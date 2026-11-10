import { FIXTURES } from './lib/fixtures.js';
import { normalizeResult, matchFixture } from './lib/schema.js';
import { computeView, buildIcs, DEFAULT_CYCLES, CLAIM_TYPES, addDays, daysBetween, isValidDate, displayLabel, DATE_UNKNOWN } from './lib/scoring.js';
import { renderResult, selectNote, replayNote, displayTitle } from './lib/render.js';
import { loadQueue, saveQueue, addRecords, removeRecord, findRecord, emptyQueue, recheckQueue, renderQueue, QUEUE_CAP } from './lib/queue.js';

const $ = (id) => document.getElementById(id);
const fixtures = FIXTURES.map(normalizeResult);

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const state = { result: null, evalDate: null, cycles: { ...DEFAULT_CYCLES }, today: localToday(), ics: '', queue: emptyQueue() };

// Browser-local batch queue. Uses only localStorage: no fetch, and stored answers/evidence are never edited.
const storage = (() => { try { return window.localStorage; } catch { return null; } })();

function setQueueMessage(text, kind = 'info') {
  const el = $('queue-message');
  el.className = `message ${kind}`;
  el.textContent = text;
}

function renderQueuePanel() {
  const evalDate = state.evalDate ?? state.today;
  $('queue-list').innerHTML = renderQueue(recheckQueue(state.queue, { evalDate, cycles: state.cycles, today: state.today }), { evalDate });
}

function commitQueue(next, okText) {
  const saved = saveQueue(storage, next);
  if (!saved.ok) {
    setQueueMessage(saved.error, 'error');
    return;
  }
  state.queue = next;
  renderQueuePanel();
  setQueueMessage(okText, 'ok');
}

function addToQueue(results) {
  const { queue, added, existing, full } = addRecords(state.queue, results, localToday());
  const parts = [`Added ${added} record(s).`];
  if (existing) parts.push(`${existing} already in the queue (left unchanged).`);
  if (full) parts.push(`${full} not added: the queue is limited to ${QUEUE_CAP} records.`);
  if (!added) {
    setQueueMessage(parts.join(' '), full ? 'warn' : 'info');
    return;
  }
  commitQueue(queue, parts.join(' '));
}

function initQueue() {
  const loaded = loadQueue(storage);
  state.queue = loaded.queue;
  if (loaded.error) setQueueMessage(loaded.error, 'warn');
  renderQueuePanel();
  $('queue-save').addEventListener('click', () => {
    if (!state.result) {
      setQueueMessage('Nothing to save: show a result first (choose an example or press Recheck).', 'warn');
      return;
    }
    addToQueue([state.result]);
  });
  $('queue-demo').addEventListener('click', () => addToQueue(fixtures));
  $('queue-recheck').addEventListener('click', () => {
    renderQueuePanel();
    setQueueMessage(`Rechecked ${state.queue.records.length} stored record(s) at evaluation date ${state.evalDate ?? state.today} from their saved evidence. No new evidence was fetched.`, 'ok');
  });
  $('queue-clear').addEventListener('click', () => commitQueue(emptyQueue(), 'Cleared the queue in this browser.'));
  $('queue-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-queue-action]');
    if (!btn) return;
    const record = findRecord(state.queue, btn.dataset.id);
    if (!record) return;
    if (btn.dataset.queueAction === 'remove') {
      commitQueue(removeRecord(state.queue, record.id), 'Removed one record from the queue.');
      return;
    }
    try {
      const result = normalizeResult(record.result);
      const keepDate = state.evalDate ?? state.today;
      $('answer').value = result.answerText;
      $('authored').value = result.authoredDate;
      if (fixtures.some((f) => f.id === result.id)) $('example').value = result.id;
      load(result, keepDate);
      setMessage(`Opened “${displayTitle(result).replace(/[<>&]/g, '')}” from the batch queue. Its saved evidence is shown; nothing new was fetched.`, 'ok');
      $('results').focus();
    } catch {
      setQueueMessage('This record could not be opened.', 'error');
    }
  });
}

function setMessage(html, kind = 'info') {
  const el = $('message');
  el.className = `message ${kind}`;
  el.innerHTML = html;
}

function showResults(show, emptyHtml = '') {
  $('results').hidden = !show;
  $('empty').hidden = show;
  $('empty').innerHTML = emptyHtml;
}

// Recompute everything that depends on evalDate / cycles. Pure local computation, no fetch.
function update() {
  const r = state.result;
  if (!r) return;
  const view = computeView(r, { evalDate: state.evalDate, cycles: state.cycles, today: state.today });
  const html = renderResult(r, view);
  $('summary').innerHTML = html.summary;
  $('claims').innerHTML = html.claims;
  $('timeline').innerHTML = html.timeline;
  $('evaldate-out').textContent = `${state.evalDate} (${view.elapsedSinceAuthored} days after the answer was written)`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  state.ics = buildIcs(r, view, stamp);
  $('ics-preview').textContent = state.ics;
}

// preferredDate (optional): keep this evaluation date, clamped to the record's slider range. Defaults to today.
function load(result, preferredDate = null) {
  state.result = result;
  const start = result.authoredDate;
  const end = start > state.today ? start : state.today;
  const max = daysBetween(start, end);
  let evalDate = end;
  if (preferredDate && isValidDate(preferredDate)) evalDate = preferredDate < start ? start : preferredDate > end ? end : preferredDate;
  const slider = $('evaldate');
  slider.min = '0';
  slider.max = String(max);
  slider.value = String(daysBetween(start, evalDate));
  state.evalDate = evalDate;
  $('evaldate-range').textContent = `Range: ${start} (answer date) to ${end} (today)`;
  const html = renderResult(result, computeView(result, { evalDate, cycles: state.cycles, today: state.today }));
  $('meta').innerHTML = html.meta;
  $('runlog').innerHTML = html.runLog;
  showResults(true);
  update();
}

function selectExample(id) {
  const f = fixtures.find((x) => x.id === id);
  $('answer').value = f.answerText;
  $('authored').value = f.authoredDate;
  load(f);
  setMessage(`Loaded example “${displayTitle(f).replace(/[<>&]/g, '')}”. ${selectNote(f)}`);
}

async function verify() {
  const text = $('answer').value;
  const authoredDate = $('authored').value;
  if (!text.trim()) {
    setMessage('Enter an answer paragraph.', 'warn');
    return;
  }
  const hit = matchFixture(text, fixtures);
  if (hit) {
    $('example').value = hit.id;
    $('authored').value = hit.authoredDate;
    load(hit);
    const dateNote = authoredDate && authoredDate !== hit.authoredDate ? ` Using the example's answer date ${hit.authoredDate} instead of the date you entered (${authoredDate}).` : '';
    setMessage(`${replayNote(hit)}${dateNote}`, 'ok');
    return;
  }
  // Not a fixture: never present cached evidence for edited text.
  state.result = null;
  showResults(false, '<p>This paragraph does not exactly match any stored example or recorded run, so no result is shown. Nothing was analyzed.</p>');
  if (!isValidDate(authoredDate)) {
    setMessage('Enter the date the answer was written.', 'warn');
    return;
  }
  setMessage('Checking whether a local live backend is available… (your paragraph has not been sent)');
  let status = null;
  try {
    const res = await fetch('./api/status', { cache: 'no-store' });
    const body = res.ok ? await res.json() : null;
    if (body && typeof body.liveReady === 'boolean') status = body;
  } catch {
    status = null;
  }
  if (!status) {
    // Static hosting (e.g. GitHub Pages): there is no backend, so no analysis can run here.
    setMessage('<strong>No live analysis is possible on this page.</strong> This static demo has no backend: your paragraph was not analyzed and was not sent anywhere, and no result is shown. Only paragraphs that exactly match a stored example or recorded run can be displayed. Live analysis of new text requires a local install and your own API keys (see “Local live mode” in the README).', 'warn');
    return;
  }
  if (!status.liveReady) {
    const problems = Array.isArray(status.problems) ? status.problems : [];
    setMessage(`<strong>No live analysis was run.</strong> Analyzing a paragraph that differs from the stored examples requires a local install and your own API keys (see “Local live mode” in the README). Current status: ${problems.map((p) => `<code>${String(p).replace(/[<>&]/g, '')}</code>`).join(', ') || 'live mode not configured'}. The stored examples remain available.`, 'warn');
    return;
  }
  setMessage('Running local live analysis (Tavily · Bifrost→Gemini, sequential)…');
  $('verify').disabled = true;
  try {
    const res = await fetch('./api/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, authoredDate }) });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || body.error);
    const result = normalizeResult(body.result);
    load(result);
    const errs = result.runLog.errors.length ? ` ${result.runLog.errors.length} error(s): see the run log.` : '';
    setMessage(`Local live analysis finished. Requests: Gemini ${result.runLog.counts.gemini}, Tavily ${result.runLog.counts.tavily}.${errs}`, errs ? 'warn' : 'ok');
  } catch (err) {
    setMessage(`Live analysis failed: ${String(err.message).replace(/[<>&]/g, '')}. Fixed example mode remains available.`, 'error');
  } finally {
    $('verify').disabled = false;
  }
}

function buildCycleInputs() {
  $('cycle-inputs').innerHTML = CLAIM_TYPES.map((t, i) => `
    <div class="field cycle">
      <label for="cycle-${i}">${displayLabel(t)}</label>
      <input type="number" id="cycle-${i}" data-type="${t}" min="1" max="3650" step="1" value="${state.cycles[t]}" inputmode="numeric">
    </div>`).join('');
  for (const input of $('cycle-inputs').querySelectorAll('input')) {
    input.addEventListener('input', () => {
      const n = Math.round(Number(input.value));
      if (Number.isFinite(n) && n >= 1 && n <= 3650) {
        state.cycles[input.dataset.type] = n;
        input.removeAttribute('aria-invalid');
        update();
      } else {
        input.setAttribute('aria-invalid', 'true');
      }
    });
  }
}


async function loadRecordedRun() {
  const panel = $('recorded-run');
  try {
    const response = await fetch('./live-run.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('no-record');
    const record = await response.json();
    if (record.mode !== 'recorded-live' || record.actualExternalRun !== true || record.executionPath !== 'direct-tavily-gemini' || record.bifrostUsed !== false) throw new Error('not-live');
    const agreement = record.humanAgreement;
    const percent = agreement.accuracy === null ? 'no label comparison' : `${Math.round(agreement.accuracy * 100)}% (${agreement.matched}/${agreement.total})`;
    const escapeHtml = (value) => String(value ?? '').replace(/[<>&"']/g, (c) => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
    const links = (record.result.runLog.tavily || []).flatMap((q) => (q.results || []).map((r) => {
      let url = ''; try { const parsed = new URL(r.url); if (parsed.protocol === 'https:' || parsed.protocol === 'http:') url = parsed.href; } catch {}
      const label = escapeHtml(r.title || url || 'No URL');
      const anchor = url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
      return `<li>${anchor} · ${escapeHtml(r.published_date || displayLabel(DATE_UNKNOWN))}<br>${url ? `<code>${escapeHtml(url)}</code><br>` : ''}<span class="small">${escapeHtml(r.contentExcerpt || '')}</span></li>`;
    })).join('');
    const comparisons = agreement.comparisons.map((c) => `Human label ${escapeHtml(displayLabel(c.label))} · Gemini verdict ${escapeHtml(displayLabel(c.modelRelation))}<br><span class="small">Label basis: ${escapeHtml(c.labelSource)}</span>`).join('<br>');
    panel.innerHTML = `<p class="badge badge-live">This record is a direct Tavily + Gemini call that did not go through Bifrost</p><p><strong>Real run</strong> · ${new Date(record.startedAt).toLocaleString('en-US')} · human-label agreement <strong>${percent}</strong> (${agreement.total} labels)</p><p>${comparisons}</p><p>Tavily searches: ${record.tavilyCalls} · direct Gemini calls: ${record.geminiCalls}. The real evidence and responses are shown below.</p><ul>${links || '<li>No search results</li>'}</ul><details><summary>Expand model responses and latency</summary><pre>${JSON.stringify(record.result.runLog.gemini.map((g) => ({ step: g.step, requestedModel: g.requestedModel, provider: g.provider, responseModel: g.responseModel, latencyMs: g.latencyMs, usage: g.usage, output: g.output })), null, 2).replace(/[<>&]/g, (c) => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</pre></details>`;
    const evalRes = await fetch('./live-evaluation-pre.json', { cache: 'no-store' });
    if (evalRes.ok) {
      const evaluation = await evalRes.json();
      const rows = evaluation.runs.map((r) => `<li><strong>${escapeHtml(r.claim)}</strong><br>Human ${escapeHtml(displayLabel(r.officialLabel))} · Gemini ${escapeHtml(displayLabel(r.modelLabel))} · ${r.matched ? 'match' : 'mismatch'} · <a href="${escapeHtml(r.officialUrl)}" target="_blank" rel="noopener noreferrer">official source</a></li>`).join('');
      panel.insertAdjacentHTML('beforeend', `<hr><h3>Live evaluation record (before prompt change)</h3><p>${evaluation.totalSamples} samples · matched ${evaluation.matched}/${evaluation.totalSamples} (${Math.round(evaluation.accuracy * 100)}%) · ${evaluation.cumulativeTavilyRequestsIncludingEarlierRetries} Tavily requests cumulative</p><ul>${rows}</ul><p class="small">The earlier 0/1 mismatch is kept separate from the 5 new evaluations. The model and rules were not changed.</p>`);
    }
    const bifRes = await fetch('./live-run-bifrost.json', { cache: 'no-store' });
    if (bifRes.ok) {
      const bifrost = await bifRes.json();
      panel.insertAdjacentHTML('beforeend', `<hr><h3>Bifrost routing check (virtual key smoke request)</h3><p>${escapeHtml(bifrost.bifrostVersion)} · Gemini ${escapeHtml(bifrost.provider)} · ${escapeHtml(bifrost.requestCount)} request(s) · HTTP ${escapeHtml(bifrost.requestLog?.httpStatus)} · request log ${bifrost.requestLog?.logged === true ? 'recorded' : 'not confirmed'} · Valkey not used</p><p>${escapeHtml(bifrost.output)}</p>`);
    }
    const safeUrl = (u) => { try { const p = new URL(u); return p.protocol === 'https:' || p.protocol === 'http:' ? p.href : ''; } catch { return ''; } };
    const bifEvalRes = await fetch('./live-evaluation-bifrost-freequery-v1.json', { cache: 'no-store' });
    if (bifEvalRes.ok) {
      const ev = await bifEvalRes.json();
      const classes = Object.entries(ev.byClass || {}).map(([label, c]) => `${escapeHtml(displayLabel(label))} ${escapeHtml(c.matched)}/${escapeHtml(c.n)}`).join(' · ');
      const rows = (ev.results || []).map((r) => {
        const url = safeUrl(r.goldBasis?.url);
        const src = url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">official label basis</a>` : 'no official label basis';
        const query = (r.executedQueries || []).map(escapeHtml).join(' · ');
        return `<li><strong>${escapeHtml(r.input)}</strong><br>Human ${escapeHtml(displayLabel(r.goldLabel))} · Gemini ${escapeHtml(displayLabel(r.modelLabel))} · ${r.matched === true ? 'match' : 'mismatch'} · ${src}<br><span class="small">Executed Tavily query: <code>${query || 'not recorded'}</code></span></li>`;
      }).join('');
      panel.insertAdjacentHTML('beforeend', `<hr><h3>Real evaluation record via Bifrost (virtual key)</h3><p>${escapeHtml(ev.totalSamples)} samples · matched ${escapeHtml(ev.matched)}/${escapeHtml(ev.totalSamples)} · by class ${classes} · ${escapeHtml(ev.newTavilyCalls)} new Tavily calls (${escapeHtml(ev.cumulativeTavilyCalls)} cumulative)</p><ul>${rows}</ul><p class="small">In this evaluation, the input claim sentence itself was sent to Tavily. Gemini's suggested search query is kept in a separate field. The executed queries contain no site: filter, answer URL, or domain restriction. The existing prompts and rules were used unchanged, and this is recorded separately from the pre-prompt-change evaluation (live-evaluation-pre.json). This is a small 6-sample demo evaluation; the quality of Gemini-generated search queries in production was not evaluated.</p>`);
    }
    const featRes = await fetch('./bifrost-runtime-feature.json', { cache: 'no-store' });
    if (featRes.ok) {
      const feat = await featRes.json();
      const pe = feat.pipelineEvaluation || {};
      panel.insertAdjacentHTML('beforeend', `<p>Bifrost ${escapeHtml(feat.bifrostVersion)} runtime features: virtual key auth ${feat.virtualKeyUsed === true ? 'used' : 'not used'} (header <code>${escapeHtml(feat.virtualKeyHeader)}</code>; key value not recorded) · direct-key bypass ${feat.directKeyBypassEnabled === false ? 'off' : 'needs verification'} · request log API (HTTP ${escapeHtml(pe.logQueryHttpStatus)}) confirmed ${escapeHtml(pe.bifrostLogStatusCounts?.success)} successful of ${escapeHtml(pe.bifrostModelCalls)} Gemini requests · Valkey and semantic cache not used</p>`);
    }
    const probeRes = await fetch('./bifrost-vk-link-probe.json', { cache: 'no-store' });
    if (probeRes.ok) {
      const probe = await probeRes.json();
      panel.insertAdjacentHTML('beforeend', `<p class="small">Excluded from scoring: the first virtual key setup check was rejected entirely because no Gemini provider key was attached (${escapeHtml(probe.error)}). It made ${escapeHtml(probe.tavilyCalls)} Tavily and ${escapeHtml(probe.geminiProviderCalls)} Gemini provider calls and is not an evaluation sample.</p>`);
    }
    const directRes = await fetch('./live-run-gemini-direct.json', { cache: 'no-store' });
    if (directRes.ok) {
      const directRun = await directRes.json();
      panel.insertAdjacentHTML('beforeend', `<p>Separate direct Gemini call record · ${directRun.requestCount} request(s) · ${escapeHtml(directRun.output)}</p>`);
    }
  } catch {
    panel.innerHTML = '<p class="muted">Could not load the run summary records. The default example is stored real Bifrost output, and this page made no new external calls.</p>';
  }
}

function init() {
  $('example').innerHTML = fixtures.map((f) => `<option value="${f.id}">${displayTitle(f).replace(/[<>&]/g, '')}</option>`).join('');
  $('example').addEventListener('change', (e) => selectExample(e.target.value));
  $('verify').addEventListener('click', verify);
  $('copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('answer').value);
      setMessage('Copied the paragraph to the clipboard.');
    } catch {
      $('answer').select();
      setMessage('Automatic copy was blocked, so the paragraph has been selected. Press Ctrl/⌘+C to copy it.', 'warn');
    }
  });
  $('answer').addEventListener('input', () => {
    if (state.result && $('answer').value !== state.result.answerText) {
      state.result = null;
      showResults(false, '<p>The paragraph has changed. The previous result was hidden because it did not check the edited paragraph. Press <strong>Recheck</strong>.</p>');
      setMessage('');
    }
  });
  $('evaldate').addEventListener('input', (e) => {
    state.evalDate = addDays(state.result.authoredDate, Number(e.target.value));
    update();
  });
  $('reset-cycles').addEventListener('click', () => {
    state.cycles = { ...DEFAULT_CYCLES };
    buildCycleInputs();
    update();
  });
  $('ics-download').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([state.ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `claimclock-${state.result.id}-${state.evalDate}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  buildCycleInputs();
  selectExample(fixtures[0].id);
  initQueue();
  loadRecordedRun();
}

init();
