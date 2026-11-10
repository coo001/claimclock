// Local backend. Serves the static UI and two JSON endpoints. Never logs request bodies or keys.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { liveConfig, runLive, DailyGuard, LIMITS } from './lib/live.js';
import { isValidDate } from './lib/scoring.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const STATIC = new Map([
  ['/', ['public/index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['public/index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['public/app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['public/style.css', 'text/css; charset=utf-8']],
  ['/live-run.json', ['public/live-run.json', 'application/json; charset=utf-8']],
  ['/live-evaluation-pre.json', ['public/live-evaluation-pre.json', 'application/json; charset=utf-8']],
  ['/live-run-bifrost.json', ['public/live-run-bifrost.json', 'application/json; charset=utf-8']],
  ['/live-run-gemini-direct.json', ['public/live-run-gemini-direct.json', 'application/json; charset=utf-8']],
  ['/live-evaluation-bifrost-freequery-v1.json', ['public/live-evaluation-bifrost-freequery-v1.json', 'application/json; charset=utf-8']],
  ['/bifrost-runtime-feature.json', ['public/bifrost-runtime-feature.json', 'application/json; charset=utf-8']],
  ['/bifrost-vk-link-probe.json', ['public/bifrost-vk-link-probe.json', 'application/json; charset=utf-8']],
  // Only browser-safe shared modules. lib/live.js (server only) is intentionally not served.
  ['/lib/scoring.js', ['lib/scoring.js', 'text/javascript; charset=utf-8']],
  ['/lib/schema.js', ['lib/schema.js', 'text/javascript; charset=utf-8']],
  ['/lib/render.js', ['lib/render.js', 'text/javascript; charset=utf-8']],
  ['/lib/fixtures.js', ['lib/fixtures.js', 'text/javascript; charset=utf-8']],
]);
const MAX_BODY = 20000;
const MAX_TEXT = 5000;

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function publicStatus(env) {
  const cfg = liveConfig(env);
  // Report which settings are present, never their values.
  return {
    liveReady: cfg.ready,
    problems: cfg.problems,
    gateway: cfg.bifrostBaseUrl ? 'local-bifrost' : null,
    model: cfg.model,
    limits: LIMITS,
    note: cfg.ready ? 'Settings are present; Bifrost and Tavily connectivity is verified on the first real request.' : 'Live analysis requires a local install and your own API keys. Fixed example mode remains available.',
  };
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('Request body is too large'), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export function createServer({ env = process.env, fetchImpl = fetch } = {}) {
  const daily = new DailyGuard(Number(env.DAILY_VERIFY_LIMIT) || 20);
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && STATIC.has(url.pathname)) {
        const [file, type] = STATIC.get(url.pathname);
        res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
        res.end(await readFile(path.join(ROOT, file)));
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/status') {
        sendJson(res, 200, publicStatus(env));
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/verify') {
        const status = publicStatus(env);
        if (!status.liveReady) {
          sendJson(res, 503, { error: 'LIVE_NOT_CONFIGURED', ...status });
          return;
        }
        const body = await readBody(req);
        const text = typeof body.text === 'string' ? body.text.trim() : '';
        if (!text || text.length > MAX_TEXT || !isValidDate(body.authoredDate)) {
          sendJson(res, 400, { error: 'BAD_INPUT', message: `An answer paragraph (1–${MAX_TEXT} characters) and an answer date (YYYY-MM-DD) are required.` });
          return;
        }
        if (!daily.take()) {
          sendJson(res, 429, { error: 'DAILY_LIMIT', message: 'The app’s daily live analysis limit has been reached.' });
          return;
        }
        const result = await runLive({ text, authoredDate: body.authoredDate, env, fetchImpl });
        sendJson(res, 200, { result });
        return;
      }
      sendJson(res, 404, { error: 'NOT_FOUND' });
    } catch (err) {
      sendJson(res, err.status ?? 500, { error: 'SERVER_ERROR', message: err.status ? err.message : 'Server error' });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 5173;
  createServer().listen(port, '127.0.0.1', () => {
    const s = publicStatus(process.env);
    console.log(`ClaimClock: http://127.0.0.1:${port}  (실시간 모드: ${s.liveReady ? '설정됨' : `꺼짐 — ${s.problems.join(', ')}`})`);
  });
}
