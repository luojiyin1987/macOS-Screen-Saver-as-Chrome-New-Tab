// Package the whole project (source, docs, music) into a zip.
//
// Excludes what can be regenerated (node_modules, build outputs) and
// what is private (.git, .env secrets). Includes web-assets/music/,
// which is gitignored and therefore absent from `git archive`.
//
// Output: releases/macify-project-v<version>.zip

import { readFile, mkdir, rm } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const releasesDir = resolve(root, 'releases');

const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const out = resolve(releasesDir, `macify-project-v${pkg.version}.zip`);

await mkdir(releasesDir, { recursive: true });
await rm(out, { force: true });

const excludes = [
  'node_modules/*',
  '.git/*',
  '.codegraph/*',
  'dist/*',
  'dist-web/*',
  'releases/*',
  '.env',
  '.env.local',
  '*.zip',
];

const args = excludes.map((p) => `-x "${p}"`).join(' ');
execSync(`cd "${root}" && zip -r "${out}" . ${args}`, { stdio: 'inherit' });
console.log(`\nWrote ${out}`);
