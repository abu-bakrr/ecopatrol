import sqlite3
import os

db_path = os.path.join('instance', 'ecopatrol.db')
print(f"Checking database at: {os.path.abspath(db_path)}")

if not os.path.exists(db_path):
    print("Database file does not exist!")
else:
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print(f"Tables found: {tables}")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")
