import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreClaim, SUPPORT, REFUTE, INSUFFICIENT, computeView, DEFAULT_CYCLES, buildIcs, evaluateClaim, evidenceAvailableDate, ORIGIN_EXTERNAL, ORIGIN_HUMAN } from '../lib/scoring.js';
import { normalizeResult, matchFixture } from '../lib/schema.js';
import { FIXTURES } from '../lib/fixtures.js';
import { renderResult, selectNote, replayNote } from '../lib/render.js';
import { readFileSync } from 'node:fs';

test('v4 score examples and boundary', () => {
  const support = scoreClaim({ relation: SUPPORT, dateKnown: true, supportDate: '2026-11-08', independentSources: 2, cycleDays: 30, evalDate: '2026-11-09' });
  assert.equal(Math.round(support.total * 10) / 10, 1.3);
  const refute = scoreClaim({ relation: REFUTE, dateKnown: true, independentSources: 2, evalDate: '2026-11-09' });
  assert.equal(refute.total, 70);
  const insufficient = scoreClaim({ relation: INSUFFICIENT, dateKnown: false, independentSources: 0, evalDate: '2026-11-09' });
  assert.equal(insufficient.total, 65);
  const unknownRefute = scoreClaim({ relation: REFUTE, dateKnown: false, independentSources: 1, evalDate: '2026-11-09' });
  assert.equal(unknownRefute.total, 70);
});

test('cycle defaults and negative elapsed days clamp to zero', () => {
  assert.deepEqual(DEFAULT_CYCLES, { '가격': 7, '버전': 30, '직책': 30, '통계': 90, '안정 사실': 365 });
  const score = scoreClaim({ relation: SUPPORT, dateKnown: true, supportDate: '2026-11-10', independentSources: 2, cycleDays: 30, evalDate: '2026-11-09' });
  assert.equal(score.elapsedDays, 0);
  assert.equal(score.A, 0);
});

const NODE = FIXTURES.find((f) => f.id === 'node20-lts-2023');

test('fixture normalizes and exact pasted example matches only', () => {
  const f = FIXTURES.map(normalizeResult);
  assert.equal(f.length, 4);
  assert.equal(matchFixture(NODE.answerText, FIXTURES), NODE);
  assert.equal(matchFixture(NODE.answerText + ' edited', FIXTURES), null);
  assert.equal(NODE.source.status, 'VERIFIED');
  assert.deepEqual(f.slice(1).map((x) => x.mode), ['fixture', 'fixture', 'fixture']);
});

test('default sample replays a real Bifrost stale-fact run with official dated timeline sources', () => {
  const record = JSON.parse(readFileSync(new URL('../public/live-stale-node20-bifrost.json', import.meta.url), 'utf8'));
  const run = record.run;
  const sample = FIXTURES[0];
  assert.equal(sample.mode, 'recorded-live');
  assert.equal(run.mode, 'live');
  assert.equal(sample.answerText, run.answerText);
  assert.equal(sample.claims[0].text, run.claims[0].text);
  assert.equal(sample.claims[0].relation, run.claims[0].relation);
  assert.equal(sample.claims[0].evidence[0].date, null);
  assert.equal(run.claims[0].evidence[0].date, '2026-04-30');
  assert.deepEqual(sample.runLog.tavily, run.runLog.tavily);
  assert.deepEqual(sample.runLog.gemini, run.runLog.gemini);
  assert.match(sample.title, /real Bifrost run/);
  assert.equal(sample.timelineEvidenceByClaim.c1.length, 2);
  assert.equal(record.actualExternalRun, true);
  assert.equal(run.runLog.externalCalls, true);
  assert.equal(run.runLog.tavily[0].query, 'Node.js 20 release schedule LTS status');
  assert.equal(run.claims[0].relation, REFUTE);
  const normalized = normalizeResult(sample);
  assert.equal(normalized.mode, 'recorded-live');
  const at = (evalDate) => evaluateClaim(normalized.claims[0], { evalDate, cycles: DEFAULT_CYCLES, authoredDate: normalized.authoredDate, resultCollectedAt: normalized.collectedAt });
  // Every saved item was collected on 2026-11-10, so none is available in 2024 views, even for 2023/2024 events.
  for (const evalDate of ['2024-02-01', '2024-10-21', '2024-10-22']) {
    const v = at(evalDate);
    assert.equal(v.relation, INSUFFICIENT, evalDate);
    assert.deepEqual(v.evidence, [], evalDate);
    assert.equal(v.hiddenEvidenceCount, 3, evalDate);
    assert.equal(v.independentSources, 0, evalDate);
  }
  const current = at('2026-11-10');
  assert.equal(current.relation, REFUTE);
  assert.equal(current.latestDate, '2024-10-22');
  assert.ok(current.evidence.some((e) => e.id === 'official-node20-eol'));
});

test('evidence provenance: recorded live is external search, fixture and timeline evidence is human-added', () => {
  const sample = normalizeResult(FIXTURES[0]);
  const ev = sample.claims[0].evidence;
  assert.equal(ev.find((e) => e.id === 'd47d36-02').origin, ORIGIN_EXTERNAL);
  assert.equal(ev.find((e) => e.id === 'historical-node20-lts').origin, ORIGIN_HUMAN);
  assert.equal(ev.find((e) => e.id === 'official-node20-eol').origin, ORIGIN_HUMAN);
  for (const claim of normalizeResult(NODE).claims) for (const e of claim.evidence) assert.equal(e.origin, ORIGIN_HUMAN, e.id);
  // Corrected manual Node v20.9.0 evidence: event date stays 2023-10-24, actual collection 2026-11-10.
  const manual = ev.find((e) => e.id === 'historical-node20-lts');
  assert.equal(manual.date, '2023-10-24');
  assert.equal(manual.collectedAt, '2026-11-10');
  // Defaults by mode, and explicit origin is preserved.
  const base = { authoredDate: '2025-01-01', collectedAt: '2025-01-02T00:00:00.000Z' };
  const claim = (evidence) => [{ id: 'c1', text: 'x', relation: 'support', evidence }];
  assert.equal(normalizeResult({ ...base, mode: 'live', claims: claim([{ id: 'a' }]) }).claims[0].evidence[0].origin, ORIGIN_EXTERNAL);
  assert.equal(normalizeResult({ ...base, mode: 'live', claims: claim([{ id: 'a', origin: ORIGIN_HUMAN }]) }).claims[0].evidence[0].origin, ORIGIN_HUMAN);
  assert.equal(normalizeResult({ ...base, mode: 'fixture', claims: claim([{ id: 'a', origin: 'bogus' }]) }).claims[0].evidence[0].origin, ORIGIN_HUMAN);
  assert.equal(normalizeResult({ ...base, mode: 'fixture', claims: claim([{ id: 'a', origin: ORIGIN_EXTERNAL }]) }).claims[0].evidence[0].origin, ORIGIN_EXTERNAL);
  const timeline = normalizeResult({ ...base, mode: 'live', claims: claim([]), timelineEvidenceByClaim: { c1: [{ id: 't' }] } });
  assert.equal(timeline.claims[0].evidence[0].origin, ORIGIN_HUMAN);
  // Re-normalizing an already normalized result keeps every origin.
  assert.deepEqual(normalizeResult(sample).claims[0].evidence.map((e) => e.origin), ev.map((e) => e.origin));
});

test('human-added evidence decides relation/date but is excluded from independent sources and the C component', () => {
  const result = normalizeResult(FIXTURES[0]);
  const view = computeView(result, { evalDate: '2026-11-10', cycles: DEFAULT_CYCLES, today: '2026-11-10' });
  const [c] = view.claims;
  assert.equal(c.relation, REFUTE);
  assert.equal(c.independentSources, 1);
  assert.equal(c.humanAddedCount, 2);
  assert.equal(c.score.C, 10);
  assert.equal(c.latestDate, '2024-10-22');
  const html = renderResult(result, view).claims;
  assert.match(html, /\b1 independent source\b/);
  assert.doesNotMatch(html, /3 independent sources/);
  assert.match(html, /External search \(Tavily\)/);
  assert.match(html, /Human-added · not counted as an independent source/);
  assert.match(html, /2 human-added \(not counted\)/);
});

test('availability is the later of event date and collection date', () => {
  assert.equal(evidenceAvailableDate({ date: '2024-10-22', collectedAt: '2026-11-10' }), '2026-11-10');
  assert.equal(evidenceAvailableDate({ date: '2026-04-30', collectedAt: '2025-01-01T09:00:00Z' }), '2026-04-30');
  assert.equal(evidenceAvailableDate({ date: null, collectedAt: '2026-11-10T07:01:41.029Z' }), '2026-11-10');
  // Missing evidence collection time falls back to the enclosing result timestamp.
  assert.equal(evidenceAvailableDate({ date: '2023-10-24', collectedAt: '' }, '2026-11-10T07:01:31.230Z'), '2026-11-10');
  // No defensible availability date: excluded.
  assert.equal(evidenceAvailableDate({ date: '2023-10-24', collectedAt: '' }), null);
  assert.equal(evidenceAvailableDate({ date: '2023-10-24', collectedAt: 'not a date' }, 'also bad'), null);

  const claim = {
    id: 'c1', text: 'x', type: '버전', relation: SUPPORT, fix: null,
    evidence: [
      { id: 'fallback', origin: ORIGIN_EXTERNAL, url: 'https://a.example/', stance: SUPPORT, citationOk: true, date: '2024-01-01', collectedAt: '' },
      { id: 'unknown', origin: ORIGIN_EXTERNAL, url: 'https://b.example/', stance: REFUTE, citationOk: true, date: '2024-01-01', collectedAt: '' },
    ],
  };
  const withFallback = (evalDate) => evaluateClaim({ ...claim, evidence: [claim.evidence[0]] }, { evalDate, cycles: DEFAULT_CYCLES, authoredDate: '2023-12-01', resultCollectedAt: '2024-06-01T00:00:00Z' });
  assert.deepEqual(withFallback('2024-05-31').evidence, []);
  assert.deepEqual(withFallback('2024-06-01').evidence.map((e) => e.id), ['fallback']);
  const noFallback = evaluateClaim(claim, { evalDate: '2030-01-01', cycles: DEFAULT_CYCLES, authoredDate: '2023-12-01' });
  assert.deepEqual(noFallback.evidence, []);
  assert.equal(noFallback.hiddenEvidenceCount, 2);
  assert.equal(noFallback.relation, INSUFFICIENT);
});

test('saved fix suggestion is hidden before its generation date and when that date is unknown', () => {
  const result = normalizeResult(FIXTURES[0]);
  const fixText = 'Node.js 20 has an End of Life date of April 30, 2026.';
  const viewAt = (evalDate) => computeView(result, { evalDate, cycles: DEFAULT_CYCLES, today: '2026-11-10' });
  const current = viewAt('2026-11-10');
  assert.equal(current.claims[0].fixStatus, 'visible');
  assert.ok(renderResult(result, current).claims.includes(fixText));
  for (const evalDate of ['2024-10-21', '2024-10-22']) {
    const v = viewAt(evalDate);
    assert.equal(v.claims[0].fixStatus, 'later', evalDate);
    assert.equal(v.claims[0].fix, null, evalDate);
    const html = renderResult(result, v).claims;
    assert.ok(!html.includes(fixText), evalDate);
    assert.match(html, /Saved fix suggestion hidden: it was generated on 2026-11-10/);
  }
  const unknown = normalizeResult({ authoredDate: '2025-01-01', mode: 'fixture', claims: [{ id: 'c1', text: 'x', relation: 'insufficient', fix: 'Saved rewrite', evidence: [] }] });
  const uv = computeView(unknown, { evalDate: '2026-11-10', cycles: DEFAULT_CYCLES, today: '2026-11-10' });
  assert.equal(uv.claims[0].fixStatus, 'unknown');
  const uhtml = renderResult(unknown, uv).claims;
  assert.ok(!uhtml.includes('Saved rewrite'));
  assert.match(uhtml, /generation date is unknown/);
});

test('exact stale sample text replays the recorded run; edited text does not', () => {
  const fixtures = FIXTURES.map(normalizeResult);
  const answer = 'Node.js 20.x is currently in Active LTS.';
  const hit = matchFixture(answer, fixtures);
  assert.equal(hit, fixtures[0]);
  assert.equal(hit.mode, 'recorded-live');
  assert.equal(matchFixture(answer + ' It is supported.', fixtures), null);
});

test('recorded stale sample is replay-only and displays English labels', () => {
  const result = normalizeResult(FIXTURES[0]);
  const view = computeView(result, { evalDate: '2026-11-10', cycles: DEFAULT_CYCLES, today: '2026-11-10' });
  const html = renderResult(result, view);
  assert.match(html.meta, /Real Bifrost run output/);
  assert.match(html.meta, /no new external calls during replay/);
  assert.match(html.meta, /Recorded live sample/);
  assert.match(html.claims, /Refuted/);
  assert.match(html.claims, /Citation check passed/);
  assert.doesNotMatch(html.claims + html.summary + html.timeline, /지지|반박|근거 부족|날짜 불명|날짜 확인/);
  assert.match(selectNote(result), /stored output from a real Bifrost run/);
  assert.match(selectNote(result), /makes no new external API calls/);
  assert.match(replayNote(result), /This replay made no external API calls/);
  const fixture = normalizeResult(NODE);
  assert.match(renderResult(fixture, computeView(fixture, { evalDate: '2026-11-10', cycles: DEFAULT_CYCLES, today: '2026-11-10' })).meta, /Fixed example · no external API calls/);
  assert.match(selectNote(fixture), /Fixed example/);
  // An exact-match fixed example is human-labeled data, never presented as AI output or a live analysis.
  assert.match(replayNote(fixture), /not AI output/);
  assert.match(replayNote(fixture), /no live analysis ran/);
});

test('changing eval date and cycle updates score and ICS', () => {
  // Fixture evidence was collected 2026-11-09, so it is only visible from then on.
  const f = normalizeResult(NODE);
  const cycles1 = { ...DEFAULT_CYCLES, '안정 사실': 3650 };
  const v1 = computeView(f, { evalDate: '2026-11-09', cycles: cycles1, today: '2026-11-10' });
  const cycles2 = { ...DEFAULT_CYCLES };
  const v2 = computeView(f, { evalDate: '2026-11-10', cycles: cycles2, today: '2026-11-10' });
  assert.equal(v1.claims[1].relation, SUPPORT);
  assert.notEqual(v1.claims[1].score.total, v2.claims[1].score.total);
  assert.notEqual(v1.claims[1].recheckDate, v2.claims[1].recheckDate);
  const stamp = '20261110T000000Z';
  assert.notEqual(buildIcs(f, v1, stamp), buildIcs(f, v2, stamp));
});

test('undated EOL evidence is not backdated from Last updated or before collection', () => {
  const result = normalizeResult(NODE);
  const claim = result.claims[0];
  const opts = (evalDate) => ({ evalDate, cycles: DEFAULT_CYCLES, authoredDate: result.authoredDate, resultCollectedAt: result.collectedAt });
  const before = evaluateClaim(claim, opts('2024-02-01'));
  const atPageUpdate = evaluateClaim(claim, opts('2026-03-24'));
  const atCollection = evaluateClaim(claim, opts('2026-11-09'));
  const current = evaluateClaim(claim, opts('2026-11-10'));
  // All fixture evidence was collected 2026-11-09: nothing is visible earlier, even the 2023-10-24 announcement.
  assert.equal(before.relation, INSUFFICIENT);
  assert.deepEqual(before.evidence, []);
  assert.equal(atPageUpdate.relation, INSUFFICIENT);
  assert.deepEqual(atPageUpdate.evidence, []);
  assert.deepEqual(atCollection.evidence.map((e) => e.id), ['e0', 'e1']);
  assert.equal(current.independentSources, 0);
  assert.equal(current.relation, REFUTE);
  assert.ok(current.evidence.some((e) => e.id === 'e1'));
  assert.equal(current.latestDate, null);
  assert.equal(current.dateStatus, '날짜 불명');
  assert.equal(current.score.U, 10);
  assert.ok(current.anchorElapsedDays >= 0);
  assert.equal(normalizeResult(NODE).claims[0].evidence.find((e) => e.id === 'e1').date, null);
  assert.equal(normalizeResult(NODE).claims[1].evidence[0].date, '2023-10-24');
  assert.equal(normalizeResult(NODE).claims[2].relation, SUPPORT);
});
