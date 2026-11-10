// Static check: the page must work when hosted under a sub-path such as /claimclock/ on GitHub Pages.
// Root-absolute asset URLs or fetches ("/x") would resolve to the domain root and break there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('index.html references assets with relative paths only', () => {
  const html = read('public/index.html');
  const refs = [...html.matchAll(/\b(?:href|src)="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(refs.length > 0);
  for (const ref of refs) {
    if (ref.startsWith('#') || /^https?:\/\//.test(ref)) continue;
    assert.ok(!ref.startsWith('/'), `root-absolute reference: ${ref}`);
  }
});

test('app.js fetches and imports use relative paths only', () => {
  const js = read('public/app.js');
  const targets = [
    ...[...js.matchAll(/fetch\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]),
    ...[...js.matchAll(/^import .* from ['"]([^'"]+)['"]/gm)].map((m) => m[1]),
  ];
  assert.ok(targets.length > 0);
  for (const t of targets) assert.ok(t.startsWith('./'), `non-relative path: ${t}`);
});

test('relative fetch targets resolve under the /claimclock/ base path', () => {
  const base = 'https://coo001.github.io/claimclock/';
  assert.equal(new URL('./live-run.json', base).pathname, '/claimclock/live-run.json');
  assert.equal(new URL('./api/status', base).pathname, '/claimclock/api/status');
  assert.equal(new URL('./lib/fixtures.js', base).pathname, '/claimclock/lib/fixtures.js');
});

test('static hosting without a backend says no live analysis is possible and how to get it', () => {
  const js = read('public/app.js');
  // Pages returns a non-JSON 404 for ./api/status; that path must not fall through to /api/verify.
  assert.match(js, /if \(!status\) \{[\s\S]*?No live analysis is possible on this page[\s\S]*?local install and your own API keys[\s\S]*?return;/);
  assert.match(js, /typeof body\.liveReady === 'boolean'/);
});
