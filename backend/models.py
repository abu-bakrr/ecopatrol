from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    telegram_id = db.Column(db.BigInteger, unique=True, nullable=False)
    username = db.Column(db.String(255))
    first_name = db.Column(db.String(100))
    last_name = db.Column(db.String(100))
    age = db.Column(db.Integer)
    phone = db.Column(db.String(20))
    balance = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    pollutions = db.relationship('Pollution', backref='author', lazy=True)


class Pollution(db.Model):
    __tablename__ = 'pollutions'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    level = db.Column(db.Integer, nullable=False)  # 1, 2, 3
    types = db.Column(db.JSON, nullable=False)    # ['plastic', 'trash']
    description = db.Column(db.Text)
    status = db.Column(db.String(20), default='active')  # 'active', 'cleaned'
    reward = db.Column(db.Float, default=0.0)
    clean_comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    photos = db.relationship('Photo', backref='pollution', lazy=True)

class Photo(db.Model):
    __tablename__ = 'photos'
    id = db.Column(db.Integer, primary_key=True)
    pollution_id = db.Column(db.Integer, db.ForeignKey('pollutions.id'), nullable=False)
    url = db.Column(db.String(512), nullable=False)
    type = db.Column(db.String(10), nullable=False)  # 'before', 'after'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
