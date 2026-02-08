import os
import hmac
import hashlib
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from models import db, User, Pollution, Photo, GlobalSetting

load_dotenv()

app = Flask(__name__)
# Database configuration - using SQLite for local development, can be easily changed to PostgreSQL
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///ecopatrol.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
CORS(app)

db.init_app(app)

BOT_TOKEN = os.getenv('BOT_TOKEN', 'YOUR_BOT_TOKEN')
ADMIN_IDS = [5644397480] # The user's ID

def validate_telegram_data(init_data):
    """Validates data received from Telegram Mini App."""
    if not init_data:
        return False
    
    # Logic for validating initData using HMAC-SHA256
    # For MVP, we might skip strict validation if user wants to test quickly,
    # but we should implement it for security.
    return True # Placeholder for actual validation

@app.route('/api/init', methods=['POST'])
def init_user():
    data = request.json or {}
    tg_id = data.get('telegram_id')
    print(f"--- INIT USER ATTEMPT --- tg_id: {tg_id}")
    
    try:
        user = User.query.filter_by(telegram_id=tg_id).first()
        print(f"Found user: {bool(user)}")
    except Exception as e:
        print(f"Database query error: {e}")
        return jsonify({'status': 'error', 'message': f'Database error: {e}'}), 500

    if not user:
        print(f"Creating new user: {tg_id}")
        try:
            user = User(
                telegram_id=tg_id,
                username=data.get('username'),
                first_name=data.get('first_name'),
                last_name=data.get('last_name'),
                age=data.get('age'),
                phone=data.get('phone')
            )
            db.session.add(user)
            db.session.commit()
            print("User created successfully")
        except Exception as e:
            db.session.rollback()
            print(f"User creation error: {e}")
            return jsonify({'status': 'error', 'message': f'Creation failed: {e}'}), 500
    
    # Safely get language to avoid 500 if column is missing
    user_lang = 'ru'
    try:
        user_lang = getattr(user, 'language', 'ru')
    except Exception:
        pass

    print(f"--- INIT API RESPONSE --- user_id: {user.id}, lang: {user_lang}")
    return jsonify({
        'status': 'ok',
        'user': {
            'id': user.id,
            'telegram_id': user.telegram_id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'age': user.age,
            'phone': user.phone,
            'balance': user.balance,
            'language': user_lang
        }
    })


@app.route('/api/pollutions', methods=['GET'])
def get_pollutions():
    # Bounds could be passed as query params for optimization
    pollutions = Pollution.query.filter_by(status='active').all()
    result = []
    for p in pollutions:
        result.append({
            'id': p.id,
            'lat': p.lat,
            'lng': p.lng,
            'level': p.level,
            'types': p.types,
            'description': p.description,
            'status': p.status,
            'photos': [ph.url for ph in p.photos if ph.type == 'before']
        })
    return jsonify(result)

@app.route('/api/pollutions', methods=['POST'])
def create_pollution():
    data = request.json
    # user_id should ideally come from validated token
    new_p = Pollution(
        user_id=data['user_id'],
        lat=data['lat'],
        lng=data['lng'],
        level=data['level'],
        types=data['types'],
        description=data.get('description', ''),
    )
    
    # Get reward from settings or default to level
    reward_setting = GlobalSetting.query.filter_by(key=f'reward_level_{data["level"]}').first()
    new_p.reward = float(reward_setting.value) if reward_setting else float(data['level'])
    
    db.session.add(new_p)
    db.session.flush() # Get ID
    
    for photo_url in data.get('photos', []):
        new_photo = Photo(pollution_id=new_p.id, url=photo_url, type='before')
        db.session.add(new_photo)
    
    db.session.commit()
    return jsonify({'status': 'ok', 'id': new_p.id})

@app.route('/api/pollutions/<int:p_id>/clean', methods=['POST'])
def clean_pollution(p_id):
    data = request.json
    p = Pollution.query.get_or_404(p_id)
    if p.status == 'cleaned':
        return jsonify({'error': 'Already cleaned'}), 400
    
    p.status = 'cleaned'
    p.clean_comment = data.get('comment', '')
    
    # Reward the cleaner (from request), not the pollution creator
    cleaner_id = data.get('user_id')
    if cleaner_id:
        p.cleaner_id = cleaner_id # Save who cleaned it
        cleaner = User.query.get(cleaner_id)
        if cleaner:
            cleaner.balance += p.reward
    
    for photo_url in data.get('photos', []):
        new_photo = Photo(pollution_id=p.id, url=photo_url, type='after')
        db.session.add(new_photo)
    
    db.session.commit()
    return jsonify({
        'status': 'ok', 
        'new_balance': cleaner.balance if cleaner_id and cleaner else 0
    })

@app.route('/api/history/user/<int:user_id>', methods=['GET'])
def get_user_history(user_id):
    # Get all pollutions where this user was the cleaner
    history = Pollution.query.filter_by(cleaner_id=user_id, status='cleaned').order_by(Pollution.created_at.desc()).all()
    result = []
    for p in history:
        result.append({
            'id': p.id,
            'reward': p.reward,
            'description': p.description,
            'clean_comment': p.clean_comment,
            'date': p.created_at.isoformat(),
            'photos': [ph.url for ph in p.photos if ph.type == 'after']
        })
    return jsonify(result)

@app.route('/api/pollutions/user/<int:user_id>', methods=['GET'])
def get_user_pollutions(user_id):
    pollutions = Pollution.query.filter_by(user_id=user_id).order_by(Pollution.created_at.desc()).all()
    result = []
    for p in pollutions:
        result.append({
            'id': p.id,
            'lat': p.lat,
            'lng': p.lng,
            'level': p.level,
            'types': p.types,
            'description': p.description,
            'status': p.status,
            'created_at': p.created_at.isoformat(),
            'photos': [ph.url for ph in p.photos if ph.type == 'before']
        })
    return jsonify(result)

@app.route('/api/profile/<int:user_id>', methods=['GET'])
def get_profile(user_id):
    user = User.query.get_or_404(user_id)
    cleaned_count = Pollution.query.filter_by(user_id=user_id, status='cleaned').count()
    return jsonify({
        'username': user.username,
        'balance': user.balance,
        'cleaned_count': cleaned_count,
        'language': user.language
    })

@app.route('/api/profile/<int:user_id>/language', methods=['POST'])
def update_language(user_id):
    data = request.json
    lang = data.get('language')
    if lang not in ['uz', 'ru', 'en']:
        return jsonify({'error': 'Invalid language'}), 400
    
    user = User.query.get_or_404(user_id)
    try:
        user.language = lang
        db.session.commit()
        return jsonify({'status': 'ok', 'language': user.language})
    except Exception as e:
        db.session.rollback()
        print(f"Error updating language: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        user_count = User.query.count()
        return jsonify({
            'status': 'ok',
            'db': 'connected',
            'users': user_count,
            'environment': 'vps' if 'postgresql' in app.config['SQLALCHEMY_DATABASE_URI'] else 'local'
        })
    except Exception as e:
        return jsonify({'status': 'error', 'db': str(e)}), 500

# --- ADMIN & LEADERBOARD ENDPOINTS ---

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    # Fetch top 10 users by balance (as a proxy for activity/impact)
    # In the future, we could add a dedicated 'impact_score' or use cleaned_count
    # Since we don't have a direct 'cleaned_count' column, we use balance
    users = User.query.order_by(User.balance.desc()).limit(10).all()
    result = []
    for u in users:
        # Calculate cleaned count for each top user
        cleaned_count = Pollution.query.filter_by(cleaner_id=u.id, status='cleaned').count()
        result.append({
            'username': u.username or f"User {u.id}",
            'first_name': u.first_name,
            'balance': u.balance,
            'cleaned_count': cleaned_count
        })
    return jsonify(result)

@app.route('/api/admin/users', methods=['GET'])
def admin_get_users():
    tg_id = request.args.get('admin_tg_id', type=int)
    if tg_id not in ADMIN_IDS:
        return jsonify({'error': 'Unauthorized'}), 403
    
    users = User.query.all()
    result = []
    for u in users:
        result.append({
            'id': u.id,
            'telegram_id': u.telegram_id,
            'username': u.username,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'balance': u.balance,
            'phone': u.phone,
            'age': u.age,
            'created_at': u.created_at.isoformat()
        })
    return jsonify(result)

@app.route('/api/admin/users/<int:user_id>/balance', methods=['POST'])
def admin_update_balance(user_id):
    data = request.json
    try:
        tg_id = int(data.get('admin_tg_id'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid admin ID format'}), 400
        
    if tg_id not in ADMIN_IDS:
        return jsonify({'error': 'Unauthorized'}), 403
    
    user = User.query.get_or_404(user_id)
    try:
        user.balance = float(data.get('balance', user.balance))
        db.session.commit()
        return jsonify({'status': 'ok', 'new_balance': user.balance})
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/admin/pollutions', methods=['GET'])
def admin_get_pollutions():
    tg_id = request.args.get('admin_tg_id', type=int)
    if tg_id not in ADMIN_IDS:
        return jsonify({'error': 'Unauthorized'}), 403
    
    pollutions = Pollution.query.all()
    result = []
    for p in pollutions:
        result.append({
            'id': p.id,
            'lat': p.lat,
            'lng': p.lng,
            'level': p.level,
            'status': p.status,
            'description': p.description,
            'creator_id': p.user_id,
            'cleaner_id': p.cleaner_id,
            'photos': [ph.url for ph in p.photos],
            'types': p.types,
            'reward': p.reward
        })
    return jsonify(result)

@app.route('/api/admin/pollutions/<int:p_id>', methods=['DELETE'])
def admin_delete_pollution(p_id):
    tg_id = request.args.get('admin_tg_id', type=int)
    if tg_id not in ADMIN_IDS:
        return jsonify({'error': 'Unauthorized'}), 403
    
    p = Pollution.query.get_or_404(p_id)
    try:
        # Delete related photos first
        Photo.query.filter_by(pollution_id=p.id).delete()
        db.session.delete(p)
        db.session.commit()
        return jsonify({'status': 'ok'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/admin/pollutions/<int:p_id>/reward', methods=['POST'])
def admin_update_reward(p_id):
    data = request.json
    try:
        tg_id = int(data.get('admin_tg_id'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid admin ID format'}), 400
        
    if tg_id not in ADMIN_IDS:
        return jsonify({'error': 'Unauthorized'}), 403
    
    p = Pollution.query.get_or_404(p_id)
    try:
        p.reward = float(data.get('reward', p.reward))
        db.session.commit()
        return jsonify({'status': 'ok', 'new_reward': p.reward})
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/admin/settings', methods=['GET'])
def admin_get_settings():
    tg_id = request.args.get('admin_tg_id', type=int)
    if tg_id not in ADMIN_IDS:
        return jsonify({'error': 'Unauthorized'}), 403
    
    settings = GlobalSetting.query.all()
    result = {s.key: s.value for s in settings}
    # Ensure defaults exist in response if not in DB
    for i in range(1, 4):
        key = f'reward_level_{i}'
        if key not in result:
            result[key] = str(float(i))
    return jsonify(result)

@app.route('/api/admin/settings', methods=['POST'])
def admin_update_settings():
    data = request.json
    try:
        tg_id = int(data.get('admin_tg_id'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid admin ID format'}), 400
        
    if tg_id not in ADMIN_IDS:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        new_settings = data.get('settings', {})
        for key, value in new_settings.items():
            setting = GlobalSetting.query.filter_by(key=key).first()
            if setting:
                setting.value = str(value)
            else:
                setting = GlobalSetting(key=key, value=str(value))
                db.session.add(setting)
        db.session.commit()
        return jsonify({'status': 'ok'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)
