import os
from flask import Flask
from models import db
from dotenv import load_dotenv
from sqlalchemy import text

load_dotenv()

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///ecopatrol.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

def migrate():
    with app.app_context():
        columns = [
            ("lat", "FLOAT"),
            ("lng", "FLOAT"),
            ("last_seen_at", "DATETIME"),
        ]
        for col_name, col_type in columns:
            try:
                db.session.execute(text(f"SELECT {col_name} FROM users LIMIT 1"))
                print(f"Column '{col_name}' already exists.")
            except Exception:
                print(f"Adding '{col_name}' column to 'users' table...")
                try:
                    db.session.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                    db.session.commit()
                    print(f"Successfully added '{col_name}' column.")
                except Exception as e:
                    db.session.rollback()
                    print(f"Error adding column '{col_name}': {e}")

if __name__ == "__main__":
    migrate()
