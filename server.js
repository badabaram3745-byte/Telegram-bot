'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const dns = require('dns').promises;

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ENV_BASE = normalizeBase(process.env.API_BASE_URL || '');
const ENV_KEY = String(process.env.API_KEY || '').trim();
// اگه ست بشه، همه درخواست‌های /api/* رمز می‌خوان (هدر x-app-password)
const APP_PASSWORD = String(process.env.APP_PASSWORD || '').trim();
// فقط برای توسعه/مدل لوکال (مثل localhost). روی Railway خاموش بمونه.
const ALLOW_PRIVATE = process.env.ALLOW_PRIVATE_UPSTREAM === '1';
const MAX_BODY = 40 * 1024 * 1024;
// همگام‌سازی بین دستگاه‌ها: فایل‌ها اینجا ذخیره میشن (روی Railway یه Volume بذار وگرنه بعد از دیپلوی پاک میشن)
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MIN) || 60;
const hits = new Map();
// جستجوی وب (اختیاری): با BRAVE_API_KEY فعال میشه. SEARCH_BASE فقط برای تست.
const SEARCH_KEY = String(process.env.BRAVE_API_KEY || '').trim();
const SEARCH_BASE = process.env.SEARCH_BASE || 'https://api.search.brave.com/res/v1/web/search';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function log(obj) {
  process.stdout.write(JSON.stringify(Object.assign({ t: new Date().toISOString() }, obj)) + '\n');
}

function normalizeBase(raw) {
  let b = String(raw || '').trim();
  if (!b) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(b)) b = 'https://' + b;
  return b.replace(/\/+$/, '');
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on('data', (c) => {
      if (failed) return;
      size += c.length;
      if (size > MAX_BODY) {
        failed = true;
        reject(httpError(413, 'حجم درخواست خیلی زیاده'));
        req.destroy();
      } else {
        chunks.push(c);
      }
    });
    req.on('end', () => {
      if (failed) return;
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('bad');
        resolve(parsed);
      } catch {
        reject(httpError(400, 'JSON نامعتبره'));
      }
    });
    req.on('error', reject);
  });
}

// ---------- SSRF guard ----------
function isPrivateV4(ip) {
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 168 || b === 0))
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}

function isPrivateIp(ip) {
  const v = net.isIP(ip);
  if (v === 4) return isPrivateV4(ip);
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s.startsWith('::ffff:')) {
      const rest = s.slice(7);
      return net.isIP(rest) === 4 ? isPrivateV4(rest) : true;
    }
    if (s === '::' || s === '::1') return true;
    if (/^fe[89ab]/.test(s)) return true; // link-local
    if (/^f[cd]/.test(s)) return true; // unique local
    if (s.startsWith('ff')) return true; // multicast
    return false;
  }
  return true; // نامشخص: بلاک
}

async function assertUpstreamAllowed(base) {
  let u;
  try {
    u = new URL(base);
  } catch {
    throw httpError(400, 'آدرس API معتبر نیست');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw httpError(400, 'فقط آدرس http یا https مجازه');
  if (ALLOW_PRIVATE || (ENV_BASE && base === ENV_BASE)) return;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  let addrs;
  if (net.isIP(host)) {
    addrs = [host];
  } else {
    try {
      const found = await Promise.race([
        dns.lookup(host, { all: true }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('dns timeout')), 5000).unref())
      ]);
      addrs = found.map((a) => a.address);
    } catch {
      throw httpError(400, 'دامنه پیدا نشد');
    }
  }
  if (addrs.some(isPrivateIp)) throw httpError(403, 'آدرس‌های داخلی یا لوکال مجاز نیستن');
}

// ---------- rate limit (per IP, per minute) ----------
function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || req.socket.remoteAddress || 'unknown';
}

function rateOk(req) {
  const ip = clientIp(req);
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  if (hits.size > 10000) hits.clear();
  hits.set(ip, arr);
  return arr.length <= RATE_LIMIT;
}

// ---------- auth ----------
function checkPassword(req) {
  if (!APP_PASSWORD) return true;
  const given = Buffer.from(String(req.headers['x-app-password'] || ''));
  const want = Buffer.from(APP_PASSWORD);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

function resolveCreds(body) {
  const base = normalizeBase(body.base) || ENV_BASE;
  const key = String(body.key || '').trim() || ENV_KEY;
  return { base, key };
}

function authHeaders(key) {
  const h = { 'Content-Type': 'application/json' };
  if (key) h.Authorization = `Bearer ${key}`;
  return h;
}

// ---------- API handlers ----------
async function handleModels(req, res) {
  const body = await readJson(req);
  const { base, key } = resolveCreds(body);
  if (!base) throw httpError(400, 'آدرس API وارد نشده');
  await assertUpstreamAllowed(base);
  const upstream = await fetch(`${base}/models`, {
    headers: authHeaders(key),
    redirect: 'error',
    signal: AbortSignal.timeout(30000)
  });
  const text = await upstream.text();
  res.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8'
  });
  res.end(text);
}

async function handleChat(req, res) {
  const body = await readJson(req);
  const { base, key } = resolveCreds(body);
  if (!base) throw httpError(400, 'آدرس API وارد نشده');
  if (!body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) {
    throw httpError(400, 'payload نامعتبره');
  }
  await assertUpstreamAllowed(base);

  const ac = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) ac.abort();
  });

  const upstream = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(key),
    body: JSON.stringify(body.payload),
    redirect: 'error',
    signal: ac.signal
  });

  res.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no'
  });

  if (!upstream.body) {
    res.end(await upstream.text());
    return;
  }
  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(value)) {
        await new Promise((r) => { res.once('drain', r); res.once('close', r); });
      }
    }
  } finally {
    reader.releaseLock();
    res.end();
  }
}

// ---------- sync ----------
function syncFile(code) {
  return path.join(DATA_DIR, crypto.createHash('sha256').update(code).digest('hex') + '.json');
}

function syncCodeOf(req) {
  const c = String(req.headers['x-sync-code'] || '').trim();
  if (c.length < 8) throw httpError(400, 'کد همگام‌سازی حداقل ۸ کاراکتر باشه');
  return c;
}

async function handleSyncGet(req, res) {
  const txt = await fs.promises.readFile(syncFile(syncCodeOf(req)), 'utf8').catch(() => null);
  if (txt === null) return sendJson(res, 404, { error: 'empty' });
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(txt);
}

async function handleSyncPut(req, res) {
  const code = syncCodeOf(req);
  const body = await readJson(req);
  if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) throw httpError(400, 'data نامعتبره');
  const text = JSON.stringify({ updatedAt: Number(body.updatedAt) || Date.now(), data: body.data });
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  const f = syncFile(code);
  await fs.promises.writeFile(f + '.tmp', text);
  await fs.promises.rename(f + '.tmp', f);
  sendJson(res, 200, { ok: true });
}

// ---------- web search ----------
async function handleSearch(req, res) {
  const body = await readJson(req);
  const q = String(body.q || '').trim().slice(0, 300);
  if (!q) throw httpError(400, 'سوال خالیه');
  if (!SEARCH_KEY) throw httpError(404, 'جستجوی وب روی سرور فعال نیست');
  const u = new URL(SEARCH_BASE);
  u.searchParams.set('q', q);
  u.searchParams.set('count', '5');
  const r = await fetch(u, {
    headers: { 'X-Subscription-Token': SEARCH_KEY, Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(15000)
  });
  if (!r.ok) throw httpError(502, 'جستجو جواب نداد');
  const j = await r.json();
  const results = ((j.web && j.web.results) || []).slice(0, 5).map((x) => ({
    title: String(x.title || ''),
    url: String(x.url || ''),
    description: String(x.description || '')
  }));
  sendJson(res, 200, { results });
}

// ---------- static ----------
function serveStatic(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400);
    return res.end();
  }
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.resolve(PUBLIC_DIR, '.' + urlPath);
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    const isManifest = path.basename(filePath) === 'manifest.json';
    res.writeHead(200, {
      'Content-Type': isManifest ? 'application/manifest+json; charset=utf-8' : (MIME[path.extname(filePath)] || 'application/octet-stream'),
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(data);
  });
}

// ---------- router ----------
const server = http.createServer((req, res) => {
  const start = Date.now();
  res.on('finish', () => {
    const { pathname } = new URL(req.url, 'http://x');
    log({ method: req.method, path: pathname, status: res.statusCode, ms: Date.now() - start });
  });

  (async () => {
    try {
      const { pathname } = new URL(req.url, 'http://x');
      if (req.method === 'GET' && pathname === '/healthz') return sendJson(res, 200, { ok: true });
      if (req.method === 'GET' && pathname === '/api/config') {
        return sendJson(res, 200, {
          hasDefaultBase: !!ENV_BASE,
          hasDefaultKey: !!ENV_KEY,
          needsPassword: !!APP_PASSWORD,
          searchEnabled: !!SEARCH_KEY
        });
      }
      if (pathname.startsWith('/api/') && !rateOk(req)) {
        return sendJson(res, 429, { error: 'خیلی سریع درخواست دادی. چند ثانیه صبر کن.' });
      }
      if (pathname === '/api/sync') {
        if (!checkPassword(req)) return sendJson(res, 401, { error: 'رمز ورود اشتباهه' });
        if (req.method === 'GET') return await handleSyncGet(req, res);
        if (req.method === 'PUT') return await handleSyncPut(req, res);
        return sendJson(res, 405, { error: 'method not allowed' });
      }
      if (pathname === '/api/search') {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' });
        if (!checkPassword(req)) return sendJson(res, 401, { error: 'رمز ورود اشتباهه' });
        return await handleSearch(req, res);
      }
      if (pathname === '/api/models' || pathname === '/api/chat') {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' });
        if (!checkPassword(req)) return sendJson(res, 401, { error: 'رمز ورود اشتباهه' });
        return pathname === '/api/models' ? await handleModels(req, res) : await handleChat(req, res);
      }
      if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
      sendJson(res, 405, { error: 'method not allowed' });
    } catch (err) {
      if (res.headersSent) {
        if (!res.writableEnded) res.end();
        return;
      }
      const status = err.status || (err.name === 'AbortError' ? 499 : 502);
      const message = err.name === 'AbortError' ? 'aborted' : (err.message || 'server error');
      sendJson(res, status, { error: message });
    }
  })();
});

if (ENV_KEY && !APP_PASSWORD) {
  log({ level: 'warn', msg: 'API_KEY is set but APP_PASSWORD is empty: anyone who finds this URL can use your key' });
}

module.exports = { server, isPrivateIp, normalizeBase };

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    log({ msg: 'listening', port: PORT });
  });
}
