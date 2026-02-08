import os
import telebot
from telebot import types
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv('BOT_TOKEN', 'YOUR_BOT_TOKEN')
MINI_APP_URL = os.getenv('MINI_APP_URL', 'https://your-mini-app-url.com')

bot = telebot.TeleBot(BOT_TOKEN)
ADMIN_IDS = [5644397480]

@bot.message_handler(commands=['admin'])
def admin_command(message):
    if message.from_user.id not in ADMIN_IDS:
        bot.reply_to(message, "У вас нет прав доступа к этой команде. ⛔")
        return

    markup = types.InlineKeyboardMarkup()
    # Using a query param to "authenticate" on the frontend side for now
    web_app = types.WebAppInfo(f"{MINI_APP_URL}/admin.html?admin_tg_id={message.from_user.id}")
    btn = types.InlineKeyboardButton("Открыть Админ-панель 🛠️", web_app=web_app)
    markup.add(btn)

    bot.send_message(
        message.chat.id,
        "Добро пожаловать в панель управления, Шеф! 😎\n\nЗдесь вы можете управлять пользователями и загрязнениями.",
        reply_markup=markup
    )

@bot.message_handler(commands=['start'])
def start(message):
    markup = types.InlineKeyboardMarkup(row_width=1)
    btn_uz = types.InlineKeyboardButton("🇺🇿 O'zbekcha", callback_data="lang_uz")
    btn_ru = types.InlineKeyboardButton("🇷🇺 Русский", callback_data="lang_ru")
    btn_en = types.InlineKeyboardButton("🇬🇧 English", callback_data="lang_en")
    markup.add(btn_uz, btn_ru, btn_en)
    
    bot.send_message(
        message.chat.id, 
        "Выберите язык / Tilni tanlang / Choose language:", 
        reply_markup=markup
    )

@bot.callback_query_handler(func=lambda call: call.data.startswith('lang_'))
def set_language(call):
    lang_code = call.data.split('_')[1]
    
    # Text for different languages
    welcome_messages = {
        'uz': "Salom! 👋\n\n**Eko-patrul**ga xush kelibsiz — sayyoramizni qutqarish uchun sizning vositangiz.\n\n📍 Axlatni xaritada belgilang.\n🧹 Tozalash ishlarini bajaring.\n💰 Mukofotlar oling.\n\nBoshlash uchun pastdagi tugmani bosing!",
        'ru': "Привет! 👋\n\nДобро пожаловать в **Экопатруль** — твой инструмент для спасения планеты.\n\n📍 Отмечай мусор на карте.\n🧹 Убирай загрязнения.\n💰 Получай виртуальные награды.\n\nНажми на кнопку ниже, чтобы начать!",
        'en': "Hello! 👋\n\nWelcome to **EcoPatrol** — your tool for saving the planet.\n\n📍 Mark litter on the map.\n🧹 Clean up pollutions.\n💰 Earn virtual rewards.\n\nClick the button below to start!"
    }
    
    btn_texts = {
        'uz': "Eko-patrulni ochish 🌍",
        'ru': "Открыть Экопатруль 🌍",
        'en': "Open EcoPatrol 🌍"
    }

    markup = types.InlineKeyboardMarkup()
    web_app = types.WebAppInfo(MINI_APP_URL)
    btn = types.InlineKeyboardButton(btn_texts[lang_code], web_app=web_app)
    markup.add(btn)

    bot.edit_message_text(
        welcome_messages[lang_code],
        call.message.chat.id,
        call.message.message_id,
        reply_markup=markup,
        parse_mode='Markdown'
    )
    
    # Answer callback to remove loading state
    bot.answer_callback_query(call.id)

if __name__ == '__main__':
    print("Bot is starting...")
    bot.infinity_polling()
