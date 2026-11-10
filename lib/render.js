// Single renderer for every normalized result (fixture cache or live). Pure: returns HTML strings.
import { round1, daysBetween, displayLabel, SUPPORT, REFUTE, INSUFFICIENT, DATE_KNOWN, DATE_UNKNOWN } from './scoring.js';

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

const REL_CLASS = { [SUPPORT]: 'rel-support', [REFUTE]: 'rel-refute', [INSUFFICIENT]: 'rel-insufficient' };

// Display-only English titles for stored example/live titles. Stored titles stay unchanged.
const DISPLAY_TITLES = Object.freeze({
  'Python 3.12 distutils (실제 Bifrost 실행 기록 · 재생 전용)': 'Python 3.12 distutils (recorded real Bifrost run · replay only)',
  'Node.js 20.x: once Active LTS, now end-of-life (real Bifrost run)': 'Node.js 20.x: once Active LTS, now end-of-life (real Bifrost run)',
  'Node.js 20.9.0 릴리스 공지 (실제 공개 문서)': 'Node.js 20.9.0 release announcement (real public document)',
  'Python 3.12 안내 (합성 답변 + 실제 공개 문서 근거)': 'Python 3.12 notes (synthetic answer + evidence from real public documents)',
  '가상 서비스 ExampleCloud (완전 합성 · 출처 미확인)': 'Fictional service ExampleCloud (fully synthetic · no verified source)',
  '입력한 답변 (로컬 실시간 분석)': 'Your answer (local live analysis)',
  '입력한 답변': 'Your answer',
});

export function displayTitle(result) {
  const t = String(result?.title ?? '');
  return DISPLAY_TITLES[t] ?? t;
}

function link(url) {
  return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>` : '<span class="muted">None</span>';
}

function renderMeta(result) {
  const s = result.source;
  const mode = {
    fixture: '<span class="badge badge-fixture">Fixed example · no external API calls</span>',
    'recorded-live': '<span class="badge badge-live">Real Bifrost run output · stored record replay · no new external calls during replay</span>',
  }[result.mode] ?? '<span class="badge badge-live">Local live result (Tavily · Bifrost→Gemini)</span>';
  return `
    <h2 id="meta-title">${esc(displayTitle(result))}</h2>
    <p>${mode} <span class="badge">Source status: ${esc(s.status === 'RECORDED_LIVE' ? 'Recorded live sample' : s.status)}</span></p>
    <dl class="meta-grid">
      <dt>Answer written</dt><dd>${esc(result.authoredDate)}</dd>
      <dt>Source URL</dt><dd>${link(s.url)}</dd>
      <dt>Source published</dt><dd>${s.publishedDate ? `${esc(s.publishedDate)} <span class="muted">(as written: “${esc(s.publishedDateText)}”)</span>` : '<span class="muted">Not applicable</span>'}</dd>
      <dt>Collected</dt><dd>${esc(result.collectedAt || '—')}</dd>
      <dt>Collection method</dt><dd>${esc(result.collectionMethod || '—')}</dd>
    </dl>
    ${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}`;
}

function renderSummary(view) {
  const s = view.summary;
  const item = (label, value, cls = '') => `<div class="stat ${cls}"><span class="stat-value">${esc(value)}</span><span class="stat-label">${esc(label)}</span></div>`;
  return `
    <p class="eval-line">Evaluation date <strong>${esc(view.evalDate)}</strong> · <strong>${esc(view.elapsedSinceAuthored)} days</strong> since written · ${s.total} claims</p>
    <div class="stats">
      ${item(displayLabel(SUPPORT), s[SUPPORT], 'rel-support')}
      ${item(displayLabel(REFUTE), s[REFUTE], 'rel-refute')}
      ${item(displayLabel(INSUFFICIENT), s[INSUFFICIENT], 'rel-insufficient')}
      ${item(displayLabel(DATE_KNOWN), s[DATE_KNOWN])}
      ${item(displayLabel(DATE_UNKNOWN), s[DATE_UNKNOWN])}
      ${item('Recheck overdue', s.overdue)}
      ${item('Highest score', round1(s.maxScore))}
      ${item('Average score', round1(s.avgScore))}
    </div>`;
}

function renderEvidence(e) {
  return `
    <li class="evidence">
      <span class="badge ${REL_CLASS[e.stance] ?? ''}">${esc(displayLabel(e.stance))}</span>
      <span class="badge">${e.citationOk ? 'Citation check passed' : 'Citation check failed'}</span>
      <span class="badge">${e.date ? `Evidence date ${esc(e.date)}` : esc(displayLabel(DATE_UNKNOWN))}</span>
      <blockquote>${esc(e.quote || '(no excerpt)')}</blockquote>
      <div class="small">${esc(e.title)} · ${link(e.url)}</div>
      ${e.dateBasis ? `<div class="small muted">Date basis: ${esc(e.dateBasis)}</div>` : ''}
      ${e.collectedAt ? `<div class="small muted">Collected at: ${esc(e.collectedAt)}</div>` : ''}
    </li>`;
}

function renderClaims(view) {
  if (!view.claims.length) return '<p class="muted">No claims were extracted.</p>';
  return view.claims.map((c) => {
    const sc = c.score;
    const elapsed = sc.elapsedDays !== null
      ? `${sc.elapsedDays} days since supporting evidence date / cycle ${c.cycleDays} days`
      : `${c.anchorElapsedDays} days since anchor date (${c.latestDate ? 'evidence date' : 'answer date'})`;
    return `
    <article class="claim" aria-labelledby="claim-${esc(c.id)}">
      <header class="claim-head">
        <h3 id="claim-${esc(c.id)}">${esc(c.text)}</h3>
        <div class="score" aria-label="Freshness score ${round1(sc.total)}"><span class="score-num">${round1(sc.total)}</span><span class="small">/100</span></div>
      </header>
      <p>
        <span class="badge">${esc(displayLabel(c.type))} · cycle ${c.cycleDays} days</span>
        <span class="badge ${REL_CLASS[c.relation]}">${esc(displayLabel(c.relation))}</span>
        <span class="badge">${esc(displayLabel(c.dateStatus))}</span>
        <span class="badge">${c.independentSources} independent sources</span>
        <span class="badge ${c.overdue ? 'overdue' : ''}">Recheck ${esc(c.recheckDate)}${c.overdue ? ' · overdue' : ''}</span>
      </p>
      <p class="formula">R ${round1(sc.R)} + A ${round1(sc.A)} + C ${round1(sc.C)} + U ${round1(sc.U)} = <strong>${round1(sc.total)}</strong> · ${esc(elapsed)}</p>
      ${c.relationNote ? `<p class="note">${esc(c.relationNote)}</p>` : ''}
      ${c.fix ? `<p class="fix"><strong>Gemini suggested fix (needs review):</strong> ${esc(c.fix)}</p>` : ''}
      ${c.evidence.length ? `<ul class="evidence-list">${c.evidence.map(renderEvidence).join('')}</ul>` : '<p class="muted small">No linked evidence</p>'}
    </article>`;
  }).join('');
}

function renderTimeline(view, result) {
  const { start, end } = view.timeline;
  const span = Math.max(1, daysBetween(start, end));
  const pos = (d) => ((daysBetween(start, d) / span) * 100).toFixed(2);
  const W = 1000;
  const rowH = 34;
  const top = 30;
  const h = top + view.claims.length * rowH + 20;
  const x = (d) => (pos(d) / 100) * W;
  const evalX = x(view.evalDate);
  const rows = view.claims.map((c, i) => {
    const y = top + i * rowH + 12;
    const anchorX = x(c.anchorDate);
    const recheckX = x(c.recheckDate);
    return `
      <g>
        <title>${esc(`${c.id}: anchor ${c.anchorDate} → recheck ${c.recheckDate}`)}</title>
        <line x1="${anchorX}" y1="${y}" x2="${recheckX}" y2="${y}" class="tl-span ${REL_CLASS[c.relation]}" />
        <circle cx="${anchorX}" cy="${y}" r="5" class="tl-anchor" />
        <rect x="${recheckX - 5}" y="${y - 5}" width="10" height="10" class="tl-recheck ${c.overdue ? 'overdue' : ''}" />
        <text x="4" y="${y - 8}" class="tl-label">${esc(c.id)} · ${esc(displayLabel(c.relation))} · ${round1(c.score.total)} pts</text>
      </g>`;
  }).join('');
  const ax = x(result.authoredDate);
  return `
    <svg viewBox="0 0 ${W} ${h}" role="img" aria-labelledby="tl-desc" preserveAspectRatio="none" class="timeline-svg">
      <desc id="tl-desc">${esc(`Timeline from ${start} to ${end}. Answer written ${result.authoredDate}, evaluation date ${view.evalDate}.`)}</desc>
      <line x1="${ax}" y1="10" x2="${ax}" y2="${h - 10}" class="tl-authored" />
      <line x1="${evalX}" y1="10" x2="${evalX}" y2="${h - 10}" class="tl-eval" />
    ${rows}
    </svg>
    <p class="small legend"><span class="lg lg-authored"></span>Answer written ${esc(result.authoredDate)} <span class="lg lg-eval"></span>Evaluation date ${esc(view.evalDate)} <span class="lg lg-anchor"></span>Evidence date (answer date if none) <span class="lg lg-recheck"></span>Recheck date · axis ${esc(start)} to ${esc(end)}</p>
    <ol class="small timeline-text">${view.claims.map((c) => `<li>${esc(c.id)}: ${esc(c.anchorDate)} → recheck ${esc(c.recheckDate)}${c.overdue ? ' (overdue)' : ''}</li>`).join('')}</ol>`;
}

function pre(obj) {
  return `<pre>${esc(typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2))}</pre>`;
}

function renderRunLog(result) {
  const log = result.runLog;
  const tav = log.tavily.map((t, i) => `
    <li><strong>Tavily #${i + 1}</strong> · Executed query: <code>${esc(t.query)}</code>${t.generatedQuery && t.generatedQuery !== t.query ? ` · Gemini-suggested query: <code>${esc(t.generatedQuery)}</code>` : ''} · collected at ${esc(t.collectedAt ?? '—')} ${t.error ? `· <span class="err">Error: ${esc(t.error)}</span>` : ''}
      <ul>${(t.results ?? []).map((r) => `<li>${link(r.url)} ${r.published_date ? `· published_date ${esc(r.published_date)}` : '· no published_date'}<br><span class="small">${esc(r.contentExcerpt)}</span></li>`).join('')}</ul></li>`).join('');
  const gem = log.gemini.map((g, i) => `
    <li><strong>Gemini #${i + 1} (${esc(g.step)})</strong> · Requested model <code>${esc(g.requestedModel)}</code> · provider ${esc(g.provider ?? 'not in response')} · response model ${esc(g.responseModel ?? 'not in response')} · latency ${g.latencyMs ?? '—'}ms · usage ${g.usage ? esc(JSON.stringify(g.usage)) : 'not in response'} ${g.error ? `· <span class="err">Error: ${esc(g.error)}</span>` : ''}
      <details><summary>Input JSON</summary>${pre(g.input)}</details>
      <details><summary>Output</summary>${pre(g.output ?? '')}</details>
      ${g.citationCheck ? `<details><summary>Citation check</summary>${pre(g.citationCheck)}</details>` : ''}</li>`).join('');
  const replay = result.mode === 'recorded-live'
    ? `<p><strong>Replaying a stored real Bifrost run record (${esc(result.collectedAt)}).</strong> The request counts and responses below are the values recorded at that time; this replay made no external API calls.</p>`
    : '';
  return `${replay}
    <p>${esc(log.note)}</p>
    <p>Requests: Gemini <strong>${log.counts.gemini}</strong>/5 · Tavily <strong>${log.counts.tavily}</strong>/8</p>
    ${log.errors.length ? `<ul class="err">${log.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
    ${tav ? `<h3>Tavily</h3><ol>${tav}</ol>` : '<p class="muted small">No Tavily calls recorded</p>'}
    ${gem ? `<h3>Gemini (via Bifrost)</h3><ol>${gem}</ol>` : '<p class="muted small">No Gemini calls recorded</p>'}`;
}

// Plain-text status copy for selecting / exact-match rechecking a stored example. No external call in either case.
export function selectNote(result) {
  return result.mode === 'recorded-live'
    ? 'This is stored output from a real Bifrost run. It is replay only and makes no new external API calls.'
    : 'Fixed example · no external API calls.';
}

export function replayNote(result) {
  return result.mode === 'recorded-live'
    ? 'The paragraph matches the original text of a stored real Bifrost run, so its output is replayed. This replay made no external API calls.'
    : 'The paragraph matches the example text, so the cached result is replayed (no external API calls).';
}

export function renderResult(result, view) {
  return {
    meta: renderMeta(result),
    summary: renderSummary(view),
    claims: renderClaims(view),
    timeline: renderTimeline(view, result),
    runLog: renderRunLog(result),
  };
}
