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
    data = request.json
    # In a real app, we would validate data['initData'] here
    tg_id = data.get('telegram_id')
    username = data.get('username')
    
    user = User.query.filter_by(telegram_id=tg_id).first()
    if not user:
        user = User(telegram_id=tg_id, username=username)
        db.session.add(user)
        db.session.commit()
    
    return jsonify({
        'status': 'ok',
        'user': {
            'id': user.id,
            'telegram_id': user.telegram_id,
            'username': user.username,
            'balance': user.balance
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
        reward=data['level'] * 10  # Simple reward logic
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
    
    for photo_url in data.get('photos', []):
        new_photo = Photo(pollution_id=p.id, url=photo_url, type='after')
        db.session.add(new_photo)
    
    # Reward the cleaner (from request), not the pollution creator
    cleaner_id = data.get('user_id')
    if cleaner_id:
        cleaner = User.query.get(cleaner_id)
        if cleaner:
            cleaner.balance += p.reward
    
    db.session.commit()
    return jsonify({
        'status': 'ok', 
        'new_balance': cleaner.balance if cleaner_id and cleaner else 0
    })

@app.route('/api/profile/<int:user_id>', methods=['GET'])
def get_profile(user_id):
    user = User.query.get_or_404(user_id)
    cleaned_count = Pollution.query.filter_by(user_id=user_id, status='cleaned').count()
    return jsonify({
        'username': user.username,
        'balance': user.balance,
        'cleaned_count': cleaned_count
    })

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)
