import fs from 'node:fs/promises';
await fs.rm('dist', { recursive: true, force: true });
await fs.cp('public', 'dist', { recursive: true });
await fs.cp('lib', 'dist/lib', { recursive: true });
// The browser imports lib/queue.js (batch queue); fail the build if it was not copied.
await fs.access('dist/lib/queue.js');
console.log('Static site built in dist/');
