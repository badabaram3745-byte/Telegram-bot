# -*- coding: utf-8 -*-
"""
ربات فروش VPN (پروکسیوم)
نیازمند: python-telegram-bot >= 22.7  (پشتیبانی از دکمه رنگی style و icon_custom_emoji_id)
"""
import os, re, io, json, time, uuid, html, secrets, sqlite3, logging, datetime as dt
import httpx
import asyncio, hmac, hashlib, base64, urllib.parse  # ➕
from telegram import (Update, InlineKeyboardButton as IKB, InlineKeyboardMarkup as IKM,
                      ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove)
from telegram.constants import ParseMode
from telegram.ext import (Application, CommandHandler, CallbackQueryHandler, MessageHandler,
                          ContextTypes, filters)
try:
    import jdatetime
except ImportError:
    jdatetime = None
try:
    import qrcode
except ImportError:
    qrcode = None

# ───────────────────────── تنظیمات اصلی ─────────────────────────
BOT_TOKEN = os.getenv("BOT_TOKEN", "PUT_YOUR_TOKEN_HERE")
ADMIN_IDS = {int(x) for x in os.getenv("ADMIN_IDS", "123456789").replace(" ", "").split(",") if x}
# ➕ ادمین اصلی (فقط او می‌تواند ادمین اضافه/حذف کند)
MAIN_ADMIN_ID = 7363962357
ENV_ADMIN_IDS = set(ADMIN_IDS)  # ادمین‌های داخل تنظیمات هم ادمین اصلی حساب می‌شوند
ADMIN_IDS.add(MAIN_ADMIN_ID)
BOT_NAME = os.getenv("BOT_NAME", "پروکسیوم")
DB_PATH = os.getenv("DB_PATH", "bot.db")
RTL = os.getenv("RTL_BUTTONS", "1") == "1"      # دکمه اول هر ردیف سمت راست باشد
USER_PREFIX = os.getenv("USER_PREFIX", "px")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("bot")

GREEN, RED, BLUE = "success", "danger", "primary"
# ➕ رنگ جداگانه برای هر دکمه (از پنل مدیریت > رنگ دکمه‌ها)
BTN_COLOR_MODES = {"orig": ("رنگ اورجینال", None), "green": ("سبز", GREEN), "red": ("قرمز", RED),
                   "blue": ("آبی", BLUE), "none": ("بی‌رنگ", None)}
BTN_GROUPS = {"pl": "دکمه‌های مدت (ماهه)", "bp": "دکمه‌های ردیف پلن (حجم/روز/قیمت)", "ta": "دکمه‌های مبلغ شارژ",
              "sv": "لیست اشتراک‌های کاربر", "inv": "دکمه‌های لوکیشن", "pv": "لیست پنل‌ها (ادمین)",
              "plv": "لیست پلن‌ها (ادمین)", "set": "دکمه‌های تنظیمات (ادمین)", "tg": "دکمه‌های روشن/خاموش (ادمین)",
              "pn": "نوع پنل (ادمین)", "soon": "پنل‌های به‌زودی", "tx": "لیست متن‌ها (ادمین)",
              "em": "لیست ایموجی‌ها (ادمین)", "noop": "عنوان‌ها و برچسب‌های صفحه", "url": "دکمه‌های لینک"}
try:
    _SRC = open(os.path.abspath(__file__), encoding="utf-8").read()
except Exception:
    _SRC = ""
BTN_NAMES = sorted(set(re.findall(r'btn\("([^"{]+)"', _SRC))) + list(dict.fromkeys(BTN_GROUPS.values()))

def color_key(text, data=None, url=None):
    if text in BTN_NAMES[:len(BTN_NAMES) - len(BTN_GROUPS)]: return text
    if url: return BTN_GROUPS["url"]
    pre = (data or "noop").split(":")[0]
    return BTN_GROUPS.get(pre, BTN_GROUPS["noop"])

# ───────────────────────── ایموجی‌ها (پریمیوم + جایگزین) ─────────────────────────
# آیدی ایموجی پریمیوم هر کلید از داخل پنل ادمین > ایموجی‌های پریمیوم ست می‌شود
EMOJI = {
    "bot": "⚡️", "fire": "♨️", "hello": "👋", "buy": "🛍", "subs": "✅", "wallet": "🤑",
    "test": "🆓", "support": "💬", "channel": "📣", "account": "👤", "more": "😎",
    "admin": "🛠", "back": "🔙", "m1": "1️⃣", "m3": "3️⃣", "m6": "6️⃣", "m12": "🔟",
    "all": "🔥", "suggest": "🤔", "gift": "🎁", "price": "💲", "volume": "🟢", "time": "⏳",
    "shop": "🏪", "card": "💳", "ok": "✅", "no": "❌", "panel": "🔌", "plan": "📦",
    "ban": "🚫", "unban": "♻️", "text": "✏️", "stats": "📊", "search": "🔎", "bridge": "🌉",
    "bc": "📢", "pin": "📍", "point": "👇", "link": "🔗", "qr": "🔳", "addbal": "➕",
    "subbal": "➖", "emoji": "😀", "settings": "⚙️", "help": "📖", "rules": "📜",
    "ref": "🤝", "phone": "📱", "chest": "🧰", "bag": "🛍",
    "ip": "📍", "usage": "📊", "mysettings": "⚙️", "remind": "🔔", "transfer": "🔁", "ipbox": "🛡",  # ➕
}

# ───────────────────────── متن‌های قابل ویرایش ─────────────────────────
# متغیرها: {BOT} {USER} {ID} {BALANCE} {PRICE} {GB} {DAYS} {LINK} {SERVICES} {DATE} ...
# ایموجی پریمیوم داخل متن: {E:کلید}  مثل {E:bot}
TEXTS = {
    "start": ("استارت",
        "{E:fire} <b>{BOT}</b> {E:bot}\n"
        "سلام <b>{USER}</b> عزیز {E:hello}\n"
        "به پنل مدیریت سرویس‌های VPN خوش آمدید.\n\n"
        "<blockquote>{E:card} موجودی کیف پول: <b>{BALANCE}</b> تومان\n"
        "{E:plan} سرویس‌های فعال: <b>{SERVICES}</b> سرویس\n"
        "🆔 شناسه کاربری: <code>{ID}</code>\n"
        "🕒 آخرین ورود: {DATE}</blockquote>\n\n"
        "<b>یکی از گزینه‌های منو را انتخاب کنید</b> {E:point}"),
    "buy_intro": ("انتخاب مدت",
        "{E:pin} <b>مدت سرویس را انتخاب کن</b>\n\n"
        "بسته‌ها را مقایسه کنید و از کلیدهای زیر، مدت دلخواه را انتخاب کنید. "
        "قیمت دقیق هر بسته پس از انتخاب مدت نمایش داده می‌شود."),
    "plans": ("لیست پلن‌ها",
        "{E:bag} لطفاً سرویس خود را انتخاب کنید.\n\n{E:chest} موجودی فعلی شما: <b>{BALANCE}</b> تومان"),
    "invoice": ("فاکتور",
        "🧾 <b>فاکتور خرید</b>\n<blockquote>{E:volume} حجم: <b>{GB} گیگ</b>\n{E:time} مدت: <b>{DAYS} روز</b>\n"
        "📍 لوکیشن: <b>{LOCATION}</b>\n{E:price} مبلغ: <b>{PRICE}</b> تومان\n"
        "{E:card} موجودی شما: <b>{BALANCE}</b> تومان</blockquote>\n\nبرای پرداخت روی دکمه زیر بزنید."),
    "delivery": ("تحویل سرویس",
        "{E:ok} <b>سرویس شما با موفقیت ساخته شد</b>\n<blockquote>👤 نام سرویس: <code>{NAME}</code>\n"
        "{E:volume} حجم: {GB} گیگ\n{E:time} مدت: {DAYS} روز\n{E:price} مبلغ: {PRICE} تومان</blockquote>\n\n"
        "{E:link} لینک اتصال:\n<code>{LINK}</code>"),
    "account": ("حساب کاربری / کیف پول",
        "{E:account} <b>حساب کاربری</b>\n<blockquote>🆔 شناسه کاربری: <code>{ID}</code>\n"
        "👤 نام: <b>{USER}</b>\n{E:phone} شماره تماس: {PHONE}\n👥 گروه کاربری: <b>{GROUP}</b>\n"
        "🕒 زمان ثبت‌نام: {JOINED}\n🎟 کد معرف: <code>{REF}</code></blockquote>\n\n"
        "<b>خلاصه فعالیت حساب</b>\n<blockquote>{E:wallet} موجودی کیف پول: <b>{BALANCE}</b> تومان\n"
        "🛒 سرویس‌های خریداری‌شده: <b>{SERVICES}</b> عدد\n🧾 فاکتورهای پرداخت‌شده: <b>{INVOICES}</b> عدد\n"
        "{E:ref} زیرمجموعه‌ها: <b>{REFS}</b> نفر</blockquote>\n\n🕒 آخرین مشاهده: {DATE}"),
    "topup": ("افزایش موجودی", "{E:wallet} <b>افزایش موجودی</b>\n\nمبلغ مورد نظر را انتخاب کنید یا مبلغ دلخواه وارد کنید."),
    "topup_card": ("کارت به کارت",
        "{E:card} <b>پرداخت کارت به کارت</b>\n<blockquote>مبلغ: <b>{PRICE}</b> تومان\n"
        "شماره کارت: <code>{CARD}</code>\nبه نام: <b>{OWNER}</b></blockquote>\n\n"
        "بعد از واریز، <b>عکس رسید</b> را همین‌جا ارسال کنید."),
    "receipt_wait": ("رسید دریافت شد", "{E:ok} رسید شما دریافت شد و پس از بررسی ادمین، موجودی شارژ می‌شود."),
    "gift": ("شارژ ویژه با هدیه",
        "{E:gift} <b>شارژ ویژه با هدیه</b>\n\nبا شارژ <b>{MIN}</b> تومان یا بیشتر، <b>{PERCENT}%</b> "
        "هدیه روی موجودی‌تان دریافت کنید!"),
    "help": ("راهنما", "{E:help} <b>راهنما</b>\n\n۱. از «خرید اشتراک» مدت و حجم را انتخاب کنید.\n"
        "۲. لینک را در اپ v2rayNG / Streisand / Hiddify وارد کنید.\n۳. در صورت مشکل به پشتیبانی پیام دهید."),
    "rules": ("قوانین", "{E:rules} <b>قوانین</b>\n\n• استفاده هم‌زمان بیش از حد مجاز ممنوع است.\n"
        "• هزینه پس از تحویل سرویس قابل بازگشت نیست."),
    "test_delivery": ("تحویل اکانت تست",
        "{E:test} <b>اکانت تست رایگان شما آماده است</b>\n<blockquote>{E:volume} حجم: {GB} گیگ\n"
        "{E:time} مدت: {DAYS} روز</blockquote>\n\n{E:link} لینک:\n<code>{LINK}</code>"),
    "test_mid": ("یادآوری میان‌دوره تست",
        "سلام {USER} {E:hello}\nاز اکانت تست راضی بودی؟ نصف زمان تستت گذشته؛ برای ادامه همین الان سرویس بخر {E:fire}"),
    "test_end": ("پایان تست", "⌛️ اکانت تست شما تمام شد. با خرید اشتراک، بدون قطعی ادامه بده {E:bot}"),
    "expire_soon": ("یادآوری انقضا", "⏰ سرویس <code>{NAME}</code> کمتر از ۲۴ ساعت دیگر منقضی می‌شود."),
    "banned": ("کاربر مسدود", "🚫 حساب شما مسدود شده است."),
    "no_balance": ("موجودی ناکافی", "{E:no} موجودی کافی نیست. مبلغ: {PRICE} | موجودی: {BALANCE} تومان"),
    "subs_empty": ("بدون اشتراک", "شما هنوز اشتراکی ندارید. از «خرید اشتراک» شروع کنید {E:buy}"),
    "more": ("سایر امکانات", "{E:more} <b>سایر امکانات</b>"),
    "ref": ("زیرمجموعه‌گیری", "{E:ref} <b>زیرمجموعه‌گیری</b>\n\nبا لینک زیر دوستانت را دعوت کن و از هر شارژشان "
        "<b>{PERCENT}%</b> هدیه بگیر:\n<code>{LINK}</code>"),
    # ➕ اطلاعات IP
    "ip_intro": ("اطلاعات IP من",
        "{E:ip} <b>اطلاعات IP من</b>\n\n📍 با بازکردن دکمه زیر، IP عمومی اتصال فعلی شما بررسی می‌شود و نتیجه "
        "داخل همین ربات ارسال خواهد شد.\n\n<blockquote>⚠️ توجه! اطلاعات IP در دیتابیس ربات ذخیره نمی‌شود. "
        "برای تشخیص موقعیت تقریبی و اپراتور، IP به سرویس ipwho.is ارسال می‌شود!</blockquote>"),
    "ip_result": ("نتیجه اطلاعات IP",
        "{E:ipbox} <b>اطلاعات IP فعلی شما</b>\n\n<blockquote>✅ آدرس IP: <code>{IP}</code>\n⚠️ نسخه: <b>{VER}</b>\n"
        "{FLAG} کشور: <b>{COUNTRY}</b>\n🌙 استان/منطقه: <b>{REGION}</b>\n⚪️ شهر: <b>{CITY}</b>\n"
        "📡 اپراتور/سازمان: <b>{ISP}</b>\n🔢 شماره ASN: <code>{ASN}</code>\n🕒 منطقه زمانی: <b>{TZ}</b></blockquote>\n\n"
        "<blockquote>🟩 موقعیت نمایش‌داده‌شده تقریبی است و براساس IP محاسبه می‌شود.</blockquote>"),
}

DEFAULT_SETTINGS = {
    "card_number": "6037-0000-0000-0000", "card_owner": "نام صاحب کارت",
    "test_enabled": "1", "test_gb": "1", "test_days": "1", "test_panel": "",
    "gift_min": "500000", "gift_percent": "10", "ref_percent": "5",
    "support_url": "https://t.me/telegram", "channel_url": "https://t.me/telegram",
    "premium_on": "1", "bridge_url": "", "start_sticker": "", "suggest_plan": "",
    "extra_admins": "",
}
SETTING_TITLES = {
    "card_number": "شماره کارت", "card_owner": "نام صاحب کارت", "test_gb": "حجم تست (گیگ)",
    "test_days": "مدت تست (روز)", "test_panel": "آیدی پنل تست", "gift_min": "حداقل شارژ هدیه",
    "gift_percent": "درصد هدیه", "ref_percent": "درصد زیرمجموعه", "support_url": "لینک پشتیبانی",
    "channel_url": "لینک کانال", "bridge_url": "آدرس پل (پروکسی هسته واسط)",
    "start_sticker": "استیکر استارت (استیکر بفرست)", "suggest_plan": "آیدی پلن پیشنهادی",
}
# ➕ آدرس عمومی سرور اطلاعات IP
DEFAULT_SETTINGS["ip_web_url"] = ""
SETTING_TITLES["ip_web_url"] = "آدرس سرور اطلاعات IP (مثل https://ip.domain.com یا http://IP:8088)"
IP_WEB_HOST = os.getenv("IP_WEB_HOST", "0.0.0.0")
IP_WEB_PORT = int(os.getenv("IP_WEB_PORT", "8088"))
IP_TRUST_PROXY = os.getenv("IP_TRUST_PROXY", "0") == "1"   # اگر پشت nginx/Cloudflare هستی 1 بگذار
BOT_REF = {"bot": None, "username": "", "srv": None, "last": {}}

PANEL_TYPES = [("marzban", "مرزبان"), ("marzneshin", "مرزنشین"), ("pasarguard", "پاسارگارد"),
               ("sanaei", "ثنایی / 3x-UI"), ("alireza", "علیرضا"), ("xui", "X-UI عمومی"),
               ("manual", "فروش دستی")]
SOON_PANELS = ["هیدیفای", "Guard", "WGDashboard", "s-ui", "IBSNG", "میکروتیک"]
XUI_PREFIX = {"sanaei": "/panel/api/inbounds", "alireza": "/xui/API/inbounds", "xui": "/xui/API/inbounds"}
EXTRA_HINT = {
    "marzban": "پروکسی‌ها به صورت JSON مثل {\"vless\":{}} (یا - برای پیش‌فرض)",
    "pasarguard": "آیدی گروه‌ها با کاما مثل 1,2",
    "marzneshin": "آیدی سرویس‌ها با کاما مثل 1,2",
    "sanaei": "آیدی اینباند|آدرس ساب|آدرس سرور  مثل  1|https://sub.domain.com:2096/sub  (فقط آیدی اینباند هم کافی است، بقیه خودکار)",
    "alireza": "آیدی اینباند|آدرس ساب", "xui": "آیدی اینباند|آدرس ساب",
}

# ───────────────────────── دیتابیس ─────────────────────────
CON = sqlite3.connect(DB_PATH, check_same_thread=False)
CON.row_factory = sqlite3.Row

def q(sql, args=(), one=False):
    rows = CON.execute(sql, args).fetchall()
    return (rows[0] if rows else None) if one else rows

def ex(sql, args=()):
    cur = CON.execute(sql, args); CON.commit(); return cur.lastrowid

def init_db():
    CON.executescript("""
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT, username TEXT, phone TEXT,
        balance INTEGER DEFAULT 0, banned INTEGER DEFAULT 0, grp TEXT DEFAULT 'عادی', created INTEGER,
        last_seen INTEGER, ref_by INTEGER, test_used INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS plans(id INTEGER PRIMARY KEY AUTOINCREMENT, months INTEGER, gb INTEGER,
        days INTEGER, price INTEGER, active INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS panels(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, ptype TEXT, url TEXT,
        user TEXT, password TEXT, extra TEXT, active INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS services(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, plan_id INTEGER,
        panel_id INTEGER, username TEXT, link TEXT, sub TEXT, gb INTEGER, days INTEGER, price INTEGER,
        created INTEGER, expire INTEGER, is_test INTEGER DEFAULT 0, mid_sent INTEGER DEFAULT 0,
        end_sent INTEGER DEFAULT 0, status TEXT DEFAULT 'active');
    CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, amount INTEGER,
        bonus INTEGER DEFAULT 0, photo TEXT, status TEXT DEFAULT 'pending', created INTEGER);
    CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT);
    """)
    for k, v in DEFAULT_SETTINGS.items():
        ex("INSERT OR IGNORE INTO settings(k,v) VALUES(?,?)", (k, v))
    if not q("SELECT 1 FROM plans LIMIT 1"):
        for m, gb, d, p in [(1, 30, 30, 55000), (1, 50, 30, 82500), (1, 100, 30, 165000), (1, 150, 30, 247500),
                            (3, 100, 90, 222750), (3, 150, 90, 334125), (3, 200, 90, 445500),
                            (6, 25, 180, 74250), (6, 50, 180, 148500), (6, 100, 180, 297000)]:
            ex("INSERT INTO plans(months,gb,days,price) VALUES(?,?,?,?)", (m, gb, d, p))

def S(k):
    r = q("SELECT v FROM settings WHERE k=?", (k,), True)
    return r["v"] if r else DEFAULT_SETTINGS.get(k, "")

def set_S(k, v):
    ex("INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", (k, str(v)))

def get_user(uid):
    return q("SELECT * FROM users WHERE id=?", (uid,), True)

# ───────────────────────── ابزارها ─────────────────────────
def money(n): return f"{int(n):,}"

def jdate(ts=None):
    ts = ts or time.time()
    if jdatetime:
        return jdatetime.datetime.fromtimestamp(ts).strftime("%Y/%m/%d - %H:%M")
    return dt.datetime.fromtimestamp(ts).strftime("%Y/%m/%d - %H:%M")

def emoji_id(key):
    if S("premium_on") != "1": return None
    return S("emoji:" + key) or None

def E(key):
    fb = EMOJI.get(key, "")
    eid = emoji_id(key)
    if eid: fb = S("emoji_fb:" + key) or fb  # ➕ ایموجی اصلی همان ایموجی پریمیوم
    return f'<tg-emoji emoji-id="{eid}">{fb or "⭐️"}</tg-emoji>' if eid else fb

def render(key, **kw):
    t = S("text:" + key) or TEXTS[key][1]
    kw.setdefault("BOT", html.escape(BOT_NAME))
    for k, v in kw.items():
        t = t.replace("{" + k + "}", str(v))
    return re.sub(r"\{E:(\w+)\}", lambda m: E(m.group(1)), t)

def btn(text, data=None, style=None, ek=None, url=None):
    """دکمه رنگی + ایموجی پریمیوم. اگر آیدی ایموجی ست نشده باشد، ایموجی معمولی کنار متن می‌آید."""
    kw = {}
    if style: kw["style"] = style
    _c = S("color:" + color_key(text, data, url))  # ➕ رنگ اختصاصی همین دکمه
    if _c == "none": kw.pop("style", None)
    elif BTN_COLOR_MODES.get(_c, (0, None))[1]: kw["style"] = BTN_COLOR_MODES[_c][1]
    eid = emoji_id(ek) if ek else None
    if eid: kw["icon_custom_emoji_id"] = eid
    label = text if (eid or not ek) else f"{text} {EMOJI.get(ek, '')}".strip()
    try:
        if url: return IKB(label, url=url, **kw)
        return IKB(label, callback_data=data or "noop", **kw)
    except TypeError:  # ➕ نسخه قدیمی‌تر کتابخانه: ارسال مستقیم فیلدها به API
        if url: return IKB(label, url=url, api_kwargs=kw)
        return IKB(label, callback_data=data or "noop", api_kwargs=kw)

def row(*b):
    b = [x for x in b if x is not None]
    return list(reversed(b)) if RTL else b

def is_admin(uid): return uid in ADMIN_IDS

# ➕ مدیریت ادمین‌ها
def is_main_admin(uid): return uid == MAIN_ADMIN_ID or uid in ENV_ADMIN_IDS

def extra_admins():
    return [int(x) for x in S("extra_admins").replace(" ", "").split(",") if x.strip().isdigit()]

def load_admins():
    ADMIN_IDS.add(MAIN_ADMIN_ID)
    for a in extra_admins(): ADMIN_IDS.add(a)

def save_admins(ids):
    set_S("extra_admins", ",".join(str(i) for i in sorted(set(ids)) if i != MAIN_ADMIN_ID))

async def admin_admins(update):
    ids = extra_admins()
    lines = [f"👑 ادمین اصلی: <code>{MAIN_ADMIN_ID}</code>"]
    lines += [f"• <code>{i}</code> ({html.escape((get_user(i) or {'name': None})['name'] or '-')})" for i in ids] or ["(ادمین دیگری اضافه نشده)"]
    kb = [row(btn("افزودن ادمین", "adm:add", GREEN, "addbal"))]
    kb += [row(btn(f"حذف {i}", f"adm:del:{i}", RED, "no")) for i in ids]
    await show(update, "👥 <b>مدیریت ادمین‌ها</b>\n<blockquote>" + "\n".join(lines) + "</blockquote>", kb + admin_back())

# ➕ ایموجی پریمیوم با کد عددی
def parse_emoji_ids(txt):
    """کدهای عددی ایموجی را از متن درمی‌آورد؛ مثل 5920499378291744339 یا [5920499378291744339]"""
    txt = (txt or "").translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789"))
    return re.findall(r"[0-9]{15,20}", txt)

async def check_emoji(bot, eid):
    """بررسی کد ایموجی از سرور تلگرام؛ خروجی: (معتبر؟, ایموجی جایگزین)"""
    try:
        st = await bot.get_custom_emoji_stickers([eid])
        if st: return True, (st[0].emoji or "⭐️")
        return False, None
    except Exception as e:
        log.warning("check_emoji %s: %s", eid, e); return True, "⭐️"

def strip_premium(text, markup):
    """اگر تلگرام ایموجی پریمیوم را قبول نکرد، نسخه ساده (بدون پریمیوم) ساخته می‌شود."""
    text = re.sub(r'<tg-emoji emoji-id="[^"]*">(.*?)</tg-emoji>', r"\1", text or "", flags=re.S)
    if markup:
        try:
            d = markup.to_dict()
            for r_ in d.get("inline_keyboard", []):
                for b_ in r_: b_.pop("icon_custom_emoji_id", None)
            markup = IKM.de_json(d, None)
        except Exception:
            pass
    return text, markup

COLOR_ICON = {"orig": "⚪️", "green": "🟢", "red": "🔴", "blue": "🔵", "none": "⚫️"}
CLR_PAGE = 16

def color_list_kb(page=0):
    names = BTN_NAMES; pages = max(1, (len(names) + CLR_PAGE - 1) // CLR_PAGE); page = max(0, min(page, pages - 1))
    items = [IKB(f"{COLOR_ICON.get(S('color:' + n) or 'orig', '⚪️')} {n}", callback_data=f"cb:{i}:{page}")
             for i, n in enumerate(names)][page * CLR_PAGE:(page + 1) * CLR_PAGE]
    kb = [row(*items[i:i + 2]) for i in range(0, len(items), 2)]
    nav = [IKB("◀️ قبلی", callback_data=f"cp:{page - 1}") if page > 0 else None,
           IKB(f"{page + 1}/{pages}", callback_data="noop"),
           IKB("بعدی ▶️", callback_data=f"cp:{page + 1}") if page + 1 < pages else None]
    kb.append(row(*nav))
    kb.append([IKB("♻️ ریست رنگ همه دکمه‌ها", callback_data="cr")])
    return kb + admin_back()

def color_pick_kb(i, page):
    cur = S("color:" + BTN_NAMES[i]) or "orig"
    kb = [[IKB(("✅ " if k == cur else "") + COLOR_ICON[k] + " " + v[0], callback_data=f"cs:{i}:{k}:{page}",
               **({"api_kwargs": {"style": v[1]}} if v[1] else {}))] for k, v in BTN_COLOR_MODES.items()]
    return kb + [[IKB("🔙 بازگشت", callback_data=f"cp:{page}")]]

# ➕ ایموجی پریمیوم: خواندن خود ایموجی از پیام
def premium_ids(m):
    ents = list(m.entities or []) + list(m.caption_entities or [])
    return [e.custom_emoji_id for e in ents if e.type == "custom_emoji"]

def entity_fb(m, eid):
    for e in list(m.entities or []):
        if e.type == "custom_emoji" and e.custom_emoji_id == eid:
            try: return m.parse_entity(e) or "⭐️"
            except Exception: break
    for e in list(m.caption_entities or []):
        if e.type == "custom_emoji" and e.custom_emoji_id == eid:
            try: return m.parse_caption_entity(e) or "⭐️"
            except Exception: break
    return "⭐️"

def premium_by_line(m):
    """{شماره خط: (آیدی, ایموجی)} برای ثبت گروهی"""
    text = m.text or m.caption or ""; ents = m.entities if m.text else m.caption_entities
    raw = text.encode("utf-16-le"); out = {}
    for e in ents or []:
        if e.type != "custom_emoji": continue
        line = raw[:e.offset * 2].decode("utf-16-le", "ignore").count("\n")
        fb = raw[e.offset * 2:(e.offset + e.length) * 2].decode("utf-16-le", "ignore") or "⭐️"
        out.setdefault(line, (e.custom_emoji_id, fb))
    return out

def emoji_pick_kb():
    keys = list(EMOJI)
    kb = [[IKB(f"{EMOJI[k]} {k}", callback_data=f"eq:{k}") for k in keys[i:i + 3]] for i in range(0, len(keys), 3)]
    return kb + admin_back("a:emoji")

# ➕ اطلاعات IP (وب‌سرور داخلی ربات)
def ip_sig(uid, exp):
    return hmac.new(BOT_TOKEN.encode(), f"{uid}:{exp}".encode(), hashlib.sha256).hexdigest()[:40]

def ip_link(uid):
    base = (S("ip_web_url") or "").strip().rstrip("/")
    if not base: return None
    if not base.startswith("http"): base = "https://" + base
    exp = int(time.time()) + 3600
    return f"{base}/ip-info?uid={uid}&exp={exp}&sig={ip_sig(uid, exp)}"

def _ip_page(ok):
    u = BOT_REF.get("username") or ""
    back = f"https://t.me/{u}" if u else "tg://"
    title = "اطلاعات ارسال شد" if ok else "لینک نامعتبر یا منقضی شده"
    sub = "نتیجه بررسی داخل ربات برای شما فرستاده شد." if ok else "دوباره از داخل ربات روی «اطلاعات IP من» بزنید."
    icon, col = ("✓", "#22c55e") if ok else ("✕", "#ef4444")
    return f"""<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title>
<style>body{{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b1120;
font-family:Tahoma,Vazirmatn,sans-serif;color:#fff}}.c{{width:84%;max-width:420px;background:#111a2e;border:1px solid #1f2a44;
border-radius:28px;padding:44px 26px;text-align:center}}.i{{width:84px;height:84px;margin:0 auto 22px;border-radius:22px;
background:#13302c;color:{col};font-size:52px;line-height:84px}}h1{{font-size:22px;margin:0 0 16px}}p{{color:#9aa4b8;margin:0 0 30px}}
a{{display:block;background:{col};color:#06150c;text-decoration:none;font-weight:bold;padding:16px;border-radius:18px;font-size:18px}}</style>
</head><body><div class="c"><div class="i">{icon}</div><h1>{title}</h1><p>{sub}</p><a href="{back}">بازگشت به ربات</a></div></body></html>"""

async def ip_send_result(uid, ip):
    bot = BOT_REF.get("bot")
    if not bot: return
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            j = (await c.get(f"https://ipwho.is/{ip}", params={"lang": "en"})).json()
    except Exception as e:
        log.warning("ipwho %s", e); j = {"success": False}
    kb = IKM([row(btn("بازگشت به سایر امکانات", "more", RED, "back"))])
    if not j.get("success"):
        return await bot.send_message(uid, f"❌ دریافت اطلاعات IP <code>{html.escape(ip)}</code> ممکن نشد.",
                                      parse_mode=ParseMode.HTML, reply_markup=kb)
    con, tz, fl = j.get("connection") or {}, j.get("timezone") or {}, j.get("flag") or {}
    e_ = lambda v: html.escape(str(v or "-"))
    text = render("ip_result", IP=e_(j.get("ip") or ip), VER=e_(j.get("type")), COUNTRY=e_(j.get("country")),
                  FLAG=fl.get("emoji") or "🏳", REGION=e_(j.get("region")), CITY=e_(j.get("city")),
                  ISP=e_(con.get("org") or con.get("isp")), ASN=e_(f"AS{con['asn']}" if con.get("asn") else "-"),
                  TZ=e_(tz.get("id")))
    try:
        await bot.send_message(uid, text, parse_mode=ParseMode.HTML, reply_markup=kb)
    except Exception:
        t2, k2 = strip_premium(text, kb)
        await bot.send_message(uid, t2, parse_mode=ParseMode.HTML, reply_markup=k2)

async def _ip_http(reader, writer):
    try:
        head = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), 10)
        lines = head.decode("latin-1").split("\r\n")
        parts = lines[0].split(" ")
        hdr = {}
        for l in lines[1:]:
            if ":" in l:
                k, v = l.split(":", 1); hdr[k.strip().lower()] = v.strip()
        peer = (writer.get_extra_info("peername") or ("",))[0]
        ip = peer
        if IP_TRUST_PROXY or peer in ("127.0.0.1", "::1"):
            ip = (hdr.get("cf-connecting-ip") or hdr.get("x-real-ip") or
                  hdr.get("x-forwarded-for", "").split(",")[0].strip() or peer)
        if ip.startswith("::ffff:"): ip = ip[7:]
        u = urllib.parse.urlsplit(parts[1] if len(parts) > 1 else "/")
        qs = dict(urllib.parse.parse_qsl(u.query))
        status, ok = "200 OK", False
        if u.path.rstrip("/").endswith("ip-info"):
            try:
                uid, exp = int(qs.get("uid", "0")), int(qs.get("exp", "0"))
                ok = exp > time.time() and hmac.compare_digest(qs.get("sig", ""), ip_sig(uid, exp))
            except Exception:
                ok = False
            if ok and time.time() - BOT_REF["last"].get(uid, 0) > 10:
                BOT_REF["last"][uid] = time.time()
                try: await ip_send_result(uid, ip)
                except Exception as e: log.warning("ip send %s", e)
            body = _ip_page(ok)
        else:
            status, body = "404 Not Found", "<h1>404</h1>"
        data = body.encode("utf-8")
        writer.write(f"HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {len(data)}\r\n"
                     "Cache-Control: no-store\r\nConnection: close\r\n\r\n".encode() + data)
        await writer.drain()
    except Exception as e:
        log.debug("ip http %s", e)
    finally:
        try: writer.close()
        except Exception: pass

async def ip_server_start(app):
    BOT_REF["bot"] = app.bot
    try: BOT_REF["username"] = (await app.bot.get_me()).username or ""
    except Exception: pass
    try:
        BOT_REF["srv"] = await asyncio.start_server(_ip_http, IP_WEB_HOST, IP_WEB_PORT)
        log.info("ip-info server on %s:%s", IP_WEB_HOST, IP_WEB_PORT)
    except Exception as e:
        log.warning("ip-info server failed: %s", e)

# ➕ پنل‌ها: ساخت لینک کانفیگ و ساب
async def _sub_links(sub):
    """کانفیگ‌ها را از خود لینک ساب می‌خواند (برای پاسارگارد/ثنایی وقتی لینک مستقیم برنگردد)."""
    try:
        async with httpx.AsyncClient(timeout=20, verify=False, follow_redirects=True, proxy=S("bridge_url") or None) as c:
            r = await c.get(sub, headers={"User-Agent": "v2rayNG/1.8.19"})
        t = r.text.strip()
        if "://" not in t:
            t = base64.b64decode(t + "=" * (-len(t) % 4)).decode("utf-8", "ignore")
        return [l.strip() for l in t.splitlines()
                if re.match(r"^(vless|vmess|trojan|ss|hysteria2|hy2|tuic|wireguard)://", l.strip())]
    except Exception as e:
        log.warning("sub links %s: %s", sub, e); return []

async def _mz_create(c, t, body, h):
    r = await c.post("/api/user", json=body, headers=h)
    if t == "pasarguard" and r.status_code == 422:   # بعضی نسخه‌ها expire را به صورت تاریخ می‌خواهند
        b2 = dict(body); b2["expire"] = dt.datetime.fromtimestamp(body["expire"], dt.timezone.utc).isoformat()
        r = await c.post("/api/user", json=b2, headers=h)
    if r.status_code >= 400: raise Exception(f"HTTP {r.status_code}: {r.text[:300]}")
    return r.json()

def _xui_root(t): return XUI_PREFIX[t].split("/api")[0].split("/API")[0]   # /panel یا /xui

async def _xui_inbound(c, t, inb):
    try:
        j = (await c.get(f"{XUI_PREFIX[t]}/get/{inb}")).json()
        return j.get("obj") if j.get("success") else None
    except Exception as e:
        log.warning("xui inbound %s", e); return None

def _xui_prepare(client, inbound):
    if not inbound: return client
    proto = inbound.get("protocol")
    try: st = json.loads(inbound.get("settings") or "{}")
    except Exception: st = {}
    old = (st.get("clients") or [{}])[0]
    if proto == "vless": client["flow"] = old.get("flow", "")
    elif proto == "vmess": client["security"] = old.get("security", "auto")
    elif proto == "trojan": client["password"] = secrets.token_urlsafe(12)
    elif proto == "shadowsocks":
        m = st.get("method", "")
        n = 16 if "128" in m else 32
        client["password"] = base64.b64encode(os.urandom(n)).decode() if m.startswith("2022") else secrets.token_urlsafe(12)
        client["method"] = "" if m.startswith("2022") else m
    return client

def _xui_link(inbound, client, host):
    try:
        proto, port = inbound.get("protocol"), inbound.get("port")
        ss = json.loads(inbound.get("streamSettings") or "{}")
        st = json.loads(inbound.get("settings") or "{}")
    except Exception:
        return None
    ext = ss.get("externalProxy") or []
    if ext: host, port = ext[0].get("dest") or host, ext[0].get("port") or port
    net, sec = ss.get("network", "tcp"), ss.get("security", "none")
    ps = f"{inbound.get('remark') or 'srv'}-{client['email']}"
    prm = {"type": net, "security": sec}
    hpath, hhost, htype = "", "", "none"
    if net == "ws":
        w = ss.get("wsSettings") or {}; hpath = w.get("path", "/"); hhost = w.get("host") or (w.get("headers") or {}).get("Host", "")
    elif net == "grpc":
        g = ss.get("grpcSettings") or {}; prm["serviceName"] = g.get("serviceName", ""); hpath = prm["serviceName"]
        if g.get("multiMode"): prm["mode"] = "multi"
    elif net == "httpupgrade":
        w = ss.get("httpupgradeSettings") or {}; hpath = w.get("path", "/"); hhost = w.get("host", "")
    elif net in ("xhttp", "splithttp"):
        w = ss.get("xhttpSettings") or ss.get("splithttpSettings") or {}; hpath = w.get("path", "/"); hhost = w.get("host", "")
        if w.get("mode"): prm["mode"] = w["mode"]
    elif net == "tcp":
        hd = (ss.get("tcpSettings") or {}).get("header") or {}
        if hd.get("type") == "http":
            htype = "http"; prm["headerType"] = "http"
            rq = hd.get("request") or {}; hpath = ",".join(rq.get("path") or ["/"])
            hhost = ",".join((rq.get("headers") or {}).get("Host") or [])
    elif net == "kcp":
        k = ss.get("kcpSettings") or {}; htype = (k.get("header") or {}).get("type", "none"); prm["headerType"] = htype
        if k.get("seed"): prm["seed"] = k["seed"]
    if hpath and net != "grpc": prm["path"] = hpath
    if hhost: prm["host"] = hhost
    sni = ""
    if sec == "tls":
        tl = ss.get("tlsSettings") or {}; sni = tl.get("serverName", "")
        fp = (tl.get("settings") or {}).get("fingerprint"); alpn = tl.get("alpn") or []
        if sni: prm["sni"] = sni
        if fp: prm["fp"] = fp
        if alpn: prm["alpn"] = ",".join(alpn)
    elif sec == "reality":
        r = ss.get("realitySettings") or {}; rs = r.get("settings") or {}
        prm["pbk"] = rs.get("publicKey", ""); prm["fp"] = rs.get("fingerprint") or "chrome"
        sni = (r.get("serverNames") or [""])[0]; prm["sni"] = sni; prm["sid"] = (r.get("shortIds") or [""])[0]
        if rs.get("spiderX"): prm["spx"] = rs["spiderX"]
    tag = "#" + urllib.parse.quote(ps)
    if proto == "vless":
        prm["encryption"] = "none"
        if client.get("flow"): prm["flow"] = client["flow"]
        return f"vless://{client['id']}@{host}:{port}?{urllib.parse.urlencode(prm)}{tag}"
    if proto == "trojan":
        return f"trojan://{client.get('password') or client['id']}@{host}:{port}?{urllib.parse.urlencode(prm)}{tag}"
    if proto == "vmess":
        v = {"v": "2", "ps": ps, "add": host, "port": port, "id": client["id"], "aid": 0, "scy": client.get("security", "auto"),
             "net": net, "type": htype, "host": hhost, "path": hpath, "tls": sec if sec in ("tls", "reality") else "",
             "sni": sni, "fp": prm.get("fp", ""), "alpn": prm.get("alpn", "")}
        return "vmess://" + base64.b64encode(json.dumps(v, ensure_ascii=False).encode()).decode()
    if proto == "shadowsocks":
        m = st.get("method", ""); pw = client.get("password", "")
        if m.startswith("2022"): pw = f"{st.get('password', '')}:{pw}"
        ui = base64.urlsafe_b64encode(f"{m}:{pw}".encode()).decode().rstrip("=")
        return f"ss://{ui}@{host}:{port}{tag}"
    return None

async def _xui_sub(c, t, p, sid):
    try:
        j = (await c.post(_xui_root(t) + "/setting/all")).json()
        o = j.get("obj") or {}
    except Exception as e:
        log.warning("xui settings %s", e); return ""
    if not o.get("subEnable"): return ""
    if o.get("subURI"): return o["subURI"].rstrip("/") + "/" + sid
    host = o.get("subDomain") or urllib.parse.urlsplit(p["url"]).hostname
    scheme = "https" if o.get("subCertFile") else "http"
    path = "/" + (o.get("subPath") or "/sub/").strip("/") + "/"
    return f"{scheme}://{host}:{o.get('subPort') or 2096}{path}{sid}"

def make_qr(data):
    if not qrcode or not data: return None
    bio = io.BytesIO(); qrcode.make(data).save(bio, "PNG"); bio.seek(0); return bio

async def show(update: Update, text, kb=None):
    """اگر از دکمه آمده، پیام ویرایش شود؛ وگرنه پیام جدید."""
    markup = IKM(kb) if kb else None
    cq = update.callback_query
    if cq:
        try:
            return await cq.edit_message_text(text, parse_mode=ParseMode.HTML, reply_markup=markup,
                                              disable_web_page_preview=True)
        except Exception:
            pass
    try:
        return await update.effective_chat.send_message(text, parse_mode=ParseMode.HTML, reply_markup=markup,
                                                        disable_web_page_preview=True)
    except Exception as e:  # ➕ اگر ایموجی پریمیوم رد شد، بدون پریمیوم بفرست تا ربات از کار نیفتد
        log.warning("show premium fallback: %s", e)
        t2, m2 = strip_premium(text, markup)
        if cq:
            try: return await cq.edit_message_text(t2, parse_mode=ParseMode.HTML, reply_markup=m2, disable_web_page_preview=True)
            except Exception: pass
        return await update.effective_chat.send_message(t2, parse_mode=ParseMode.HTML, reply_markup=m2,
                                                        disable_web_page_preview=True)

def set_state(ctx, *s): ctx.user_data["state"] = s
def clear_state(ctx): ctx.user_data.pop("state", None)

# ───────────────────────── اتصال به پنل‌ها ─────────────────────────
def _http(p):
    return httpx.AsyncClient(base_url=p["url"].rstrip("/"), timeout=25, verify=False,
                             proxy=S("bridge_url") or None, follow_redirects=True)

async def _token(c, p):
    path = "/api/admins/token" if p["ptype"] == "marzneshin" else "/api/admin/token"
    r = await c.post(path, data={"username": p["user"], "password": p["password"]})
    r.raise_for_status()
    return {"Authorization": "Bearer " + r.json()["access_token"]}

async def _xlogin(c, p):
    r = await c.post("/login", data={"username": p["user"], "password": p["password"]})
    r.raise_for_status()
    j = r.json()
    if not j.get("success"): raise Exception(j.get("msg") or "login failed")

def _ids(extra): return [int(x) for x in (extra or "").replace(" ", "").split(",") if x.isdigit()]

async def panel_test(p):
    if p["ptype"] == "manual": return True, "حالت فروش دستی (بدون اتصال)"
    try:
        async with _http(p) as c:
            await (_xlogin(c, p) if p["ptype"] in XUI_PREFIX else _token(c, p))
        return True, "اتصال موفق ✅"
    except Exception as e:
        return False, f"خطا در اتصال: {html.escape(str(e))[:300]}"

async def panel_create(p, username, gb, days):
    t, extra = p["ptype"], (p["extra"] or "").strip()
    exp = int(time.time() + days * 86400); limit = int(gb * 1024 ** 3); links = []
    async with _http(p) as c:
        if t in ("marzban", "pasarguard"):
            h = await _token(c, p)
            body = {"username": username, "expire": exp, "data_limit": limit,
                    "data_limit_reset_strategy": "no_reset", "status": "active"}
            if t == "marzban":
                body["proxies"] = json.loads(extra) if extra.startswith("{") else {"vless": {}}
                body["inbounds"] = {}
            else:
                body["group_ids"] = _ids(extra); body["proxy_settings"] = {}
                if not body["group_ids"]:  # ➕ اگر گروه وارد نشده، همه گروه‌های فعال پنل
                    try:
                        gj = (await c.get("/api/groups", headers=h)).json()
                        gl = gj.get("groups", []) if isinstance(gj, dict) else (gj or [])
                        body["group_ids"] = [g["id"] for g in gl if not g.get("is_disabled")]
                    except Exception as e:
                        log.warning("pasarguard groups %s", e)
            j = await _mz_create(c, t, body, h)  # ➕ با پیام خطای دقیق + سازگاری پاسارگارد
            sub, links = j.get("subscription_url") or "", j.get("links") or []
        elif t == "marzneshin":
            h = await _token(c, p)
            body = {"username": username, "service_ids": _ids(extra), "expire_strategy": "fixed_date",
                    "expire_date": dt.datetime.fromtimestamp(exp, dt.timezone.utc).isoformat(),
                    "data_limit": limit, "data_limit_reset_strategy": "no_reset"}
            r = await c.post("/api/users", json=body, headers=h); r.raise_for_status(); j = r.json()
            sub = j.get("subscription_url") or ""
        elif t in XUI_PREFIX:
            await _xlogin(c, p)
            parts = extra.split("|")
            inb = int(parts[0]) if parts and parts[0].strip().isdigit() else 1
            sub_base = parts[1].strip() if len(parts) > 1 else ""
            sid = secrets.token_hex(8)
            client = {"id": str(uuid.uuid4()), "email": username, "limitIp": 0, "totalGB": limit,
                      "expiryTime": exp * 1000, "enable": True, "tgId": "", "subId": sid, "flow": ""}
            inbound = await _xui_inbound(c, t, inb)  # ➕ تنظیم کلاینت بر اساس پروتکل اینباند
            client = _xui_prepare(client, inbound)
            r = await c.post(XUI_PREFIX[t] + "/addClient",
                             data={"id": inb, "settings": json.dumps({"clients": [client]})})
            j = r.json()
            if not j.get("success"): raise Exception(j.get("msg") or "addClient failed")
            sub = f"{sub_base.rstrip('/')}/{sid}" if sub_base else ""
            if not sub: sub = await _xui_sub(c, t, p, sid)  # ➕ لینک ساب از تنظیمات خود پنل
            host = parts[2].strip() if len(parts) > 2 and parts[2].strip() else urllib.parse.urlsplit(p["url"]).hostname
            if inbound and inbound.get("listen") not in (None, "", "0.0.0.0", "::") and not (len(parts) > 2 and parts[2].strip()):
                host = inbound["listen"]
            lk = _xui_link(inbound, client, host) if inbound else None  # ➕ لینک مستقیم کانفیگ
            if lk: links = [lk]
        else:
            raise Exception("نوع پنل پشتیبانی نمی‌شود")
    if sub.startswith("/"): sub = p["url"].rstrip("/") + sub
    if not links and sub.startswith("http"):  # ➕ گرفتن کانفیگ‌ها از خود لینک ساب
        links = await _sub_links(sub)
    return {"sub": sub, "link": links[0] if links else sub}

async def panel_info(p, username):
    t = p["ptype"]
    async with _http(p) as c:
        if t in ("marzban", "pasarguard"):
            h = await _token(c, p)
            j = (await c.get(f"/api/user/{username}", headers=h)).json()
            used, total, exp, st = j.get("used_traffic", 0), j.get("data_limit") or 0, j.get("expire"), j.get("status")
        elif t == "marzneshin":
            h = await _token(c, p)
            j = (await c.get(f"/api/users/{username}", headers=h)).json()
            used, total, exp = j.get("used_traffic", 0), j.get("data_limit") or 0, j.get("expire_date")
            st = "active" if j.get("is_active", j.get("enabled")) else "disabled"
        elif t in XUI_PREFIX:
            await _xlogin(c, p)
            j = (await c.get(f"{XUI_PREFIX[t]}/getClientTraffics/{username}")).json().get("obj") or {}
            used, total = (j.get("up", 0) + j.get("down", 0)), j.get("total", 0)
            exp = (j.get("expiryTime") or 0) / 1000; st = "active" if j.get("enable") else "disabled"
        else:
            return None
    if isinstance(exp, str):
        try: exp = dt.datetime.fromisoformat(exp.replace("Z", "+00:00")).timestamp()
        except Exception: exp = None
    return {"status": st, "used": used / 1024 ** 3, "total": total / 1024 ** 3 if total else 0,
            "expire": jdate(exp) if exp else "نامحدود"}

# ───────────────────────── کیبوردها ─────────────────────────
def main_kb(uid):
    kb = [
        row(btn("خرید اشتراک", "buy", GREEN, "buy")),
        row(btn("اشتراک ها", "subs", None, "subs"), btn("افزایش موجودی", "account", None, "wallet")),
        row(btn("تست قبل از خرید", "test", RED, "test")),
        row(btn("پشتیبانی", url=S("support_url"), ek="support"), btn("کانال", url=S("channel_url"), ek="channel"),
            btn("حساب", "account", None, "account")),
        row(btn("سایر امکانات", "more", None, "more")),
    ]
    if is_admin(uid):  # دکمه مخفی؛ فقط ادمین می‌بیند
        kb.append(row(btn("پنل مدیریت", "admin", BLUE, "admin")))
    return kb

def back_home(): return [row(btn("بازگشت به منوی اصلی", "home", RED, "back"))]

def admin_kb():
    return [
        row(btn("آمار", "a:stats", BLUE, "stats"), btn("پیام همگانی", "a:bc", BLUE, "bc")),
        row(btn("مدیریت پنل‌ها", "a:panels", BLUE, "panel"), btn("مدیریت پلن‌ها", "a:plans", BLUE, "plan")),
        row(btn("افزایش موجودی با آیدی", "a:addbal", GREEN, "addbal"), btn("کسر موجودی", "a:subbal", RED, "subbal")),
        row(btn("بن کاربر", "a:ban", RED, "ban"), btn("آن‌بن کاربر", "a:unban", GREEN, "unban")),
        row(btn("ویرایش متن‌ها", "a:texts", None, "text"), btn("ایموجی‌های پریمیوم", "a:emoji", None, "emoji")),
        row(btn("تنظیمات تست", "a:test", None, "test"), btn("تنظیمات پرداخت", "a:pay", None, "card")),
        row(btn("جستجوی کاربر در پنل", "a:search", None, "search"), btn("آدرس پل", "set:bridge_url", None, "bridge")),
        row(btn("تنظیمات عمومی", "a:gen", None, "settings")),
        row(btn("رنگ دکمه‌ها", "a:color", None, "settings"), btn("مدیریت ادمین‌ها", "a:admins", None, "admin")),
        row(btn("آدرس سرور اطلاعات IP", "set:ip_web_url", None, "ip")),
        row(btn("بازگشت", "home", RED, "back")),
    ]

def admin_back(to="admin"): return [row(btn("بازگشت", to, RED, "back"))]

# ───────────────────────── صفحات کاربر ─────────────────────────
def active_services(uid):
    return q("SELECT COUNT(*) c FROM services WHERE user_id=? AND status='active' AND expire>?",
             (uid, int(time.time())), True)["c"]

async def send_home(update: Update, ctx, uid):
    u = get_user(uid)
    text = render("start", USER=html.escape(u["name"] or "کاربر"), ID=uid, BALANCE=money(u["balance"]),
                  SERVICES=active_services(uid), DATE=jdate())
    await show(update, text, main_kb(uid))

def months_label(m):
    return {1: "یک‌ماهه"}.get(m, f"{m} ماهه")

async def page_buy(update, ctx):
    plans = q("SELECT * FROM plans WHERE active=1 ORDER BY months, price")
    months = sorted({p["months"] for p in plans})
    lines = ["<b>مدت | حجم‌ها | شروع قیمت</b>"]
    for m in months:
        ps = [p for p in plans if p["months"] == m]
        lines.append(f"<b>{m} ماهه</b> | {min(p['gb'] for p in ps)} تا {max(p['gb'] for p in ps)} گیگ | "
                     f"{money(min(p['price'] for p in ps))} تومان")
    text = render("buy_intro") + "\n\n<blockquote>" + "\n".join(lines) + "</blockquote>"
    mb = [btn(months_label(m), f"pl:{m}", BLUE, f"m{m}" if f"m{m}" in EMOJI else None) for m in months]
    kb = [row(*mb[i:i + 2]) for i in range(0, len(mb), 2)]
    kb += [row(btn("مشاهده همه پلن‌ها", "pl:0", BLUE, "all")),
           row(btn("پیشنهاد سرویس", "suggest", GREEN, "suggest")),
           row(btn("بازگشت", "home", RED, "back"))]
    await show(update, text, kb)

def plan_rows(ps, bk):
    return [row(btn("خرید", f"bp:{p['id']}", GREEN, bk), btn(f"{p['gb']}گیگ", f"bp:{p['id']}"),
                btn(f"{p['days']}روز", f"bp:{p['id']}"), btn(money(p["price"]), f"bp:{p['id']}")) for p in ps]

async def page_plans(update, ctx, uid, m):
    plans = q("SELECT * FROM plans WHERE active=1 ORDER BY months, gb")
    months = sorted({p["months"] for p in plans})
    if not months: return await show(update, "فعلاً پلنی تعریف نشده.", back_home())
    u = get_user(uid)
    kb = [row(btn("خرید", "noop", RED, "shop"), btn("حجم", "noop", RED, "volume"),
              btn("زمان", "noop", RED, "time"), btn("قیمت", "noop", RED, "price"))]
    if m == 0:
        for mm in months:
            kb.append(row(btn(f"{mm} ماهه", f"pl:{mm}", BLUE, f"m{mm}" if f"m{mm}" in EMOJI else None)))
            kb += plan_rows([p for p in plans if p["months"] == mm], f"m{mm}" if f"m{mm}" in EMOJI else None)
    else:
        if m not in months: m = months[0]
        i = months.index(m); ek = f"m{m}" if f"m{m}" in EMOJI else None
        kb.append(row(btn(f"{m} ماهه", "noop", BLUE, ek)))
        kb += plan_rows([p for p in plans if p["months"] == m], ek)
        kb.append(row(btn("صفحه بعد", f"pl:{months[i + 1]}", BLUE) if i + 1 < len(months) else None,
                      btn(months_label(m), "noop"),
                      btn("صفحه قبل", f"pl:{months[i - 1]}", BLUE) if i > 0 else None))
    kb += [row(btn("پیشنهاد سرویس", "suggest", GREEN, "suggest")), row(btn("بازگشت", "buy", RED, "back"))]
    await show(update, render("plans", BALANCE=money(u["balance"])), kb)

async def page_invoice(update, uid, plan_id, panel_id):
    p = q("SELECT * FROM plans WHERE id=?", (plan_id,), True)
    pn = q("SELECT * FROM panels WHERE id=?", (panel_id,), True)
    u = get_user(uid)
    text = render("invoice", GB=p["gb"], DAYS=p["days"], PRICE=money(p["price"]), BALANCE=money(u["balance"]),
                  LOCATION=html.escape(pn["name"]))
    kb = [row(btn("پرداخت از کیف پول", f"pay:{plan_id}:{panel_id}", GREEN, "ok")),
          row(btn("افزایش موجودی", "topup", None, "wallet")),
          row(btn("بازگشت", "buy", RED, "back"))]
    await show(update, text, kb)

async def deliver(ctx, uid, sid, key="delivery"):
    s = q("SELECT * FROM services WHERE id=?", (sid,), True)
    u = get_user(uid)
    link = s["sub"] or s["link"] or "-"
    text = render(key, USER=html.escape(u["name"] or ""), NAME=s["username"], GB=s["gb"], DAYS=s["days"],
                  PRICE=money(s["price"]), LINK=html.escape(link))
    kb = IKM([row(btn("اشتراک‌های من", "subs", BLUE, "subs")), row(btn("منوی اصلی", "home", RED, "back"))])
    qr = make_qr(link if link != "-" else None)
    if qr and len(text) < 1000:
        await ctx.bot.send_photo(uid, qr, caption=text, parse_mode=ParseMode.HTML, reply_markup=kb)
    else:
        await ctx.bot.send_message(uid, text, parse_mode=ParseMode.HTML, reply_markup=kb)
    # ➕ ارسال جداگانه بارکد (QR) کانفیگ و لینک ساب
    for title, val in (("کانفیگ", s["link"]), ("لینک ساب", s["sub"])):
        if not val or val == "-": continue
        img = make_qr(val)
        if not img: continue
        try:
            await ctx.bot.send_photo(uid, img, caption=f"🔳 <b>QR {title}</b>\n<code>{html.escape(val[:900])}</code>",
                                     parse_mode=ParseMode.HTML)
        except Exception as e:
            log.warning("qr %s: %s", title, e)

async def build_service(ctx, uid, panel, gb, days, price, plan_id=None, is_test=0):
    uname = f"{USER_PREFIX}{uid}_{secrets.token_hex(2)}"
    now = int(time.time())
    if panel["ptype"] == "manual":
        sid = ex("INSERT INTO services(user_id,plan_id,panel_id,username,gb,days,price,created,expire,is_test,status)"
                 " VALUES(?,?,?,?,?,?,?,?,?,?,'pending')",
                 (uid, plan_id, panel["id"], uname, gb, days, price, now, now + days * 86400, is_test))
        for a in ADMIN_IDS:
            await ctx.bot.send_message(a, f"🛎 سفارش دستی #{sid}\nکاربر: <code>{uid}</code>\n{gb} گیگ / {days} روز",
                                       parse_mode=ParseMode.HTML,
                                       reply_markup=IKM([[btn("ارسال کانفیگ", f"dl:{sid}", GREEN, "link")]]))
        return sid, True
    res = await panel_create(panel, uname, gb, days)
    sid = ex("INSERT INTO services(user_id,plan_id,panel_id,username,link,sub,gb,days,price,created,expire,is_test)"
             " VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
             (uid, plan_id, panel["id"], uname, res["link"], res["sub"], gb, days, price, now,
              now + days * 86400, is_test))
    return sid, False

async def do_pay(update, ctx, uid, plan_id, panel_id):
    p = q("SELECT * FROM plans WHERE id=?", (plan_id,), True)
    pn = q("SELECT * FROM panels WHERE id=? AND active=1", (panel_id,), True)
    u = get_user(uid)
    if not p or not pn: return await show(update, "این پلن/لوکیشن در دسترس نیست.", back_home())
    if u["balance"] < p["price"]:
        return await show(update, render("no_balance", PRICE=money(p["price"]), BALANCE=money(u["balance"])),
                          [row(btn("افزایش موجودی", "topup", GREEN, "wallet")), row(btn("بازگشت", "buy", RED, "back"))])
    ex("UPDATE users SET balance=balance-? WHERE id=?", (p["price"], uid))
    try:
        sid, manual = await build_service(ctx, uid, pn, p["gb"], p["days"], p["price"], plan_id)
    except Exception as e:
        ex("UPDATE users SET balance=balance+? WHERE id=?", (p["price"], uid))
        log.exception("create failed")
        for a in ADMIN_IDS:
            await ctx.bot.send_message(a, f"⚠️ خطای ساخت سرویس روی پنل {pn['name']}:\n{html.escape(str(e))[:500]}")
        return await show(update, "❌ ساخت سرویس با خطا مواجه شد و مبلغ به کیف پول برگشت. به پشتیبانی پیام دهید.",
                          back_home())
    if manual:
        return await show(update, "✅ سفارش ثبت شد. کانفیگ به‌زودی توسط پشتیبانی ارسال می‌شود.", back_home())
    if update.callback_query:
        try: await update.callback_query.message.delete()
        except Exception: pass
    await deliver(ctx, uid, sid)

async def page_account(update, uid):
    u = get_user(uid)
    services = q("SELECT COUNT(*) c FROM services WHERE user_id=? AND is_test=0", (uid,), True)["c"]
    inv = q("SELECT COUNT(*) c FROM payments WHERE user_id=? AND status='ok'", (uid,), True)["c"]
    refs = q("SELECT COUNT(*) c FROM users WHERE ref_by=?", (uid,), True)["c"]
    text = render("account", ID=uid, USER=html.escape(u["name"] or ""), PHONE=u["phone"] or "ثبت نشده",
                  GROUP=u["grp"], JOINED=jdate(u["created"]), REF=uid, BALANCE=money(u["balance"]),
                  SERVICES=services, INVOICES=inv, REFS=refs, DATE=jdate())
    kb = [row(btn("افزایش موجودی", "topup", GREEN, "bag"), btn("شارژ ویژه با هدیه", "gift", GREEN, "gift"))]
    if not u["phone"]: kb.append(row(btn("ثبت شماره تماس", "phone", None, "phone")))
    kb += back_home()
    await show(update, text, kb)

async def page_topup(update, gift=False):
    base = int(S("gift_min")) if gift else 50000
    amounts = [base, base * 2, base * 4, base * 10] if gift else [50000, 100000, 200000, 500000]
    g = 1 if gift else 0
    kb = [row(btn(f"{money(a)} تومان", f"ta:{a}:{g}", GREEN)) for a in amounts]
    kb += [row(btn("مبلغ دلخواه", f"tc:{g}", BLUE, "card")), row(btn("بازگشت", "account", RED, "back"))]
    text = render("gift", MIN=money(S("gift_min")), PERCENT=S("gift_percent")) if gift else render("topup")
    await show(update, text, kb)

async def ask_receipt(update, ctx, amount, gift):
    set_state(ctx, "receipt", amount, gift)
    await show(update, render("topup_card", PRICE=money(amount), CARD=html.escape(S("card_number")),
                              OWNER=html.escape(S("card_owner"))),
               [row(btn("انصراف", "account", RED, "no"))])

async def page_subs(update, uid):
    rows = q("SELECT * FROM services WHERE user_id=? ORDER BY id DESC LIMIT 30", (uid,))
    if not rows: return await show(update, render("subs_empty"), [row(btn("خرید اشتراک", "buy", GREEN, "buy"))] + back_home())
    kb = []
    for s in rows:
        st = "🟢" if s["status"] == "active" and s["expire"] > time.time() else ("⏳" if s["status"] == "pending" else "🔴")
        kb.append(row(btn(f"{st} {s['username']} | {s['gb']}GB{' (تست)' if s['is_test'] else ''}", f"sv:{s['id']}")))
    await show(update, f"{E('subs')} <b>اشتراک‌های شما</b>", kb + back_home())

async def page_service(update, uid, sid):
    s = q("SELECT * FROM services WHERE id=? AND user_id=?", (sid, uid), True)
    if not s: return await show(update, "سرویس پیدا نشد.", back_home())
    pn = q("SELECT * FROM panels WHERE id=?", (s["panel_id"],), True)
    extra = ""
    if pn and pn["ptype"] != "manual" and s["status"] == "active":
        try:
            i = await panel_info(pn, s["username"])
            if i: extra = (f"\nوضعیت: <b>{i['status']}</b>\nمصرف: <b>{i['used']:.2f}</b> از "
                           f"<b>{i['total']:.0f}</b> گیگ\nانقضا: {i['expire']}")
        except Exception:
            extra = "\n(دریافت وضعیت از پنل ممکن نشد)"
    link = s["sub"] or s["link"] or "هنوز ارسال نشده"
    text = (f"{E('plan')} <b>{s['username']}</b>\n<blockquote>📍 لوکیشن: {html.escape(pn['name'] if pn else '-')}\n"
            f"{E('volume')} حجم: {s['gb']} گیگ\n{E('time')} انقضا: {jdate(s['expire'])}{extra}</blockquote>\n\n"
            f"{E('link')} لینک:\n<code>{html.escape(link)}</code>")
    kb = [row(btn("دریافت QR", f"qr:{sid}", BLUE, "qr"), btn("بروزرسانی وضعیت", f"sv:{sid}", None, "search")),
          row(btn("QR کانفیگ", f"qrc:{sid}", BLUE, "qr")) if s["link"] and s["sub"] and s["link"] != s["sub"] else [],
          row(btn("بازگشت", "subs", RED, "back"))]
    kb = [r for r in kb if r]  # ➕
    await show(update, text, kb)

async def do_test(update, ctx, uid):
    u = get_user(uid)
    if S("test_enabled") != "1": return await show(update, "اکانت تست فعلاً غیرفعال است.", back_home())
    if u["test_used"]: return await show(update, "شما قبلاً اکانت تست دریافت کرده‌اید.", back_home())
    pid = S("test_panel")
    pn = (q("SELECT * FROM panels WHERE id=? AND active=1", (pid,), True) if pid.isdigit() else None) or \
         q("SELECT * FROM panels WHERE active=1 AND ptype!='manual' ORDER BY id LIMIT 1", one=True)
    if not pn: return await show(update, "هنوز سروری برای تست تنظیم نشده.", back_home())
    try:
        sid, manual = await build_service(ctx, uid, pn, float(S("test_gb")), float(S("test_days")), 0, None, 1)
    except Exception as e:
        log.exception("test failed")
        return await show(update, "❌ ساخت اکانت تست ممکن نشد، بعداً تلاش کنید.", back_home())
    ex("UPDATE users SET test_used=1 WHERE id=?", (uid,))
    if manual: return await show(update, "✅ درخواست تست ثبت شد.", back_home())
    await deliver(ctx, uid, sid, "test_delivery")

async def page_more(update, uid):
    kb = [row(btn("راهنما", "help", None, "help"), btn("قوانین", "rules", None, "rules")),
          row(btn("زیرمجموعه‌گیری", "ref", GREEN, "ref"), btn("حساب کاربری", "account", None, "account"))]
    kb = [row(btn("اطلاعات IP من", "ip", GREEN, "ip")),  # ➕ مثل طرح جدید
          row(btn("گزارش مصرف", "usage", None, "usage"), btn("پیشنهاد سرویس", "suggest", None, "suggest")),
          row(btn("تنظیمات من", "myset", None, "mysettings"), btn("تنظیم یادآورها", "remind", None, "remind")),
          row(btn("انتقال سرویس", "transfer", None, "transfer"))] + kb
    await show(update, render("more"), kb + back_home())

# ➕ صفحات جدید سایر امکانات
def back_more(): return [row(btn("بازگشت به سایر امکانات", "more", RED, "back"))]

async def page_ip(update, uid):
    link = ip_link(uid)
    if not link:
        t = "⚠️ این بخش هنوز توسط مدیریت فعال نشده."
        if is_admin(uid): t += "\n\nادمین: از پنل مدیریت > «آدرس سرور اطلاعات IP» آدرس عمومی سرور را وارد کن."
        return await show(update, t, back_more())
    await show(update, render("ip_intro"), [row(btn("بررسی و ارسال اطلاعات IP", url=link, style=GREEN, ek="ip"))] + back_more())

async def page_usage(update, uid):
    rows_ = q("SELECT * FROM services WHERE user_id=? AND status='active' ORDER BY id DESC LIMIT 10", (uid,))
    if not rows_: return await show(update, render("subs_empty"), back_more())
    out = []
    for s in rows_:
        pn = q("SELECT * FROM panels WHERE id=?", (s["panel_id"],), True)
        line = f"{E('plan')} <b>{html.escape(s['username'])}</b>"
        try:
            i = await panel_info(pn, s["username"]) if pn and pn["ptype"] != "manual" else None
        except Exception:
            i = None
        if i:
            left = max(i["total"] - i["used"], 0) if i["total"] else 0
            line += (f"\nمصرف: <b>{i['used']:.2f}</b> از <b>{i['total']:.0f}</b> گیگ"
                     + (f" | باقی‌مانده: <b>{left:.2f}</b>" if i["total"] else "") + f"\nانقضا: {i['expire']}")
        else:
            line += f"\nحجم: {s['gb']} گیگ | انقضا: {jdate(s['expire'])}"
        out.append(line)
    await show(update, f"{E('usage')} <b>گزارش مصرف</b>\n\n<blockquote>" + "\n\n".join(out) + "</blockquote>", back_more())

def remind_on(uid): return S(f"remind:{uid}") != "0"

async def page_myset(update, uid):
    u = get_user(uid)
    t = (f"{E('mysettings')} <b>تنظیمات من</b>\n<blockquote>👤 نام: <b>{html.escape(u['name'] or '-')}</b>\n"
         f"🆔 شناسه: <code>{uid}</code>\n📱 شماره: {html.escape(u['phone'] or 'ثبت نشده')}\n"
         f"🔔 یادآور انقضا: <b>{'روشن' if remind_on(uid) else 'خاموش'}</b></blockquote>")
    kb = [row(btn("تنظیم یادآورها", "remind", None, "remind"), btn("حساب کاربری", "account", None, "account"))]
    if not u["phone"]: kb.append(row(btn("ثبت شماره تماس", "phone", None, "phone")))
    await show(update, t, kb + back_more())

async def page_remind(update, uid):
    on = remind_on(uid)
    t = (f"{E('remind')} <b>تنظیم یادآورها</b>\n\nیادآور قبل از اتمام سرویس (۲۴ ساعت مانده): "
         f"<b>{'روشن' if on else 'خاموش'}</b>")
    await show(update, t, [row(btn("خاموش کردن یادآور" if on else "روشن کردن یادآور", "rmt", RED if on else GREEN, "remind"))] + back_more())

async def page_transfer(update, uid):
    rows_ = q("SELECT * FROM services WHERE user_id=? AND status='active' AND is_test=0 AND expire>? ORDER BY id DESC LIMIT 30",
              (uid, int(time.time())))
    if not rows_: return await show(update, "سرویس فعالی برای انتقال ندارید.", back_more())
    kb = [row(btn(f"{s['username']} | {s['gb']}GB", f"tr:{s['id']}", None, "transfer")) for s in rows_]
    await show(update, f"{E('transfer')} <b>انتقال سرویس</b>\nکدام سرویس را به کاربر دیگری منتقل کنیم؟", kb + back_more())

async def page_suggest(update):
    sp = S("suggest_plan")
    p = (q("SELECT * FROM plans WHERE id=? AND active=1", (sp,), True) if sp.isdigit() else None) or \
        q("SELECT p.* , COUNT(s.id) c FROM plans p LEFT JOIN services s ON s.plan_id=p.id WHERE p.active=1 "
          "GROUP BY p.id ORDER BY c DESC, p.price ASC LIMIT 1", one=True)
    if not p: return await show(update, "پلنی موجود نیست.", back_home())
    text = (f"{E('suggest')} <b>پیشنهاد ما برای شما</b>\n<blockquote>{E('volume')} {p['gb']} گیگ\n"
            f"{E('time')} {p['days']} روز\n{E('price')} {money(p['price'])} تومان</blockquote>")
    await show(update, text, [row(btn("خرید همین سرویس", f"bp:{p['id']}", GREEN, "buy")), row(btn("بازگشت", "buy", RED, "back"))])

# ───────────────────────── صفحات ادمین ─────────────────────────
async def admin_panels(update):
    kb = [row(btn(f"{'🟢' if p['active'] else '🔴'} {p['name']} ({p['ptype']})", f"pv:{p['id']}"))
          for p in q("SELECT * FROM panels")]
    kb += [row(btn("افزودن پنل", "pn", GREEN, "addbal"))] + admin_back()
    await show(update, f"{E('panel')} <b>مدیریت پنل‌ها (پل اتصال)</b>\nچند پنل = چند لوکیشن هنگام خرید.", kb)

async def admin_plans(update):
    kb = [row(btn(f"{'🟢' if p['active'] else '🔴'} {p['months']}ماهه | {p['gb']}گیگ | {p['days']}روز | {money(p['price'])}",
                  f"plv:{p['id']}")) for p in q("SELECT * FROM plans ORDER BY months, gb")]
    kb += [row(btn("افزودن پلن", "pla", GREEN, "addbal"))] + admin_back()
    await show(update, f"{E('plan')} <b>مدیریت پلن‌ها</b>\nقیمت، حجم و روز را خودت تعیین کن.", kb)

def settings_kb(keys, toggles=()):
    kb = [row(btn(f"{SETTING_TITLES[k]}: {S(k)[:20] or '-'}", f"set:{k}")) for k in keys]
    for k, title in toggles:
        on = S(k) == "1"
        kb.append(row(btn(f"{title}: {'روشن' if on else 'خاموش'}", f"tg:{k}", GREEN if on else RED)))
    return kb + admin_back()

# ───────────────────────── هندلرها ─────────────────────────
def touch(tg_user, ref=None):
    u = get_user(tg_user.id); now = int(time.time())
    if not u:
        ref_by = ref if ref and ref != tg_user.id and get_user(ref) else None
        ex("INSERT INTO users(id,name,username,created,last_seen,ref_by) VALUES(?,?,?,?,?,?)",
           (tg_user.id, tg_user.first_name, tg_user.username, now, now, ref_by))
    else:
        ex("UPDATE users SET name=?, username=?, last_seen=? WHERE id=?",
           (tg_user.first_name, tg_user.username, now, tg_user.id))
    return get_user(tg_user.id)

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    ref = None
    if ctx.args and ctx.args[0].startswith("ref_") and ctx.args[0][4:].isdigit():
        ref = int(ctx.args[0][4:])
    u = touch(update.effective_user, ref)
    clear_state(ctx)
    if u["banned"]: return await update.message.reply_text(render("banned"), parse_mode=ParseMode.HTML)
    if S("start_sticker"):
        try: await update.message.reply_sticker(S("start_sticker"))
        except Exception: pass
    await send_home(update, ctx, u["id"])

async def cmd_emoji(update: Update, ctx):
    if not is_admin(update.effective_user.id): return
    set_state(ctx, "emojiinfo")
    await update.message.reply_text("یک پیام حاوی ایموجی پریمیوم بفرست تا آیدی‌اش را بدهم.")

async def on_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    cq = update.callback_query; uid = cq.from_user.id; d = cq.data
    u = touch(cq.from_user)
    if u["banned"]: return await cq.answer("حساب شما مسدود است", show_alert=True)
    if d == "noop": return await cq.answer()
    await cq.answer()
    adm = is_admin(uid)

    # ---------- کاربر ----------
    if d == "home": clear_state(ctx); return await send_home(update, ctx, uid)
    if d == "buy": return await page_buy(update, ctx)
    if d.startswith("pl:"): return await page_plans(update, ctx, uid, int(d[3:]))
    if d == "suggest": return await page_suggest(update)
    if d.startswith("bp:"):
        pid = int(d[3:]); panels = q("SELECT * FROM panels WHERE active=1")
        if not panels: return await show(update, "فعلاً سروری فعال نیست.", back_home())
        if len(panels) == 1: return await page_invoice(update, uid, pid, panels[0]["id"])
        kb = [row(btn(f"📍 {p['name']}", f"inv:{pid}:{p['id']}", BLUE)) for p in panels]
        return await show(update, "📍 <b>لوکیشن مورد نظر را انتخاب کنید</b>", kb + [row(btn("بازگشت", "buy", RED, "back"))])
    if d.startswith("inv:"):
        _, a, b = d.split(":"); return await page_invoice(update, uid, int(a), int(b))
    if d.startswith("pay:"):
        _, a, b = d.split(":"); return await do_pay(update, ctx, uid, int(a), int(b))
    if d == "account": clear_state(ctx); return await page_account(update, uid)
    if d == "topup": return await page_topup(update)
    if d == "gift": return await page_topup(update, True)
    if d.startswith("ta:"):
        _, a, g = d.split(":"); return await ask_receipt(update, ctx, int(a), g == "1")
    if d.startswith("tc:"):
        set_state(ctx, "amount", d[3:] == "1")
        return await show(update, "💳 مبلغ دلخواه را به تومان بفرستید (فقط عدد):", [row(btn("انصراف", "account", RED, "no"))])
    if d == "subs": return await page_subs(update, uid)
    if d.startswith("sv:"): return await page_service(update, uid, int(d[3:]))
    if d.startswith("qr:"):
        s = q("SELECT * FROM services WHERE id=? AND user_id=?", (int(d[3:]), uid), True)
        img = make_qr(s and (s["sub"] or s["link"]))
        if img: await ctx.bot.send_photo(uid, img, caption=f"<code>{html.escape(s['sub'] or s['link'])}</code>", parse_mode=ParseMode.HTML)
        return
    if d.startswith("qrc:"):  # ➕ QR فقط کانفیگ
        s = q("SELECT * FROM services WHERE id=? AND user_id=?", (int(d[4:]), uid), True)
        img = make_qr(s and s["link"])
        if img: await ctx.bot.send_photo(uid, img, caption=f"🔳 <b>QR کانفیگ</b>\n<code>{html.escape(s['link'][:900])}</code>", parse_mode=ParseMode.HTML)
        return
    # ➕ سایر امکانات جدید
    if d == "ip": return await page_ip(update, uid)
    if d == "usage": return await page_usage(update, uid)
    if d == "myset": return await page_myset(update, uid)
    if d == "remind": return await page_remind(update, uid)
    if d == "rmt": set_S(f"remind:{uid}", "0" if remind_on(uid) else "1"); return await page_remind(update, uid)
    if d == "transfer": clear_state(ctx); return await page_transfer(update, uid)
    if d.startswith("tr:"):
        s = q("SELECT * FROM services WHERE id=? AND user_id=?", (int(d[3:]), uid), True)
        if not s: return await show(update, "سرویس پیدا نشد.", back_more())
        set_state(ctx, "transfer", s["id"])
        return await show(update, f"آیدی عددی کاربری که می‌خواهی سرویس <code>{html.escape(s['username'])}</code> به او منتقل شود را بفرست:\n"
                                  "(کاربر مقصد باید یک‌بار ربات را استارت کرده باشد)", [row(btn("انصراف", "transfer", RED, "no"))])
    if d.startswith("trc:"):
        _, a, b = d.split(":"); s = q("SELECT * FROM services WHERE id=? AND user_id=?", (int(a), uid), True)
        if not s or not get_user(int(b)): return await show(update, "انتقال ممکن نیست.", back_more())
        ex("UPDATE services SET user_id=? WHERE id=?", (int(b), s["id"])); clear_state(ctx)
        try: await ctx.bot.send_message(int(b), f"🔁 سرویس <code>{html.escape(s['username'])}</code> به حساب شما منتقل شد.", parse_mode=ParseMode.HTML)
        except Exception: pass
        return await show(update, f"✅ سرویس <code>{html.escape(s['username'])}</code> به کاربر <code>{b}</code> منتقل شد.", back_more())
    if d == "test": return await do_test(update, ctx, uid)
    if d == "more": return await page_more(update, uid)
    if d in ("help", "rules"): return await show(update, render(d), [row(btn("بازگشت", "more", RED, "back"))])
    if d == "ref":
        me = await ctx.bot.get_me()
        return await show(update, render("ref", PERCENT=S("ref_percent"), LINK=f"https://t.me/{me.username}?start=ref_{uid}"),
                          [row(btn("بازگشت", "more", RED, "back"))])
    if d == "phone":
        kb = ReplyKeyboardMarkup([[KeyboardButton("📱 ارسال شماره", request_contact=True)]], resize_keyboard=True, one_time_keyboard=True)
        return await ctx.bot.send_message(uid, "با دکمه زیر شماره‌ات را بفرست:", reply_markup=kb)

    if not adm: return
    # ---------- ادمین ----------
    if d == "admin": clear_state(ctx); return await show(update, f"{E('admin')} <b>پنل مدیریت</b>", admin_kb())
    if d == "a:stats":
        now = int(time.time())
        t = (f"{E('stats')} <b>آمار</b>\n<blockquote>کاربران: {q('SELECT COUNT(*) c FROM users', one=True)['c']}\n"
             f"مسدود: {q('SELECT COUNT(*) c FROM users WHERE banned=1', one=True)['c']}\n"
             f"سرویس فعال: {q('SELECT COUNT(*) c FROM services WHERE status=? AND expire>?', ('active', now), True)['c']}\n"
             f"فروش کل: {money(q('SELECT COALESCE(SUM(price),0) s FROM services', one=True)['s'])} تومان\n"
             f"شارژ تأییدشده: {money(q('SELECT COALESCE(SUM(amount),0) s FROM payments WHERE status=?', ('ok',), True)['s'])} تومان\n"
             f"رسید در انتظار: {q('SELECT COUNT(*) c FROM payments WHERE status=?', ('pending',), True)['c']}</blockquote>")
        return await show(update, t, admin_back())
    prompts = {"a:addbal": ("addbal", "آیدی و مبلغ را بفرست:\n<code>123456789 50000</code>"),
               "a:subbal": ("subbal", "آیدی و مبلغ کسر:\n<code>123456789 50000</code>"),
               "a:ban": ("ban", "آیدی عددی کاربر برای بن:"), "a:unban": ("unban", "آیدی عددی کاربر برای آن‌بن:"),
               "a:bc": ("bc", "پیام همگانی را بفرست (متن/عکس/هرچی):"),
               "a:search": ("search", "یوزرنیم سرویس روی پنل را بفرست:"),
               "pla": ("pladd", "پلن جدید را این شکلی بفرست:\n<code>ماه حجم روز قیمت</code>\nمثال: <code>1 50 30 82500</code>")}
    if d in prompts:
        set_state(ctx, prompts[d][0]); return await show(update, prompts[d][1], admin_back())
    if d == "a:panels": return await admin_panels(update)
    if d == "a:plans": return await admin_plans(update)
    if d == "pn":
        kb = [row(btn(n, f"pn:{t}", BLUE)) for t, n in PANEL_TYPES]
        kb += [row(btn(f"{n} (به‌زودی)", "soon")) for n in SOON_PANELS]
        return await show(update, "نوع پنل را انتخاب کن:", kb + admin_back("a:panels"))
    if d == "soon": return await cq.answer("به‌زودی اضافه می‌شود", show_alert=True)
    if d.startswith("pn:"):
        ctx.user_data["np"] = {"ptype": d[3:]}; set_state(ctx, "padd", "name")
        return await show(update, "اسم پنل/لوکیشن را بفرست (مثلاً 🇩🇪 آلمان):", admin_back("a:panels"))
    if d == "psave":
        np = ctx.user_data.pop("np", None)
        if np:
            ex("INSERT INTO panels(name,ptype,url,user,password,extra) VALUES(?,?,?,?,?,?)",
               (np["name"], np["ptype"], np.get("url", ""), np.get("user", ""), np.get("password", ""), np.get("extra", "")))
        clear_state(ctx); return await admin_panels(update)
    if d.startswith("pv:"):
        p = q("SELECT * FROM panels WHERE id=?", (int(d[3:]),), True)
        t = (f"{E('panel')} <b>{html.escape(p['name'])}</b> (آیدی {p['id']})\nنوع: {p['ptype']}\nآدرس: {html.escape(p['url'] or '-')}\n"
             f"تنظیمات اضافه: <code>{html.escape(p['extra'] or '-')}</code>")
        kb = [row(btn("تست اتصال", f"pt:{p['id']}", BLUE, "search"),
                  btn("غیرفعال کن" if p["active"] else "فعال کن", f"pg:{p['id']}", RED if p["active"] else GREEN)),
              row(btn("حذف پنل", f"pd:{p['id']}", RED, "no"))] + admin_back("a:panels")
        return await show(update, t, kb)
    if d.startswith("pt:"):
        ok, msg = await panel_test(q("SELECT * FROM panels WHERE id=?", (int(d[3:]),), True))
        return await cq.message.reply_text(msg)
    if d.startswith("pg:"):
        ex("UPDATE panels SET active=1-active WHERE id=?", (int(d[3:]),)); return await admin_panels(update)
    if d.startswith("pd:"):
        ex("DELETE FROM panels WHERE id=?", (int(d[3:]),)); return await admin_panels(update)
    if d.startswith("plv:"):
        p = q("SELECT * FROM plans WHERE id=?", (int(d[4:]),), True)
        t = f"{E('plan')} پلن #{p['id']}\n{p['months']} ماهه | {p['gb']} گیگ | {p['days']} روز | {money(p['price'])} تومان"
        kb = [row(btn("ویرایش قیمت", f"plp:{p['id']}", BLUE, "price"),
                  btn("غیرفعال" if p["active"] else "فعال", f"plg:{p['id']}", RED if p["active"] else GREEN)),
              row(btn("حذف پلن", f"pld:{p['id']}", RED, "no"))] + admin_back("a:plans")
        return await show(update, t, kb)
    if d.startswith("plp:"):
        set_state(ctx, "plprice", int(d[4:])); return await show(update, "قیمت جدید (تومان):", admin_back("a:plans"))
    if d.startswith("plg:"):
        ex("UPDATE plans SET active=1-active WHERE id=?", (int(d[4:]),)); return await admin_plans(update)
    if d.startswith("pld:"):
        ex("DELETE FROM plans WHERE id=?", (int(d[4:]),)); return await admin_plans(update)
    if d == "a:texts":
        kb = [row(btn(v[0], f"tx:{k}", None, "text")) for k, v in TEXTS.items()]
        return await show(update, "✏️ <b>ویرایشگر متن‌ها</b>\nکدام متن را عوض کنیم؟", kb + admin_back())
    if d.startswith("tx:"):
        k = d[3:]; set_state(ctx, "text", k)
        cur = S("text:" + k) or TEXTS[k][1]
        return await show(update, f"متن فعلی «{TEXTS[k][0]}»:\n\n<code>{html.escape(cur)}</code>\n\n"
                                  "متغیرها: {BOT} {USER} {ID} {BALANCE} {PRICE} {GB} {DAYS} {LINK} {NAME} {DATE}\n"
                                  "ایموجی پریمیوم: {E:کلید} یا مستقیم ایموجی پریمیوم داخل متن بذار.\n\n"
                                  "متن جدید را بفرست (یا <code>reset</code> برای پیش‌فرض):",
                          [row(btn("بازگشت", "a:texts", RED, "back"))])
    if d == "a:emoji":
        set_state(ctx, "emojiquick")  # ➕ ارسال مستقیم ایموجی پریمیوم در همین صفحه
        kb = [row(btn(f"{EMOJI[k]} {k} {'✅' if S('emoji:' + k) else ''}", f"em:{k}")) for k in EMOJI]
        kb = [kb[i][0:1] + (kb[i + 1][0:1] if i + 1 < len(kb) else []) for i in range(0, len(kb), 2)]
        kb.append(row(btn(f"ایموجی پریمیوم: {'روشن' if S('premium_on') == '1' else 'خاموش'}", "tg:premium_on",
                          GREEN if S("premium_on") == "1" else RED)))
        kb.append(row(btn("ثبت گروهی با کد ایموجی", "emb", BLUE, "emoji")))  # ➕
        return await show(update, "😀 <b>ایموجی‌های پریمیوم</b>\nروی هر کلید بزن و ایموجی پریمیوم دلخواهت را بفرست.\n"
                                  "(باید صاحب ربات تلگرام پریمیوم داشته باشد)\n\n"
                                  "➕ یا همین‌جا <b>خود ایموجی پریمیوم</b> را بفرست تا بپرسم برای کدام دکمه ثبت شود.", kb + admin_back())
    if d.startswith("em:"):
        ctx.user_data.pop("eq", None)
        set_state(ctx, "emoji", d[3:])
        return await show(update, f"ایموجی پریمیوم برای «{d[3:]}» را بفرست (یا <code>reset</code>):"
                                  "\n\n➕ <b>خود ایموجی پریمیوم</b> را همین‌جا بفرست تا ثبت شود (کد عددی هم قبول است).", admin_back("a:emoji"))
    if d == "emb":  # ➕ ثبت گروهی ایموجی با کد
        set_state(ctx, "emojibulk")
        return await show(update, "هر خط: <code>کلید ایموجی‌پریمیوم</code> (یا کلید کد)\nمثال:\n<code>buy 🛍\nok ✅</code>  ← به جای این‌ها خود ایموجی پریمیوم را بگذار\n\n"
                                  "کلیدها: " + " ".join(f"<code>{k}</code>" for k in EMOJI), admin_back("a:emoji"))
    if d == "a:color" or d.startswith("cp:"):  # ➕ رنگ دکمه‌ها (هر دکمه جدا)
        return await show(update, "🎨 <b>رنگ دکمه‌ها</b>\nروی هر دکمه بزن و رنگش را انتخاب کن.\n"
                                  "⚪️ اورجینال  🟢 سبز  🔴 قرمز  🔵 آبی  ⚫️ بی‌رنگ",
                          color_list_kb(int(d[3:]) if d.startswith("cp:") else 0))
    if d.startswith("cb:"):
        _, i, pg = d.split(":"); i = int(i)
        if not 0 <= i < len(BTN_NAMES): return await show(update, "دکمه پیدا نشد.", color_list_kb())
        return await show(update, f"🎨 رنگ دکمه «<b>{html.escape(BTN_NAMES[i])}</b>» را انتخاب کن:", color_pick_kb(i, int(pg)))
    if d.startswith("cs:"):
        _, i, k, pg = d.split(":"); i = int(i)
        if 0 <= i < len(BTN_NAMES) and k in BTN_COLOR_MODES: set_S("color:" + BTN_NAMES[i], "" if k == "orig" else k)
        return await show(update, f"✅ رنگ «<b>{html.escape(BTN_NAMES[i])}</b>» شد: <b>{BTN_COLOR_MODES[k][0]}</b>",
                          color_list_kb(int(pg)))
    if d == "cr":
        ex("DELETE FROM settings WHERE k LIKE 'color:%'")
        return await show(update, "♻️ رنگ همه دکمه‌ها به حالت اورجینال برگشت.", color_list_kb())
    if d == "a:admins" or d.startswith("adm:"):  # ➕ مدیریت ادمین‌ها (فقط ادمین اصلی)
        if not is_main_admin(uid): return await show(update, "⛔️ فقط ادمین اصلی به این بخش دسترسی دارد.", admin_back())
        if d == "adm:add":
            set_state(ctx, "admadd"); return await show(update, "آیدی عددی ادمین جدید را بفرست:", admin_back("a:admins"))
        if d.startswith("adm:del:"):
            rid = int(d[8:]); save_admins([i for i in extra_admins() if i != rid])
            if rid != MAIN_ADMIN_ID and rid not in ENV_ADMIN_IDS: ADMIN_IDS.discard(rid)
        return await admin_admins(update)
    if d.startswith("eq:"):  # ➕ ثبت ایموجی ارسال‌شده روی دکمه انتخابی
        k, e = d[3:], ctx.user_data.get("eq")
        if not e or k not in EMOJI: return await show(update, "اول ایموجی پریمیوم را بفرست.", admin_back("a:emoji"))
        set_S("emoji:" + k, e[0]); set_S("emoji_fb:" + k, e[1]); set_state(ctx, "emojiquick")
        msg = f'✅ ثبت شد: <b>{k}</b> ← <tg-emoji emoji-id="{e[0]}">{e[1]}</tg-emoji>\nایموجی بعدی را بفرست یا برگرد.'
        return await show(update, msg, admin_back("a:emoji"))
    if d == "a:test":
        panels = "\n".join(f"{p['id']}: {html.escape(p['name'])}" for p in q("SELECT * FROM panels")) or "-"
        return await show(update, f"🆓 <b>تنظیمات اکانت تست</b>\nپنل‌ها:\n{panels}",
                          settings_kb(["test_gb", "test_days", "test_panel"], [("test_enabled", "تست رایگان")]))
    if d == "a:pay":
        return await show(update, "💳 <b>تنظیمات پرداخت و هدیه</b>",
                          settings_kb(["card_number", "card_owner", "gift_min", "gift_percent", "ref_percent"]))
    if d == "a:gen":
        return await show(update, "⚙️ <b>تنظیمات عمومی</b>",
                          settings_kb(["support_url", "channel_url", "start_sticker", "suggest_plan", "bridge_url"]))
    if d.startswith("set:"):
        k = d[4:]; set_state(ctx, "set", k)
        return await show(update, f"مقدار جدید «{SETTING_TITLES[k]}» را بفرست (یا <code>-</code> برای خالی):\nفعلی: <code>{html.escape(S(k))}</code>",
                          admin_back())
    if d.startswith("tg:"):
        k = d[3:]; set_S(k, "0" if S(k) == "1" else "1")
        return await show(update, f"✅ {k} = {'روشن' if S(k) == '1' else 'خاموش'}", admin_kb())
    if d.startswith("pa:") or d.startswith("pr:"):
        pay = q("SELECT * FROM payments WHERE id=?", (int(d[3:]),), True)
        if not pay or pay["status"] != "pending": return await cq.message.reply_text("قبلاً بررسی شده.")
        if d.startswith("pa:"):
            total = pay["amount"] + pay["bonus"]
            ex("UPDATE payments SET status='ok' WHERE id=?", (pay["id"],))
            ex("UPDATE users SET balance=balance+? WHERE id=?", (total, pay["user_id"]))
            payer = get_user(pay["user_id"])
            if payer["ref_by"]:
                share = pay["amount"] * int(S("ref_percent")) // 100
                if share:
                    ex("UPDATE users SET balance=balance+? WHERE id=?", (share, payer["ref_by"]))
                    try: await ctx.bot.send_message(payer["ref_by"], f"🤝 {money(share)} تومان پاداش زیرمجموعه گرفتی!")
                    except Exception: pass
            await ctx.bot.send_message(pay["user_id"], f"✅ {money(total)} تومان به کیف پولت اضافه شد.")
            await cq.edit_message_caption(f"✅ تأیید شد #{pay['id']} | {money(total)}")
        else:
            ex("UPDATE payments SET status='rejected' WHERE id=?", (pay["id"],))
            await ctx.bot.send_message(pay["user_id"], "❌ رسید شما رد شد. با پشتیبانی در ارتباط باشید.")
            await cq.edit_message_caption(f"❌ رد شد #{pay['id']}")
        return
    if d.startswith("dl:"):
        set_state(ctx, "deliver", int(d[3:])); return await cq.message.reply_text("لینک/کانفیگ این سفارش را بفرست:")

async def on_message(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    m = update.effective_message; uid = update.effective_user.id
    u = touch(update.effective_user)
    if u["banned"]: return
    if m.contact and m.contact.user_id == uid:
        ex("UPDATE users SET phone=? WHERE id=?", (m.contact.phone_number, uid))
        await m.reply_text("✅ شماره ثبت شد.", reply_markup=ReplyKeyboardRemove())
        return await page_account(update, uid)
    st = ctx.user_data.get("state")
    if not st: return
    name, txt = st[0], (m.text or "").strip()

    # ---------- کاربر ----------
    if name == "amount":
        if not txt.replace(",", "").isdigit() or int(txt.replace(",", "")) < 10000:
            return await m.reply_text("فقط عدد بالای ۱۰,۰۰۰ تومان بفرست.")
        return await ask_receipt(update, ctx, int(txt.replace(",", "")), st[1])
    if name == "receipt":
        if not m.photo: return await m.reply_text("لطفاً عکس رسید را بفرست.")
        amount, gift = st[1], st[2]
        bonus = amount * int(S("gift_percent")) // 100 if gift and amount >= int(S("gift_min")) else 0
        pid = ex("INSERT INTO payments(user_id,amount,bonus,photo,created) VALUES(?,?,?,?,?)",
                 (uid, amount, bonus, m.photo[-1].file_id, int(time.time())))
        clear_state(ctx)
        cap = (f"🧾 رسید #{pid}\nکاربر: <code>{uid}</code> ({html.escape(u['name'] or '')})\n"
               f"مبلغ: {money(amount)}{f' + هدیه {money(bonus)}' if bonus else ''} تومان")
        kb = IKM([row(btn("تأیید", f"pa:{pid}", GREEN, "ok"), btn("رد", f"pr:{pid}", RED, "no"))])
        for a in ADMIN_IDS:
            try: await ctx.bot.send_photo(a, m.photo[-1].file_id, caption=cap, parse_mode=ParseMode.HTML, reply_markup=kb)
            except Exception: pass
        return await m.reply_text(render("receipt_wait"), parse_mode=ParseMode.HTML, reply_markup=IKM(back_home()))

    if name == "transfer":  # ➕ انتقال سرویس
        t = txt.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789"))
        if not t.isdigit(): return await m.reply_text("فقط آیدی عددی بفرست.")
        if int(t) == uid: return await m.reply_text("نمی‌توانی به خودت منتقل کنی.")
        if not get_user(int(t)): return await m.reply_text("این کاربر پیدا نشد (باید یک‌بار ربات را استارت کرده باشد).")
        s = q("SELECT * FROM services WHERE id=? AND user_id=?", (st[1], uid), True)
        if not s: clear_state(ctx); return await m.reply_text("سرویس پیدا نشد.")
        kb = [row(btn("تأیید انتقال", f"trc:{s['id']}:{t}", GREEN, "ok"), btn("انصراف", "transfer", RED, "no"))]
        return await m.reply_text(f"سرویس <code>{html.escape(s['username'])}</code> به کاربر <code>{t}</code> منتقل شود؟",
                                  parse_mode=ParseMode.HTML, reply_markup=IKM(kb))
    if not is_admin(uid): return
    # ---------- ادمین ----------
    if name == "emojiinfo" or name == "emoji":
        ids = premium_ids(m)  # ➕ متن و کپشن
        if name == "emoji":
            if txt.lower() == "reset": set_S("emoji:" + st[1], "")
            elif not ids and parse_emoji_ids(txt):  # ➕ کد عددی ایموجی
                eid = parse_emoji_ids(txt)[0]
                valid, fb = await check_emoji(ctx.bot, eid)
                if not valid: return await m.reply_text(f"❌ کد <code>{eid}</code> در تلگرام وجود ندارد. کد درست را بفرست.", parse_mode=ParseMode.HTML)
                set_S("emoji:" + st[1], eid); set_S("emoji_fb:" + st[1], fb); clear_state(ctx)
                try:
                    return await m.reply_text(f"✅ ذخیره شد: {st[1]}  →  <tg-emoji emoji-id=\"{eid}\">{fb}</tg-emoji>\n<code>{eid}</code>",
                                              parse_mode=ParseMode.HTML, reply_markup=IKM(admin_back("a:emoji")))
                except Exception as e:
                    return await m.reply_text(f"✅ ذخیره شد: {st[1]} ({eid})\n⚠️ تلگرام اجازه نمایش این ایموجی را به ربات نداد: {e}\n"
                                              "(برای نمایش ایموجی پریمیوم، صاحب ربات باید تلگرام پریمیوم داشته باشد)",
                                              reply_markup=IKM(admin_back("a:emoji")))
            elif not ids: return await m.reply_text("ایموجی پریمیوم پیدا نکردم. یک ایموجی پریمیوم بفرست.")
            else: set_S("emoji:" + st[1], ids[0])
            if ids and txt.lower() != "reset":  # ➕ ذخیره خود ایموجی + پیش‌نمایش
                fb = entity_fb(m, ids[0]); set_S("emoji_fb:" + st[1], fb)
                try: await m.reply_text(f'پیش‌نمایش: <tg-emoji emoji-id="{ids[0]}">{fb}</tg-emoji>', parse_mode=ParseMode.HTML)
                except Exception as e: await m.reply_text(f"⚠️ ذخیره شد ولی تلگرام اجازه نمایش نداد: {e}")
            clear_state(ctx); return await m.reply_text(f"✅ ذخیره شد: {st[1]}", reply_markup=IKM(admin_back("a:emoji")))
        if not ids and parse_emoji_ids(txt):  # ➕ پیش‌نمایش کد عددی
            return await m.reply_text("\n".join(f'<tg-emoji emoji-id="{i}">⭐️</tg-emoji> <code>{i}</code>' for i in parse_emoji_ids(txt)),
                                      parse_mode=ParseMode.HTML)
        if m.sticker: return await m.reply_text(f"file_id استیکر:\n<code>{m.sticker.file_id}</code>", parse_mode=ParseMode.HTML)
        return await m.reply_text("\n".join(f"<code>{i}</code>" for i in ids) or "ایموجی پریمیوم نبود.", parse_mode=ParseMode.HTML)
    if name == "emojiquick":  # ➕ ایموجی پریمیوم مستقیم → انتخاب دکمه
        ids = premium_ids(m)
        if ids: eid, fb = ids[0], entity_fb(m, ids[0])
        elif parse_emoji_ids(txt):
            eid = parse_emoji_ids(txt)[0]; valid, fb = await check_emoji(ctx.bot, eid)
            if not valid: return await m.reply_text("❌ این کد ایموجی معتبر نیست.")
        else:
            return await m.reply_text("ایموجی پریمیوم پیدا نکردم. (فرستنده باید تلگرام پریمیوم داشته باشد تا ایموجی پریمیوم بفرستد)")
        ctx.user_data["eq"] = (eid, fb)
        t = f'این ایموجی <tg-emoji emoji-id="{eid}">{fb}</tg-emoji> برای کدام دکمه ثبت شود؟\n<code>{eid}</code>'
        try: return await m.reply_text(t, parse_mode=ParseMode.HTML, reply_markup=IKM(emoji_pick_kb()))
        except Exception:
            t2, _ = strip_premium(t, None)
            return await m.reply_text(t2, parse_mode=ParseMode.HTML, reply_markup=IKM(emoji_pick_kb()))
    if name == "emojibulk":  # ➕ ثبت گروهی ایموجی با کد
        ok, bad = [], []
        pl = premium_by_line(m)
        for li, line in enumerate((m.text or "").splitlines()):
            parts = line.replace("»", " ").replace(":", " ").split()
            if not parts: continue
            if li in pl and parts[0] in EMOJI:  # ➕ خود ایموجی پریمیوم
                set_S("emoji:" + parts[0], pl[li][0]); set_S("emoji_fb:" + parts[0], pl[li][1])
                ok.append(f'{parts[0]} <tg-emoji emoji-id="{pl[li][0]}">{pl[li][1]}</tg-emoji>'); continue
            ids = parse_emoji_ids(line)
            if parts[0] in EMOJI and ids:
                valid, fb = await check_emoji(ctx.bot, ids[0])
                if not valid: bad.append(html.escape(line) + " (کد نامعتبر)"); continue
                set_S("emoji:" + parts[0], ids[0]); set_S("emoji_fb:" + parts[0], fb); ok.append(f'{parts[0]} <tg-emoji emoji-id="{ids[0]}">{fb}</tg-emoji>')
            else: bad.append(html.escape(line))
        clear_state(ctx)
        msg = ("✅ ذخیره شد:\n" + "\n".join(ok) if ok else "چیزی ذخیره نشد.") + ("\n\n❌ نامعتبر:\n" + "\n".join(bad) if bad else "")
        try: return await m.reply_text(msg, parse_mode=ParseMode.HTML, reply_markup=IKM(admin_back("a:emoji")))
        except Exception:
            t2, _ = strip_premium(msg, None)
            return await m.reply_text(t2 + "\n\n⚠️ تلگرام اجازه نمایش ایموجی پریمیوم را به ربات نداد (صاحب ربات باید پریمیوم باشد).",
                                      parse_mode=ParseMode.HTML, reply_markup=IKM(admin_back("a:emoji")))
    if name == "admadd":  # ➕ افزودن ادمین
        if not is_main_admin(uid): clear_state(ctx); return
        fo = getattr(m, "forward_origin", None); fu = getattr(fo, "sender_user", None) if fo else None
        if fu: txt = str(fu.id)  # پیام فوروارد‌شده از خود شخص هم قبول است
        txt = txt.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789"))
        if not txt.isdigit(): return await m.reply_text("فقط آیدی عددی بفرست (یا یک پیام از خود شخص فوروارد کن).")
        nid = int(txt); save_admins(extra_admins() + [nid]); ADMIN_IDS.add(nid); clear_state(ctx)
        try: await ctx.bot.send_message(nid, "🛠 شما به عنوان ادمین ربات اضافه شدید. /start را بزنید.")
        except Exception: pass
        return await m.reply_text(f"✅ ادمین <code>{nid}</code> اضافه شد.", parse_mode=ParseMode.HTML,
                                  reply_markup=IKM([row(btn("مدیریت ادمین‌ها", "a:admins", BLUE, "admin"))] + admin_back()))
    if name == "set":
        k = st[1]
        val = m.sticker.file_id if (k == "start_sticker" and m.sticker) else ("" if txt == "-" else txt)
        set_S(k, val); clear_state(ctx)
        return await m.reply_text(f"✅ {SETTING_TITLES[k]} ذخیره شد.", reply_markup=IKM(admin_kb()))
    if name == "text":
        if txt.lower() == "reset": set_S("text:" + st[1], "")
        else: set_S("text:" + st[1], m.text_html)  # ایموجی‌های پریمیوم و فرمت‌ها حفظ می‌شوند
        clear_state(ctx); return await m.reply_text("✅ متن ذخیره شد.", reply_markup=IKM(admin_back("a:texts")))
    if name in ("addbal", "subbal"):
        parts = txt.split()
        if len(parts) != 2 or not all(x.isdigit() for x in parts): return await m.reply_text("فرمت: آیدی مبلغ")
        tid, amt = int(parts[0]), int(parts[1])
        if not get_user(tid): return await m.reply_text("کاربر پیدا نشد (باید یک‌بار ربات را استارت کرده باشد).")
        ex("UPDATE users SET balance=balance" + ("+" if name == "addbal" else "-") + "? WHERE id=?", (amt, tid))
        clear_state(ctx)
        try: await ctx.bot.send_message(tid, f"{'➕' if name == 'addbal' else '➖'} {money(amt)} تومان {'به' if name == 'addbal' else 'از'} کیف پول شما {'اضافه' if name == 'addbal' else 'کسر'} شد.")
        except Exception: pass
        return await m.reply_text(f"✅ انجام شد. موجودی جدید: {money(get_user(tid)['balance'])}", reply_markup=IKM(admin_kb()))
    if name in ("ban", "unban"):
        if not txt.isdigit(): return await m.reply_text("آیدی عددی بفرست.")
        ex("UPDATE users SET banned=? WHERE id=?", (1 if name == "ban" else 0, int(txt))); clear_state(ctx)
        return await m.reply_text(f"✅ کاربر {txt} {'بن' if name == 'ban' else 'آن‌بن'} شد.", reply_markup=IKM(admin_kb()))
    if name == "bc":
        clear_state(ctx); ok = 0
        for r in q("SELECT id FROM users WHERE banned=0"):
            try: await m.copy(r["id"]); ok += 1
            except Exception: pass
        return await m.reply_text(f"📢 ارسال شد برای {ok} نفر.", reply_markup=IKM(admin_kb()))
    if name == "search":
        out = []
        for p in q("SELECT * FROM panels WHERE active=1 AND ptype!='manual'"):
            try:
                i = await panel_info(p, txt)
                if i and i.get("status"): out.append(f"📍 {html.escape(p['name'])}: {i['status']} | {i['used']:.2f}/{i['total']:.0f}GB | {i['expire']}")
            except Exception: pass
        s = q("SELECT * FROM services WHERE username=?", (txt,), True)
        if s: out.append(f"👤 مالک تلگرام: <code>{s['user_id']}</code>")
        clear_state(ctx)
        return await m.reply_text("\n".join(out) or "روی هیچ پنلی پیدا نشد.", parse_mode=ParseMode.HTML, reply_markup=IKM(admin_kb()))
    if name == "pladd":
        parts = txt.split()
        if len(parts) != 4 or not all(x.isdigit() for x in parts): return await m.reply_text("فرمت: ماه حجم روز قیمت")
        ex("INSERT INTO plans(months,gb,days,price) VALUES(?,?,?,?)", tuple(map(int, parts))); clear_state(ctx)
        return await m.reply_text("✅ پلن اضافه شد.", reply_markup=IKM(admin_back("a:plans")))
    if name == "plprice":
        if not txt.isdigit(): return await m.reply_text("فقط عدد.")
        ex("UPDATE plans SET price=? WHERE id=?", (int(txt), st[1])); clear_state(ctx)
        return await m.reply_text("✅ قیمت به‌روز شد.", reply_markup=IKM(admin_back("a:plans")))
    if name == "deliver":
        s = q("SELECT * FROM services WHERE id=?", (st[1],), True)
        ex("UPDATE services SET link=?, sub=?, status='active', created=?, expire=? WHERE id=?",
           (txt, txt, int(time.time()), int(time.time()) + s["days"] * 86400, s["id"]))
        clear_state(ctx); await deliver(ctx, s["user_id"], s["id"], "test_delivery" if s["is_test"] else "delivery")
        return await m.reply_text("✅ برای کاربر ارسال شد.")
    if name == "padd":
        np, step = ctx.user_data.setdefault("np", {}), st[1]
        manual = np.get("ptype") == "manual"
        flow = ["name"] if manual else ["name", "url", "user", "password", "extra"]
        key = {"name": "name", "url": "url", "user": "user", "password": "password", "extra": "extra"}[step]
        np[key] = "" if (step == "extra" and txt == "-") else txt.rstrip("/") if step == "url" else txt
        nxt = flow.index(step) + 1
        asks = {"url": "آدرس پنل با پورت (مثل https://panel.site.com:8000):", "user": "یوزرنیم ادمین پنل:",
                "password": "پسورد ادمین پنل:",
                "extra": f"تنظیمات اضافه: {EXTRA_HINT.get(np['ptype'], '-')}\n(یا - برای رد کردن)"}
        if nxt < len(flow):
            set_state(ctx, "padd", flow[nxt]); return await m.reply_text(asks[flow[nxt]])
        await m.reply_text("⏳ در حال تست اتصال...")
        ok, msg = await panel_test(np)
        kb = [row(btn("ذخیره", "psave", GREEN, "ok") if ok else btn("ذخیره به هر حال", "psave", RED, "no")),
              row(btn("لغو", "a:panels", RED, "back"))]
        return await m.reply_text(msg, reply_markup=IKM(kb))

# ───────────────────────── کار زمان‌بندی‌شده (پیگیری تست/انقضا) ─────────────────────────
async def job_followup(ctx: ContextTypes.DEFAULT_TYPE):
    now = int(time.time())
    for s in q("SELECT * FROM services WHERE status='active'"):
        if not s["is_test"] and not remind_on(s["user_id"]):  # ➕ یادآور خاموش
            if now >= s["expire"]: ex("UPDATE services SET status='expired' WHERE id=?", (s["id"],))
            continue
        u = get_user(s["user_id"]); name = html.escape(u["name"] or "") if u else ""
        buy_kb = IKM([row(btn("خرید اشتراک", "buy", GREEN, "buy"))])
        try:
            if s["is_test"]:
                if not s["mid_sent"] and now >= (s["created"] + s["expire"]) // 2:
                    await ctx.bot.send_message(s["user_id"], render("test_mid", USER=name), parse_mode=ParseMode.HTML, reply_markup=buy_kb)
                    ex("UPDATE services SET mid_sent=1 WHERE id=?", (s["id"],))
                if not s["end_sent"] and now >= s["expire"]:
                    await ctx.bot.send_message(s["user_id"], render("test_end", USER=name), parse_mode=ParseMode.HTML, reply_markup=buy_kb)
                    ex("UPDATE services SET end_sent=1, status='expired' WHERE id=?", (s["id"],))
            else:
                if not s["mid_sent"] and 0 < s["expire"] - now < 86400:
                    await ctx.bot.send_message(s["user_id"], render("expire_soon", NAME=s["username"]), parse_mode=ParseMode.HTML, reply_markup=buy_kb)
                    ex("UPDATE services SET mid_sent=1 WHERE id=?", (s["id"],))
                if now >= s["expire"]: ex("UPDATE services SET status='expired' WHERE id=?", (s["id"],))
        except Exception as e:
            log.warning("followup %s: %s", s["id"], e)

def main():
    init_db()
    load_admins()  # ➕
    app = Application.builder().token(BOT_TOKEN).build()
    app.post_init = ip_server_start  # ➕ وب‌سرور اطلاعات IP
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("emoji", cmd_emoji))
    app.add_handler(CallbackQueryHandler(on_callback))
    app.add_handler(MessageHandler(~filters.COMMAND, on_message))
    app.job_queue.run_repeating(job_followup, interval=300, first=30)
    log.info("bot started")
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
