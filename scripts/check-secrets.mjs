// Secret check. Prints only file paths and pattern names, never matched values or file contents.
// Scans only tracked and unignored files that Git could include; ignored local .env is permitted.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PATTERNS = [
  ['google-api-key', /AIza[0-9A-Za-z_-]{35}/],
  ['tavily-key', /tvly-[0-9A-Za-z_-]{20,}/],
  ['openai-style-key', /sk-[0-9A-Za-z_-]{20,}/],
  ['github-token', /gh[pousr]_[0-9A-Za-z]{30,}/],
  ['aws-access-key', /AKIA[0-9A-Z]{16}/],
  ['slack-token', /xox[abpr]-[0-9A-Za-z-]{10,}/],
  ['private-key-block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['filled-env-secret', /^[ \t]*[A-Z0-9_]*(API_KEY|TOKEN|SECRET)[ \t]*=[ \t]*[^\s#]{8,}/m],
];
const problems = [];
const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '.'], {
  cwd: ROOT, encoding: 'utf8',
}).split('\0').filter(Boolean);
for (const rel of files) {
  if (/^\.env(\..+)?$/.test(path.basename(rel)) && path.basename(rel) !== '.env.example') {
    problems.push(`${rel}: real env file would be included`);
  }
  let text;
  try { text = readFileSync(path.join(ROOT, rel), 'utf8'); } catch { continue; }
  for (const [name, re] of PATTERNS) if (re.test(text)) problems.push(`${rel}: matches ${name}`);
}
if (problems.length) {
  console.error(`check:secrets FAILED (${problems.length})`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(`check:secrets OK (${files.length} files scanned, no commit-visible .env)`);
