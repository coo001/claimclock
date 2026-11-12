// HTTP smoke tests. Empty env + a fetch stub that fails the test if called: no external network.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.js';

let server;
let base;
let externalCalls = 0;
const fetchStub = async () => {
  externalCalls += 1;
  throw new Error('external fetch is not allowed in tests');
};

before(async () => {
  server = createServer({ env: {}, fetchImpl: fetchStub });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
  assert.equal(externalCalls, 0);
});

test('GET / serves HTML with the key-free demo banner', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const html = await res.text();
  assert.match(html, /stored examples only/);
  assert.match(html, /no external API calls/);
});

test('static JS, CSS and fixture modules are served', async () => {
  for (const [p, type] of [
    ['/app.js', /javascript/],
    ['/style.css', /text\/css/],
    ['/lib/fixtures.js', /javascript/],
    ['/lib/scoring.js', /javascript/],
    ['/lib/schema.js', /javascript/],
    ['/lib/render.js', /javascript/],
    ['/lib/queue.js', /javascript/],
  ]) {
    const res = await fetch(base + p);
    assert.equal(res.status, 200, p);
    assert.match(res.headers.get('content-type'), type, p);
    assert.ok((await res.text()).length > 0, p);
  }
  const fixtures = await (await fetch(`${base}/lib/fixtures.js`)).text();
  assert.match(fixtures, /export const FIXTURES/);
});

test('GET /live-run.json serves the recorded API run', async () => {
  const res = await fetch(`${base}/live-run.json`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  const body = await res.json();
  assert.equal(body.mode, 'recorded-live');
  assert.equal(body.actualExternalRun, true);
  assert.ok(body.humanAgreement.total >= 1);
});

test('GET /live-run-python-bifrost.json serves the second real Bifrost example', async () => {
  const res = await fetch(`${base}/live-run-python-bifrost.json`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  const body = await res.json();
  assert.equal(body.mode, 'recorded-live');
  assert.equal(body.actualExternalRun, true);
  assert.equal(body.input.title, 'Python support lifecycle claims');
  assert.equal(body.result.runLog.counts.tavily, 2);
  assert.equal(body.result.claims.length, 2);
  assert.ok(body.result.claims.every((claim) => claim.evidence.length > 0));
  assert.doesNotMatch(JSON.stringify(body), /\bsk-[A-Za-z0-9]|AIza[0-9A-Za-z_-]{20,}|tvly-[A-Za-z0-9]/);
});

test('GET /live-run-stale-bifrost.json serves the live run that refuted stale claims and suggested fixes', async () => {
  const res = await fetch(`${base}/live-run-stale-bifrost.json`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.mode, 'recorded-live');
  assert.equal(body.actualExternalRun, true);
  assert.match(body.executionPath, /virtual key/);
  assert.equal(body.input.answerText, body.result.answerText);
  assert.ok(body.result.runLog.counts.tavily <= 3);
  const refuted = body.result.claims.filter((c) => c.relation === '반박');
  assert.ok(refuted.length >= 1);
  assert.ok(refuted.every((c) => c.fix && c.evidence.some((e) => e.citationOk)));
  assert.doesNotMatch(JSON.stringify(body), /\bsk-[A-Za-z0-9]|AIza[0-9A-Za-z_-]{20,}|tvly-[A-Za-z0-9]/);
});

test('every listed static file exists and the app lists each recorded run it replays', async () => {
  const app = await (await fetch(`${base}/app.js`)).text();
  for (const file of ['live-run-stale-bifrost.json', 'live-run-python-bifrost.json', 'live-run-deno-bifrost.json']) {
    assert.ok(app.includes(`'./${file}', 'Recorded live run'`), file);
    assert.equal((await fetch(`${base}/${file}`)).status, 200, file);
  }
});

test('GET routes serve evaluation, Bifrost, and direct Gemini run records', async () => {
  for (const [route, mode] of [
    ['/live-evaluation-pre.json', 'recorded-live-evaluation-pre-tuning'],
    ['/live-run-bifrost.json', 'recorded-live'],
    ['/live-run-gemini-direct.json', 'recorded-live'],
  ]) {
    const res = await fetch(`${base}${route}`);
    assert.equal(res.status, 200, route);
    assert.match(res.headers.get('content-type'), /application\/json/);
    const body = await res.json();
    assert.equal(body.mode, mode, route);
    assert.equal(body.actualExternalRun, true, route);
  }
  const set = await (await fetch(`${base}/live-evaluation-pre.json`)).json();
  assert.equal(set.totalSamples, 6);
  assert.equal(set.tavilyCalls, 6);
});

test('GET routes serve Bifrost virtual-key evaluation, runtime feature, and excluded probe records', async () => {
  const get = async (route) => {
    const res = await fetch(`${base}${route}`);
    assert.equal(res.status, 200, route);
    assert.match(res.headers.get('content-type'), /application\/json/, route);
    return res.json();
  };
  const evaluation = await get('/live-evaluation-bifrost-freequery-v1.json');
  assert.equal(evaluation.mode, 'recorded-live-evaluation-bifrost-freequery');
  assert.equal(evaluation.actualExternalRun, true);
  assert.equal(evaluation.totalSamples, 6);
  assert.equal(evaluation.matched, 6);
  assert.equal(evaluation.results.length, 6);
  assert.equal(evaluation.newTavilyCalls, 6);
  assert.equal(evaluation.cumulativeTavilyCalls, 17);
  for (const c of Object.values(evaluation.byClass)) assert.deepEqual([c.n, c.matched], [2, 2]);
  for (const r of evaluation.results) {
    for (const q of r.run.runLog.tavily) assert.doesNotMatch(q.query, /site:|https?:\/\//, r.id);
  }

  const feature = await get('/bifrost-runtime-feature.json');
  assert.equal(feature.mode, 'recorded-runtime-feature');
  assert.equal(feature.virtualKeyUsed, true);
  assert.equal(feature.directKeyBypassEnabled, false);
  assert.equal(feature.pipelineEvaluation.bifrostModelCalls, 14);
  assert.equal(feature.pipelineEvaluation.bifrostLogStatusCounts.success, 14);
  assert.equal(feature.secretsRecorded, false);

  const probe = await get('/bifrost-vk-link-probe.json');
  assert.equal(probe.mode, 'integration-probe-failed-not-evaluation');
  assert.equal(probe.actualExternalRun, false);
  assert.equal(probe.tavilyCalls, 0);
  assert.equal(probe.geminiProviderCalls, 0);

  for (const body of [evaluation, feature, probe]) {
    assert.doesNotMatch(JSON.stringify(body), /\bsk-[A-Za-z0-9]|AIza[0-9A-Za-z_-]{20,}|tvly-[A-Za-z0-9]/);
  }
});

test('server-only lib/live.js is not served', async () => {
  const res = await fetch(`${base}/lib/live.js`);
  assert.equal(res.status, 404);
  await res.text();
});

test('/api/status reports live mode off with Bifrost/Gemini/Tavily unset', async () => {
  const res = await fetch(`${base}/api/status`);
  assert.equal(res.status, 200);
  const s = await res.json();
  assert.equal(s.liveReady, false);
  assert.equal(s.gateway, null);
  assert.equal(s.model, null);
  for (const key of ['TAVILY_API_KEY', 'BIFROST_BASE_URL', 'GEMINI_MODEL']) {
    assert.ok(s.problems.includes(`${key} not set`), key);
  }
});

test('/api/verify is refused with 503 LIVE_NOT_CONFIGURED', async () => {
  const res = await fetch(`${base}/api/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'Node.js 20 is the current LTS.', authoredDate: '2024-01-01' }),
  });
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error, 'LIVE_NOT_CONFIGURED');
  assert.equal(body.liveReady, false);
});
