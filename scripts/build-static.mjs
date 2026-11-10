import fs from 'node:fs/promises';
await fs.rm('dist', { recursive: true, force: true });
await fs.cp('public', 'dist', { recursive: true });
await fs.cp('lib', 'dist/lib', { recursive: true });
console.log('Static site built in dist/');
