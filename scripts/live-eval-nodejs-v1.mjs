import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { runLive } from '../lib/live.js';

const ROOT = new URL('../', import.meta.url);
const PREREG = new URL('../public/live-evaluation-nodejs-v1-preregistered.json', import.meta.url);
const OUT = new URL('../public/live-evaluation-nodejs-v1.json', import.meta.url);
const MAX_NEW_TAVILY = 30; // 20 already used + 30 = the 50-call free cap
const PREVIOUS_TAVILY = 20;
const baseUrl = 'http://127.0.0.1:18081';
const prereg = JSON.parse(await fs.readFile(PREREG, 'utf8'));
const db = new URL('../bifrost-data/config.db', import.meta.url).pathname;
const vk = execFileSync('sqlite3', [db, "select value from governance_virtual_keys where id='claimclock-eval-vk' and is_active=1"], { encoding: 'utf8' }).trim();
const model = String(process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').replace(/^models\//, '');
if (!process.env.TAVILY_API_KEY || !vk || !model) throw new Error('Required live configuration is missing.');

let out = null;
try { out = JSON.parse(await fs.readFile(OUT, 'utf8')); } catch {}
const results = new Map((out?.results || []).map((r) => [r.id, r]));
const countTavily = (r) => (r?.tavilyAttempts || 0) + (r?.priorAttempts || []).reduce((n, a) => n + (a.tavilyAttempts || 0), 0);
let sentNewTavily = [...results.values()].reduce((n, r) => n + countTavily(r), 0);
const forcedPrevious = new Map();
const requested = process.argv.slice(2);
const force = requested.includes('--force');
const ids = requested.filter((id) => id !== '--force');
const selected = ids.length ? prereg.cases.filter((c) => ids.includes(c.id)) : prereg.cases.filter((c) => !results.has(c.id));
if (ids.some((id) => !prereg.cases.some((c) => c.id === id))) throw new Error('Unknown case ID.');
if (force) { for (const id of ids) { const r = results.get(id); if (r) { const { priorAttempts = [], ...current } = r; forcedPrevious.set(id, [...priorAttempts, current]); results.delete(id); } } }
const startedAt = out?.startedAt || new Date().toISOString();

function gatewayStats() {
  const dbRows = execFileSync('sqlite3', ['-separator', '|', db, `select max_limit,current_usage from governance_budgets where id='claimclock-daily-budget'; select id,request_max_limit,request_current_usage,token_max_limit,token_current_usage from governance_rate_limits where id='claimclock-100-rpd-50000-tpd';`], { encoding: 'utf8' }).trim().split(/\r?\n/);
  const budget = (dbRows[0] || '').split('|');
  const limit = (dbRows[1] || '').split('|');
  return { budgetLimitUSD: Number(budget[0] || 0), budgetUsedUSD: Number(budget[1] || 0), rateLimitPolicyId: limit[0] || null, rateLimitRequestLimit: Number(limit[1] || 0), rateLimitRequestsUsed: Number(limit[2] || 0), rateLimitTokenLimit: Number(limit[3] || 0), rateLimitTokensUsed: Number(limit[4] || 0) };
}

function summarize() {
  const ordered = prereg.cases.map((c) => results.get(c.id)).filter(Boolean);
  const allAttempts = ordered.flatMap((r) => [...(r.priorAttempts || []), r]);
  const judged = ordered.filter((r) => r.judgmentSuccessful ?? Boolean(r.run?.runLog?.gemini?.some((g) => g.step === 'judge' && g.output)));
  const matched = judged.filter((r) => r.matched).length;
  const attemptedMatches = ordered.filter((r) => r.matched).length;
  const byClass = {};
  for (const label of ['Supported', 'Refuted', 'Insufficient evidence']) {
    const rows = judged.filter((r) => r.goldLabel === label);
    byClass[label] = { n: rows.length, matched: rows.filter((r) => r.matched).length, agreement: rows.length ? rows.filter((r) => r.matched).length / rows.length : null };
  }
  const usage = allAttempts.flatMap((r) => r.run?.runLog?.gemini || []).map((g) => g.usage).filter(Boolean);
  return {
    schemaVersion: 1,
    datasetId: prereg.datasetId,
    mode: 'recorded-live-evaluation-bifrost-virtual-key',
    actualExternalRun: true,
    evaluationAsOf: prereg.evaluationAsOf,
    preregisteredCases: 'live-evaluation-nodejs-v1-preregistered.json',
    promptAndRules: 'existing lib/live.js EXTRACT_SYSTEM + JUDGE_SYSTEM + FIX_SYSTEM; unchanged',
    executionPath: 'Tavily basic search + Gemini through local Bifrost v2.5.0 virtual key',
    queryMode: 'The extraction model generated the Tavily query; the exact query body was forwarded unchanged.',
    startedAt,
    finishedAt: new Date().toISOString(),
    plannedSamples: prereg.plannedSamples,
    completedSamples: ordered.length,
    completedJudgments: judged.length,
    incompleteJudgments: ordered.filter((r) => !judged.includes(r)).map((r) => r.id),
    attemptedMatches,
    attemptedAgreement: ordered.length ? attemptedMatches / ordered.length : null,
    changedSinceAuthoringCount: prereg.changedSinceAuthoringCount,
    changedSinceAuthoringFraction: prereg.changedSinceAuthoringFraction,
    matched,
    accuracy: judged.length ? matched / judged.length : null,
    byClass,
    newTavilyCalls: sentNewTavily,
    previouslyDocumentedTavilyCalls: PREVIOUS_TAVILY,
    cumulativeTavilyCalls: PREVIOUS_TAVILY + sentNewTavily,
    bifrostRequestAttempts: allAttempts.reduce((n, r) => n + (r.run?.runLog?.counts?.gemini || 0), 0),
    bifrostSuccessfulResponses: usage.length,
    totalReportedTokens: usage.reduce((n, u) => n + (u.total_tokens || 0), 0),
    ...gatewayStats(),
    rateLimitUsageScope: 'Daily local policy counter includes one pre-evaluation smoke request (8 tokens); evaluation-only request/token totals are reported separately.',
    promptTokens: usage.reduce((n, u) => n + (u.prompt_tokens || 0), 0),
    completionTokens: usage.reduce((n, u) => n + (u.completion_tokens || 0), 0),
    note: 'Gold labels and source schedule entries were frozen before these calls. Claims are one-sentence time-drift tests: 8 were true on their authorship date and became false by evaluation date; 7 codename facts remain true. Accuracy includes only samples with a successful Gemini judgment; unsuccessful attempts and retries remain recorded. No prompt tuning or query override.',
    results: ordered,
  };
}

for (const item of selected) {
  if (results.has(item.id)) continue;
  const actualQueries = [];
  const env = { ...process.env, BIFROST_BASE_URL: baseUrl, GEMINI_MODEL: model };
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    if (u === 'https://api.tavily.com/search') {
      if (sentNewTavily >= MAX_NEW_TAVILY) {
        const err = new Error('Global Tavily free-tier cap reached; request blocked before sending.');
        err.budget = true;
        throw err;
      }
      const body = JSON.parse(init.body || '{}');
      actualQueries.push(String(body.query || ''));
      sentNewTavily += 1;
      return fetch(url, init);
    }
    if (u.startsWith(baseUrl + '/v1/')) {
      const headers = new Headers(init.headers || {});
      headers.set('x-bf-vk', vk);
      headers.delete('x-goog-api-key');
      headers.delete('authorization');
      return fetch(url, { ...init, headers });
    }
    return fetch(url, init);
  };
  const run = await runLive({ text: item.text, authoredDate: item.authoredDate, env, fetchImpl });
  const claim = run.claims?.[0] || null;
  const priorAttempts = forcedPrevious.get(item.id) || [];
  const judgmentSuccessful = Boolean(run.runLog?.gemini?.some((g) => g.step === 'judge' && g.output));
  const extract = run.runLog?.gemini?.find((g) => g.step === 'extract');
  let generatedQueries = [];
  try { generatedQueries = JSON.parse(extract?.output || '{}').claims?.map((c) => String(c.query || '')).filter(Boolean) || []; } catch {}
  const queryAudit = actualQueries.map((sentQuery, i) => ({ generatedQuery: generatedQueries[i] || null, sentQuery, exactMatch: generatedQueries[i] === sentQuery, usedSiteOperator: /\bsite\s*:/i.test(sentQuery), containsUrl: /https?:\/\//i.test(sentQuery) }));
  const expected = item.goldCurrentLabel === 'Supported' ? '지지' : item.goldCurrentLabel === 'Refuted' ? '반박' : '근거 부족';
  const rawModelLabel = claim?.relation || '근거 부족';
  const sample = {
    id: item.id,
    input: item.text,
    authoredDate: item.authoredDate,
    evaluationAsOf: prereg.evaluationAsOf,
    goldLabel: item.goldCurrentLabel,
    goldAtAuthorDate: item.goldAtAuthorDate,
    changedSinceAuthoring: item.changedSinceAuthoring,
    transitionDate: item.transitionDate,
    currentState: item.currentState,
    goldBasis: { ...item.officialSource, reason: item.goldReason },
    modelLabel: rawModelLabel === '지지' ? 'Supported' : rawModelLabel === '반박' ? 'Refuted' : 'Insufficient evidence',
    rawModelLabel,
    matched: rawModelLabel === expected,
    judgmentSuccessful,
    priorAttempts,
    executionPath: 'bifrost-virtual-key',
    generatedQueries,
    executedQueries: actualQueries,
    queryAudit,
    tavilyAttempts: actualQueries.length,
    run,
  };
  results.set(item.id, sample);
  const json = JSON.stringify(summarize(), null, 2) + '\n';
  for (const secret of [process.env.TAVILY_API_KEY, process.env.GEMINI_API_KEY, vk]) if (secret && json.includes(secret)) throw new Error('Secret redaction guard failed.');
  await fs.writeFile(OUT, json, { mode: 0o644 });
  const quotaHit = (run.runLog?.errors || []).some((e) => /HTTP\s*429|RESOURCE_EXHAUSTED/i.test(String(e)));
  console.log(JSON.stringify({ completed: results.size, id: item.id, modelLabel: sample.modelLabel, goldLabel: sample.goldLabel, matched: sample.matched, judgmentSuccessful, priorAttempts: priorAttempts.length, newTavilyCalls: sentNewTavily, geminiAttempts: run.runLog?.counts?.gemini || 0, generatedQueryForwardedExactly: queryAudit.every((q) => q.exactMatch), errorCount: run.runLog?.errors?.length || 0, quotaHit, rateLimitRequestsUsed: gatewayStats().rateLimitRequestsUsed, rateLimitTokensUsed: gatewayStats().rateLimitTokensUsed }));
  if (quotaHit) { console.log(JSON.stringify({ stoppedEarly: true, reason: 'Provider returned HTTP 429; no further calls will be made in this batch.' })); break; }
}
await new Promise((resolve) => setTimeout(resolve, 1200));
const finalData = summarize();
const finalJson = JSON.stringify(finalData, null, 2) + '\n';
for (const secret of [process.env.TAVILY_API_KEY, process.env.GEMINI_API_KEY, vk]) if (secret && finalJson.includes(secret)) throw new Error('Secret redaction guard failed.');
await fs.writeFile(OUT, finalJson, { mode: 0o644 });
const { results: _hiddenResults, ...finalSummary } = finalData;
console.log(JSON.stringify({ output: OUT.pathname, ...finalSummary }));
