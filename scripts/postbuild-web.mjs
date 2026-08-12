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

import {
  cp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { loadEnv } from 'vite';

const OUT = join(process.cwd(), 'dist-web');
const MUSIC_SOURCE = join(process.cwd(), 'web-assets', 'music');
const MUSIC_TARGET = join(OUT, 'music');
const env = loadEnv('web', process.cwd(), 'VITE_');
const SITE_URL = (
  process.env.VITE_SITE_URL ||
  env.VITE_SITE_URL ||
  'https://macify-web.pages.dev'
).replace(/\/$/, '');

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

await cp(join(process.cwd(), 'src', 'res', 'icon.png'), join(OUT, 'icon.png'));
await cp(
  join(process.cwd(), 'docs', 'social-preview.jpg'),
  join(OUT, 'social-preview.jpg'),
);

await writeFile(
  join(OUT, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
);
await writeFile(
  join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${SITE_URL}/</loc>\n    <changefreq>monthly</changefreq>\n  </url>\n</urlset>\n`,
);

const htmlFiles = ['index.html', 'options.html'];
const scriptHashes = new Set();

for (const file of htmlFiles) {
  const path = join(OUT, file);
  let html = await readFile(path, 'utf8');

  for (const match of html.matchAll(/<script([^>]*?)src="([^"]+)"([^>]*)>/g)) {
    const asset = await readFile(join(OUT, match[2].replace(/^\//, '')));
    const hash = createHash('sha256').update(asset).digest('base64');
    scriptHashes.add(`'sha256-${hash}'`);

    const tag = match[0].replace(
      '<script',
      `<script integrity="sha256-${hash}"`,
    );
    html = html.replace(match[0], tag);
  }

  for (const match of html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )) {
    const hash = createHash('sha256').update(match[1]).digest('base64');
    scriptHashes.add(`'sha256-${hash}'`);
  }

  await writeFile(path, html);
}

const csp = [
  "default-src 'self'",
  `script-src ${[...scriptHashes].join(' ')} 'strict-dynamic'`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "media-src 'self' https: http://localhost:* http://127.0.0.1:*",
  "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

await writeFile(
  join(OUT, '_headers'),
  `/*\n  Content-Security-Policy: ${csp}\n  Permissions-Policy: geolocation=(), microphone=(), camera=()\n  X-Frame-Options: DENY\n`,
);

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
