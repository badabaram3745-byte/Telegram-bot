(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const DEF = { base: '', key: '', model: '', system: '', temperature: 0.7, maxTokens: 2048, stream: true, speak: false, theme: 'dark' };
  const safeParse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

  let settings = Object.assign({}, DEF, safeParse(localStorage.getItem('cb_settings')));
  let convs = safeParse(localStorage.getItem('cb_convs')) || [];
  let currentId = convs[0] ? convs[0].id : null;
  let config = { hasDefaultBase: false, hasDefaultKey: false };
  let pending = [];
  let busy = false;
  let abortCtrl = null;
  let rafPending = false;

  function persist() {
    try {
      localStorage.setItem('cb_settings', JSON.stringify(settings));
      localStorage.setItem('cb_convs', JSON.stringify(convs));
    } catch {
      toast('حافظه مرورگر پره. چت‌های قدیمی یا فایل‌های بزرگ رو پاک کن.', 5000);
    }
  }

  function toast(msg, ms = 3000) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._h);
    t._h = setTimeout(() => { t.hidden = true; }, ms);
  }

  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function current() { return convs.find((c) => c.id === currentId); }
  function hasApi() { return !!(settings.base || config.hasDefaultBase); }

  function friendly(status, text) {
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
      return '' + (blocks.length - 1) + '';
    });
    html = html
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/^#{1,3} (.+)$/gm, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
    return html.replace(/(\d+)/g, (_, i) => blocks[i]);
  }

  function stripMd(t) { return String(t).replace(/```[\s\S]*?```/g, ' ').replace(/[*#`_]/g, ''); }

  function speak(text) {
    if (!('speechSynthesis' in window)) return toast('مرورگرت خواندن با صدا رو نداره');
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(stripMd(text));
    u.lang = /[\u0600-\u06FF]/.test(text) ? 'fa-IR' : 'en-US';
    speechSynthesis.speak(u);
  }

  function copyText(t) {
    if (!navigator.clipboard) return toast('کپی پشتیبانی نمیشه');
    navigator.clipboard.writeText(t).then(() => toast('کپی شد'), () => toast('کپی نشد'));
  }

  function applyTheme() { document.documentElement.dataset.theme = settings.theme || 'dark'; }

  // ---------- conversations ----------
  function newConv() {
    const c = { id: uid(), title: 'چت جدید', messages: [], created: Date.now() };
    convs.unshift(c);
    currentId = c.id;
    persist();
    renderAll();
    return c;
  }
  function ensureConv() { return current() || newConv(); }

  // ---------- rendering ----------
  function renderAll() { renderSidebar(); renderMessages(); renderTop(); renderAttachBar(); }

  function renderTop() {
    const c = current();
    $('chatTitle').textContent = c ? c.title : 'چت جدید';
    $('modelLabel').textContent = settings.model || 'مدل انتخاب نشده';
  }

  function renderSidebar() {
    const list = $('convList');
    list.innerHTML = '';
    if (!convs.length) {
      list.innerHTML = '<div class="empty-side">هنوز چتی نداری</div>';
      return;
    }
    convs.forEach((c) => {
      const row = document.createElement('div');
      row.className = 'conv' + (c.id === currentId ? ' active' : '');
      const t = document.createElement('button');
      t.className = 'conv-title';
      t.textContent = c.title;
      t.onclick = () => { currentId = c.id; closeSide(); renderAll(); };
      const d = document.createElement('button');
      d.className = 'icon-btn small';
      d.textContent = '🗑';
      d.title = 'حذف';
      d.onclick = (e) => {
        e.stopPropagation();
        if (!confirm('این چت حذف بشه؟')) return;
        convs = convs.filter((x) => x.id !== c.id);
        if (currentId === c.id) currentId = convs[0] ? convs[0].id : null;
        persist();
        renderAll();
      };
      row.append(t, d);
      list.append(row);
    });
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
    if (!m.streaming) {
      const bar = document.createElement('div');
      bar.className = 'msg-actions';
      const mk = (label, fn) => {
        const x = document.createElement('button');
        x.className = 'mini'; x.textContent = label; x.onclick = fn;
        return x;
      };
      bar.append(mk('کپی', () => copyText(m.text || '')));
      if (m.role === 'assistant') {
        bar.append(mk('🔊', () => speak(m.text || '')));
        bar.append(mk('🔁', () => regen(i)));
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
      box.innerHTML = '<div class="welcome"><div class="logo">✦</div><h2>چی توی ذهنته؟</h2><p>متن، عکس، فایل، صدا یا ورودی صوتی بفرست. مدل و آدرس API رو از ⚙️ وصل کن.</p></div>';
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

  function renderAttachBar() {
    const bar = $('attachBar');
    bar.innerHTML = '';
    pending.forEach((a, idx) => {
      const s = document.createElement('span');
      s.className = 'chip';
      s.textContent = (a.kind === 'image' ? '🖼 ' : a.kind === 'audio' ? '🎵 ' : '📄 ') + a.name;
      const x = document.createElement('button');
      x.className = 'mini'; x.textContent = '✕';
      x.onclick = () => { pending.splice(idx, 1); renderAttachBar(); };
      s.append(x);
      bar.append(s);
    });
  }

  // ---------- files ----------
  function toDataURL(f) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(new Error('read'));
      r.readAsDataURL(f);
    });
  }

  function shrinkImage(f) {
    return new Promise((res, rej) => {
      const img = new Image();
      const url = URL.createObjectURL(f);
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
        URL.revokeObjectURL(url);
        res(cv.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => rej(new Error('img'));
      img.src = url;
    });
  }

  async function readFile(f) {
    const mime = f.type || '';
    if (mime.startsWith('image/')) return { kind: 'image', name: f.name, mime: 'image/jpeg', url: await shrinkImage(f) };
    if (mime.startsWith('audio/')) {
      if (f.size > 3 * 1024 * 1024) throw new Error('فایل صوتی بزرگتر از ۳ مگابایته');
      return { kind: 'audio', name: f.name, mime, url: await toDataURL(f) };
    }
    if (mime === 'application/pdf') {
      if (f.size > 3 * 1024 * 1024) throw new Error('PDF بزرگتر از ۳ مگابایته');
      return { kind: 'pdf', name: f.name, mime, url: await toDataURL(f) };
    }
    const isText = mime.startsWith('text/') || /\.(md|json|csv|txt|js|ts|py|html|css|xml|ya?ml|log)$/i.test(f.name);
    if (isText) return { kind: 'text', name: f.name, mime: 'text/plain', text: (await f.text()).slice(0, 100000) };
    throw new Error('این نوع فایل پشتیبانی نمیشه');
  }

  async function handleFiles(list) {
    for (const f of Array.from(list)) {
      try { pending.push(await readFile(f)); }
      catch (err) { toast(f.name + ': ' + err.message, 4000); }
    }
    renderAttachBar();
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

  // ---------- voice input (speech to text) ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  $('micBtn').onclick = () => {
    if (!SR) return toast('این مرورگر ورودی صوتی نداره. Chrome، Edge یا Safari جدید رو امتحان کن.', 4000);
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = navigator.language && navigator.language.startsWith('en') ? 'en-US' : 'fa-IR';
    rec.interimResults = true;
    rec.continuous = false;
    const base = $('input').value;
    rec.onresult = (e) => {
      let t = '';
      for (const r of e.results) t += r[0].transcript;
      $('input').value = (base ? base + ' ' : '') + t;
      autosize();
    };
    rec.onend = () => { rec = null; $('micBtn').classList.remove('rec'); };
    rec.onerror = () => { rec = null; $('micBtn').classList.remove('rec'); toast('ورودی صوتی کار نکرد'); };
    rec.start();
    $('micBtn').classList.add('rec');
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
      text += `\n\n[فایل: ${a.name}]\n${a.text}`;
    });
    const parts = [{ type: 'text', text: text || ' ' }];
    m.attachments.forEach((a) => {
      if (a.kind === 'image') parts.push({ type: 'image_url', image_url: { url: a.url } });
      else if (a.kind === 'audio') {
        const fmt = audioFormat(a.mime, a.name);
        if (fmt) parts.push({ type: 'input_audio', input_audio: { data: a.url.split(',')[1], format: fmt } });
        else parts.push({ type: 'text', text: `[فایل صوتی ${a.name} با این فرمت پشتیبانی نمیشه. mp3 یا wav بفرست]` });
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
    b.textContent = on ? '■' : '➤';
    b.classList.toggle('stop', on);
    b.title = on ? 'توقف' : 'ارسال';
  }

  async function runCompletion(c, asst) {
    busy = true;
    setSending(true);
    abortCtrl = new AbortController();
    const messages = [];
    if (settings.system && settings.system.trim()) messages.push({ role: 'system', content: settings.system.trim() });
    c.messages.filter((m) => m !== asst).forEach((m) => messages.push(toApi(m)));

    const body = { model: settings.model, messages, stream: !!settings.stream };
    if (settings.temperature !== '' && settings.temperature !== undefined) body.temperature = Number(settings.temperature);
    if (Number(settings.maxTokens) > 0) body.max_tokens = Number(settings.maxTokens);

    const send = (b) => post('/api/chat', { base: settings.base, key: settings.key, payload: b }, abortCtrl.signal);

    try {
      let res = await send(body);
      if (!res.ok) {
        const t = await res.text();
        if (/temperature/i.test(t) && 'temperature' in body) {
          delete body.temperature;
          res = await send(body);
          if (!res.ok) throw new Error(friendly(res.status, await res.text()));
        } else {
          throw new Error(friendly(res.status, t));
        }
      }

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
        asst.text = (asst.text || '') + (asst.text ? '\n\n' : '') + '(متوقف شد)';
      } else {
        asst.text = (asst.text ? asst.text + '\n\n' : '') + '⚠️ ' + (err.message || 'خطای نامشخص');
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
    if (!text && !pending.length) return;
    if (!hasApi()) { openSettings(); toast('اول آدرس API رو وارد کن'); return; }
    if (!settings.model) { openSettings(); toast('یه مدل انتخاب کن'); return; }

    const c = ensureConv();
    const userMsg = {
      role: 'user',
      text,
      attachments: pending.map((a) => ({ kind: a.kind, name: a.name, mime: a.mime, url: a.url, text: a.text }))
    };
    c.messages.push(userMsg);
    if (c.title === 'چت جدید' && text) c.title = text.slice(0, 40);
    pending = [];
    $('input').value = '';
    autosize();

    const asst = { role: 'assistant', text: '', streaming: true };
    c.messages.push(asst);
    renderAll();
    await runCompletion(c, asst);
  }

  async function regen(i) {
    if (busy) return;
    const c = current();
    if (!c) return;
    c.messages.splice(i);
    const asst = { role: 'assistant', text: '', streaming: true };
    c.messages.push(asst);
    renderAll();
    await runCompletion(c, asst);
  }

  // ---------- models ----------
  async function loadModels() {
    const base = $('setBase').value.trim() || settings.base;
    const key = $('setKey').value.trim() || settings.key;
    if (!base && !config.hasDefaultBase) return toast('اول آدرس API رو وارد کن');
    try {
      const res = await post('/api/models', { base, key });
      const text = await res.text();
      if (!res.ok) throw new Error(friendly(res.status, text));
      const j = JSON.parse(text);
      const list = j.data || j.models || [];
      const ids = list.map((m) => (typeof m === 'string' ? m : (m.id || m.name))).filter(Boolean).sort();
      $('modelList').innerHTML = ids.map((id) => `<option value="${esc(id)}"></option>`).join('');
      toast(ids.length ? `${ids.length} مدل پیدا شد. از لیست انتخاب کن` : 'مدلی پیدا نشد', 3500);
    } catch (e) {
      toast('خطا در گرفتن مدل‌ها: ' + e.message, 5000);
    }
  }

  // ---------- settings ----------
  function openSettings() {
    $('setBase').value = settings.base;
    $('setBase').placeholder = config.hasDefaultBase ? 'خالی = آدرس پیش‌فرض سرور' : 'https://.../v1';
    $('setKey').value = settings.key;
    $('setModel').value = settings.model;
    $('setSystem').value = settings.system;
    $('setTemp').value = settings.temperature;
    $('setMax').value = settings.maxTokens;
    $('setStream').checked = !!settings.stream;
    $('setSpeak').checked = !!settings.speak;
    $('setTheme').value = settings.theme;
    $('settingsModal').hidden = false;
  }

  function saveSettings() {
    let base = $('setBase').value.trim().replace(/\/+$/, '');
    if (base && !/^https?:\/\//i.test(base)) base = 'https://' + base;
    settings = Object.assign({}, settings, {
      base,
      key: $('setKey').value.trim(),
      model: $('setModel').value.trim(),
      system: $('setSystem').value,
      temperature: $('setTemp').value === '' ? 0.7 : Number($('setTemp').value),
      maxTokens: Number($('setMax').value) || 0,
      stream: $('setStream').checked,
      speak: $('setSpeak').checked,
      theme: $('setTheme').value
    });
    persist();
    applyTheme();
    $('settingsModal').hidden = true;
    renderTop();
    toast('ذخیره شد');
  }

  // ---------- sidebar / misc ----------
  function openSide() { $('app').classList.add('side-open'); }
  function closeSide() { $('app').classList.remove('side-open'); }

  function autosize() {
    const t = $('input');
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 160) + 'px';
  }

  function exportChat() {
    const c = current();
    if (!c || !c.messages.length) return toast('چت خالیه');
    const out = c.messages.map((m) => {
      const att = (m.attachments || []).map((a) => `\n\n[${a.kind}: ${a.name}]`).join('');
      return `### ${m.role === 'user' ? 'تو' : 'AI'}\n\n${m.text || ''}${att}`;
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
  $('closeSide').onclick = closeSide;
  $('backdrop').onclick = closeSide;
  $('exportBtn').onclick = exportChat;
  $('settingsBtn').onclick = openSettings;
  $('openSettings2').onclick = () => { closeSide(); openSettings(); };
  $('closeSettings').onclick = () => { $('settingsModal').hidden = true; };
  $('saveSettings').onclick = saveSettings;
  $('loadModels').onclick = loadModels;
  $('clearAll').onclick = () => {
    if (!confirm('همه چت‌ها پاک بشن؟ این کار برگشت نداره.')) return;
    convs = [];
    currentId = null;
    persist();
    renderAll();
    $('settingsModal').hidden = true;
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
    if (e.key === 'Escape') { $('settingsModal').hidden = true; closeSide(); }
  });

  applyTheme();
  fetch('/api/config').then((r) => r.json()).then((c) => { config = c; renderTop(); }).catch(() => {});
  renderAll();
})();
