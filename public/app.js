(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const DEF = { lang: 'fa', theme: 'system', base: '', key: '', model: '', system: '', temperature: 0.7, maxTokens: 2048, stream: true, speak: false, modelCache: [] };
  const safeParse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

  const I18N = {
    fa: {
      newChat: '+ چت جدید', settings: 'تنظیمات', export: 'خروجی گرفتن', menu: 'منو', untitled: 'چت جدید',
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
      newChat: '+ New chat', settings: 'Settings', export: 'Export chat', menu: 'Menu', untitled: 'New chat',
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

  let settings = Object.assign({}, DEF, safeParse(localStorage.getItem('cb_settings')));
  let convs = safeParse(localStorage.getItem('cb_convs')) || [];
  let currentId = convs[0] ? convs[0].id : null;
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
      localStorage.setItem('cb_settings', JSON.stringify(settings));
      localStorage.setItem('cb_convs', JSON.stringify(convs));
    } catch {
      toast(t('storageFull'), 5000);
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
    if (/classification/i.test(String(text))) return t('classModel');
    let msg = '';
    try {
      const j = JSON.parse(text);
      msg = (j.error && (j.error.message || (typeof j.error === 'string' ? j.error : ''))) || j.message || '';
    } catch {}
    if (!msg) msg = String(text || '').slice(0, 300);
    return `HTTP ${status}: ${msg}`;
  }

  function md(text) {
    const blocks = [];
    let html = esc(text).replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      blocks.push('<pre><code>' + code + '</code></pre>');
      return '\u0001' + (blocks.length - 1) + '\u0001';
    });
    html = html
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/^#{1,3} (.+)$/gm, '<strong>$1</strong>')
      .replace(/^[-*] (.+)$/gm, '• $1')
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

  // ---------- conversations ----------
  function newConv() {
    const c = { id: uid(), title: '', messages: [], created: Date.now() };
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
    $('modelLabel').textContent = settings.model || t('noModel');
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
    convs.forEach((c) => {
      const row = document.createElement('div');
      row.className = 'conv' + (c.id === currentId ? ' active' : '');
      row.dir = 'auto';
      row.textContent = c.title || t('untitled');
      row.onclick = () => { currentId = c.id; closeSide(); renderAll(); };
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
    const b = document.createElement('div');
    b.className = 'bubble';
    b.dir = 'auto';
    b.innerHTML = md(m.text || '');
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
          const s = document.createElement('span');
          s.className = 'chip';
          s.textContent = '📄 ' + a.name;
          ad.append(s);
        }
      });
      b.prepend(ad);
    }
    if (m.streaming) b.insertAdjacentHTML('beforeend', '<span class="cursor"></span>');
    wrap.append(b);
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

  function renderMessages() {
    const box = $('messages');
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    box.innerHTML = '';
    const c = current();
    if (!c || !c.messages.length) {
      const w = document.createElement('div');
      w.className = 'welcome';
      w.innerHTML = `<div class="logo">✦</div><h2>${esc(t('welcomeTitle'))}</h2><p>${esc(t('welcomeText'))}</p>`;
      box.append(w);
      return;
    }
    c.messages.forEach((m, i) => box.append(bubble(m, i)));
    if (nearBottom) box.scrollTop = box.scrollHeight;
  }

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
    const isPdf = mime === 'application/pdf';
    const isText = !isImg && !isAudio && !isPdf && (mime.startsWith('text/') || /\.(md|json|csv|txt|js|ts|py|html|css|xml|ya?ml|log)$/i.test(f.name));
    if (!isImg && !isAudio && !isPdf && !isText) throw new Error(t('unsupported'));
    if ((isAudio || isPdf) && f.size > 3 * 1024 * 1024) throw new Error(t('tooBig'));
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
    return { kind: isAudio ? 'audio' : 'pdf', name: f.name, mime, url: dataUrl };
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
      } else if (a.kind === 'pdf') parts.push({ type: 'file', file: { filename: a.name, file_data: a.url } });
    });
    return { role: m.role, content: parts };
  }

  // ---------- completion ----------
  function post(path, payload, signal) {
    return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal });
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

  async function runCompletion(c, asst) {
    busy = true;
    setSending(true);
    abortCtrl = new AbortController();
    const messages = [];
    c.messages.filter((m) => m !== asst).forEach((m) => messages.push(toApi(m)));

    const body = { model: settings.model, messages, stream: !!settings.stream };

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
        } else if (/max_tokens/i.test(txt) && mt) {
          body.max_tokens = Number(mt[1]);
          settings.maxTokens = body.max_tokens;
          persist();
        } else if (/streaming/i.test(txt) && body.stream) {
          body.stream = false;
        } else if (/single user message/i.test(txt) && !single) {
          const last = [...body.messages].reverse().find((m) => m.role === 'user');
          if (last) body.messages = flattenMessages([last]);
          single = true;
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
      busy = false;
      abortCtrl = null;
      setSending(false);
      persist();
      renderAll();
    }
  }

  async function send(textIn) {
    if (busy) return;
    const text = (textIn || '').trim();
    if (pending.some((a) => !a.done)) { toast(t('stillUploading')); return; }
    if (!text && !pending.length) return;
    if (!hasApi()) { openSettings(); toast(t('needApi')); return; }
    if (!settings.model) { openSettings(); toast(t('needModel')); return; }

    const c = ensureConv();
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

    const asst = { role: 'assistant', text: '', streaming: true, time: Date.now() };
    c.messages.push(asst);
    renderAll();
    await runCompletion(c, asst);
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
      const res = await post('/api/models', { base, key });
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
    $('setStream').checked = !!settings.stream;
    $('setSpeak').checked = !!settings.speak;
    fillModels(settings.model);
    markSeg();
    $('settingsModal').hidden = false;
    if (hasApi() && !(settings.modelCache || []).length) loadModels(true);
  }

  function closeSettings() {
    // revert unsaved language/theme changes
    settings = Object.assign({}, DEF, safeParse(localStorage.getItem('cb_settings')));
    applyTheme();
    applyLang();
    renderAll();
    $('settingsModal').hidden = true;
  }

  function saveSettings() {
    let base = $('setBase').value.trim().replace(/\/+$/, '');
    if (base && !/^https?:\/\//i.test(base)) base = 'https://' + base;
    settings = Object.assign({}, settings, {
      base,
      key: $('setKey').value.trim(),
      model: $('setModel').value || '',
      stream: $('setStream').checked,
      speak: $('setSpeak').checked
    });
    persist();
    applyTheme();
    applyLang();
    renderAll();
    $('settingsModal').hidden = true;
    toast(t('saved'));
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

  // ---------- wiring ----------
  $('newChat').onclick = () => { newConv(); closeSide(); };
  $('menuBtn').onclick = openSide;
  $('backdrop').onclick = closeSide;
  $('exportBtn').onclick = exportChat;
  $('settingsBtn').onclick = openSettings;
  $('openSettings2').onclick = () => { closeSide(); openSettings(); };
  $('closeSettings').onclick = closeSettings;
  $('saveSettings').onclick = saveSettings;
  $('loadModels').onclick = () => loadModels(false);
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
    convs = [];
    currentId = null;
    persist();
    $('settingsModal').hidden = true;
    renderAll();
  };
  $('sendBtn').onclick = () => {
    if (busy) { if (abortCtrl) abortCtrl.abort(); return; }
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

  applyTheme();
  applyLang();
  setSending(false);
  fetch('/api/config').then((r) => r.json()).then((c) => { config = c; renderTop(); }).catch(() => {});
  renderAll();
})();
