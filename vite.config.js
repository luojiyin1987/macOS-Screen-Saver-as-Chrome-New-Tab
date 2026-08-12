import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { crx } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import Icons from 'unplugin-icons/vite';
import manifest from './src/manifest.config.js';

// Two build targets share this config:
//
//   pnpm run build      -> Chrome extension (crx), output to dist/
//   pnpm run build:web  -> website for Cloudflare Pages, output to dist-web/
//
// `--mode web` loads .env.web, which sets VITE_WEB_BUILD=true. The
// extension build requires VITE_MACIFY_BASE (video proxy host); the
// website build defaults it to the site's own origin at runtime, so a
// Pages deployment needs no per-deploy env at all.

const REQUIRED_ENV = ['VITE_MACIFY_BASE'];

export default defineConfig(({ mode }) => {
  // loadEnv() resolves its envDir argument relative to process.cwd(),
  // which is already the project root when invoked via `pnpm run build`.
  // The vite `envDir` config is resolved relative to vite's `root`
  // (= 'src'), so '..' points to the same project root.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const isWeb = env.VITE_WEB_BUILD === 'true';
  const siteUrl = (env.VITE_SITE_URL || 'https://macify-web.pages.dev').replace(
    /\/$/,
    '',
  );

  if (!isWeb) {
    const missing = REQUIRED_ENV.filter((k) => !env[k] || !env[k].trim());
    if (missing.length > 0) {
      throw new Error(
        `\n\nMissing required env var(s): ${missing.join(', ')}\n` +
          `Set them in .env (or .env.local). See .env.example for what each one is for.\n`,
      );
    }
  }

  const commonPlugins = [
    {
      name: 'macify-site-url',
      transformIndexHtml: (html) => html.replaceAll('__MACIFY_SITE_URL__', siteUrl),
    },
    tailwindcss(),
    svelte(),
    Icons({ compiler: 'svelte' }),
  ];

  return {
    root: 'src',
    envDir: '..',
    publicDir: false,
    plugins: isWeb ? commonPlugins : [...commonPlugins, crx({ manifest })],
    build: isWeb
      ? {
          outDir: '../dist-web',
          emptyOutDir: true,
          rollupOptions: {
            input: {
              // Main new-tab page at the site root, settings at /options.html
              index: resolve(process.cwd(), 'src/popup/index.html'),
              options: resolve(process.cwd(), 'src/options/index.html'),
            },
          },
        }
      : {
          outDir: '../dist',
          emptyOutDir: true,
        },
    server: isWeb
      ? {
          // Local stand-in for the Pages function that proxies
          // sylvan.apple.com. Only used when the Apple proxy is enabled.
          proxy: {
            '/itunes-assets': {
              target: 'https://sylvan.apple.com',
              changeOrigin: true,
            },
          },
        }
      : undefined,
  };
});
