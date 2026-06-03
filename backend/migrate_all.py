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
        # First ensure tables exist
        db.create_all()
        print('Tables verified/created.')

        columns_to_add = [
            ('lat', 'FLOAT'),
            ('lng', 'FLOAT'),
            ('last_seen_at', 'TIMESTAMP'),
            ('email', 'VARCHAR(150)'),
            ('password', 'VARCHAR(200)'),
            ('language', 'VARCHAR(10)')
        ]

        engine = db.engine
        with engine.connect() as conn:
            for col, typ in columns_to_add:
                try:
                    conn.execute(text(f"SELECT {col} FROM users LIMIT 1"))
                    print(f"Column '{col}' already exists.")
                except Exception:
                    # rollback the failed SELECT transaction
                    conn.rollback()
                    print(f"Adding '{col}' column to 'users' table...")
                    try:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {typ}"))
                        conn.commit()
                        print(f"Successfully added '{col}'.")
                    except Exception as e:
                        conn.rollback()
                        print(f"Error adding column '{col}': {e}")

if __name__ == "__main__":
    migrate()
