import sqlite3
import os

# Possible database paths (Check current and instance folder)
DB_PATHS = [
    'ecopatrol.db',
    'instance/ecopatrol.db',
    '/root/eco-app/backend/instance/ecopatrol.db',
    '/root/eco-app/backend/ecopatrol.db'
]

def migrate():
    db_path = None
    for p in DB_PATHS:
        if os.path.exists(p):
            db_path = p
            break
    
    if not db_path:
        print(f"Database not found in checked paths: {DB_PATHS}")
        return

    print(f"Using database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if 'rating' exists in 'users'
        cursor.execute("PRAGMA table_info(users)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'rating' in columns and 'balance' not in columns:
            print("Renaming 'rating' to 'balance' in 'users' table...")
            cursor.execute("ALTER TABLE users RENAME COLUMN rating TO balance")
            print("Done!")
        elif 'balance' in columns:
            print("'balance' column already exists.")
        else:
            print("'rating' column not found, maybe already migrated or table structure is different.")

    except Exception as e:
        print(f"Migration failed: {e}")
    finally:
        conn.commit()
        conn.close()

if __name__ == '__main__':
    migrate()
