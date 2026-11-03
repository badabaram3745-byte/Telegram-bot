'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

const { isPrivateIp, normalizeBase } = require('../server.js');

const SERVER = path.join(__dirname, '..', 'server.js');
const children = [];
const mocks = [];

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

function startMock() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        if (req.url === '/v1/models') {
          res.writeHead(200, { 'content-type': 'application/json' });
          return res.end(JSON.stringify({ data: [{ id: 'mock-model' }] }));
        }
        if (req.url === '/v1/chat/completions') {
          const p = JSON.parse(body || '{}');
          if (p.stream) {
            res.writeHead(200, { 'content-type': 'text/event-stream' });
            res.write('data: {"choices":[{"delta":{"content":"he"}}]}\n\n');
            res.write('data: {"choices":[{"delta":{"content":"llo"}}]}\n\n');
            res.write('data: [DONE]\n\n');
            return res.end();
          }
          const last = p.messages[p.messages.length - 1];
          res.writeHead(200, { 'content-type': 'application/json' });
          return res.end(JSON.stringify({ choices: [{ message: { content: 'echo:' + last.content } }] }));
        }
        res.writeHead(404);
        res.end();
      });
    });
    mocks.push(srv);
    srv.listen(0, '127.0.0.1', () => resolve(srv.address().port));
  });
}

async function startServer(env = {}) {
  const port = await freePort();
  const child = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      PORT: String(port),
      API_BASE_URL: '',
      API_KEY: '',
      APP_PASSWORD: '',
      ALLOW_PRIVATE_UPSTREAM: '',
      DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'aichat-test-')),
      ...env
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  children.push(child);
  await new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', (d) => {
      out += d;
      if (out.includes('"listening"')) resolve();
    });
    child.on('error', reject);
    child.on('exit', (code) => reject(new Error('server exited ' + code)));
  });
  return `http://127.0.0.1:${port}`;
}

after(() => {
  children.forEach((c) => c.kill());
  mocks.forEach((m) => { m.closeAllConnections(); m.close(); });
});

// ---------- unit ----------
test('isPrivateIp blocks internal ranges and allows public ones', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.5', '172.20.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:7f00:1']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) {
    assert.equal(isPrivateIp(ip), false, ip);
  }
});

test('normalizeBase adds https and trims trailing slashes', () => {
  assert.equal(normalizeBase('api.example.com/v1/'), 'https://api.example.com/v1');
  assert.equal(normalizeBase(''), '');
});

// ---------- integration ----------
test('health and config endpoints work', async () => {
  const base = await startServer({ APP_PASSWORD: 'pw' });
  const h = await fetch(base + '/healthz');
  assert.equal(h.status, 200);
  const c = await (await fetch(base + '/api/config')).json();
  assert.equal(c.needsPassword, true);
});

test('chat requires the site password when one is set', async () => {
  const mock = await startMock();
  const base = await startServer({ APP_PASSWORD: 'secret', ALLOW_PRIVATE_UPSTREAM: '1' });
  const payload = { base: `http://127.0.0.1:${mock}/v1`, payload: { messages: [{ role: 'user', content: 'hi' }] } };
  const post = (headers) => fetch(base + '/api/chat', {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(payload)
  });
  assert.equal((await post({})).status, 401);
  assert.equal((await post({ 'x-app-password': 'wrong' })).status, 401);
  const ok = await post({ 'x-app-password': 'secret' });
  assert.equal(ok.status, 200);
  const j = await ok.json();
  assert.equal(j.choices[0].message.content, 'echo:hi');
});

test('models endpoint proxies the upstream list', async () => {
  const mock = await startMock();
  const base = await startServer({ ALLOW_PRIVATE_UPSTREAM: '1' });
  const r = await fetch(base + '/api/models', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ base: `http://127.0.0.1:${mock}/v1` })
  });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).data[0].id, 'mock-model');
});

test('streaming responses pass through', async () => {
  const mock = await startMock();
  const base = await startServer({ ALLOW_PRIVATE_UPSTREAM: '1' });
  const r = await fetch(base + '/api/chat', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ base: `http://127.0.0.1:${mock}/v1`, payload: { stream: true, messages: [] } })
  });
  const text = await r.text();
  assert.match(text, /"content":"he"/);
  assert.match(text, /\[DONE\]/);
});

test('SSRF guard blocks internal upstreams unless explicitly allowed', async () => {
  const base = await startServer({});
  const post = (b) => fetch(base + '/api/models', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ base: b })
  });
  assert.equal((await post('http://127.0.0.1:9/v1')).status, 403);
  assert.equal((await post('http://169.254.169.254/latest')).status, 403);
  assert.equal((await post('file:///etc/passwd')).status, 400);
  assert.equal((await post('ftp://example.com')).status, 400);
});

test('static files cannot escape the public folder', async () => {
  const base = await startServer({});
  const traversal = await fetch(base + '/%2e%2e/package.json');
  assert.notEqual(traversal.status, 200);
  const traversal2 = await fetch(base + '/..%2fserver.js');
  assert.notEqual(traversal2.status, 200);
  const bad = await fetch(base + '/%E0%A4%A');
  assert.equal(bad.status, 400);
  const idx = await fetch(base + '/');
  assert.equal(idx.status, 200);
  assert.match(await idx.text(), /<html/);
});

test('bad JSON gives a clean 400, not a crash', async () => {
  const base = await startServer({});
  const r = await fetch(base + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' });
  assert.equal(r.status, 400);
  const again = await fetch(base + '/healthz');
  assert.equal(again.status, 200);
});

test('sync stores and returns the blob, and rejects short codes', async () => {
  const base = await startServer({});
  const code = 'abcdefgh123';
  const put = await fetch(base + '/api/sync', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-sync-code': code },
    body: JSON.stringify({ updatedAt: 1, data: { convs: [{ id: 'x', messages: [] }], deleted: [] } })
  });
  assert.equal(put.status, 200);
  const get = await fetch(base + '/api/sync', { headers: { 'x-sync-code': code } });
  assert.equal(get.status, 200);
  assert.equal((await get.json()).data.convs[0].id, 'x');
  assert.equal((await fetch(base + '/api/sync', { headers: { 'x-sync-code': 'short' } })).status, 400);
  assert.equal((await fetch(base + '/api/sync', { headers: { 'x-sync-code': 'zzzzzzzzzz' } })).status, 404);
});

test('sync needs the site password when one is set', async () => {
  const base = await startServer({ APP_PASSWORD: 'pw' });
  const r = await fetch(base + '/api/sync', { headers: { 'x-sync-code': 'abcdefgh123' } });
  assert.equal(r.status, 401);
});

test('rate limit returns 429 after the per-minute budget', async () => {
  const base = await startServer({ RATE_LIMIT_PER_MIN: '3' });
  const codes = [];
  for (let i = 0; i < 4; i++) {
    codes.push((await fetch(base + '/api/models', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status);
  }
  assert.deepEqual(codes.slice(0, 3), [400, 400, 400]);
  assert.equal(codes[3], 429);
});
