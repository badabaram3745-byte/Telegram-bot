(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const DEF = { lang: 'fa', theme: 'system', base: '', key: '', appPass: '', rememberKey: true, model: '', system: '', temperature: 0.7, maxTokens: 2048, historyLimit: 40, syncCode: '', bgFx: true, stream: true, speak: false, modelCache: [] };
  const safeParse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

  const I18N = {
    fa: {
      newChat: '+ چت جدید', settings: 'تنظیمات', toBottom: 'برو به آخرین پیام',
      sThisChat: 'این چت', sFx: 'پس‌زمینه متحرک (نور آبی و رعد)', sProject: 'پروژه', sPreset: 'پریست', sChatSystem: 'دستور این چت (System prompt)', sChatModel: 'مدل این چت', useGlobal: 'همون مدل کلی', noProject: 'بدون پروژه', sProjects: 'پروژه‌ها', projNamePh: 'اسم پروژه جدید', projAdd: 'ساختن', projNeedName: 'اول یه اسم بنویس', projInstr: 'دستورالعمل پروژه (همیشه اعمال میشه)', projAddFile: 'افزودن فایل متنی', projDel: 'حذف پروژه', confirmDelProj: 'این پروژه حذف بشه؟ چت‌هاش حذف نمیشن.', projFiles: (n) => `${n} فایل`, presetNone: 'بدون پریست', presetCode: 'برنامه‌نویس', presetTrans: 'مترجم', presetWriter: 'نویسنده', presetTeacher: 'معلم', sWeb: 'جستجوی وب برای هر سوال', sCompare: 'مدل دوم برای مقایسه (خالی = خاموش)', compareOff: 'خاموش', webOff: 'سرور هنوز کلید جستجو نداره (BRAVE_API_KEY)',
      sHistory: 'تعداد پیام‌های آخر که فرستاده میشن (۰ = همه)', sSync: 'همگام‌سازی بین دستگاه‌ها', sSyncCode: 'کد همگام‌سازی (حداقل ۸ کاراکتر)', sSyncHint: 'همین کد رو روی دستگاه دیگه هم بذار. مثل رمز نگهش دار.', syncNow: 'همگام‌سازی الان', syncOff: 'همگام‌سازی خاموشه', syncOk: 'همگام‌سازی شد', syncFail: 'همگام‌سازی نشد', sData: 'داده‌ها', exportAll: 'خروجی کل چت‌ها', importAll: 'وارد کردن فایل پشتیبان', importDone: 'چت‌های جدید اضافه شدن', importFail: 'فایل پشتیبان معتبر نیست', rename: 'تغییر اسم', renamePrompt: 'اسم جدید چت', searchPh: 'جستجو توی چت‌ها', edit: 'ویرایش', editing: 'پیامتو ویرایش کن و بفرست. پیام‌های بعدش پاک میشن.', sRemember: 'کلید رو روی این دستگاه نگه دار', sAppPass: 'رمز ورود سایت', sAppPassPh: 'فقط اگه سرور رمز داره', needPass: 'رمز ورود لازمه یا اشتباهه. توی تنظیمات وارد کن.', sSecretWarn: 'اگه غیر از خودت کسی به این دستگاه دسترسی داره، تیک «نگه دار» رو بردار. کلید بعد از بستن مرورگر پاک میشه.', loading: 'در حال بارگذاری...', export: 'خروجی گرفتن', menu: 'منو', untitled: 'چت جدید',
      noModel: 'مدل انتخاب نشده', noChats: 'هنوز چتی نداری', welcomeTitle: 'چی توی ذهنته؟',
      welcomeText: 'متن، عکس، فایل، صدا یا ورودی صوتی بفرست. اول آدرس API رو از تنظیمات وصل کن.',
      placeholder: 'پیامت رو بنویس...', attach: 'ارسال فایل', mic: 'ضبط پیام صوتی', send: 'ارسال', stop: 'توقف',
      copy: 'کپی', read: 'خواندن', regen: 'تولید دوباره', remove: 'حذف', copied: 'کپی شد', copyFail: 'کپی نشد',
      stopped: '(متوقف شد)', chatEmpty: 'چت خالیه', needApi: 'اول آدرس API رو وارد کن', needModel: 'یه مدل انتخاب کن',
      noSpeech: 'مرورگرت خواندن با صدا رو نداره', noMic: 'این مرورگر ورودی صوتی نداره. Chrome، Edge یا Safari جدید رو امتحان کن.',
      micFail: 'ورودی صوتی کار نکرد', storageFull: 'حافظه مرورگر پره. چت‌های قدیمی یا فایل‌های بزرگ رو پاک کن.',
      tooBig: 'بزرگتر از ۳ مگابایته', unsupported: 'این نوع فایل پشتیبانی نمیشه',
      unsupportedAudio: (n) => `[فایل صوتی ${n} با این فرمت پشتیبانی نمیشه. mp3 یا wav بفرست]`,
      modelsFound: (n) => `${n} مدل پیدا شد`, noModels: 'مدلی پیدا نشد', noModelsLoaded: 'اول آدرس API رو وارد کن',
      loadErr: 'خطا در گرفتن مدل‌ها', saved: 'ذخیره شد', confirmDelChat: 'این چت حذف بشه؟',
      confirmClear: 'همه چت‌ها پاک بشن؟ این کار برگشت نداره.', sGeneral: 'عمومی', sLang: 'زبان', sTheme: 'تم',
      themeSystem: 'سیستم', themeDark: 'تاریک', themeLight: 'روشن', sApi: 'اتصال API', sApiUrl: 'آدرس API',
      sModel: 'مدل', sRefresh: 'بروزرسانی لیست مدل‌ها', sChat: 'تنظیمات چت', sSystem: 'System prompt',
      sSystemPh: 'مثلاً: همیشه فارسی جواب بده', sTemp: 'خلاقیت', sMax: 'حداکثر توکن', sStream: 'پاسخ استریم (تایپ زنده)',
      sSpeak: 'پاسخ‌ها رو با صدا بخون', sDanger: 'منطقه خطر', deleteChat: 'حذف این چت', clearAll: 'پاک کردن همه چت‌ها',
      save: 'ذخیره', recShort: 'خیلی کوتاه بود', micDenied: 'دسترسی میکروفون داده نشد', stillUploading: 'صبر کن تا فایل آپلود بشه', recStart: 'ضبط شروع شد. دوباره بزن تا تموم شه', classModel: 'این مدل فیلتر امنیتیه و برای چت نیست. یه مدل چت از لیست انتخاب کن.', resetSettings: 'بازگشت به تنظیمات اولیه', confirmReset: 'همه تنظیمات (آدرس API، کلید، زبان، تم) به حالت اول برگرده؟ چت‌ها پاک نمیشن.', resetDone: 'تنظیمات به حالت اول برگشت', close: 'بستن', hint: 'کلید و تنظیمات فقط داخل همین مرورگر ذخیره میشن.', hintBase: 'خالی = آدرس پیش‌فرض سرور'
    },
    en: {
      newChat: '+ New chat', settings: 'Settings', toBottom: 'Jump to latest',
      sThisChat: 'This chat', sFx: 'Animated background (blue light and lightning)', sProject: 'Project', sPreset: 'Preset', sChatSystem: 'This chat instructions (system prompt)', sChatModel: 'Model for this chat', useGlobal: 'Same as global', noProject: 'No project', sProjects: 'Projects', projNamePh: 'New project name', projAdd: 'Create', projNeedName: 'Give it a name first', projInstr: 'Project instructions (always applied)', projAddFile: 'Add text file', projDel: 'Delete project', confirmDelProj: 'Delete this project? Its chats stay.', projFiles: (n) => `${n} files`, presetNone: 'No preset', presetCode: 'Programmer', presetTrans: 'Translator', presetWriter: 'Writer', presetTeacher: 'Teacher', sWeb: 'Web search for each question', sCompare: 'Second model for comparison (empty = off)', compareOff: 'Off', webOff: 'Server has no search key yet (BRAVE_API_KEY)',
      sHistory: 'Recent messages sent (0 = all)', sSync: 'Sync across devices', sSyncCode: 'Sync code (min 8 characters)', sSyncHint: 'Use the same code on your other device. Keep it like a password.', syncNow: 'Sync now', syncOff: 'Sync is off', syncOk: 'Synced', syncFail: 'Sync failed', sData: 'Data', exportAll: 'Export all chats', importAll: 'Import backup file', importDone: 'New chats were added', importFail: 'Not a valid backup file', rename: 'Rename', renamePrompt: 'New chat name', searchPh: 'Search chats', edit: 'Edit', editing: 'Edit your message and send. Replies after it will be removed.', sRemember: 'Keep the key on this device', sAppPass: 'Site password', sAppPassPh: 'Only if the server has one', needPass: 'Site password is required or wrong. Enter it in Settings.', sSecretWarn: 'If others can use this device, untick Keep so the key is cleared when the browser closes.', loading: 'Loading...', export: 'Export chat', menu: 'Menu', untitled: 'New chat',
      noModel: 'No model selected', noChats: 'No chats yet', welcomeTitle: 'What’s on your mind?',
      welcomeText: 'Send text, images, files, audio or voice input. Connect your API URL in Settings first.',
      placeholder: 'Type a message...', attach: 'Attach file', mic: 'Record voice message', send: 'Send', stop: 'Stop',
      copy: 'Copy', read: 'Read aloud', regen: 'Regenerate', remove: 'Delete', copied: 'Copied', copyFail: 'Copy failed',
      stopped: '(stopped)', chatEmpty: 'This chat is empty', needApi: 'Enter your API URL first', needModel: 'Pick a model',
      noSpeech: 'Your browser can’t read text aloud', noMic: 'This browser has no voice input. Try Chrome, Edge or recent Safari.',
      micFail: 'Voice input failed', storageFull: 'Browser storage is full. Delete old chats or big files.',
      tooBig: 'Over 3 MB', unsupported: 'This file type isn’t supported',
      unsupportedAudio: (n) => `[Audio file ${n} is not supported in this format. Send mp3 or wav]`,
      modelsFound: (n) => `${n} models found`, noModels: 'No models found', noModelsLoaded: 'Enter your API URL first',
      loadErr: 'Could not load models', saved: 'Saved', confirmDelChat: 'Delete this chat?',
      confirmClear: 'Delete all chats? This can’t be undone.', sGeneral: 'General', sLang: 'Language', sTheme: 'Theme',
      themeSystem: 'System', themeDark: 'Dark', themeLight: 'Light', sApi: 'API connection', sApiUrl: 'API URL',
      sModel: 'Model', sRefresh: 'Refresh model list', sChat: 'Chat settings', sSystem: 'System prompt',
      sSystemPh: 'e.g. always answer in Persian', sTemp: 'Creativity', sMax: 'Max tokens', sStream: 'Stream replies (live typing)',
      sSpeak: 'Read replies aloud', sDanger: 'Danger zone', deleteChat: 'Delete this chat', clearAll: 'Delete all chats',
      save: 'Save', recShort: 'Too short', micDenied: 'Microphone access was denied', stillUploading: 'Wait for the upload to finish', recStart: 'Recording. Tap again to stop', classModel: 'This is a safety filter model, not a chat model. Pick a chat model from the list.', resetSettings: 'Reset settings', confirmReset: 'Reset all settings (API URL, key, language, theme) to defaults? Chats stay.', resetDone: 'Settings reset', close: 'Close', hint: 'Your key and settings stay in this browser only.', hintBase: 'Empty = server default'
    }
  };

  const SECRET_FIELDS = ['key', 'appPass', 'syncCode'];

  // IndexedDB: chats and attached files can be large, localStorage is only ~5MB
  const DB = (() => {
    let dbp = null;
    const open = () => {
      if (!dbp) {
        dbp = new Promise((res, rej) => {
          const r = indexedDB.open('aichat', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('kv');
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
      }
      return dbp;
    };
    return {
      async get(k) {
        const db = await open();
        return new Promise((res, rej) => {
          const q = db.transaction('kv').objectStore('kv').get(k);
          q.onsuccess = () => res(q.result);
          q.onerror = () => rej(q.error);
        });
      },
      async set(k, v) {
        const db = await open();
        return new Promise((res, rej) => {
          const tx = db.transaction('kv', 'readwrite');
          tx.objectStore('kv').put(v, k);
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
          tx.onabort = () => rej(tx.error || new Error('abort'));
        });
      }
    };
  })();

  function loadSettings() {
    const s = Object.assign({}, DEF, safeParse(localStorage.getItem('cb_settings')));
    if (!s.rememberKey) {
      const sess = safeParse(sessionStorage.getItem('cb_secrets')) || {};
      SECRET_FIELDS.forEach((f) => { s[f] = sess[f] || ''; });
    }
    return s;
  }

  function saveSettingsStore() {
    const pub = Object.assign({}, settings);
    const secrets = {};
    SECRET_FIELDS.forEach((f) => { secrets[f] = pub[f] || ''; delete pub[f]; });
    if (settings.rememberKey) {
      localStorage.setItem('cb_settings', JSON.stringify(Object.assign(pub, secrets)));
      sessionStorage.removeItem('cb_secrets');
    } else {
      localStorage.setItem('cb_settings', JSON.stringify(pub));
      sessionStorage.setItem('cb_secrets', JSON.stringify(secrets));
    }
  }

  let settings = loadSettings();
  let followStream = true;
  let editIdx = null;
  let projects = [];
  let draftCfg = null;
  let stopRequested = false;
  let convs = [];
  let currentId = null;
  let ready = false;
  let config = { hasDefaultBase: false, hasDefaultKey: false };
  let pending = [];
  let busy = false;
  let abortCtrl = null;
  let rafPending = false;
  let recog = null;

  const t = (k, ...a) => {
    const d = I18N[settings.lang] || I18N.fa;
    const v = d[k] !== undefined ? d[k] : (I18N.en[k] !== undefined ? I18N.en[k] : k);
    return typeof v === 'function' ? v(...a) : v;
  };

  function persist() {
    try {
      saveSettingsStore();
    } catch {
      toast(t('storageFull'), 5000);
    }
    if (ready) {
      DB.set('convs', convs).catch(() => toast(t('storageFull'), 5000));
      scheduleSyncPush();
    }
  }

  function toast(msg, ms = 3000) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(el._h);
    el._h = setTimeout(() => { el.hidden = true; }, ms);
  }

  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function current() { return convs.find((c) => c.id === currentId); }
  function hasApi() { return !!(settings.base || config.hasDefaultBase); }
  function isFa() { return settings.lang !== 'en'; }

  function friendly(status, text) {
    if (status === 401) return t('needPass');
    if (/classification/i.test(String(text))) return t('classModel');
    let msg = '';
    try {
      const j = JSON.parse(text);
      msg = (j.error && (j.error.message || (typeof j.error === 'string' ? j.error : ''))) || j.message || '';
    } catch {}
    if (!msg) msg = String(text || '').slice(0, 300);
    return `HTTP ${status}: ${msg}`;
  }

  function mdTables(src) {
    const isRow = (l) => /^\s*\|.*\|\s*$/.test(l);
    const isSep = (l) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l);
    const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    const lines = src.split('\n');
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      if (isRow(lines[i]) && i + 1 < lines.length && isSep(lines[i + 1])) {
        let html = '<div class="tbl"><table><thead><tr>' + cells(lines[i]).map((c) => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
        i += 2;
        while (i < lines.length && isRow(lines[i])) {
          html += '<tr>' + cells(lines[i]).map((c) => `<td>${c}</td>`).join('') + '</tr>';
          i++;
        }
        i--;
        out.push(html + '</tbody></table></div>');
      } else {
        out.push(lines[i]);
      }
    }
    return out.join('\n');
  }

  function md(text) {
    const blocks = [];
    let html = esc(text).replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      blocks.push('<pre><code>' + code + '</code></pre>');
      return '\u0001' + (blocks.length - 1) + '\u0001';
    });
    html = mdTables(html);
    html = html
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/^#{1,3} (.+)$/gm, '<strong>$1</strong>')
      .replace(/^[-*] (.+)$/gm, '• $1')
      .replace(/!\[([^\]]*)\]\((data:image\/[a-z.+-]+;base64,[A-Za-z0-9+/=]+|https?:\/\/[^\s)]+)\)/g, '<img class="att-img" alt="$1" src="$2">')
      .replace(/(^|[\s>])(https?:\/\/[^\s<"]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
      .replace(/\[([^\]]+)\]\((data:[^\s)]+|https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" download>$1</a>')
      .replace(/\n/g, '<br>');
    return html.replace(/\u0001(\d+)\u0001/g, (_, i) => blocks[Number(i)]);
  }

  function stripMd(s) { return String(s).replace(/```[\s\S]*?```/g, ' ').replace(/[*#`_]/g, ''); }

  function speak(text) {
    if (!('speechSynthesis' in window)) return toast(t('noSpeech'));
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(stripMd(text));
    u.lang = /[\u0600-\u06FF]/.test(text) ? 'fa-IR' : 'en-US';
    speechSynthesis.speak(u);
  }

  function copyText(s) {
    if (!navigator.clipboard) return toast(t('copyFail'));
    navigator.clipboard.writeText(s).then(() => toast(t('copied')), () => toast(t('copyFail')));
  }

  function applyTheme() {
    const th = settings.theme === 'system'
      ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : settings.theme;
    document.documentElement.dataset.theme = th;
    document.querySelector('meta[name=theme-color]').content = th === 'light' ? '#f4f7fb' : '#0a0d14';
  }

  function applyLang() {
    const fa = isFa();
    document.documentElement.lang = fa ? 'fa' : 'en';
    document.documentElement.dir = fa ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    markSeg();
  }

  function markSeg() {
    document.querySelectorAll('#langSeg button').forEach((b) => b.classList.toggle('on', b.dataset.val === settings.lang));
    document.querySelectorAll('#themeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.val === settings.theme));
  }

  // ---------- sync and helpers ----------
  const tombs = () => safeParse(localStorage.getItem('cb_tombs')) || [];
  function markDeleted(ids) {
    localStorage.setItem('cb_tombs', JSON.stringify([...new Set([...tombs(), ...ids])].slice(-2000)));
  }
  let syncTimer = null;
  function setSyncStatus(msg) { const el = $('syncStatus'); if (el) el.textContent = msg; }
  function syncHeaders() {
    const h = { 'x-sync-code': settings.syncCode };
    if (settings.appPass) h['x-app-password'] = settings.appPass;
    return h;
  }
  function mergeConvs(local, remote) {
    const map = new Map(local.map((c) => [c.id, c]));
    let changed = false;
    remote.forEach((r) => {
      if (!r || !r.id || !Array.isArray(r.messages)) return;
      const l = map.get(r.id);
      if (!l || r.messages.length > l.messages.length) { map.set(r.id, r); changed = true; }
    });
    const list = [...map.values()].sort((a, b) => (b.created || 0) - (a.created || 0));
    return { list, changed };
  }
  function scheduleSyncPush() {
    if (!settings.syncCode) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncPush, 3000);
  }
  async function syncPush() {
    if (!settings.syncCode) return;
    try {
      const res = await fetch('/api/sync', {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, syncHeaders()),
        body: JSON.stringify({ updatedAt: Date.now(), data: { convs, deleted: tombs(), projects } })
      });
      if (!res.ok) throw new Error(friendly(res.status, await res.text()));
      setSyncStatus(t('syncOk') + ' · ' + fmtTime(Date.now()));
    } catch (e) {
      setSyncStatus(t('syncFail') + ': ' + e.message);
    }
  }
  async function syncPull() {
    if (!settings.syncCode) return;
    try {
      const res = await fetch('/api/sync', { headers: syncHeaders() });
      if (res.status === 404) return syncPush();
      if (!res.ok) throw new Error(friendly(res.status, await res.text()));
      const remote = (await res.json()).data || {};
      const dead = new Set([...tombs(), ...(remote.deleted || [])]);
      markDeleted([...dead]);
      const merged = mergeConvs(convs.filter((c) => !dead.has(c.id)), (remote.convs || []).filter((r) => r && !dead.has(r.id)));
      if (merged.changed || merged.list.length !== convs.length) {
        convs = merged.list;
        if (!convs.some((c) => c.id === currentId)) currentId = convs[0] ? convs[0].id : null;
        await DB.set('convs', convs);
        renderAll();
      }
      const pm = new Map(projects.filter((p) => !dead.has(p.id)).map((p) => [p.id, p]));
      let pChanged = false;
      (remote.projects || []).forEach((p) => {
        if (p && p.id && !dead.has(p.id) && !pm.has(p.id)) { pm.set(p.id, p); pChanged = true; }
      });
      if (pChanged || pm.size !== projects.length) {
        projects = [...pm.values()];
        await DB.set('projects', projects);
        renderProjects();
      }
      await syncPush();
    } catch (e) {
      setSyncStatus(t('syncFail') + ': ' + e.message);
    }
  }
  // ---------- projects, retrieval, presets, web ----------
  const PRESETS = {
    '': '',
    code: 'You are a senior software engineer. Give correct, working code with short explanations and mention assumptions.',
    trans: 'You are a professional translator. Translate the user text accurately, keep the formatting, and output only the translation unless asked otherwise.',
    writer: 'You are a sharp copywriter. Write clear, engaging text with concise sentences.',
    teacher: 'You are a patient teacher. Explain step by step with simple examples and check understanding at the end.'
  };
  function projectOf(c) { return c && c.projectId ? (projects.find((p) => p.id === c.projectId) || null) : null; }
  function selectedProject() { return projects.find((p) => p.id === $('projSelect').value) || null; }
  function saveProjects() {
    if (ready) DB.set('projects', projects).catch(() => toast(t('storageFull'), 5000));
    scheduleSyncPush();
  }
  function fillSelect(sel, items, selected) {
    sel.innerHTML = '';
    items.forEach(([val, label]) => sel.add(new Option(label, val)));
    sel.value = items.some(([v]) => v === selected) ? selected : items[0][0];
  }
  function renderProjects() {
    const cur = $('projSelect').value;
    const list = projects.map((p) => [p.id, p.name]);
    fillSelect($('projSelect'), list.length ? list : [['', t('noProject')]], cur);
    const sp = selectedProject();
    $('projInstr').value = sp ? (sp.instructions || '') : '';
    $('projInstr').disabled = !sp;
    $('projInfo').textContent = sp ? t('projFiles', sp.files.length) : '';
    const c = current() || (draftCfg ? { projectId: draftCfg.projectId } : {});
    fillSelect($('chatProject'), [['', t('noProject')]].concat(list), (c && c.projectId) || '');
  }
  function fillChatSection() {
    const c = current() || (draftCfg ? { cfg: draftCfg.cfg, projectId: draftCfg.projectId } : {});
    const cfg = c.cfg || {};
    $('chatSystem').value = cfg.system || '';
    $('chatPreset').value = '';
    const models = [['', t('useGlobal')]].concat((settings.modelCache || []).map((m) => [m, m]));
    if (cfg.model && !models.some(([v]) => v === cfg.model)) models.push([cfg.model, cfg.model]);
    fillSelect($('chatModel'), models, cfg.model || '');
  }
  function fillCompare() {
    const items = [['', t('compareOff')]].concat((settings.modelCache || []).map((m) => [m, m]));
    fillSelect($('setCompare'), items, settings.compareModel || '');
  }
  function chunkText(text, size = 900) {
    const out = [];
    let cur = '';
    text.split(/\n\s*\n/).forEach((p) => {
      if (cur && (cur + '\n\n' + p).length > size) { out.push(cur); cur = ''; }
      cur = cur ? cur + '\n\n' + p : p;
      while (cur.length > size * 1.5) { out.push(cur.slice(0, size)); cur = cur.slice(size); }
    });
    if (cur.trim()) out.push(cur);
    return out;
  }
  const tokenize = (s) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);
  function retrieveFromProject(c, query) {
    const proj = projectOf(c);
    if (!proj || !proj.files || !proj.files.length || !query) return '';
    const total = proj.files.reduce((n, f) => n + f.text.length, 0);
    if (total <= 6000) return 'Project files:\n\n' + proj.files.map((f) => `[${f.name}]\n${f.text}`).join('\n\n');
    const chunks = [];
    proj.files.forEach((f) => chunkText(f.text).forEach((txt) => chunks.push({ name: f.name, txt, toks: tokenize(txt) })));
    const qToks = [...new Set(tokenize(query))];
    const N = chunks.length;
    const df = {};
    qToks.forEach((q) => { df[q] = chunks.filter((ch) => ch.toks.includes(q)).length; });
    const scored = chunks.map((ch) => {
      let sc = 0;
      qToks.forEach((q) => {
        const tf = ch.toks.filter((w) => w === q).length;
        if (tf) sc += tf * Math.log(1 + N / df[q]);
      });
      return { ch, sc: sc / Math.sqrt(ch.toks.length + 1) };
    }).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 4);
    if (!scored.length) return '';
    return 'Relevant excerpts from project files:\n\n' + scored.map((x) => `[${x.ch.name}]\n${x.ch.txt}`).join('\n\n');
  }
  async function webSearch(q) {
    try {
      const r = await post('/api/search', { q });
      if (!r.ok) return [];
      return (await r.json()).results || [];
    } catch {
      return [];
    }
  }
  function buildSystem(c, ctx) {
    const parts = [];
    const proj = projectOf(c);
    if (proj && proj.instructions && proj.instructions.trim()) parts.push(proj.instructions.trim());
    const own = c.cfg && c.cfg.system && c.cfg.system.trim();
    const glob = settings.system && settings.system.trim();
    if (own) parts.push(own); else if (glob) parts.push(glob);
    if (ctx) parts.push(ctx);
    return parts.join('\n\n');
  }

  function estTokens(c) {
    let n = 0;
    c.messages.forEach((m) => {
      n += (m.text || '').length;
      (m.attachments || []).forEach((a) => { if (a.kind === 'text') n += (a.text || '').length; });
    });
    return Math.round(n / 3.5);
  }
  function fmtTokens(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }

  // ---------- conversations ----------
  function newConv() {
    followStream = true;
    editIdx = null;
    const c = { id: uid(), title: '', messages: [], created: Date.now() };
    if (draftCfg) { c.cfg = draftCfg.cfg; c.projectId = draftCfg.projectId; draftCfg = null; }
    convs.unshift(c);
    currentId = c.id;
    persist();
    renderAll();
    return c;
  }
  function ensureConv() { return current() || newConv(); }

  function renderAll() { renderSidebar(); renderMessages(); renderTop(); renderAttachBar(); }

  function renderTop() {
    const c = current();
    $('chatTitle').textContent = c && c.title ? c.title : t('untitled');
    const tok = c && c.messages.length ? ' · ~' + fmtTokens(estTokens(c)) + ' tok' : '';
    $('modelLabel').textContent = (settings.model || t('noModel')) + tok;
  }

  function renameConv(c) {
    const v = prompt(t('renamePrompt'), c.title || '');
    if (v === null) return;
    const nv = v.trim().slice(0, 80);
    if (nv) c.title = nv;
    persist();
    renderAll();
  }

  function deleteConv(c) {
    if (!confirm(t('confirmDelChat'))) return;
    markDeleted([c.id]);
    convs = convs.filter((x) => x.id !== c.id);
    if (currentId === c.id) currentId = convs[0] ? convs[0].id : null;
    editIdx = null;
    persist();
    renderAll();
  }

  function renderSidebar() {
    const list = $('convList');
    list.innerHTML = '';
    if (!convs.length) {
      const e = document.createElement('div');
      e.className = 'empty-side';
      e.textContent = t('noChats');
      list.append(e);
      return;
    }
    const q = ($('convSearch') ? $('convSearch').value : '').trim().toLowerCase();
    const shown = convs.filter((c) => !q
      || (c.title || '').toLowerCase().includes(q)
      || c.messages.some((m) => (m.text || '').toLowerCase().includes(q)));
    shown.forEach((c) => {
      const row = document.createElement('div');
      row.className = 'conv' + (c.id === currentId ? ' active' : '');
      row.dir = 'auto';
      const name = document.createElement('span');
      name.className = 'conv-name';
      name.textContent = c.title || t('untitled');
      const act = (label, title, fn) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'conv-act';
        b.title = title;
        b.textContent = label;
        b.onclick = (e) => { e.stopPropagation(); fn(); };
        return b;
      };
      row.append(name, act('✎', t('rename'), () => renameConv(c)), act('🗑', t('deleteChat'), () => deleteConv(c)));
      row.onclick = () => { currentId = c.id; editIdx = null; followStream = true; closeSide(); renderAll(); };
      list.append(row);
    });
  }

  function fmtTime(ts) {
    try {
      return new Intl.DateTimeFormat(isFa() ? 'fa-IR' : 'en-US', { calendar: 'gregory', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
    } catch { return new Date(ts).toLocaleString(); }
  }

  function bubble(m, i) {
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + m.role;
    if (m.model) {
      const ml = document.createElement('div');
      ml.className = 'mdl';
      ml.textContent = m.model;
      wrap.append(ml);
    }
    const b = document.createElement('div');
    b.className = 'bubble';
    b.dir = 'auto';
    b.innerHTML = md(m.text || '');
    b.querySelectorAll('pre').forEach((pre) => {
      const cb = document.createElement('button');
      cb.type = 'button';
      cb.className = 'code-copy';
      cb.textContent = t('copy');
      cb.onclick = () => copyText(pre.querySelector('code') ? pre.querySelector('code').textContent : pre.textContent);
      pre.append(cb);
    });
    if (m.attachments && m.attachments.length) {
      const ad = document.createElement('div');
      ad.className = 'att-list';
      m.attachments.forEach((a) => {
        if (a.kind === 'image') {
          const im = document.createElement('img');
          im.src = a.url; im.className = 'att-img'; im.alt = a.name;
          ad.append(im);
        } else if (a.kind === 'audio') {
          const au = document.createElement('audio');
          au.controls = true; au.src = a.url;
          ad.append(au);
        } else {
          const s = document.createElement(a.url ? 'a' : 'span');
          s.className = 'chip';
          if (a.url) { s.href = a.url; s.download = a.name; }
          s.textContent = '📄 ' + a.name;
          ad.append(s);
        }
      });
      b.prepend(ad);
    }
    if (m.streaming) b.insertAdjacentHTML('beforeend', '<span class="cursor"></span>');
    wrap.append(b);
    if (m.sources && m.sources.length) {
      const sd = document.createElement('div');
      sd.className = 'sources';
      m.sources.forEach((src) => {
        if (!/^https?:\/\//.test(src.url || '')) return;
        const a = document.createElement('a');
        a.href = src.url; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = src.title || src.url;
        sd.append(a);
      });
      wrap.append(sd);
    }
    if (m.time) {
      const st = document.createElement('div');
      st.className = 'stamp';
      st.textContent = fmtTime(m.time);
      wrap.append(st);
    }
    if (!m.streaming) {
      const bar = document.createElement('div');
      bar.className = 'msg-actions';
      const mk = (label, fn) => {
        const x = document.createElement('button');
        x.className = 'mini'; x.textContent = label; x.onclick = fn;
        return x;
      };
      bar.append(mk(t('copy'), () => copyText(m.text || '')));
      if (m.role === 'assistant') {
        bar.append(mk('🔊 ' + t('read'), () => speak(m.text || '')));
        bar.append(mk('🔁 ' + t('regen'), () => regen(i)));
      }
      if (m.role === 'user') bar.append(mk('✏️ ' + t('edit'), () => startEdit(i)));
      bar.append(mk('🗑', () => {
        const c = current();
        if (!c) return;
        c.messages.splice(i, 1);
        persist();
        renderMessages();
      }));
      wrap.append(bar);
    }
    return wrap;
  }

  function isNearBottom() {
    const b = $('messages');
    return b.scrollHeight - b.scrollTop - b.clientHeight < 120;
  }

  function updateToBottom() {
    $('toBottom').hidden = isNearBottom();
  }

  function renderMessages() {
    const box = $('messages');
    const prevTop = box.scrollTop;
    box.innerHTML = '';
    const c = current();
    if (!c || !c.messages.length) {
      const w = document.createElement('div');
      w.className = 'welcome';
      w.innerHTML = `<div class="logo">✦</div><h2>${esc(t('welcomeTitle'))}</h2><p>${esc(t('welcomeText'))}</p>`;
      box.append(w);
    } else {
      c.messages.forEach((m, i) => box.append(bubble(m, i)));
      // keep following the reply only if the user is at the bottom, otherwise keep their place
      box.scrollTop = followStream ? box.scrollHeight : prevTop;
    }
    updateToBottom();
  }

  $('messages').addEventListener('scroll', () => {
    followStream = isNearBottom();
    updateToBottom();
  });

  $('toBottom').onclick = () => {
    followStream = true;
    const b = $('messages');
    b.scrollTo({ top: b.scrollHeight, behavior: 'smooth' });
  };

  function scheduleRender() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { rafPending = false; renderMessages(); });
  }

  // ---------- files ----------
  function readDataUrl(f, onp) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onprogress = (e) => { if (e.lengthComputable && onp) onp(e.loaded / e.total); };
      r.onload = () => res(r.result);
      r.onerror = () => rej(new Error('read'));
      r.readAsDataURL(f);
    });
  }

  function shrinkImage(dataUrl) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const max = 1024;
        const r = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * r), h = Math.round(img.height * r);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        res(cv.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => rej(new Error('img'));
      img.src = dataUrl;
    });
  }

  async function readFile(f, setP) {
    const mime = f.type || '';
    const isImg = mime.startsWith('image/');
    const isAudio = mime.startsWith('audio/');
    const isText = !isImg && !isAudio && (mime.startsWith('text/') || /json|xml|javascript|yaml/.test(mime) || /\.(md|txt|json|csv|js|ts|jsx|tsx|py|html|css|xml|ya?ml|log|sh|sql|ini|toml|env|go|rs|java|c|cpp|h|swift|kt|rb|php)$/i.test(f.name));
    if (!isImg && !isText && f.size > 3 * 1024 * 1024) throw new Error(t('tooBig'));
    if (isText) {
      setP(50);
      return { kind: 'text', name: f.name, mime: 'text/plain', text: (await f.text()).slice(0, 100000) };
    }
    const dataUrl = await readDataUrl(f, (p) => setP(Math.round(p * 80)));
    if (isImg) {
      setP(90);
      return { kind: 'image', name: f.name, mime: 'image/jpeg', url: await shrinkImage(dataUrl) };
    }
    setP(95);
    if (isAudio) return { kind: 'audio', name: f.name, mime, url: dataUrl };
    return { kind: 'file', name: f.name, mime: mime || 'application/octet-stream', url: dataUrl };
  }

  async function handleFiles(list) {
    for (const f of Array.from(list)) {
      const item = {
        id: uid(), name: f.name, kind: 'pending', progress: 0, done: false,
        preview: (f.type || '').startsWith('image/') ? URL.createObjectURL(f) : ''
      };
      pending.push(item);
      renderAttachBar();
      try {
        const data = await readFile(f, (p) => { item.progress = p; renderAttachBar(); });
        Object.assign(item, data, { progress: 100, done: true });
      } catch (err) {
        pending = pending.filter((x) => x !== item);
        toast(f.name + ': ' + err.message, 4000);
      }
      renderAttachBar();
    }
  }

  function ringHtml(p) {
    const r = 18, c = 2 * Math.PI * r;
    const pct = Math.min(100, Math.max(0, p));
    const off = c * (1 - pct / 100);
    return '<div class="ring"><svg viewBox="0 0 44 44">'
      + '<circle cx="22" cy="22" r="' + r + '" class="ring-bg"/>'
      + '<circle cx="22" cy="22" r="' + r + '" class="ring-fg" style="stroke-dasharray:' + c.toFixed(2) + ';stroke-dashoffset:' + off.toFixed(2) + '"/>'
      + '</svg><span>' + Math.round(pct) + '%</span></div>';
  }

  function renderAttachBar() {
    const bar = $('attachBar');
    bar.innerHTML = '';
    pending.forEach((a) => {
      const card = document.createElement('div');
      card.className = 'thumb';
      if (a.kind === 'image' || a.preview) {
        const im = document.createElement('img');
        im.src = a.preview || a.url;
        im.alt = a.name;
        card.append(im);
      } else {
        const fc = document.createElement('div');
        fc.className = 'file-card';
        fc.textContent = (a.kind === 'audio' ? '🎵 ' : '📄 ') + a.name;
        card.append(fc);
      }
      if (!a.done) card.insertAdjacentHTML('beforeend', ringHtml(a.progress || 0));
      const x = document.createElement('button');
      x.className = 'thumb-x';
      x.textContent = '✕';
      x.onclick = () => { pending = pending.filter((p) => p !== a); renderAttachBar(); };
      card.append(x);
      bar.append(card);
    });
  }

  $('attachBtn').onclick = () => $('fileInput').click();
  $('fileInput').onchange = async (e) => {
    await handleFiles(e.target.files);
    e.target.value = '';
  };
  $('input').addEventListener('paste', (e) => {
    const files = e.clipboardData && e.clipboardData.files;
    if (files && files.length) { e.preventDefault(); handleFiles(files); }
  });

  // ---------- voice message (record and attach) ----------
  let rec = null;

  function encodeWav(samples, inRate, outRate) {
    const ratio = inRate / outRate;
    const outLen = Math.floor(samples.length / ratio);
    const out = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const s = Math.max(-1, Math.min(1, samples[Math.floor(i * ratio)]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    const buf = new ArrayBuffer(44 + out.length * 2);
    const v = new DataView(buf);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + out.length * 2, true); w(8, 'WAVE');
    w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, outRate, true); v.setUint32(28, outRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, 'data'); v.setUint32(40, out.length * 2, true);
    for (let i = 0; i < out.length; i++) v.setInt16(44 + i * 2, out[i], true);
    return buf;
  }

  async function startRec() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    await ctx.resume();
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const chunks = [];
    proc.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(proc);
    proc.connect(ctx.destination);
    rec = { stream, ctx, src, proc, chunks, timer: null };
    rec.timer = setTimeout(() => { if (rec) stopRec(); }, 90000);
    $('micBtn').classList.add('rec');
    toast(t('recStart'), 2000);
  }

  async function stopRec() {
    const r = rec;
    if (!r) return;
    rec = null;
    clearTimeout(r.timer);
    r.proc.disconnect();
    r.src.disconnect();
    r.stream.getTracks().forEach((tr) => tr.stop());
    const rate = r.ctx.sampleRate;
    await r.ctx.close();
    $('micBtn').classList.remove('rec');
    const total = r.chunks.reduce((n, c) => n + c.length, 0);
    if (total < rate * 0.5) return toast(t('recShort'));
    const pcm = new Float32Array(total);
    let o = 0;
    r.chunks.forEach((c) => { pcm.set(c, o); o += c.length; });
    const wav = encodeWav(pcm, rate, 16000);
    const name = 'voice-' + new Date().toISOString().slice(11, 19).replace(/:/g, '') + '.wav';
    handleFiles([new File([new Blob([wav], { type: 'audio/wav' })], name, { type: 'audio/wav' })]);
  }

  $('micBtn').onclick = async () => {
    if (rec) return stopRec();
    if (!navigator.mediaDevices || !(window.AudioContext || window.webkitAudioContext)) return toast(t('noMic'), 4000);
    try { await startRec(); } catch { toast(t('micDenied'), 4000); }
  };

  // ---------- API messages ----------
  function audioFormat(mime, name) {
    const m = (mime || '').toLowerCase(), n = (name || '').toLowerCase();
    if (m.includes('mpeg') || m.includes('mp3') || n.endsWith('.mp3')) return 'mp3';
    if (m.includes('wav') || m.includes('wave') || n.endsWith('.wav')) return 'wav';
    return null;
  }

  function toApi(m) {
    if (!m.attachments || !m.attachments.length) return { role: m.role, content: m.text || '' };
    let text = m.text || '';
    m.attachments.filter((a) => a.kind === 'text').forEach((a) => {
      text += `\n\n[${a.name}]\n${a.text}`;
    });
    const parts = [{ type: 'text', text: text || ' ' }];
    m.attachments.forEach((a) => {
      if (a.kind === 'image') parts.push({ type: 'image_url', image_url: { url: a.url } });
      else if (a.kind === 'audio') {
        const fmt = audioFormat(a.mime, a.name);
        if (fmt) parts.push({ type: 'input_audio', input_audio: { data: a.url.split(',')[1], format: fmt } });
        else parts.push({ type: 'text', text: t('unsupportedAudio', a.name) });
      } else if (a.kind === 'pdf' || a.kind === 'file') parts.push({ type: 'file', file: { filename: a.name, file_data: a.url } });
    });
    return { role: m.role, content: parts };
  }

  // ---------- completion ----------
  function post(path, payload, signal, pass) {
    const headers = { 'Content-Type': 'application/json' };
    const p = pass !== undefined ? pass : settings.appPass;
    if (p) headers['x-app-password'] = p;
    return fetch(path, { method: 'POST', headers, body: JSON.stringify(payload), signal });
  }

  function setSending(on) {
    const b = $('sendBtn');
    b.classList.toggle('stop', on);
    b.innerHTML = on ? '■' : '<img src="/send.png" alt="">';
    b.title = on ? t('stop') : t('send');
  }

  function flattenMessages(msgs) {
    return msgs.map((m) => {
      if (!Array.isArray(m.content)) return m;
      const text = m.content.map((p) => {
        if (p.type === 'text') return p.text;
        return '[attachment omitted: this model only accepts text]';
      }).join('\n');
      return { role: m.role, content: text };
    });
  }

  async function runCompletion(c, asst, opts = {}) {
    busy = true;
    setSending(true);
    abortCtrl = new AbortController();
    const messages = [];
    let src = c.messages.filter((m) => !(opts.exclude || [asst]).includes(m));
    const lim = Number(settings.historyLimit);
    if (lim > 0 && src.length > lim) {
      src = src.slice(-lim);
      const k = src.findIndex((m) => m.role === 'user');
      if (k > 0) src = src.slice(k);
    }
    src.forEach((m) => messages.push(toApi(m)));

    const body = { model: opts.model || (c.cfg && c.cfg.model) || settings.model, messages, stream: !!settings.stream };
    const sys = buildSystem(c, opts.context);
    if (sys) body.messages = [{ role: 'system', content: sys }, ...messages];
    const temp = Number(settings.temperature);
    if (settings.temperature !== '' && Number.isFinite(temp)) body.temperature = temp;
    const maxT = Number(settings.maxTokens);
    if (Number.isFinite(maxT) && maxT > 0) {
      if (settings.useMaxCompletion) body.max_completion_tokens = Math.round(maxT);
      else body.max_tokens = Math.round(maxT);
    }

    const send = (b) => post('/api/chat', { base: settings.base, key: settings.key, payload: b }, abortCtrl.signal);

    try {
      let res = await send(body);
      let flat = false;
      let single = false;
      for (let tries = 0; !res.ok && tries < 4; tries++) {
        const txt = await res.clone().text();
        const mt = txt.match(/less than or equal to (\d+)/i);
        if (/temperature/i.test(txt) && 'temperature' in body) {
          delete body.temperature;
        } else if (/max_completion_tokens/i.test(txt) && 'max_tokens' in body) {
          body.max_completion_tokens = body.max_tokens;
          delete body.max_tokens;
          settings.useMaxCompletion = true;
          persist();
        } else if (/max_tokens/i.test(txt) && mt) {
          body.max_tokens = Number(mt[1]);
          settings.maxTokens = body.max_tokens;
          persist();
        } else if (/streaming/i.test(txt) && body.stream) {
          body.stream = false;
        } else if (/single user message/i.test(txt) && !single) {
          const last = [...body.messages].reverse().find((m) => m.role === 'user');
          if (last) body.messages = [...body.messages.filter((m) => m.role === 'system'), ...flattenMessages([last])];
          single = true;
        } else if (!flat && /file|pdf|input_audio|image_url|multimodal|content type|unsupported/i.test(txt) && body.messages.some((m) => Array.isArray(m.content))) {
          body.messages = flattenMessages(body.messages);
          flat = true;
        } else if (/must be a string/i.test(txt) && !flat) {
          body.messages = flattenMessages(body.messages);
          flat = true;
        } else {
          break;
        }
        res = await send(body);
      }
      if (!res.ok) throw new Error(friendly(res.status, await res.text()));

      const ct = res.headers.get('content-type') || '';
      if (body.stream && ct.includes('text/event-stream')) {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (!data || data === '[DONE]') continue;
            try {
              const j = JSON.parse(data);
              const d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
              if (d) { asst.text += d; scheduleRender(); }
            } catch {}
          }
        }
      } else {
        const j = await res.json();
        asst.text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || JSON.stringify(j);
      }
      asst.streaming = false;
      if (settings.speak) speak(asst.text);
    } catch (err) {
      asst.streaming = false;
      if (err.name === 'AbortError') {
        asst.text = (asst.text || '') + (asst.text ? '\n\n' : '') + t('stopped');
      } else {
        asst.text = (asst.text ? asst.text + '\n\n' : '') + '⚠️ ' + (err.message || '?');
        asst.error = true;
      }
    } finally {
      if (!opts.keepBusy) { busy = false; setSending(false); }
      abortCtrl = null;
      persist();
      renderAll();
    }
  }

  async function send(textIn) {
    if (busy || !ready) return;
    const text = (textIn || '').trim();
    if (pending.some((a) => !a.done)) { toast(t('stillUploading')); return; }
    if (!text && !pending.length) return;
    if (!hasApi()) { openSettings(); toast(t('needApi')); return; }
    if (!settings.model && !((current() || {}).cfg || {}).model) { openSettings(); toast(t('needModel')); return; }

    const c = ensureConv();
    if (editIdx !== null) {
      if (c.messages[editIdx] && c.messages[editIdx].role === 'user') c.messages.splice(editIdx);
      editIdx = null;
    }
    c.messages.push({
      role: 'user',
      text,
      time: Date.now(),
      attachments: pending.map((a) => ({ kind: a.kind, name: a.name, mime: a.mime, url: a.url, text: a.text }))
    });
    if (!c.title && text) c.title = text.slice(0, 40);
    pending = [];
    $('input').value = '';
    autosize();

    stopRequested = false;
    const primaryModel = (c.cfg && c.cfg.model) || settings.model;
    const cmp = settings.compareModel && settings.compareModel !== primaryModel ? settings.compareModel : '';
    const asst = { role: 'assistant', text: '', streaming: true, time: Date.now() };
    if (cmp) asst.model = primaryModel;
    c.messages.push(asst);
    let asst2 = null;
    if (cmp) {
      asst2 = { role: 'assistant', text: '', streaming: true, time: Date.now(), model: cmp };
      c.messages.push(asst2);
    }
    followStream = true;
    renderAll();
    let ctx = retrieveFromProject(c, text);
    if (settings.webSearch && config.searchEnabled && text) {
      const web = await webSearch(text);
      if (web.length) {
        asst.sources = web.map((x) => ({ title: x.title, url: x.url }));
        ctx += (ctx ? '\n\n' : '') + 'Web search results (cite the URLs you use):\n'
          + web.map((x, i) => `${i + 1}. ${x.title} - ${x.url}\n   ${x.description}`).join('\n');
      }
    }
    const exclude = [asst, asst2].filter(Boolean);
    await runCompletion(c, asst, { model: primaryModel, context: ctx, exclude, keepBusy: !!asst2 });
    if (asst2 && !stopRequested) {
      await runCompletion(c, asst2, { model: cmp, context: ctx, exclude });
    } else if (asst2) {
      busy = false;
      setSending(false);
    }
  }

  function startEdit(i) {
    const c = current();
    if (!c || !c.messages[i] || busy) return;
    editIdx = i;
    $('input').value = c.messages[i].text || '';
    autosize();
    $('input').focus();
    toast(t('editing'), 3500);
  }

  async function regen(i) {
    if (busy) return;
    const c = current();
    if (!c) return;
    c.messages.splice(i);
    const asst = { role: 'assistant', text: '', streaming: true, time: Date.now() };
    c.messages.push(asst);
    renderAll();
    await runCompletion(c, asst);
  }

  // ---------- models ----------
  function fillModels(selected) {
    const sel = $('setModel');
    const ids = [...new Set([...(settings.modelCache || []), selected].filter(Boolean))];
    sel.innerHTML = '';
    if (!ids.length) {
      sel.add(new Option(t('noModelsLoaded'), ''));
    } else {
      ids.forEach((id) => sel.add(new Option(id, id)));
    }
    sel.value = selected || '';
  }

  async function loadModels(silent) {
    const base = $('setBase').value.trim() || settings.base;
    const key = $('setKey').value.trim() || settings.key;
    if (!base && !config.hasDefaultBase) { if (!silent) toast(t('needApi')); return; }
    try {
      const res = await post('/api/models', { base, key }, undefined, $('setAppPass').value.trim() || settings.appPass);
      const text = await res.text();
      if (!res.ok) throw new Error(friendly(res.status, text));
      const j = JSON.parse(text);
      const list = j.data || j.models || [];
      const ids = list.map((m) => (typeof m === 'string' ? m : (m.id || m.name))).filter(Boolean).sort();
      settings.modelCache = ids;
      persist();
      fillModels($('setModel').value || settings.model);
      if (!silent) toast(ids.length ? t('modelsFound', ids.length) : t('noModels'), 3000);
    } catch (e) {
      if (!silent) toast(t('loadErr') + ': ' + e.message, 5000);
    }
  }

  // ---------- settings ----------
  function openSettings() {
    $('setBase').value = settings.base;
    $('setBase').placeholder = config.hasDefaultBase ? t('hintBase') : 'https://.../v1';
    $('setKey').value = settings.key;
    $('setSync').value = settings.syncCode || '';
    $('setWeb').checked = !!settings.webSearch;
    $('setFx').checked = settings.bgFx !== false;
    $('setWeb').disabled = !config.searchEnabled;
    $('webHint').hidden = !!config.searchEnabled;
    fillCompare();
    renderProjects();
    fillChatSection();
    $('setHistory').value = settings.historyLimit;
    $('setAppPass').value = settings.appPass || '';
    $('setRemember').checked = settings.rememberKey !== false;
    $('setSystem').value = settings.system || '';
    $('setTemp').value = settings.temperature;
    $('setMax').value = settings.maxTokens;
    $('setStream').checked = !!settings.stream;
    $('setSpeak').checked = !!settings.speak;
    fillModels(settings.model);
    markSeg();
    $('settingsModal').hidden = false;
    if (hasApi() && !(settings.modelCache || []).length) loadModels(true);
  }

  function closeSettings() {
    // revert unsaved language/theme changes
    settings = loadSettings();
    applyTheme();
    applyLang();
    renderAll();
    $('settingsModal').hidden = true;
  }

  function saveSettings() {
    let base = $('setBase').value.trim().replace(/\/+$/, '');
    if (base && !/^https?:\/\//i.test(base)) base = 'https://' + base;
    const temp = Number($('setTemp').value);
    const maxT = Math.round(Number($('setMax').value));
    const hist = Math.round(Number($('setHistory').value));
    const prevSync = settings.syncCode;
    const newSync = $('setSync').value.trim();
    const cur = current();
    const chatCfg = { system: $('chatSystem').value.trim(), model: $('chatModel').value || '' };
    const chatProj = $('chatProject').value || null;
    if (cur) {
      cur.cfg = chatCfg;
      cur.projectId = chatProj;
    } else {
      draftCfg = { cfg: chatCfg, projectId: chatProj };
    }
    const sp = selectedProject();
    if (sp) { sp.instructions = $('projInstr').value.trim(); saveProjects(); }
    settings = Object.assign({}, settings, {
      base,
      key: $('setKey').value.trim(),
      appPass: $('setAppPass').value.trim(),
      syncCode: newSync,
      webSearch: $('setWeb').checked && !$('setWeb').disabled,
      compareModel: $('setCompare').value || '',
      bgFx: $('setFx').checked,
      historyLimit: Number.isFinite(hist) && hist >= 0 ? hist : DEF.historyLimit,
      rememberKey: $('setRemember').checked,
      system: $('setSystem').value.trim(),
      temperature: Number.isFinite(temp) ? Math.min(2, Math.max(0, temp)) : DEF.temperature,
      maxTokens: Number.isFinite(maxT) && maxT > 0 ? maxT : DEF.maxTokens,
      model: $('setModel').value || '',
      stream: $('setStream').checked,
      speak: $('setSpeak').checked
    });
    persist();
    applyTheme();
    applyLang();
    applyFx();
    renderAll();
    $('settingsModal').hidden = true;
    toast(t('saved'));
    if (newSync && newSync !== prevSync) syncPull();
  }

  function openSide() { $('app').classList.add('side-open'); }
  function closeSide() { $('app').classList.remove('side-open'); }

  function autosize() {
    const el = $('input');
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }

  function exportChat() {
    const c = current();
    if (!c || !c.messages.length) return toast(t('chatEmpty'));
    const out = c.messages.map((m) => {
      const att = (m.attachments || []).map((a) => `\n\n[${a.kind}: ${a.name}]`).join('');
      return `### ${m.role === 'user' ? 'You' : 'AI'}\n\n${m.text || ''}${att}`;
    }).join('\n\n---\n\n');
    const blob = new Blob([out], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (c.title || 'chat').replace(/[\\/:*?"<>|]/g, '_') + '.md';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- animated background: soft blue light, lightning, sparks ----------
  const FX = (() => {
    const cv = $('bgFx');
    const cx = cv.getContext('2d');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rnd = (a, b) => a + Math.random() * (b - a);
    let W = 0, H = 0, dpr = 1, raf = 0, running = false, last = 0, bolt = null, nextBolt = 0, sparks = [], orbs = [];

    function newSpark(s, fresh) {
      s.x = rnd(0, W);
      s.y = fresh ? rnd(0, H) : H + 10;
      s.vx = rnd(-0.12, 0.12);
      s.vy = rnd(-0.35, -0.08);
      s.r = rnd(0.6, 1.8);
      s.max = rnd(4, 9);
      s.life = s.max;
      s.ph = rnd(0, 6.28);
      return s;
    }

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const m = Math.max(W, H);
      orbs = [
        { bx: W * 0.15, by: H * 0.2, r: m * 0.45, c: [56, 189, 248], a: 0.16, sp: 0.00005, ph: 0 },
        { bx: W * 0.85, by: H * 0.75, r: m * 0.5, c: [37, 99, 235], a: 0.2, sp: 0.00004, ph: 2 },
        { bx: W * 0.5, by: H * 0.45, r: m * 0.35, c: [125, 211, 252], a: 0.08, sp: 0.00006, ph: 4 }
      ];
      sparks = Array.from({ length: Math.min(90, Math.round(W * H / 14000)) }, () => newSpark({}, true));
    }

    function makeBolt(x0, y0, x1, y1, depth, out) {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const segs = Math.max(6, Math.round(len / 26));
      const pts = [[x0, y0]];
      for (let i = 1; i < segs; i++) {
        const f = i / segs;
        const j = (1 - Math.abs(0.5 - f) * 2) * 0.16 * len + 5;
        pts.push([x0 + (x1 - x0) * f + rnd(-j, j), y0 + (y1 - y0) * f + rnd(-j * 0.3, j * 0.3)]);
      }
      pts.push([x1, y1]);
      out.push(pts);
      if (depth > 0) {
        for (let k = 0; k < 2; k++) {
          if (Math.random() < 0.55) {
            const [bx, by] = pts[1 + Math.floor(Math.random() * (pts.length - 2))];
            const ang = Math.PI / 2 + rnd(-0.6, 0.6);
            const bl = len * rnd(0.25, 0.5);
            makeBolt(bx, by, bx + Math.cos(ang) * bl, by + Math.sin(ang) * bl, depth - 1, out);
          }
        }
      }
      return out;
    }

    function spawnBolt() {
      const x0 = rnd(W * 0.15, W * 0.85);
      const x1 = x0 + rnd(-W * 0.25, W * 0.25);
      const y1 = H * rnd(0.35, 0.7);
      bolt = { paths: makeBolt(x0, -10, x1, y1, 3, []), age: 0, life: rnd(0.4, 0.75) };
    }

    function stroke(pts, color, width, blur) {
      cx.beginPath();
      cx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) cx.lineTo(pts[i][0], pts[i][1]);
      cx.strokeStyle = color;
      cx.lineWidth = width;
      cx.shadowColor = '#38bdf8';
      cx.shadowBlur = blur;
      cx.stroke();
    }

    function drawBolt(dt, k) {
      bolt.age += dt;
      const p = bolt.age / bolt.life;
      if (p >= 1) { bolt = null; return; }
      let a = p < 0.12 ? p / 0.12 : Math.max(0, (1 - p) / 0.88);
      if (Math.random() < 0.3) a *= 0.35;
      const flash = Math.max(0, 1 - p * 2.2);
      cx.globalCompositeOperation = 'lighter';
      cx.fillStyle = `rgba(56,189,248,${0.1 * flash * k})`;
      cx.fillRect(0, 0, W, H);
      cx.lineJoin = 'round';
      cx.lineCap = 'round';
      bolt.paths.forEach((pts, idx) => {
        const w = idx === 0 ? 1 : 0.6;
        stroke(pts, `rgba(56,189,248,${0.22 * a * k})`, 12 * w, 22);
        stroke(pts, `rgba(96,165,250,${0.7 * a * k})`, 3.2 * w, 12);
        stroke(pts, `rgba(235,248,255,${0.95 * a})`, 1.1 * w, 4);
      });
    }

    function paint(ts, dt, animate) {
      const k = document.documentElement.dataset.theme === 'light' ? 0.5 : 1;
      cx.globalCompositeOperation = 'source-over';
      cx.clearRect(0, 0, W, H);
      cx.globalCompositeOperation = 'lighter';
      orbs.forEach((o) => {
        const x = o.bx + Math.sin(ts * o.sp + o.ph) * W * 0.12;
        const y = o.by + Math.cos(ts * o.sp * 0.8 + o.ph) * H * 0.08;
        const g = cx.createRadialGradient(x, y, 0, x, y, o.r);
        const [r, gg, b] = o.c;
        g.addColorStop(0, `rgba(${r},${gg},${b},${o.a * k})`);
        g.addColorStop(0.5, `rgba(${r},${gg},${b},${o.a * 0.35 * k})`);
        g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
        cx.fillStyle = g;
        cx.fillRect(0, 0, W, H);
      });
      sparks.forEach((sp) => {
        if (animate) {
          sp.x += sp.vx * dt * 60;
          sp.y += sp.vy * dt * 60;
          sp.life -= dt;
          if (sp.life <= 0 || sp.y < -10) newSpark(sp, false);
        }
        const al = Math.min(1, sp.life / sp.max) * (0.55 + 0.45 * Math.sin(ts / 260 + sp.ph)) * k;
        cx.fillStyle = `rgba(147,197,253,${al})`;
        cx.beginPath();
        cx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
        cx.fill();
      });
      if (animate) {
        if (!bolt && ts > nextBolt) { spawnBolt(); nextBolt = ts + rnd(3500, 8000); }
        if (bolt) drawBolt(dt, k);
      }
      cx.shadowBlur = 0;
      cx.globalCompositeOperation = 'source-over';
    }

    function frame(ts) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (ts - last < 1000 / 30) return;
      const dt = Math.min(0.06, (ts - last) / 1000);
      last = ts;
      paint(ts, dt, true);
    }

    const enabled = () => settings.bgFx !== false;

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
      cx.clearRect(0, 0, W, H);
    }

    function start() {
      if (!enabled()) return stop();
      if (reduce) { paint(0, 0, false); return; }
      if (running || document.hidden) return;
      running = true;
      last = performance.now();
      nextBolt = last + 1200;
      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', () => {
      resize();
      if (reduce && enabled()) paint(0, 0, false);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); } else start();
    });
    return { start, stop };
  })();

  function applyFx() {
    const on = settings.bgFx !== false;
    document.documentElement.classList.toggle('fx', on);
    if (on) FX.start(); else FX.stop();
  }

  // ---------- wiring ----------
  $('newChat').onclick = () => { if (!ready) return; newConv(); closeSide(); };
  $('menuBtn').onclick = openSide;
  $('backdrop').onclick = closeSide;
  $('exportBtn').onclick = exportChat;
  $('settingsBtn').onclick = openSettings;
  $('openSettings2').onclick = () => { closeSide(); openSettings(); };
  $('closeSettings').onclick = closeSettings;
  $('saveSettings').onclick = saveSettings;
  $('loadModels').onclick = () => loadModels(false);
  $('syncNow').onclick = () => { if (!settings.syncCode) return toast(t('syncOff')); syncPull(); };
  $('convSearch').addEventListener('input', renderSidebar);
  $('projSelect').addEventListener('change', renderProjects);
  $('projInstr').addEventListener('input', () => {
    const sp = selectedProject();
    if (sp) { sp.instructions = $('projInstr').value; saveProjects(); }
  });
  $('chatPreset').addEventListener('change', () => { $('chatSystem').value = PRESETS[$('chatPreset').value] || ''; });
  $('projAdd').onclick = () => {
    const name = $('projName').value.trim();
    if (!name) return toast(t('projNeedName'));
    const p = { id: uid(), name: name.slice(0, 60), instructions: '', files: [] };
    projects.push(p);
    $('projName').value = '';
    saveProjects();
    fillSelect($('projSelect'), projects.map((x) => [x.id, x.name]), p.id);
    renderProjects();
  };
  $('projAddFile').onclick = () => {
    if (!selectedProject()) return toast(t('projNeedName'));
    $('projFile').click();
  };
  $('projFile').onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    const sp = selectedProject();
    if (!f || !sp) return;
    try {
      const r = await readFile(f, () => {});
      if (r.kind !== 'text') throw new Error('not text');
      sp.files.push({ name: f.name, text: r.text });
      saveProjects();
      renderProjects();
      toast(t('saved'));
    } catch {
      toast(t('unsupported'), 4000);
    }
  };
  $('projDel').onclick = () => {
    const sp = selectedProject();
    if (!sp || !confirm(t('confirmDelProj'))) return;
    markDeleted([sp.id]);
    projects = projects.filter((p) => p.id !== sp.id);
    convs.forEach((c) => { if (c.projectId === sp.id) c.projectId = null; });
    saveProjects();
    persist();
    renderProjects();
    renderAll();
  };
  $('exportAll').onclick = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), convs }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'aichat-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('importBtn').onclick = () => $('importFile').click();
  $('importFile').onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const incoming = Array.isArray(j) ? j : (Array.isArray(j.convs) ? j.convs : null);
      if (!incoming) throw new Error('bad');
      const fresh = incoming.filter((x) => x && x.id && Array.isArray(x.messages) && !convs.some((c) => c.id === x.id));
      convs = [...fresh, ...convs];
      if (!currentId) currentId = convs[0] ? convs[0].id : null;
      persist();
      renderAll();
      toast(t('importDone'));
    } catch {
      toast(t('importFail'), 4000);
    }
  };
  $('setBase').addEventListener('change', () => { if ($('setBase').value.trim()) loadModels(true); });
  $('langSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    settings.lang = b.dataset.val; applyLang(); renderAll();
  });
  $('themeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    settings.theme = b.dataset.val; applyTheme(); markSeg();
  });
  $('deleteChat').onclick = () => {
    const c = current();
    if (!c) return toast(t('chatEmpty'));
    if (!confirm(t('confirmDelChat'))) return;
    markDeleted([c.id]);
    convs = convs.filter((x) => x.id !== c.id);
    currentId = convs[0] ? convs[0].id : null;
    persist();
    $('settingsModal').hidden = true;
    renderAll();
  };
  $('resetSettings').onclick = () => {
    if (!confirm(t('confirmReset'))) return;
    settings = Object.assign({}, DEF);
    persist();
    applyTheme();
    applyLang();
    renderAll();
    openSettings();
    toast(t('resetDone'));
  };
  $('clearAll').onclick = () => {
    if (!confirm(t('confirmClear'))) return;
    markDeleted(convs.map((c) => c.id));
    convs = [];
    currentId = null;
    persist();
    $('settingsModal').hidden = true;
    renderAll();
  };
  $('sendBtn').onclick = () => {
    if (busy) { stopRequested = true; if (abortCtrl) abortCtrl.abort(); return; }
    send($('input').value);
  };
  $('input').addEventListener('input', autosize);
  $('input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer:fine)').matches) {
      e.preventDefault();
      $('sendBtn').click();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (!$('settingsModal').hidden) closeSettings(); closeSide(); }
  });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (settings.theme === 'system') applyTheme(); });

  async function init() {
    applyTheme();
    applyLang();
    setSending(false);
    applyFx();
    try {
      convs = (await DB.get('convs')) || [];
      projects = (await DB.get('projects')) || [];
      const legacy = safeParse(localStorage.getItem('cb_convs'));
      if (Array.isArray(legacy)) {
        if (!convs.length && legacy.length) {
          convs = legacy;
          await DB.set('convs', convs);
        }
        localStorage.removeItem('cb_convs');
      }
    } catch {
      toast(t('storageFull'), 5000);
    }
    currentId = convs[0] ? convs[0].id : null;
    ready = true;
    renderAll();
    try {
      config = await fetch('/api/config').then((r) => r.json());
      if (config.needsPassword && !settings.appPass) toast(t('needPass'), 4000);
    } catch {}
    renderTop();
    if (settings.syncCode) syncPull();
  }

  init();
})();
