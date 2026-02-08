import os
from flask import Flask
from models import db, User
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///ecopatrol.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

def migrate():
    with app.app_context():
        # Check if language column exists
        try:
            from sqlalchemy import text
            db.session.execute(text("SELECT language FROM users LIMIT 1"))
            print("Column 'language' already exists.")
        except Exception:
            print("Adding 'language' column to 'users' table...")
            try:
                # This works for both SQLite and PostgreSQL
                db.session.execute(text("ALTER TABLE users ADD COLUMN language VARCHAR(10) DEFAULT 'ru'"))
                db.session.commit()
                print("Successfully added 'language' column.")
            except Exception as e:
                db.session.rollback()
                print(f"Error adding column: {e}")

if __name__ == "__main__":
    migrate()
