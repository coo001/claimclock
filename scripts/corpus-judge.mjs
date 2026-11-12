// Judge-stage measurement on the small real-answer corpus (public/corpus-stale-v1.json).
// The normal live pipeline runs unchanged (extract → judge → fix through the local Bifrost virtual key, citation
// check, scoring), except that the search step is answered from the primary-source excerpt stored with each corpus
// row. No Tavily request is made, so this measures judgment and prioritisation, not retrieval.
import fs from 'node:fs/promises';
import { runLive, PROMPT_VERSION } from '../lib/live.js';
import { computeView, displayLabel, DEFAULT_CYCLES, SUPPORT, REFUTE, INSUFFICIENT } from '../lib/scoring.js';

const EVAL_DATE = process.argv[2] || new Date().toISOString().slice(0, 10);
const PAUSE_MS = Number(process.env.CORPUS_PAUSE_MS || 4000);
const ONLY = process.env.CORPUS_ONLY ? new Set(process.env.CORPUS_ONLY.split(',')) : null;
const OUT = process.env.CORPUS_OUT || 'corpus-stale-v1-run.json';
const env = { ...process.env };
const corpus = JSON.parse(await fs.readFile(new URL('../public/corpus-stale-v1.json', import.meta.url), 'utf8'));

const tavilyRequests = 0; // the search step never leaves this process
const supplied = (item) => async (url, init) => {
  if (!String(url).startsWith('https://api.tavily.com/')) return fetch(url, init);
  const body = JSON.stringify({ results: item.primary.map((p) => ({ url: p.url, title: p.title, published_date: null, content: p.excerpt })) });
  return { ok: true, status: 200, text: async () => body };
};

const rows = [];
for (const item of corpus.items) {
  if (ONLY && !ONLY.has(item.id)) continue;
  const started = Date.now();
  const result = await runLive({ text: item.quote, authoredDate: item.source.answeredOn, env, fetchImpl: supplied(item) });
  const seconds = (Date.now() - started) / 1000;
  const { summary, claims } = computeView(result, { evalDate: EVAL_DATE, cycles: DEFAULT_CYCLES, today: EVAL_DATE });
  rows.push({
    id: item.id,
    url: item.source.url,
    answeredOn: item.source.answeredOn,
    label: item.label,
    flagged: summary[REFUTE] > 0,
    allSupported: summary.total > 0 && summary[SUPPORT] === summary.total,
    maxScore: summary.maxScore,
    counts: { claims: summary.total, supported: summary[SUPPORT], refuted: summary[REFUTE], insufficient: summary[INSUFFICIENT] },
    seconds,
    geminiRequests: result.runLog.counts.gemini,
    claims: result.claims.map((c, i) => ({ text: c.text, relation: displayLabel(claims?.[i]?.relation ?? c.relation), fix: c.fix ?? null, quotes: c.evidence.filter((e) => e.citationOk).map((e) => e.quote) })),
    errors: result.runLog.errors,
  });
  console.error(`${item.id} ${item.label} → flagged=${rows.at(-1).flagged} max=${summary.maxScore} errors=${result.runLog.errors.length}`);
  await new Promise((r) => setTimeout(r, PAUSE_MS));
}

const of = (label) => rows.filter((r) => r.label === label);
const tally = (list) => ({ n: list.length, flagged: list.filter((r) => r.flagged).length, allSupported: list.filter((r) => r.allSupported).length });
const ranked = [...rows].sort((a, b) => (b.maxScore ?? -1) - (a.maxScore ?? -1));
const staleTotal = rows.filter((r) => r.label !== 'still-valid').length;
const seconds = rows.map((r) => r.seconds).sort((a, b) => a - b);
const record = {
  schemaVersion: 1,
  mode: 'corpus-judge-stage-measurement',
  corpus: 'corpus-stale-v1.json',
  promptVersion: PROMPT_VERSION,
  evalDate: EVAL_DATE,
  ranAt: new Date().toISOString(),
  executionPath: 'Gemini extract/judge/fix through the local Bifrost virtual key; search step answered from the stored primary-source excerpt',
  tavilyRequestsMade: tavilyRequests,
  retrievalTested: false,
  summary: {
    answers: rows.length,
    runsWithErrors: rows.filter((r) => r.errors.length).length,
    byLabel: { 'stale-status': tally(of('stale-status')), 'stale-relative-time': tally(of('stale-relative-time')), 'still-valid': tally(of('still-valid')) },
    skippable: { allSupported: rows.filter((r) => r.allSupported).length, ofWhichStale: rows.filter((r) => r.allSupported && r.label !== 'still-valid').length },
    staleInTopRanked: { top: staleTotal, stale: ranked.slice(0, staleTotal).filter((r) => r.label !== 'still-valid').length },
    pipelineSeconds: { median: seconds[Math.floor(seconds.length / 2)], max: seconds.at(-1), total: seconds.reduce((a, b) => a + b, 0) },
    geminiRequests: rows.reduce((a, r) => a + r.geminiRequests, 0),
  },
  rankedIds: ranked.map((r) => r.id),
  rows,
};
const serialized = JSON.stringify(record, null, 2);
for (const name of ['GEMINI_API_KEY', 'TAVILY_API_KEY', 'BIFROST_VIRTUAL_KEY']) if (env[name] && serialized.includes(env[name])) throw new Error('Secret redaction check failed.');
await fs.writeFile(new URL(`../public/${OUT}`, import.meta.url), `${serialized}\n`, { mode: 0o644 });
console.log(JSON.stringify(record.summary, null, 2));
