import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
// Live pipeline tests with an injected fake fetch. No real network, no secrets (placeholder key only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveConfig, runLive } from '../lib/live.js';
import { computeView, DEFAULT_CYCLES } from '../lib/scoring.js';
import { runLiveDirect } from '../scripts/live-run-direct.mjs';

const ENV = { BIFROST_BASE_URL: 'http://localhost:8080', GEMINI_MODEL: 'gemini-2.5-flash', TAVILY_API_KEY: 'test' };
const CONTENT = 'Node.js 22 entered Active LTS on 2024-10-29 according to the release schedule.';
const QUOTE = 'Node.js 22 entered Active LTS on 2024-10-29';

function chat(obj) {
  return { model: 'gemini-2.5-flash', extra_fields: { provider: 'gemini' }, usage: { total_tokens: 1 }, choices: [{ message: { role: 'assistant', content: JSON.stringify(obj) } }] };
}

// Responds in order: Bifrost extract → Tavily search → Bifrost judge. Records every call.
function fakeFetch(judgement) {
  const calls = [];
  const impl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body, headers: init.headers });
    let data;
    if (url === 'http://localhost:8080/v1/chat/completions') {
      const system = body.messages[0].content;
      data = system.startsWith('You extract')
        ? chat({ claims: [{ text: 'Node.js 22는 Active LTS다', type: 'version', query: 'Node.js 22 Active LTS' }] })
        : chat({ judgements: [judgement] });
    } else if (url === 'https://api.tavily.com/search') {
      data = { results: [{ url: 'https://nodejs.org/en/about/previous-releases', title: 'Node.js Releases', published_date: '2024-10-29', content: CONTENT }] };
    } else {
      throw new Error(`unexpected URL in test: ${url}`);
    }
    return { ok: true, status: 200, text: async () => JSON.stringify(data) };
  };
  return { impl, calls };
}

const run = (fetchImpl) => runLive({ text: 'Node.js 22는 Active LTS입니다.', authoredDate: '2025-01-01', env: ENV, fetchImpl, now: () => 1000, nowIso: () => '2025-01-02T00:00:00.000Z' });

test('liveConfig: local Bifrost + GEMINI_MODEL + Tavily key is ready without any Gemini key in app env', () => {
  for (const url of ['http://localhost:8080', 'http://127.0.0.1:8080/']) {
    const cfg = liveConfig({ ...ENV, BIFROST_BASE_URL: url });
    assert.equal(cfg.ready, true, url);
    assert.deepEqual(cfg.problems, []);
    assert.equal(cfg.model, 'gemini/gemini-2.5-flash');
  }
  assert.equal('GEMINI_API_KEY' in ENV, false);
  assert.equal(liveConfig({ ...ENV, GEMINI_MODEL: 'gemini/gemini-2.5-flash' }).model, 'gemini/gemini-2.5-flash');
});

test('liveConfig: remote, malformed, or non-http Bifrost URL is not ready', () => {
  for (const url of ['https://bifrost.example.com', 'http://localhost.evil.com:8080', 'http://10.0.0.5:8080', 'localhost:8080', 'not a url', 'ftp://localhost:8080']) {
    const cfg = liveConfig({ ...ENV, BIFROST_BASE_URL: url });
    assert.equal(cfg.ready, false, url);
    assert.equal(cfg.bifrostBaseUrl, null, url);
  }
  assert.equal(liveConfig({ ...ENV, TAVILY_API_KEY: '' }).ready, false);
  assert.equal(liveConfig({ ...ENV, GEMINI_MODEL: '' }).ready, false);
  assert.equal(liveConfig({}).ready, false);
});

test('runLive: Gemini only via Bifrost OpenAI-compatible API, verbatim citation keeps support, 2 Gemini / 1 Tavily', async () => {
  const { impl, calls } = fakeFetch({ claim_id: 'c1', relation: 'support', citations: [{ evidence_id: 'e1', quote: QUOTE }] });
  const result = await run(impl);

  assert.deepEqual(calls.map((c) => c.url), ['http://localhost:8080/v1/chat/completions', 'https://api.tavily.com/search', 'http://localhost:8080/v1/chat/completions']);
  assert.equal(calls.some((c) => /googleapis|generativelanguage|google\.com/.test(c.url)), false);
  for (const c of calls.filter((c) => c.url.includes('8080'))) {
    assert.equal(c.body.model, 'gemini/gemini-2.5-flash');
    assert.ok(Array.isArray(c.body.messages));
    assert.equal(c.headers.authorization, undefined);
  }
  assert.equal(calls[1].headers.authorization, 'Bearer test');

  assert.equal(result.mode, 'live');
  assert.deepEqual(result.runLog.counts, { gemini: 2, tavily: 1 });
  assert.equal(result.claims.length, 1);
  const [claim] = result.claims;
  assert.equal(claim.relation, '지지');
  assert.equal(claim.type, '버전');
  assert.equal(claim.evidence.length, 1);
  assert.equal(claim.evidence[0].citationOk, true);
  assert.equal(claim.evidence[0].quote, QUOTE);
  assert.equal(claim.evidence[0].stance, '지지');
  assert.equal(claim.evidence[0].date, '2024-10-29');
});

test('runLive: a future date in the quote is a target date, and evidence is visible from collection', async () => {
  const collectedAt = '2026-11-11T01:10:12.461Z';
  const quote = 'October 31, 2028: Python 3.12 reaches end of life.';
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    let data;
    if (url === 'http://localhost:8080/v1/chat/completions') {
      const system = body.messages[0].content;
      data = system.startsWith('You extract')
        ? chat({ claims: [{ text: 'Python 3.12 is supported through October 2028.', type: 'version', query: 'Python 3.12 support lifecycle' }] })
        : chat({ judgements: [{ claim_id: 'c1', relation: 'support', citations: [{ evidence_id: 'e1', quote }] }] });
    } else if (url === 'https://api.tavily.com/search') {
      data = { results: [{ url: 'https://devguide.python.org/versions/', title: 'Python versions', published_date: null, content: quote }] };
    } else throw new Error(`unexpected URL in test: ${url}`);
    return { ok: true, status: 200, text: async () => JSON.stringify(data) };
  };
  const result = await runLive({ text: 'Python 3.12 is supported through October 2028.', authoredDate: '2024-10-07', env: ENV, fetchImpl, now: () => 1000, nowIso: () => collectedAt });
  assert.deepEqual(result.runLog.counts, { gemini: 2, tavily: 1 });
  const evidence = result.claims[0].evidence[0];
  assert.equal(result.claims[0].relation, '지지');
  assert.equal(evidence.date, null);
  assert.match(evidence.dateBasis, /2028-10-31.*later than collection.*target date/);
  const view = computeView(result, { evalDate: '2026-11-11', cycles: DEFAULT_CYCLES, today: '2026-11-11' });
  assert.equal(view.claims[0].relation, '지지');
  assert.equal(view.claims[0].hiddenEvidenceCount, 0);
  assert.equal(view.claims[0].evidence.length, 1);
});

test('runLive: quote not found in search content downgrades relation to 근거 부족', async () => {
  const { impl, calls } = fakeFetch({ claim_id: 'c1', relation: 'refute', citations: [{ evidence_id: 'e1', quote: 'Node.js 22 reached end of life in 2024' }] });
  const result = await run(impl);
  assert.equal(calls.length, 3);
  assert.deepEqual(result.runLog.counts, { gemini: 2, tavily: 1 });
  const [claim] = result.claims;
  assert.equal(claim.relation, '근거 부족');
  assert.equal(claim.evidence[0].citationOk, false);
  assert.equal(claim.fix, null);
});

test('live-run exits safely when required credentials are missing and creates no record', () => {
  const record = new URL('../public/live-run.json', import.meta.url);
  const before = fs.existsSync(record) ? fs.readFileSync(record, 'utf8') : null;
  const env = { PATH: process.env.PATH, HOME: process.env.HOME };
  const run = spawnSync(process.execPath, ['scripts/live-run.mjs'], { cwd: process.cwd(), env, encoding: 'utf8' });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /GEMINI_API_KEY/);
  assert.match(run.stderr, /TAVILY_API_KEY/);
  assert.equal(fs.existsSync(record), before !== null);
  if (before !== null) assert.equal(fs.readFileSync(record, 'utf8'), before);
});

test('runLiveDirect: one Tavily and one Gemini direct call, Bifrost bypass is labeled and agreement is computed', async () => {
  const calls = [];
  const key1 = 'test-gemini-secret-never-output';
  const key2 = 'test-tavily-secret-never-output';
  const content = 'v20 | Iron | Apr 17, 2023 | Mar 24, 2026 | EOL';
  const quote = 'v20 | Iron | Apr 17, 2023 | Mar 24, 2026 | EOL';
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body, headers: init.headers });
    if (url === 'https://api.tavily.com/search') return { ok: true, status: 200, json: async () => ({ results: [{ url: 'https://nodejs.org/en/about/previous-releases', title: 'Node.js Releases', published_date: '2026-03-24', content }] }) };
    if (url.includes('generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent')) {
      const output = JSON.stringify({ relation: 'insufficient', citations: [], rationale: 'The evidence does not establish the exact support window.' });
      return { ok: true, status: 200, json: async () => ({ modelVersion: 'gemini-3.5-flash-lite', candidates: [{ content: { parts: [{ text: output }] } }], usageMetadata: { totalTokenCount: 10 } }) };
    }
    throw new Error('unexpected endpoint');
  };
  const record = await runLiveDirect({ env: { GEMINI_API_KEY: key1, TAVILY_API_KEY: key2 }, fetchImpl, now: () => 1000, nowIso: () => '2026-11-09T11:00:00.000Z' });
  assert.deepEqual(calls.map((c) => c.url.includes('api.tavily.com') ? 'tavily' : c.url.includes('generativelanguage.googleapis.com') ? 'gemini-direct' : 'other'), ['tavily', 'gemini-direct']);
  assert.equal(calls[0].headers.authorization, `Bearer ${key2}`);
  assert.equal(calls[1].headers['x-goog-api-key'], key1);
  assert.equal(record.executionPath, 'direct-tavily-gemini');
  assert.equal(record.bifrostUsed, false);
  assert.equal(record.result.runLog.counts.tavily, 1);
  assert.equal(record.result.runLog.counts.gemini, 1);
  assert.equal(record.result.claims[0].relation, '근거 부족');
  assert.equal(record.humanAgreement.comparisons[0].label, '지지');
  assert.equal(record.humanAgreement.accuracy, 0);
  const serialized = JSON.stringify(record);
  assert.equal(serialized.includes(key1), false);
  assert.equal(serialized.includes(key2), false);
});
