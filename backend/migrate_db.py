from app import app, db
from sqlalchemy import text

def migrate():
    with app.app_context():
        # Add 'language' column if missing
        print("Ensuring 'language' column in 'users' table...")
        try:
            db.session.execute(text("ALTER TABLE users ADD COLUMN language VARCHAR(10) DEFAULT 'ru'"))
            db.session.commit()
            print("Column 'language' added successully.")
        except Exception as e:
            db.session.rollback()
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                print("Column 'language' already exists.")
            else:
                print(f"Error adding 'language' column: {e}")

        # cleaner_id
        print("Ensuring 'cleaner_id' column in 'pollutions' table...")
        try:
            db.session.execute(text("ALTER TABLE pollutions ADD COLUMN cleaner_id INTEGER"))
            db.session.commit()
            print("Column 'cleaner_id' added successfully.")
        except Exception as e:
            db.session.rollback()
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                print("Column 'cleaner_id' already exists.")
            else:
                print(f"Error adding 'cleaner_id' column: {e}")

        # clean_comment
        print("Ensuring 'clean_comment' column in 'pollutions' table...")
        try:
            db.session.execute(text("ALTER TABLE pollutions ADD COLUMN clean_comment TEXT"))
            db.session.commit()
            print("Column 'clean_comment' added successfully.")
        except Exception as e:
            db.session.rollback()
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                print("Column 'clean_comment' already exists.")
            else:
                print(f"Error adding 'clean_comment' column: {e}")

        print("Migration complete.")

if __name__ == "__main__":
    migrate()
