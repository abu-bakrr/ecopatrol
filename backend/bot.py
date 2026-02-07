import os
import telebot
from telebot import types
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv('BOT_TOKEN', 'YOUR_BOT_TOKEN')
MINI_APP_URL = os.getenv('MINI_APP_URL', 'https://your-mini-app-url.com')

bot = telebot.TeleBot(BOT_TOKEN)

@bot.message_handler(commands=['start'])
def start(message):
    markup = types.InlineKeyboardMarkup()
    # Mini App button
    web_app = types.WebAppInfo(MINI_APP_URL)
    btn = types.InlineKeyboardButton("Открыть Экопатруль 🌍", web_app=web_app)
    markup.add(btn)
    
    welcome_text = (
        f"Привет, {message.from_user.first_name}! 👋\n\n"
        "Добро пожаловать в **Экопатруль** — твой инструмент для спасения планеты.\n\n"
        "📍 Отмечай мусор на карте.\n"
        "🧹 Убирай загрязнения.\n"
        "💰 Получай виртуальные награды.\n\n"
        "Нажми на кнопку ниже, чтобы начать!"
    )
    
    bot.send_message(message.chat.id, welcome_text, reply_markup=markup, parse_mode='Markdown')

if __name__ == '__main__':
    print("Bot is starting...")
    bot.infinity_polling()
