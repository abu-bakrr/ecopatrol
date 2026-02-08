from app import app, db
import os

print(f"Инициализация базы данных...")
with app.app_context():
    db.create_all()
    print("✅ Все таблицы созданы успешно!")
