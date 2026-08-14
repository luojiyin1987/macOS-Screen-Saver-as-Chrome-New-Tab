# Macify — macOS Aerial Screensavers in Chrome's New Tab

![GitHub Repo stars](https://img.shields.io/github/stars/jason5ng32/macOS-Screen-Saver-as-Chrome-New-Tab)
![GitHub](https://img.shields.io/github/license/jason5ng32/macOS-Screen-Saver-as-Chrome-New-Tab)
![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/lgdipcalomggcjkohjhkhkbcpgladnoe)
![GitHub contributors](https://img.shields.io/github/contributors/jason5ng32/macOS-Screen-Saver-as-Chrome-New-Tab)

Replace Chrome's new tab page with macOS's aerial screensaver videos and a small set of calm, optional widgets. macOS is **not** required — videos are streamed from Apple's CDN and play in any platform that runs Chrome.

![screenshot](docs/screenshot.png)

## Features

- 🎥 **156 aerial videos** in 4K SDR, sourced from Apple's current macOS catalog (Landscapes, Cities, Underwater, Space, and more).
- 🌤️ **Live weather** — current temperature, "feels like", 3-day forecast, sunrise/sunset, UV, wind, air quality. Powered by [Open-Meteo](https://open-meteo.com/), no API key required.
- 📌 **Top sites** widget pulled from Chrome's built-in list (no history permission needed).
- 💬 **Random quotes** from a curated 500-entry public-domain set.
- 🧘 **Zen mode** — fullscreen the video with optional ambient music.
- 🔤 **4 languages** — English, 简体中文, 繁體中文, 日本語.

## Install

[Install from Chrome Web Store](https://chromewebstore.google.com/detail/macify-macos-screensaver/lgdipcalomggcjkohjhkhkbcpgladnoe).

Building from source or contributing? See [DEVELOPMENT.md](DEVELOPMENT.md).

## Run it as a website (Cloudflare Pages)

Macify also ships as a regular website — the same new-tab page and settings, no Chrome extension required. Host it on Cloudflare Pages with one command:

```bash
pnpm install
pnpm run deploy:web
```

The first run logs you into Cloudflare and asks for a project name (default `macify-web`). The script builds `dist-web/` and uploads it; the site then lives at `<project>.pages.dev`.

**Note about Chrome's new tab.** A website can't replace Chrome's new tab page — that override is an extension-only capability. The website is the same page you'd get, open it as a bookmark, as your homepage, or via a new-tab redirect extension. To keep the true new-tab replacement, the Chrome Web Store build is the way.

**Stable URL.** `wrangler pages deploy` also prints a `<hash>.<project>.pages.dev` link. That is a preview deployment (usable for a while, not the canonical URL) — share `macify-web.pages.dev` or a custom domain instead.

What the deploy includes:

- The new-tab page at `/`, settings at `/options` (Cloudflare Pages auto-redirects `/options.html` to `/options`; no config needed).
- A Pages Function at `/itunes-assets/*` that reverse-proxies Apple's aerial CDN, so videos play even where Apple's certificate isn't trusted (same role the extension's hosted Worker plays).
- Optional zen-mode music: put 40 ambient files named `music00001.mp3` … `music00040.mp3` in `web-assets/music/` before building. The build copies them into the deploy as static assets (served at `/music/*`, free and unlimited). Each file must stay under Cloudflare's 25 MiB per-file limit — re-encode with `ffmpeg -i in.mp3 -codec:a libmp3lame -b:a 96k out.mp3` if larger.
- Optional anti-abuse token: set `APPLE_PROXY_KEY` as a Pages secret AND the same value as `VITE_APPLE_PROXY_KEY` in `.env.web` before building. Mismatched values = every video request returns 403. The token is inlined in the public bundle, so it only stops casual abuse — for real protection add WAF rules and rate limiting on a custom domain.

Differences from the extension:

| | Extension | Website |
|---|---|---|
| Top Sites | Chrome's real most-visited list | Editable list, seeded with curated defaults (websites can't read browsing history) |
| Settings storage | `chrome.storage.sync` (per-account sync) | localStorage (per-browser) |
| Zen break reminder | Tracks idle via `chrome.idle` | Tracks only while the tab is visible |

## Choosing a video source

Two options. Each has a built-in step-by-step guide inside Macify's settings page; this section just summarises.

### 1. Apple Server (default — zero setup)

Streams directly from `sylvan.apple.com`. Chrome may not trust Apple's certificate by default. Macify fails over silently between the proxy and the direct route, and degrades to a still frame if both fail — most users never see an error. Two manual fixes remain for a permanent setup:

**Option A — Reverse proxy (default on, easiest).** Video requests are routed through a hosted Cloudflare Worker that handles the certificate dance. Zero local setup. Convenient but should not be relied on long-term — set up local hosting or trust the cert when possible.

**Option B — Trust Apple's cert manually (cleanest).** Visit [https://sylvan.apple.com](https://sylvan.apple.com) once in Chrome. You'll see a security warning — click "Advanced", then "Proceed to sylvan.apple.com (unsafe)". Chrome remembers the trust and direct connection works thereafter.

![Chrome warning when trusting sylvan.apple.com](docs/chromewarnning.jpg)

### 2. Local server (recommended for macOS users)

Best performance, zero third-party dependency. **One command** configures macOS's built-in Apache to serve your local Aerial videos at `http://localhost:18000/videos/`:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/jason5ng32/Macify/main/scripts/local-server/setup.sh)
```

Asks for your password once (sudo). Then in Macify's settings, switch the source to **Local server**.

To uninstall:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/jason5ng32/Macify/main/scripts/local-server/uninstall.sh)
```

The local server needs the videos on disk first. Two ways:

**Through System Settings.** Open System Settings → Screen Saver → Aerial. Click each video you want (each is 500MB–1GB). Tedious for the full 156-video catalog but no extras needed.

![macOS screen saver settings](docs/systempreferrence.jpg)

**One-line batch downloader.** Macify includes a Python downloader that pulls the full Aerial catalog (or a subset) directly from Apple's CDN, with progress bars, resume support, and category/random/limit filters:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/jason5ng32/Macify/main/scripts/aerial_downloader/install.sh)
```

Copy the command, paste it in Terminal, and follow the on-screen prompts. The full catalog is ~80–150 GB; the script reports the estimated size and your free disk space before asking for confirmation, so you can safely back out.

## Permissions

Macify requests these permissions, all non-sensitive:

| Permission | Used for |
|---|---|
| `storage` | Persist user preferences and cache weather data. |
| `topSites` | Read Chrome's most-visited list for the Top Sites widget. |
| `favicon` | Show favicons next to Top Sites entries (uses Chrome's built-in cache; no external network). |
| `idle` | Track when the user is away from the computer to determine showing Zen mode notification or not. |

No `history` permission. No host permissions for arbitrary sites.

## License

MIT. See [LICENSE](LICENSE).

## Credits

Created by Jason Ng, Dofy, Setilis. Aerial videos are © Apple Inc.
