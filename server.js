'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ENV_BASE = process.env.API_BASE_URL || '';
const ENV_KEY = process.env.API_KEY || '';
const MAX_BODY = 40 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function normalizeBase(raw) {
  let b = String(raw || '').trim();
  if (!b) return '';
  if (!/^https?:\/\//i.test(b)) b = 'https://' + b;
  return b.replace(/\/+$/, '');
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('payload too large'), { status: 413 }));
        req.destroy();
      } else {
        chunks.push(c);
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('invalid json'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function resolveCreds(body) {
  const base = normalizeBase(body.base) || normalizeBase(ENV_BASE);
  const key = String(body.key || '').trim() || ENV_KEY;
  return { base, key };
}

function authHeaders(key) {
  const h = { 'Content-Type': 'application/json' };
  if (key) h.Authorization = `Bearer ${key}`;
  return h;
}

async function handleModels(req, res) {
  const body = await readJson(req);
  const { base, key } = resolveCreds(body);
  if (!base) return sendJson(res, 400, { error: 'آدرس API وارد نشده' });
  const upstream = await fetch(`${base}/models`, {
    headers: authHeaders(key),
    signal: AbortSignal.timeout(30000)
  });
  const text = await upstream.text();
  res.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') || 'application/json'
  });
  res.end(text);
}

async function handleChat(req, res) {
  const body = await readJson(req);
  const { base, key } = resolveCreds(body);
  if (!base) return sendJson(res, 400, { error: 'آدرس API وارد نشده' });
  if (!body.payload || typeof body.payload !== 'object') {
    return sendJson(res, 400, { error: 'payload invalid' });
  }

  const ac = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) ac.abort();
  });

  const upstream = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(key),
    body: JSON.stringify(body.payload),
    signal: ac.signal
  });

  res.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') || 'application/json',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no'
  });

  if (!upstream.body) {
    res.end(await upstream.text());
    return;
  }
  const reader = upstream.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://x');
    if (req.method === 'GET' && pathname === '/healthz') return sendJson(res, 200, { ok: true });
    if (req.method === 'GET' && pathname === '/api/config') {
      return sendJson(res, 200, { hasDefaultBase: !!ENV_BASE, hasDefaultKey: !!ENV_KEY });
    }
    if (req.method === 'POST' && pathname === '/api/models') return await handleModels(req, res);
    if (req.method === 'POST' && pathname === '/api/chat') return await handleChat(req, res);
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
    sendJson(res, 405, { error: 'method not allowed' });
  } catch (err) {
    if (res.headersSent) {
      res.end();
      return;
    }
    const status = err.status || (err.name === 'AbortError' ? 499 : 502);
    sendJson(res, status, { error: err.name === 'AbortError' ? 'aborted' : (err.message || 'server error') });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`listening on ${PORT}`);
});
