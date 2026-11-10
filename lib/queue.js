// Browser-local batch recheck queue. Pure helpers: no network, no DOM. Storage is passed in (localStorage-like).
// Batch recheck only recomputes status/priority from evidence already saved with each record; it fetches nothing
// and never edits saved answers or evidence.
import { computeView, SUPPORT, REFUTE, INSUFFICIENT } from './scoring.js';
import { normalizeResult } from './schema.js';
import { displayTitle, esc } from './render.js';

export const QUEUE_STORAGE_KEY = 'claimclock.batchQueue.v1';
export const QUEUE_VERSION = 1;
export const QUEUE_CAP = 20;

export function emptyQueue() {
  return { version: QUEUE_VERSION, records: [] };
}

function isUsableRecord(record) {
  if (!record || typeof record !== 'object' || typeof record.id !== 'string' || !record.id) return false;
  try {
    normalizeResult(record.result);
    return true;
  } catch {
    return false;
  }
}

// Parses stored JSON. Never throws: unreadable data yields an empty queue plus a short error message.
export function parseQueue(text) {
  if (text === null || text === undefined || text === '') return { queue: emptyQueue(), error: null };
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { queue: emptyQueue(), error: 'The saved queue in this browser could not be read and was ignored.' };
  }
  if (!data || data.version !== QUEUE_VERSION || !Array.isArray(data.records)) {
    return { queue: emptyQueue(), error: 'The saved queue uses an unsupported format and was ignored.' };
  }
  const usable = data.records.filter(isUsableRecord);
  const records = usable.slice(0, QUEUE_CAP);
  const problems = [];
  if (usable.length < data.records.length) problems.push(`${data.records.length - usable.length} unreadable record(s) were skipped.`);
  if (usable.length > QUEUE_CAP) problems.push(`Only the first ${QUEUE_CAP} records were kept.`);
  return { queue: { version: QUEUE_VERSION, records }, error: problems.length ? problems.join(' ') : null };
}

export function serializeQueue(queue) {
  return JSON.stringify({ version: QUEUE_VERSION, records: queue.records });
}

export function loadQueue(storage) {
  try {
    if (!storage) throw new Error('no storage');
    return parseQueue(storage.getItem(QUEUE_STORAGE_KEY));
  } catch {
    return { queue: emptyQueue(), error: 'Browser storage is unavailable, so the queue cannot be kept between visits.' };
  }
}

export function saveQueue(storage, queue) {
  try {
    if (!storage) throw new Error('no storage');
    storage.setItem(QUEUE_STORAGE_KEY, serializeQueue(queue));
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: 'Could not save to browser storage (it may be full or disabled). The queue was not changed.' };
  }
}

// Returns a new queue. Existing records are never overwritten; a full queue rejects further records.
export function addRecords(queue, results, savedAt) {
  const records = [...queue.records];
  let added = 0;
  let existing = 0;
  let full = 0;
  for (const result of results) {
    if (records.some((r) => r.id === result.id)) {
      existing += 1;
    } else if (records.length >= QUEUE_CAP) {
      full += 1;
    } else {
      records.push({ id: result.id, savedAt, result: JSON.parse(JSON.stringify(result)) });
      added += 1;
    }
  }
  return { queue: { version: QUEUE_VERSION, records }, added, existing, full };
}

export function removeRecord(queue, id) {
  return { version: QUEUE_VERSION, records: queue.records.filter((r) => r.id !== id) };
}

export function findRecord(queue, id) {
  return queue.records.find((r) => r.id === id) ?? null;
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Highest claim priority first; unscorable rows last; then title, then id (locale-independent, deterministic).
export function compareRows(a, b) {
  const sa = a.maxScore ?? -1;
  const sb = b.maxScore ?? -1;
  return (sb - sa) || cmp(a.title, b.title) || cmp(a.id, b.id);
}

export function recheckQueue(queue, { evalDate, cycles, today }) {
  const rows = queue.records.map((record) => {
    try {
      const result = normalizeResult(record.result);
      const { summary } = computeView(result, { evalDate, cycles, today });
      return {
        id: record.id,
        title: displayTitle(result),
        savedAt: record.savedAt,
        maxScore: summary.maxScore,
        total: summary.total,
        counts: { supported: summary[SUPPORT], refuted: summary[REFUTE], insufficient: summary[INSUFFICIENT], overdue: summary.overdue },
        error: null,
      };
    } catch {
      return { id: record.id, title: String(record.result?.title ?? record.id), savedAt: record.savedAt, maxScore: null, total: 0, counts: null, error: 'This record could not be scored.' };
    }
  });
  return rows.sort(compareRows);
}

export function renderQueue(rows, { evalDate }) {
  if (!rows.length) return '<p class="muted small">The queue is empty. Save the current result or load the fixed examples.</p>';
  const items = rows.map((r) => {
    const stats = r.error
      ? `<span class="err small">${esc(r.error)}</span>`
      : `<span class="badge">Highest score ${esc(Math.round(r.maxScore * 10) / 10)}</span>
        <span class="badge">${esc(r.total)} claims</span>
        <span class="badge rel-support">Supported ${esc(r.counts.supported)}</span>
        <span class="badge rel-refute">Refuted ${esc(r.counts.refuted)}</span>
        <span class="badge rel-insufficient">Insufficient evidence ${esc(r.counts.insufficient)}</span>
        <span class="badge ${r.counts.overdue ? 'overdue' : ''}">Recheck overdue ${esc(r.counts.overdue)}</span>`;
    return `
    <li class="queue-item">
      <div class="queue-main">
        <h3>${esc(r.title)}</h3>
        <p class="queue-stats">${stats}</p>
        <p class="small muted">Saved ${esc(r.savedAt || '—')}</p>
      </div>
      <div class="queue-actions">
        <button type="button" data-queue-action="open" data-id="${esc(r.id)}" aria-label="Open ${esc(r.title)} in the single-answer view">Open</button>
        <button type="button" data-queue-action="remove" data-id="${esc(r.id)}" aria-label="Remove ${esc(r.title)} from the queue">Remove</button>
      </div>
    </li>`;
  }).join('');
  return `<p class="small">Scores as of evaluation date <strong>${esc(evalDate)}</strong> · ${rows.length}/${QUEUE_CAP} stored · sorted by highest claim score</p><ol class="queue-list">${items}</ol>`;
}
