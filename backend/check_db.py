import sqlite3
import os

db_path = 'c:/ecopatrol/backend/instance/ecopatrol.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('PRAGMA table_info(users)')
    columns = cursor.fetchall()
    for col in columns:
        print(col)
    conn.close()
