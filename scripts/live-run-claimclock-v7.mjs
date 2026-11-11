import fs from 'node:fs/promises';
import { runLive } from '../lib/live.js';

const text = 'Deno 2.0 reached its stable release on October 9, 2024.';
const env = { ...process.env };
if (!env.BIFROST_VIRTUAL_KEY || !env.BIFROST_BASE_URL || !env.TAVILY_API_KEY || !env.GEMINI_MODEL) throw new Error('Local Bifrost virtual-key configuration is incomplete.');
const startedAt = new Date().toISOString();
const result = await runLive({ text, authoredDate: '2024-10-09', env });
if (result.runLog.counts.tavily > 3) throw new Error('Tavily call limit exceeded.');
const record = {
  schemaVersion: 1,
  mode: 'recorded-live',
  actualExternalRun: result.runLog.externalCalls === true,
  executionPath: 'Tavily basic search + Gemini through local Bifrost virtual key',
  startedAt,
  finishedAt: new Date().toISOString(),
  input: { title: 'Deno 2.0 release claim (new live analysis)', authoredDate: '2024-10-09', answerText: text },
  result,
};
const serialized = JSON.stringify(record);
for (const secretName of ['GEMINI_API_KEY', 'TAVILY_API_KEY', 'BIFROST_VIRTUAL_KEY']) if (env[secretName] && serialized.includes(env[secretName])) throw new Error('Secret redaction check failed.');
await fs.writeFile(new URL('../public/live-run-deno-bifrost.json', import.meta.url), JSON.stringify(record, null, 2) + '\n', { mode: 0o644 });
console.log(JSON.stringify({ actualExternalRun: record.actualExternalRun, tavily: result.runLog.counts.tavily, gemini: result.runLog.counts.gemini, claims: result.claims.map(({ text, relation }) => ({ text, relation })), errors: result.runLog.errors }));
