import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreClaim, SUPPORT, REFUTE, INSUFFICIENT, computeView, DEFAULT_CYCLES, buildIcs, evaluateClaim } from '../lib/scoring.js';
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
  const historical = evaluateClaim(normalized.claims[0], { evalDate: '2024-02-01', cycles: DEFAULT_CYCLES, authoredDate: normalized.authoredDate });
  const beforeTransition = evaluateClaim(normalized.claims[0], { evalDate: '2024-10-21', cycles: DEFAULT_CYCLES, authoredDate: normalized.authoredDate });
  const atTransition = evaluateClaim(normalized.claims[0], { evalDate: '2024-10-22', cycles: DEFAULT_CYCLES, authoredDate: normalized.authoredDate });
  assert.equal(historical.relation, SUPPORT);
  assert.equal(beforeTransition.relation, SUPPORT);
  assert.equal(atTransition.relation, REFUTE);
  assert.equal(atTransition.latestDate, '2024-10-22');
  assert.ok(atTransition.evidence.some((e) => e.id === 'official-node20-eol'));
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
});

test('changing eval date and cycle updates score and ICS', () => {
  const f = normalizeResult(NODE);
  const cycles1 = { ...DEFAULT_CYCLES };
  const v1 = computeView(f, { evalDate: '2024-02-01', cycles: cycles1, today: '2026-11-09' });
  const cycles2 = { ...DEFAULT_CYCLES, '안정 사실': 7 };
  const v2 = computeView(f, { evalDate: '2024-02-02', cycles: cycles2, today: '2026-11-09' });
  assert.notEqual(v1.claims[1].score.total, v2.claims[1].score.total);
  assert.notEqual(v1.claims[1].recheckDate, v2.claims[1].recheckDate);
  const stamp = '20261109T000000Z';
  assert.notEqual(buildIcs(f, v1, stamp), buildIcs(f, v2, stamp));
});

test('undated EOL evidence is not backdated from Last updated or before collection', () => {
  const result = normalizeResult(NODE);
  const claim = result.claims[0];
  const before = evaluateClaim(claim, { evalDate: '2024-02-01', cycles: DEFAULT_CYCLES, authoredDate: result.authoredDate });
  const atPageUpdate = evaluateClaim(claim, { evalDate: '2026-03-24', cycles: DEFAULT_CYCLES, authoredDate: result.authoredDate });
  const current = evaluateClaim(claim, { evalDate: '2026-11-10', cycles: DEFAULT_CYCLES, authoredDate: result.authoredDate });
  assert.equal(before.relation, SUPPORT);
  assert.deepEqual(before.evidence.map((e) => e.id), ['e0']);
  assert.equal(atPageUpdate.relation, SUPPORT);
  assert.deepEqual(atPageUpdate.evidence.map((e) => e.id), ['e0']);
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
