// Flatten the web build output for Cloudflare Pages.
//
// Vite emits each HTML entry under its source directory (dist-web/popup/
// and dist-web/options/). The site wants the new-tab page at the root
// and settings at /options.html. All asset URLs are absolute (/assets/...),
// so moving the HTML files is safe.

import { mkdir, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const OUT = join(process.cwd(), 'dist-web');

const moves = [
  ['popup/index.html', 'index.html'],
  ['options/index.html', 'options.html'],
];

for (const [from, to] of moves) {
  await mkdir(dirname(join(OUT, to)), { recursive: true });
  await rename(join(OUT, from), join(OUT, to));
}

await rm(join(OUT, 'popup'), { recursive: true, force: true });
await rm(join(OUT, 'options'), { recursive: true, force: true });

console.log('postbuild-web: flattened dist-web/');
