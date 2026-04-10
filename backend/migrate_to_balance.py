import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///ecopatrol.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

def migrate():
    with app.app_context():
        try:
            # Detect if 'rating' column exists in 'users' table
            # This is a generic way to rename columns in most DBs (Postgres, SQLite 3.25+, etc.)
            print(f"Connecting to database...")
            
            # Using raw SQL for the rename to avoid complex SQLAlchemy migration setups like Alembic
            # for a simple one-off change.
            print("Renaming 'rating' to 'balance' in 'users' table...")
            db.session.execute(text("ALTER TABLE users RENAME COLUMN rating TO balance;"))
            db.session.commit()
            print("Successfully migrated 'rating' to 'balance'!")
            
        except Exception as e:
            db.session.rollback()
            if "already exists" in str(e).lower() or "not found" in str(e).lower() or "does not exist" in str(e).lower():
                print(f"Migration might have already been applied or column not found: {e}")
            else:
                print(f"Migration failed: {e}")
                print("Tip: If you are using PostgreSQL, make sure your DATABASE_URL is correct in .env")

if __name__ == '__main__':
    migrate()
