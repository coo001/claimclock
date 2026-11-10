// Pure scoring/date logic shared by browser and server. No I/O, no network.

export const SUPPORT = '지지';
export const REFUTE = '반박';
export const INSUFFICIENT = '근거 부족';
export const DATE_KNOWN = '날짜 확인';
export const DATE_UNKNOWN = '날짜 불명';

export const CLAIM_TYPES = ['가격', '버전', '직책', '통계', '안정 사실'];
export const DEFAULT_CYCLES = Object.freeze({ '가격': 7, '버전': 30, '직책': 30, '통계': 90, '안정 사실': 365 });

// Display-only English labels. Stored/machine labels above stay unchanged.
const DISPLAY_LABELS = Object.freeze({
  [SUPPORT]: 'Supported',
  [REFUTE]: 'Refuted',
  [INSUFFICIENT]: 'Insufficient evidence',
  [DATE_KNOWN]: 'Date confirmed',
  [DATE_UNKNOWN]: 'Date unknown',
  '가격': 'Price',
  '버전': 'Version',
  '직책': 'Role',
  '통계': 'Statistic',
  '안정 사실': 'Stable fact',
});

export function displayLabel(value) {
  const s = String(value ?? '');
  return DISPLAY_LABELS[s] ?? s;
}

const RELATION_ALIASES = new Map([
  ...['지지', 'support', 'supports', 'supported', 'entailment', 'entails'].map((k) => [k, SUPPORT]),
  ...['반박', 'refute', 'refutes', 'refuted', 'contradict', 'contradicts', 'contradicted', 'contradiction'].map((k) => [k, REFUTE]),
]);

// Everything that is not clearly support/refute (무관, 관계 불명, 형식 오류, missing) becomes 근거 부족.
export function normalizeRelation(value) {
  const key = String(value ?? '').trim().toLowerCase();
  return RELATION_ALIASES.get(key) ?? INSUFFICIENT;
}

const TYPE_ALIASES = new Map([
  ...['가격', 'price', 'pricing'].map((k) => [k, '가격']),
  ...['버전', 'version', 'release'].map((k) => [k, '버전']),
  ...['직책', 'role', 'title', 'position'].map((k) => [k, '직책']),
  ...['통계', 'statistic', 'statistics', 'stat'].map((k) => [k, '통계']),
  ...['안정 사실', '안정사실', 'stable', 'stable fact', 'fact'].map((k) => [k, '안정 사실']),
]);

// Unknown types fall back to 버전(30일) — documented in README.
export function normalizeType(value) {
  return TYPE_ALIASES.get(String(value ?? '').trim().toLowerCase()) ?? '버전';
}

const DAY_MS = 86400000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDate(value) {
  const m = ISO_RE.exec(String(value ?? ''));
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(ms);
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
  return ms;
}

export function isValidDate(value) {
  return parseDate(value) !== null;
}

export function daysBetween(from, to) {
  return Math.round((parseDate(to) - parseDate(from)) / DAY_MS);
}

export function addDays(date, days) {
  return new Date(parseDate(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export function maxDate(dates) {
  const valid = dates.filter(isValidDate).sort();
  return valid.length ? valid[valid.length - 1] : null;
}

// v4 formula. Total = R + A + C + U, capped at 100.
export function scoreClaim({ relation, dateKnown, supportDate, independentSources, cycleDays, evalDate }) {
  const R = relation === REFUTE ? 30 : relation === SUPPORT ? 0 : 15;
  let A;
  let ratio = null;
  let elapsedDays = null;
  if (relation === SUPPORT) {
    if (isValidDate(supportDate)) {
      elapsedDays = Math.max(0, daysBetween(supportDate, evalDate));
      ratio = Math.min(1, Math.max(0, elapsedDays / cycleDays));
      A = 40 * ratio;
    } else {
      A = 20; // 지지 but no verified date: treated like 날짜 불명 (assumption, see README)
    }
  } else if (relation === REFUTE) {
    A = dateKnown ? 40 : 20;
  } else {
    A = 20;
  }
  const C = 20 * (1 - Math.min(1, independentSources / 2));
  const U = dateKnown ? 0 : 10;
  const total = Math.min(100, R + A + C + U);
  return { R, A, C, U, total, ratio, elapsedDays };
}

export function round1(n) {
  return Math.round(n * 10) / 10;
}

// Evidence that counts for a claim: citation passed and stance equals the claim's relation.
export function countedEvidence(claim) {
  if (claim.relation === INSUFFICIENT) return [];
  return claim.evidence.filter((e) => e.citationOk && e.stance === claim.relation);
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function evaluateClaim(claim, { evalDate, cycles, authoredDate }) {
  // Dated evidence becomes available on its publication date. Undated evidence becomes available only when first collected; that is an observation boundary, not a fact date.
  const visibleEvidence = claim.evidence.filter((e) => {
    const collectedDate = typeof e.collectedAt === 'string' ? e.collectedAt.slice(0, 10) : null;
    const availableDate = isValidDate(e.date) ? e.date : (isValidDate(collectedDate) ? collectedDate : null);
    return availableDate === null || availableDate <= evalDate;
  });
  const counted = visibleEvidence.filter((e) => e.citationOk && [SUPPORT, REFUTE].includes(e.stance));
  const relation = counted.some((e) => e.stance === REFUTE) ? REFUTE
    : counted.some((e) => e.stance === SUPPORT) ? SUPPORT : INSUFFICIENT;
  const independentSources = new Set(counted.map((e) => hostOf(e.url)).filter(Boolean)).size;
  const latestDate = maxDate(counted.filter((e) => e.stance === relation).map((e) => e.date));
  const dateKnown = latestDate !== null;
  const cycleDays = cycles[claim.type] ?? DEFAULT_CYCLES[claim.type];
  const supportDate = relation === SUPPORT ? latestDate : null;
  const score = scoreClaim({ relation, dateKnown, supportDate, independentSources, cycleDays, evalDate });
  const anchorDate = latestDate ?? authoredDate;
  const recheckDate = addDays(anchorDate, cycleDays);
  return {
    ...claim, relation, evidence: visibleEvidence,
    dateStatus: dateKnown ? DATE_KNOWN : DATE_UNKNOWN,
    latestDate, independentSources, cycleDays, score, anchorDate,
    anchorElapsedDays: Math.max(0, daysBetween(anchorDate, evalDate)),
    recheckDate, overdue: recheckDate <= evalDate,
  };
}

export function computeView(result, { evalDate, cycles, today }) {
  const claims = result.claims.map((c) => evaluateClaim(c, { evalDate, cycles, authoredDate: result.authoredDate }));
  const summary = {
    [SUPPORT]: 0, [REFUTE]: 0, [INSUFFICIENT]: 0, [DATE_KNOWN]: 0, [DATE_UNKNOWN]: 0,
    overdue: 0, maxScore: 0, avgScore: 0, total: claims.length,
  };
  for (const c of claims) {
    summary[c.relation] += 1;
    summary[c.dateStatus] += 1;
    if (c.overdue) summary.overdue += 1;
    summary.maxScore = Math.max(summary.maxScore, c.score.total);
    summary.avgScore += c.score.total;
  }
  if (claims.length) summary.avgScore /= claims.length;
  const allDates = [result.authoredDate, evalDate, today, ...claims.flatMap((c) => [c.recheckDate, c.latestDate])];
  const timeline = {
    start: [...allDates].filter(isValidDate).sort()[0],
    end: maxDate(allDates),
  };
  return {
    evalDate,
    elapsedSinceAuthored: daysBetween(result.authoredDate, evalDate),
    claims,
    summary,
    timeline,
  };
}

function icsEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

export function buildIcs(result, view, dtstamp) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ClaimClock//Recheck//EN', 'CALSCALE:GREGORIAN'];
  for (const c of view.claims) {
    const start = c.recheckDate.replace(/-/g, '');
    const end = addDays(c.recheckDate, 1).replace(/-/g, '');
    const prefix = c.overdue ? '[Overdue] ' : '';
    const text = c.text.length > 60 ? `${c.text.slice(0, 60)}…` : c.text;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${icsEscape(`${result.id}-${c.id}-${start}`)}@claimclock.local`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${icsEscape(`${prefix}ClaimClock recheck: ${text}`)}`,
      `DESCRIPTION:${icsEscape(`Type ${displayLabel(c.type)}, cycle ${c.cycleDays} days, relation ${displayLabel(c.relation)}, ${displayLabel(c.dateStatus)}, score ${round1(c.score.total)} (evaluation date ${view.evalDate})`)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
