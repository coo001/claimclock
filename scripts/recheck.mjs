import fs from 'node:fs/promises';
import { parseQueue, recheckQueue } from '../lib/queue.js';
import { DEFAULT_CYCLES } from '../lib/scoring.js';

const input = process.argv[2];
if (!input || input.startsWith('-')) {
  console.error('Usage: npm run recheck -- <exported-queue.json> [YYYY-MM-DD]');
  process.exitCode = 2;
} else {
  const evalDate = process.argv[3] || new Date().toISOString().slice(0, 10);
  const parsed = parseQueue(await fs.readFile(input, 'utf8'));
  const rows = recheckQueue(parsed.queue, { evalDate, cycles: DEFAULT_CYCLES, today: evalDate });
  console.log(JSON.stringify({ evalDate, mode: 'saved-evidence-only; no network or model calls', count: rows.length, warning: parsed.error, records: rows }, null, 2));
}
