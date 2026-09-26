#!/usr/bin/env node
// The Committee — local server.
// Serves the app and proxies model calls to Featherless, keeping your API key
// off the page and keeping total in-flight requests inside your plan's
// concurrency allotment (bigger models cost more concurrency units).
//
// Run:  FEATHERLESS_API_KEY=... node server.js      (or put the key in .env)
// Then open http://localhost:3000

const http = require('http');
const fs = require('fs');
const path = require('path');

loadDotEnv();
const PORT = Number(process.env.PORT) || 3000;
const API = 'https://api.featherless.ai/v1';
const KEY = process.env.FEATHERLESS_API_KEY || '';
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS) || 120000; // cold models can take a while to load
let capacity = Number(process.env.CONCURRENCY) || 0; // 0 = read from /v1/plan

function loadDotEnv() {
  try {
    const text = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* no .env, that's fine */ }
}

const auth = () => ({ Authorization: `Bearer ${KEY}` });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Plan + model catalogue ----------
let plan = null;
async function getPlan() {
  if (plan || !KEY) return plan;
  try {
    const r = await fetch(`${API}/plan`, { headers: auth() });
    if (r.ok) plan = await r.json();
  } catch { /* offline */ }
  if (!capacity) capacity = (plan && plan.concurrency) || 2;
  return plan;
}

let modelCache = null; // { at, list: [{id, cls}] }
const modelClass = new Map();
async function getModels() {
  if (modelCache && Date.now() - modelCache.at < 60 * 60 * 1000) return modelCache.list;
  const all = [];
  let page = 1, totalPages = 1;
  do {
    const url = page === 1 ? `${API}/models` : `${API}/models?page=${page}`;
    const r = await fetch(url, { headers: auth() });
    if (!r.ok) throw new Error(`Featherless /models returned ${r.status}`);
    const j = await r.json();
    all.push(...(j.data || []));
    totalPages = (j.pagination && j.pagination.total_pages) || 1;
    page++;
  } while (page <= totalPages && page < 500);

  const list = all
    .filter((m) => m.available_on_current_plan !== false && !m.is_gated)
    .map((m) => ({ id: m.id, cls: m.model_class || '' }));
  for (const m of list) modelClass.set(m.id, m.cls);
  modelCache = { at: Date.now(), list };
  return list;
}

// Concurrency cost per Featherless docs: <=15B → 1, 24–34B → 2, 70B+ and DeepSeek/Kimi/GLM → 4.
function weightFor(id) {
  const s = `${modelClass.get(id) || ''} ${id}`.toLowerCase();
  if (/deepseek|kimi|glm/.test(s)) return 4;
  const m = s.match(/(\d+(?:\.\d+)?)b\b/);
  const size = m ? parseFloat(m[1]) : 8;
  if (size >= 60) return 4;
  if (size >= 20) return 2;
  return 1;
}

// ---------- Weighted semaphore ----------
let inUse = 0;
const waiters = [];
function acquire(w) {
  return new Promise((resolve) => { waiters.push({ w, resolve }); pump(); });
}
function release(w) { inUse -= w; pump(); }
function pump() {
  const cap = capacity || 2;
  while (waiters.length) {
    const head = waiters[0];
    const w = Math.min(head.w, cap);
    if (inUse + w > cap) break;
    waiters.shift();
    inUse += w;
    head.resolve(w);
  }
}

// ---------- One model call ----------
function cleanText(t) {
  return String(t || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^[\s\S]*<\/think>/i, '') // unmatched closing tag
    .replace(/<think>[\s\S]*$/i, '')   // thinking that never closed
    .trim();
}

async function chat({ model, prompt, max_tokens = 200, temperature = 0.9 }, isGone) {
  await getPlan();
  const held = await acquire(weightFor(model));
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (isGone()) return { error: 'adjourned' };
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const r = await fetch(`${API}/chat/completions`, {
          method: 'POST',
          headers: { ...auth(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens,
            temperature,
          }),
          signal: ctrl.signal,
        });
        const body = await r.text();
        if ([429, 502, 503].includes(r.status)) { await sleep(1500 * 2 ** attempt); continue; }
        if (!r.ok) return { error: body.slice(0, 300), status: r.status };
        const j = JSON.parse(body);
        return { text: cleanText(j.choices?.[0]?.message?.content), usage: j.usage || null };
      } catch (e) {
        if (e.name === 'AbortError') return { error: 'timed out', status: 408 };
        if (attempt === 3) return { error: String(e.message || e) };
        await sleep(1000 * 2 ** attempt);
      } finally {
        clearTimeout(timer);
      }
    }
    return { error: 'rate limited', status: 429 };
  } finally {
    release(held);
  }
}

// ---------- HTTP ----------
function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(path.join(__dirname, 'public', 'index.html')).pipe(res);
    }
    if (req.method === 'GET' && url.pathname === '/api/status') {
      const p = await getPlan();
      return send(res, 200, { hasKey: !!KEY, plan: p, concurrency: capacity || 2 });
    }
    if (req.method === 'GET' && url.pathname === '/api/models') {
      if (!KEY) return send(res, 200, { models: [] });
      const list = await getModels();
      return send(res, 200, { models: list.map((m) => ({ id: m.id, w: weightFor(m.id) })) });
    }
    if (req.method === 'POST' && url.pathname === '/api/chat') {
      if (!KEY) return send(res, 400, { error: 'No FEATHERLESS_API_KEY set on the server.' });
      let gone = false;
      res.on('close', () => { if (!res.writableEnded) gone = true; });
      const body = await readBody(req);
      if (!body.model || !body.prompt) return send(res, 400, { error: 'model and prompt are required' });
      const out = await chat(body, () => gone);
      if (!gone) send(res, 200, out);
      return;
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
});

server.listen(PORT, async () => {
  await getPlan();
  console.log(`\n  The Committee is in session at http://localhost:${PORT}`);
  if (!KEY) console.log('  No FEATHERLESS_API_KEY found — the app will run in rehearsal mode with fake delegates.');
  else console.log(`  Plan: ${plan ? plan.name : 'unknown'}; concurrency units: ${capacity || 2}`);
  console.log('');
});
