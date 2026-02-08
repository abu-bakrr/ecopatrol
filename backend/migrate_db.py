from app import app, db
from sqlalchemy import text

def migrate():
    print("🔹 Запуск миграции базы данных...")
    with app.app_context():
        try:
            # Получаем движок БД
            engine = db.engine
            
            # Проверяем наличие колонки language в таблице users
            # SQL-запрос может отличаться для SQLite и Postgres, 
            # но мы можем просто попробовать добавить колонку и поймать ошибку, 
            # или использовать инспектор SQLAlchemy.
            
            from sqlalchemy import inspect
            inspector = inspect(engine)
            columns = [col['name'] for col in inspector.get_columns('users')]
            
            if 'language' not in columns:
                print("🔹 Добавляю колонку 'language' в таблицу 'users'...")
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE users ADD COLUMN language VARCHAR(10) DEFAULT 'ru'"))
                    conn.commit()
                print("✅ Миграция успешно завершена!")
            else:
                print("✅ Колонка 'language' уже существует.")
                
        except Exception as e:
            print(f"❌ Ошибка при миграции: {e}")

if __name__ == "__main__":
    migrate()
