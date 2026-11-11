// Browser-local batch queue helpers. Fake storage only; any fetch call fails the test. No network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURES } from '../lib/fixtures.js';
import { normalizeResult } from '../lib/schema.js';
import { DEFAULT_CYCLES } from '../lib/scoring.js';
import {
  QUEUE_CAP, QUEUE_STORAGE_KEY, QUEUE_VERSION, emptyQueue, parseQueue, serializeQueue, loadQueue, saveQueue,
  addRecords, removeRecord, findRecord, recheckQueue, compareRows, renderQueue,
} from '../lib/queue.js';

const fixtures = FIXTURES.map(normalizeResult);
const AT = { evalDate: '2026-11-10', cycles: DEFAULT_CYCLES, today: '2026-11-10' };

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

function synthetic(id, title) {
  return normalizeResult({ id, title, authoredDate: '2025-01-15', mode: 'fixture', claims: [{ id: 'c1', text: 't', type: '가격', relation: 'insufficient', evidence: [] }] });
}

function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const v of Object.values(obj)) deepFreeze(v);
  }
  return obj;
}

test('queue is versioned, capped at 20, and never overwrites existing records', () => {
  assert.equal(QUEUE_CAP, 20);
  assert.equal(QUEUE_STORAGE_KEY, 'claimclock.batchQueue.v1');
  const many = Array.from({ length: 25 }, (_, i) => synthetic(`s${String(i).padStart(2, '0')}`, `Sample ${i}`));
  const first = addRecords(emptyQueue(), many, '2026-11-10');
  assert.equal(first.queue.records.length, 20);
  assert.deepEqual([first.added, first.existing, first.full], [20, 0, 5]);
  assert.equal(first.queue.version, QUEUE_VERSION);
  const again = addRecords(first.queue, [many[0]], '2026-11-11');
  assert.deepEqual([again.added, again.existing, again.full], [0, 1, 0]);
  assert.equal(findRecord(again.queue, 's00').savedAt, '2026-11-10');
  const removed = removeRecord(first.queue, 's03');
  assert.equal(removed.records.length, 19);
  assert.equal(findRecord(removed, 's03'), null);
  // Parsing stored data also enforces the cap.
  const oversized = JSON.stringify({ version: QUEUE_VERSION, records: [...first.queue.records, ...addRecords(emptyQueue(), many.slice(20), 'x').queue.records] });
  const parsed = parseQueue(oversized);
  assert.equal(parsed.queue.records.length, 20);
  assert.match(parsed.error, /first 20/);
});

test('batch recheck sorts by highest claim score, then title, then id', () => {
  const { queue } = addRecords(emptyQueue(), [...fixtures, synthetic('z-b', 'Tie B'), synthetic('z-a2', 'Tie A'), synthetic('z-a1', 'Tie A')], '2026-11-10');
  const rows = recheckQueue(queue, AT);
  for (let i = 1; i < rows.length; i += 1) assert.ok(compareRows(rows[i - 1], rows[i]) <= 0, `row ${i}`);
  for (let i = 1; i < rows.length; i += 1) assert.ok(rows[i - 1].maxScore >= rows[i].maxScore);
  const ties = rows.filter((r) => r.id.startsWith('z-')).map((r) => r.id);
  assert.deepEqual(ties, ['z-a1', 'z-a2', 'z-b']);
  const node = rows.find((r) => r.id === fixtures[0].id);
  assert.equal(node.total, 1);
  assert.deepEqual(node.counts, { supported: 0, refuted: 1, insufficient: 0, overdue: 0 });
  assert.equal(rows.length, fixtures.length + 3);
  const html = renderQueue(rows, { evalDate: AT.evalDate });
  assert.match(html, /Highest score/);
  assert.match(html, /data-queue-action="open"/);
  assert.match(html, /data-queue-action="remove"/);
  assert.match(html, /Scores as of evaluation date <strong>2026-11-10<\/strong>/);
  assert.match(renderQueue([], AT), /queue is empty/);
});

test('storage errors and unreadable data are handled without throwing', () => {
  assert.deepEqual(loadQueue(memoryStorage()).queue, emptyQueue());
  assert.equal(loadQueue(memoryStorage()).error, null);
  assert.match(loadQueue(null).error, /unavailable/);
  assert.match(loadQueue({ getItem: () => { throw new Error('SecurityError'); } }).error, /unavailable/);
  assert.match(parseQueue('{not json').error, /could not be read/);
  assert.match(parseQueue(JSON.stringify({ version: 99, records: [] })).error, /unsupported format/);
  const mixed = parseQueue(JSON.stringify({ version: QUEUE_VERSION, records: [{ id: 'bad', result: { authoredDate: 'nope' } }, { id: fixtures[1].id, savedAt: 'x', result: fixtures[1] }] }));
  assert.deepEqual(mixed.queue.records.map((r) => r.id), [fixtures[1].id]);
  assert.match(mixed.error, /1 unreadable/);
  const quota = saveQueue({ setItem: () => { throw new Error('QuotaExceededError'); } }, emptyQueue());
  assert.equal(quota.ok, false);
  assert.match(quota.error, /not changed/);
  const store = memoryStorage();
  const { queue } = addRecords(emptyQueue(), fixtures, '2026-11-10');
  assert.equal(saveQueue(store, queue).ok, true);
  const roundTrip = loadQueue(store);
  assert.equal(roundTrip.error, null);
  assert.deepEqual(roundTrip.queue.records.map((r) => r.id), fixtures.map((f) => f.id));
  // A record whose stored result breaks scoring is listed last with an error instead of throwing.
  const broken = { version: QUEUE_VERSION, records: [{ id: 'broken', savedAt: 'x', result: { authoredDate: 'bad' } }, ...queue.records] };
  const rows = recheckQueue(broken, AT);
  assert.equal(rows.at(-1).id, 'broken');
  assert.match(rows.at(-1).error, /could not be scored/);
});

test('queue operations make no fetch calls and do not mutate saved answers or evidence', () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('fetch is not allowed'); };
  try {
    const source = deepFreeze(JSON.parse(JSON.stringify(fixtures)));
    const { queue } = addRecords(emptyQueue(), source, '2026-11-10');
    deepFreeze(queue);
    const before = serializeQueue(queue);
    for (const evalDate of ['2024-10-22', '2026-11-10']) recheckQueue(queue, { ...AT, evalDate });
    removeRecord(queue, fixtures[0].id);
    addRecords(queue, [synthetic('extra', 'Extra')], '2026-11-10');
    const store = memoryStorage();
    saveQueue(store, queue);
    loadQueue(store);
    assert.equal(serializeQueue(queue), before);
    assert.equal(JSON.stringify(source), JSON.stringify(fixtures));
    // Stored copies are independent of the in-memory result objects.
    assert.notEqual(queue.records[0].result, source[0]);
    assert.equal(queue.records[0].result.answerText, fixtures[0].answerText);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(calls, 0);
});
