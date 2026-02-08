import sqlite3
import os

def migrate():
    db_path = os.path.join('instance', 'ecopatrol.db')
    if not os.path.exists(db_path):
        print(f"База данных не найдена по пути: {db_path}")
        return

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Проверяем, есть ли уже колонка language
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'language' not in columns:
            print("Добавляю колонку 'language' в таблицу 'users'...")
            cursor.execute("ALTER TABLE users ADD COLUMN language VARCHAR(10) DEFAULT 'ru'")
            conn.commit()
            print("✅ Миграция успешно завершена!")
        else:
            print("✅ Колонка 'language' уже существует.")
            
        conn.close()
    except Exception as e:
        print(f"❌ Ошибка при миграции: {e}")

if __name__ == "__main__":
    migrate()
