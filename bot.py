import asyncio
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.types import Message

TOKEN = "8724829924:AAE8y_c810f0BJ1zm08v4DqleteOBk1rLUU"

dp = Dispatcher()

emojis = {
    "hello": ("5440431182602842059", "👋"),
    "start-eye": ("5253800186278325174", "🤩"),
    "fire": ("5463154755054349837", "🔥"),
}

def e(name):
    eid, ch = emojis[name]
    return f'<tg-emoji emoji-id="{eid}">{ch}</tg-emoji>'

@dp.message()
async def start(message: Message):
    await message.answer(f"{e('hello')} سلام! {e('start-eye')} خوش اومدی {e('fire')}")

async def main():
    bot = Bot(TOKEN, default=DefaultBotProperties(parse_mode="HTML"))
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
