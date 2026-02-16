import os
from flask import Flask
from models import db, User
from dotenv import load_dotenv
from sqlalchemy import text

load_dotenv()

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///ecopatrol.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

def migrate():
    with app.app_context():
        # Check if balance column exists
        try:
            db.session.execute(text("SELECT balance FROM users LIMIT 1"))
            print("Renaming 'balance' column to 'rating'...")
            try:
                # This works for PostgreSQL
                db.session.execute(text("ALTER TABLE users RENAME COLUMN balance TO rating"))
                db.session.commit()
                print("Successfully renamed column.")
            except Exception as e:
                db.session.rollback()
                print(f"Error renaming column: {e}")
        except Exception:
            # Check if rating column already exists
            try:
                db.session.execute(text("SELECT rating FROM users LIMIT 1"))
                print("Column 'rating' already exists.")
            except Exception as e:
                print(f"Neither 'balance' nor 'rating' columns found or other error: {e}")

if __name__ == "__main__":
    migrate()
