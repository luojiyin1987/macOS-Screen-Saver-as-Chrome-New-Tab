// Flatten the web build output for Cloudflare Pages, and copy zen-mode
// music into the deploy as static assets.
//
// 1. Vite emits each HTML entry under its source directory
//    (dist-web/popup/ and dist-web/options/). The site wants the
//    new-tab page at the root and settings at /options.html. All asset
//    URLs are absolute (/assets/...), so moving the HTML files is safe.
// 2. Optional music: web-assets/music/*.mp3 is copied to dist-web/music/.
//    Cloudflare Pages serves it directly — no Function, no R2. Per-file
//    limit is 25 MiB; larger files fail the build with a re-encode hint.

import { cp, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const OUT = join(process.cwd(), 'dist-web');
const MUSIC_SOURCE = join(process.cwd(), 'web-assets', 'music');
const MUSIC_TARGET = join(OUT, 'music');

const MAX_MUSIC_FILE_BYTES = 25 * 1024 * 1024; // 25 MiB

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

// Music is optional — skip silently when web-assets/music is absent.
let musicCount = 0;
try {
  await stat(MUSIC_SOURCE);
  await cp(MUSIC_SOURCE, MUSIC_TARGET, { recursive: true });
  const files = await readdir(MUSIC_TARGET);
  musicCount = files.length;

  const tooLarge = [];
  for (const file of files) {
    const entry = await stat(join(MUSIC_TARGET, file));
    if (entry.isFile() && entry.size > MAX_MUSIC_FILE_BYTES) {
      tooLarge.push(`${file} (${(entry.size / 1024 / 1024).toFixed(1)} MiB)`);
    }
  }
  if (tooLarge.length > 0) {
    console.error(
      'Music files exceed the Cloudflare Pages per-file limit of 25 MiB:',
    );
    for (const line of tooLarge) console.error(`  ${line}`);
    console.error(
      'Re-encode at a lower bitrate, e.g.: ffmpeg -i in.mp3 -codec:a libmp3lame -b:a 96k out.mp3',
    );
    console.error(
      'Keep files clearly below the limit (23-24 MiB) for safety.',
    );
    process.exit(1);
  }
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}

if (musicCount > 0) {
  console.log(`postbuild-web: copied ${musicCount} music file(s) to dist-web/music/`);
} else {
  console.log('postbuild-web: no web-assets/music directory — skipping music');
}

console.log('postbuild-web: flattened dist-web/');
