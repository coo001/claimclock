// One normalized result schema for both fixture (cached) and live results.
import { normalizeRelation, normalizeType, isValidDate, displayLabel, INSUFFICIENT, SUPPORT, REFUTE } from './scoring.js';

export const MAX_CLAIMS = 8;

function str(v, fallback = '') {
  return typeof v === 'string' ? v : fallback;
}

function normalizeEvidence(e, i) {
  const stance = normalizeRelation(e?.stance);
  return {
    id: str(e?.id, `e${i + 1}`),
    url: str(e?.url),
    title: str(e?.title),
    quote: str(e?.quote),
    stance,
    citationOk: e?.citationOk === true,
    date: isValidDate(e?.date) ? e.date : null,
    dateBasis: str(e?.dateBasis),
    collectedAt: str(e?.collectedAt),
  };
}

function normalizeClaim(c, i) {
  const evidence = Array.isArray(c?.evidence) ? c.evidence.map(normalizeEvidence) : [];
  let relation = normalizeRelation(c?.relation);
  let relationNote = str(c?.relationNote);
  // 지지/반박 without at least one citation-checked evidence of the same stance is downgraded.
  if ((relation === SUPPORT || relation === REFUTE) && !evidence.some((e) => e.citationOk && e.stance === relation)) {
    relationNote = `Original verdict '${displayLabel(relation)}' had no evidence that passed the citation check, so it was normalized to ${displayLabel(INSUFFICIENT)}.`;
    relation = INSUFFICIENT;
  }
  return {
    id: str(c?.id, `c${i + 1}`),
    text: str(c?.text),
    type: normalizeType(c?.type),
    relation,
    relationNote,
    evidence,
    fix: str(c?.fix) || null,
  };
}

export function normalizeResult(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('result must be an object');
  if (!isValidDate(raw.authoredDate)) throw new Error('authoredDate must be YYYY-MM-DD');
  const claims = (Array.isArray(raw.claims) ? raw.claims : []).slice(0, MAX_CLAIMS).map(normalizeClaim);
  for (const claim of claims) {
    const extra = raw.timelineEvidenceByClaim?.[claim.id];
    if (Array.isArray(extra)) claim.evidence.push(...extra.map(normalizeEvidence));
  }
  return {
    id: str(raw.id, 'result'),
    mode: raw.mode === 'live' || raw.mode === 'recorded-live' ? raw.mode : 'fixture',
    title: str(raw.title, 'Your answer'),
    authoredDate: raw.authoredDate,
    answerText: str(raw.answerText),
    source: {
      status: str(raw.source?.status, 'NEEDS_SOURCE_VERIFICATION'),
      url: str(raw.source?.url) || null,
      publishedDate: isValidDate(raw.source?.publishedDate) ? raw.source.publishedDate : null,
      publishedDateText: str(raw.source?.publishedDateText),
      note: str(raw.source?.note),
    },
    collectedAt: str(raw.collectedAt),
    collectionMethod: str(raw.collectionMethod),
    claims,
    runLog: {
      note: str(raw.runLog?.note),
      externalCalls: raw.runLog?.externalCalls === true,
      counts: {
        gemini: Number(raw.runLog?.counts?.gemini) || 0,
        tavily: Number(raw.runLog?.counts?.tavily) || 0,
      },
      tavily: Array.isArray(raw.runLog?.tavily) ? raw.runLog.tavily : [],
      gemini: Array.isArray(raw.runLog?.gemini) ? raw.runLog.gemini : [],
      errors: Array.isArray(raw.runLog?.errors) ? raw.runLog.errors.map(String) : [],
    },
  };
}

export function normalizeText(text) {
  return String(text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

// Exact match (after whitespace normalization) only. Edited text never matches.
export function matchFixture(text, fixtures) {
  const needle = normalizeText(text);
  if (!needle) return null;
  return fixtures.find((f) => normalizeText(f.answerText) === needle) ?? null;
}
