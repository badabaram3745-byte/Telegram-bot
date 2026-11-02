# AI Chat (ریلوی)

چت وب/موبایل برای هر API سازگار با OpenAI (`/v1/models` و `/v1/chat/completions`).
متن، عکس، فایل (txt/md/json/csv/pdf)، صدا (mp3/wav)، ورودی صوتی، استریم، تنظیمات، خروجی گرفتن، خوندن پاسخ با صدا، نصب روی گوشی (PWA).

## دیپلوی
1. این پوشه رو توی یه ریپوی GitHub جدید آپلود کن.
2. توی Railway: New Project > Deploy from GitHub repo > ریپو رو انتخاب کن.
3. (اختیاری) توی Variables مقدار `API_BASE_URL` و `API_KEY` رو بذار.
4. توی Settings > Networking > Generate Domain بزن تا لینک بگیری.

Railway خودش `PORT` رو میده و Node رو تشخیص میده. نیاز به تنظیم Build یا Start Command نیست (`npm start`).

## نکته
کلیدها و تنظیمات کاربر فقط توی localStorage مرورگر ذخیره میشن. سرور فقط درخواست رو به API مقصد پروکسی میکنه.
