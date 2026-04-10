import sqlite_utils # A handy tool if available, but let's use standard sqlite3 for compatibility
import sqlite3
import os

db_path = 'ecopatrol.db' # Local path, will be different on VPS

def migrate():
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

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
