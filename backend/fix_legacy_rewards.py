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

def fix_rewards():
    with app.app_context():
        try:
            print("Fetching current reward settings...")
            # Get reward levels from settings
            settings = {}
            res = db.session.execute(text("SELECT key, value FROM global_settings WHERE key LIKE 'reward_level_%'"))
            for row in res:
                settings[row[0]] = float(row[1])
            
            # Defaults if settings not found
            l1 = settings.get('reward_level_1', 500.0)
            l2 = settings.get('reward_level_2', 1000.0)
            l3 = settings.get('reward_level_3', 1500.0)
            
            print(f"Using reward levels: L1={l1}, L2={l2}, L3={l3}")
            
            # Update pollutions with legacy rewards (values 1, 2, 3)
            print("Updating legacy rewards in 'pollutions' table...")
            
            # Level 1
            db.session.execute(text(f"UPDATE pollutions SET reward = {l1} WHERE level = 1 AND reward <= 3;"))
            # Level 2
            db.session.execute(text(f"UPDATE pollutions SET reward = {l2} WHERE level = 2 AND reward <= 3;"))
            # Level 3
            db.session.execute(text(f"UPDATE pollutions SET reward = {l3} WHERE level = 3 AND reward <= 3;"))
            
            db.session.commit()
            print("Successfully updated legacy rewards!")
            
        except Exception as e:
            db.session.rollback()
            print(f"Update failed: {e}")

if __name__ == '__main__':
    fix_rewards()
