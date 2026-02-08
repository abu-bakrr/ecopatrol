import os
import hmac
import hashlib
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from models import db, User, Pollution, Photo

load_dotenv()

app = Flask(__name__)
# Database configuration - using SQLite for local development, can be easily changed to PostgreSQL
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///ecopatrol.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
CORS(app)

db.init_app(app)

BOT_TOKEN = os.getenv('BOT_TOKEN', 'YOUR_BOT_TOKEN')

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
    try:
        data = request.json
        tg_id = data.get('telegram_id')
        
        if not tg_id:
            return jsonify({'error': 'Missing telegram_id'}), 400
            
        user = User.query.filter_by(telegram_id=tg_id).first()
        if not user:
            user = User(
                telegram_id=tg_id,
                username=data.get('username'),
                first_name=data.get('first_name'),
                last_name=data.get('last_name'),
                age=data.get('age'),
                phone=data.get('phone'),
                language=data.get('language', 'ru')
            )
            db.session.add(user)
            db.session.commit()
        
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
                'language': user.language
            }
        })
    except Exception as e:
        print(f"Error in /api/init: {e}")
        return jsonify({'error': str(e)}), 500


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
        reward=data['level']
    )
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
    user.language = lang
    db.session.commit()
    return jsonify({'status': 'ok', 'language': user.language})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)
