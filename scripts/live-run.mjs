import fs from 'node:fs/promises';
import path from 'node:path';
import { runLive } from '../lib/live.js';
import { FIXTURES } from '../lib/fixtures.js';

const required = ['GEMINI_API_KEY', 'TAVILY_API_KEY', 'BIFROST_BASE_URL', 'GEMINI_MODEL'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`실행 중단: ${missing.join(', ')} 미설정. build/.env에 값을 설정하고 로컬 Bifrost를 시작한 뒤 다시 실행하세요.`);
  process.exitCode = 2;
} else {
  const fixture = FIXTURES[0];
  const answer = "Node.js 20.x remains in Active LTS through October 2024.";
  const startedAt = new Date().toISOString();
  const result = await runLive({ text: answer, authoredDate: fixture.authoredDate, env: process.env });
  const canonical = fixture.claims;
  const humanLabels = result.claims.map((claim) => {
    const match = canonical.find((c) => c.text.toLowerCase().includes('active lts') && claim.text.toLowerCase().includes('active lts'));
    return match ? { claimId: claim.id, claimText: claim.text, label: '반박', labelSource: '사람이 수동 지정한 공식 Node.js 릴리스 표 검토', evidenceUrl: 'https://nodejs.org/en/about/previous-releases' } : null;
  }).filter(Boolean);
  const comparisons = humanLabels.map((h) => ({ ...h, modelRelation: result.claims.find((c) => c.id === h.claimId)?.relation ?? '근거 부족' }));
  const matched = comparisons.filter((c) => c.label === c.modelRelation).length;
  const safe = {
    schemaVersion: 1,
    mode: 'recorded-live',
    actualExternalRun: result.runLog.externalCalls,
    startedAt,
    finishedAt: new Date().toISOString(),
    input: { title: 'Node.js 20.9.0 릴리스 문구', authoredDate: fixture.authoredDate, answerText: answer },
    result,
    humanAgreement: { comparisons, matched, total: comparisons.length, accuracy: comparisons.length ? matched / comparisons.length : null },
  };
  const redact = (value) => {
    if (typeof value === 'string') return required.map((k) => process.env[k]).filter(Boolean).reduce((s, secret) => s.split(secret).join('[REDACTED]'), value);
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v)]));
    return value;
  };
  const out = path.resolve('public/live-run.json');
  await fs.writeFile(out, JSON.stringify(redact(safe), null, 2) + '\n', { mode: 0o644 });
  console.log(`실행 기록 저장: ${path.relative(process.cwd(), out)} · Tavily ${result.runLog.counts.tavily}회 · Gemini ${result.runLog.counts.gemini}회 · 비교 ${matched}/${comparisons.length}`);
}
