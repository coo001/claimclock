// Server-only live pipeline: Tavily (direct, server side) + Gemini via local Bifrost gateway only.
// Nothing here logs user text or keys.
import { normalizeResult, MAX_CLAIMS } from './schema.js';
import { CLAIM_TYPES, normalizeRelation, normalizeType, REFUTE } from './scoring.js';

export const LIMITS = Object.freeze({ gemini: 5, tavily: 8, fixes: 3 });
const TAVILY_URL = 'https://api.tavily.com/search';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function liveConfig(env) {
  const missing = [];
  if (!env.TAVILY_API_KEY) missing.push('TAVILY_API_KEY');
  if (!env.BIFROST_BASE_URL) missing.push('BIFROST_BASE_URL');
  if (!env.BIFROST_VIRTUAL_KEY) missing.push('BIFROST_VIRTUAL_KEY');
  if (!env.GEMINI_MODEL) missing.push('GEMINI_MODEL');
  let bifrostLocal = false;
  if (env.BIFROST_BASE_URL) {
    try {
      const u = new URL(env.BIFROST_BASE_URL);
      bifrostLocal = (u.protocol === 'http:' || u.protocol === 'https:') && LOCAL_HOSTS.has(u.hostname);
    } catch {
      bifrostLocal = false;
    }
  }
  const problems = [...missing.map((k) => `${k} not set`)];
  if (env.BIFROST_BASE_URL && !bifrostLocal) problems.push('BIFROST_BASE_URL must be a local Bifrost address on localhost/127.0.0.1');
  return {
    ready: problems.length === 0,
    problems,
    bifrostBaseUrl: bifrostLocal ? env.BIFROST_BASE_URL.replace(/\/+$/, '') : null,
    model: env.GEMINI_MODEL ? `gemini/${env.GEMINI_MODEL.replace(/^gemini\//, '')}` : null,
    tavilyKey: env.TAVILY_API_KEY || null,
    virtualKey: env.BIFROST_VIRTUAL_KEY || null,
  };
}

export class CallBudget {
  constructor(limits = LIMITS) {
    this.limits = limits;
    this.counts = { gemini: 0, tavily: 0 };
  }
  take(kind) {
    if (this.counts[kind] >= this.limits[kind]) {
      const err = new Error(`${kind} call limit of ${this.limits[kind]} exceeded`);
      err.budget = true;
      throw err;
    }
    this.counts[kind] += 1;
  }
}

export class DailyGuard {
  constructor(limit) {
    this.limit = limit;
    this.day = null;
    this.used = 0;
  }
  take(now = new Date()) {
    const day = now.toISOString().slice(0, 10);
    if (day !== this.day) {
      this.day = day;
      this.used = 0;
    }
    if (this.used >= this.limit) return false;
    this.used += 1;
    return true;
  }
}

export function isQuotaError(err) {
  return err?.status === 429 || /quota|rate.?limit|resource_exhausted/i.test(String(err?.message ?? ''));
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// One attempt + at most one retry for non-quota errors. 429/quota: no retry. Budget is consumed per attempt.
export async function withPolicy(budget, kind, fn) {
  budget.take(kind);
  try {
    return await fn();
  } catch (err) {
    if (isQuotaError(err) || err.budget) throw err;
    budget.take(kind);
    return await fn();
  }
}

async function postJson(fetchImpl, url, body, headers) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status}: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(res.status, 'Failed to parse JSON response');
  }
}

export function parseModelJson(content) {
  const s = String(content ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  return JSON.parse(s);
}

function squash(s) {
  return String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

// A citation passes only if the quoted text appears verbatim (whitespace-insensitive) in the fetched content.
export function citationPasses(quote, content) {
  const q = squash(quote);
  return q.length >= 8 && squash(content).includes(q);
}

const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12, jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

export function dateFromText(text) {
  const s = String(text ?? '');
  let m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),\s*(\d{4})\b/.exec(s);
  if (m && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return null;
}

export function evidenceDate(publishedDate, quote, collectedAt = '') {
  const p = /^(\d{4}-\d{2}-\d{2})/.exec(String(publishedDate ?? ''));
  if (p) return { date: p[1], dateBasis: `Tavily published_date '${publishedDate}' (best-effort estimate)` };
  const q = dateFromText(quote);
  const collected = /^(\d{4}-\d{2}-\d{2})/.exec(String(collectedAt ?? ''))?.[1] ?? null;
  if (q && collected && q > collected) {
    return { date: null, dateBasis: `Quoted date ${q} is later than collection (${collected}); treated as a target date, not a publication/event date.` };
  }
  if (q) return { date: q, dateBasis: 'Date appears verbatim in the cited source text.' };
  return { date: null, dateBasis: 'No published_date or date in the cited source text.' };
}

const NEWS_TYPES = new Set(['직책', '통계']);

async function callGemini({ cfg, fetchImpl, budget, log, step, messages, now }) {
  const entry = { step, requestedModel: cfg.model, provider: null, responseModel: null, latencyMs: null, usage: null, input: { model: cfg.model, messages }, output: null };
  log.gemini.push(entry);
  const started = now();
  try {
    const data = await withPolicy(budget, 'gemini', () =>
      postJson(fetchImpl, `${cfg.bifrostBaseUrl}/v1/chat/completions`, { model: cfg.model, messages, temperature: 0, response_format: { type: 'json_object' } }, { 'x-bf-vk': cfg.virtualKey }));
    entry.latencyMs = now() - started;
    entry.provider = data?.extra_fields?.provider ?? null;
    entry.responseModel = data?.model ?? null;
    entry.usage = data?.usage ?? null;
    entry.output = data?.choices?.[0]?.message?.content ?? null;
    return parseModelJson(entry.output);
  } catch (err) {
    entry.latencyMs = now() - started;
    entry.error = err.message;
    throw err;
  }
}

async function searchTavily({ cfg, fetchImpl, budget, log, query, type, nowIso }) {
  const entry = { query, topic: NEWS_TYPES.has(type) ? 'news' : 'general', collectedAt: null, results: [] };
  log.tavily.push(entry);
  try {
    const data = await withPolicy(budget, 'tavily', () =>
      postJson(fetchImpl, TAVILY_URL, { query, search_depth: 'basic', topic: entry.topic, max_results: 3 }, { authorization: `Bearer ${cfg.tavilyKey}` }));
    entry.collectedAt = nowIso();
    const results = Array.isArray(data?.results) ? data.results : [];
    entry.results = results.map((r) => ({ url: r.url, title: r.title, published_date: r.published_date ?? null, contentExcerpt: String(r.content ?? '').slice(0, 300) }));
    return results.map((r) => ({ ...r, collectedAt: entry.collectedAt }));
  } catch (err) {
    entry.error = err.message;
    throw err;
  }
}

const EXTRACT_SYSTEM = `You extract checkable factual claims from an answer. Return JSON only: {"claims":[{"text":"...","type":"${CLAIM_TYPES.join('|')}","query":"web search query"}]}. At most ${MAX_CLAIMS} claims. Keep the claim language the same as the input. Prefer official/primary sources in the query.`;
const JUDGE_SYSTEM = 'For each claim, judge its relation to the evidence. Return JSON only: {"judgements":[{"claim_id":"c1","relation":"support|refute|insufficient","citations":[{"evidence_id":"e1","quote":"exact substring copied from the evidence content"}]}]}. Use insufficient when evidence is unrelated or unclear. Quotes must be copied verbatim.';
const FIX_SYSTEM = 'Rewrite the refuted claim so it matches the cited evidence. Return JSON only: {"fix":"..."}. Do not add facts that are not in the evidence.';

export async function runLive({ text, authoredDate, env, fetchImpl = fetch, now = Date.now, nowIso = () => new Date().toISOString() }) {
  const cfg = liveConfig(env);
  if (!cfg.ready) throw new Error(`Live mode not configured: ${cfg.problems.join(', ')}`);
  const budget = new CallBudget();
  const log = { note: 'Local live run (app limits: 5 Gemini calls · 8 Tavily calls · sequential · no retries on 429)', externalCalls: true, counts: budget.counts, tavily: [], gemini: [], errors: [] };
  const ctx = { cfg, fetchImpl, budget, log, now, nowIso };
  const base = { id: `live-${now()}`, mode: 'live', title: 'Your answer (local live analysis)', authoredDate, answerText: text, source: { status: 'Recorded live run', note: 'Processed locally; request text is not retained by this demo server.' }, collectedAt: nowIso(), collectionMethod: 'Tavily basic search + Gemini judgment through Bifrost', claims: [], runLog: log };

  // 1) extract (Gemini #1)
  let extracted;
  try {
    extracted = await callGemini({ ...ctx, step: 'extract', messages: [{ role: 'system', content: EXTRACT_SYSTEM }, { role: 'user', content: JSON.stringify({ authored_date: authoredDate, answer: text }) }] });
  } catch (err) {
    log.errors.push(`Claim extraction failed: ${err.message}`);
    return normalizeResult(base);
  }
  const claims = (Array.isArray(extracted?.claims) ? extracted.claims : []).slice(0, MAX_CLAIMS).map((c, i) => ({
    id: `c${i + 1}`, text: String(c?.text ?? ''), type: normalizeType(c?.type), query: String(c?.query || c?.text || ''), relation: 'insufficient', evidence: [],
  })).filter((c) => c.text);

  // 2) search (Tavily, sequential, one per claim)
  const pool = [];
  for (const c of claims) {
    try {
      const results = await searchTavily({ ...ctx, query: c.query, type: c.type });
      for (const r of results) pool.push({ id: `e${pool.length + 1}`, claimId: c.id, ...r });
    } catch (err) {
      log.errors.push(`Search failed (${c.id}): ${err.message}`);
      if (err.budget || isQuotaError(err)) break;
    }
  }

  // 3) batch judge (Gemini #2)
  if (claims.length && pool.length) {
    const judgeInput = {
      claims: claims.map((c) => ({ id: c.id, text: c.text })),
      evidence: pool.map((e) => ({ id: e.id, claim_id: e.claimId, url: e.url, content: String(e.content ?? '').slice(0, 1200) })),
    };
    try {
      const judged = await callGemini({ ...ctx, step: 'judge', messages: [{ role: 'system', content: JUDGE_SYSTEM }, { role: 'user', content: JSON.stringify(judgeInput) }] });
      const checks = [];
      for (const j of Array.isArray(judged?.judgements) ? judged.judgements : []) {
        const claim = claims.find((c) => c.id === j?.claim_id);
        if (!claim) continue;
        const relation = normalizeRelation(j.relation);
        claim.relation = relation;
        for (const cit of Array.isArray(j.citations) ? j.citations : []) {
          const ev = pool.find((e) => e.id === cit?.evidence_id);
          const ok = Boolean(ev) && citationPasses(cit.quote, ev.content);
          checks.push({ claim_id: claim.id, evidence_id: cit?.evidence_id ?? null, quote: String(cit?.quote ?? ''), passed: ok });
          if (!ev) continue;
          claim.evidence.push({ id: ev.id, url: ev.url, title: ev.title, quote: String(cit.quote ?? ''), stance: relation, citationOk: ok, collectedAt: ev.collectedAt, ...evidenceDate(ev.published_date, cit.quote, ev.collectedAt) });
        }
      }
      log.gemini[log.gemini.length - 1].citationCheck = checks;
    } catch (err) {
      log.errors.push(`Judgment failed; all claims marked insufficient evidence: ${err.message}`);
    }
  }

  // 4) fixes for refuted claims (Gemini, at most 3)
  const refuted = claims.filter((c) => normalizeRelation(c.relation) === REFUTE && c.evidence.some((e) => e.citationOk)).slice(0, LIMITS.fixes);
  for (const c of refuted) {
    try {
      const out = await callGemini({ ...ctx, step: `fix:${c.id}`, messages: [{ role: 'system', content: FIX_SYSTEM }, { role: 'user', content: JSON.stringify({ claim: c.text, evidence: c.evidence.filter((e) => e.citationOk).map((e) => e.quote) }) }] });
      if (typeof out?.fix === 'string') c.fix = out.fix;
    } catch (err) {
      log.errors.push(`Rewrite failed (${c.id}): ${err.message}`);
      if (err.budget || isQuotaError(err)) break;
    }
  }

  base.claims = claims.map(({ query, ...c }) => c);
  return normalizeResult(base);
}
