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
          needsPassword: !!APP_PASSWORD
        });
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
