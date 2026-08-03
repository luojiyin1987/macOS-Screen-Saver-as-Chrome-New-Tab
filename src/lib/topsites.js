// Chrome's topSites API only exists inside the extension. The website
// build falls back to a user-editable list (localStorage-backed, seeded
// with curated defaults) — same panel, no history permission to ask
// for.

import { cache } from './storage.js';

const WEB_SITES_KEY = 'webTopSites';

const WEB_DEFAULT_TOP_SITES = [
  { url: 'https://www.youtube.com', title: 'YouTube' },
  { url: 'https://mail.google.com', title: 'Gmail' },
  { url: 'https://github.com', title: 'GitHub' },
  { url: 'https://www.reddit.com', title: 'Reddit' },
  { url: 'https://x.com', title: 'X' },
  { url: 'https://en.wikipedia.org', title: 'Wikipedia' },
  { url: 'https://chatgpt.com', title: 'ChatGPT' },
  { url: 'https://www.google.com/maps', title: 'Google Maps' },
];

// Real extensions expose chrome.runtime.id; the web shim deliberately
// doesn't, so this stays false outside the extension.
function isExtension() {
  return typeof chrome !== 'undefined' && chrome.runtime?.id != null;
}

export async function getTopSites() {
  if (isExtension() && chrome.topSites?.get) {
    try {
      const sites = await chrome.topSites.get();
      return sites.map((s) => ({
        url: s.url,
        title: s.title || hostnameOf(s.url),
      }));
    } catch (e) {
      console.warn('chrome.topSites.get failed:', e);
      return [];
    }
  }
  return getWebTopSites();
}

async function getWebTopSites() {
  const stored = await cache.get(WEB_SITES_KEY);
  if (stored !== undefined) return stored;
  await cache.set(WEB_SITES_KEY, WEB_DEFAULT_TOP_SITES);
  return [...WEB_DEFAULT_TOP_SITES];
}

/** Web-only: add a site to the list. Returns the updated list. */
export async function addTopSite(url) {
  const list = await getWebTopSites();
  const entry = { url, title: hostnameOf(url) };
  if (!list.some((s) => s.url === url)) list.push(entry);
  await cache.set(WEB_SITES_KEY, list);
  return list;
}

/** Web-only: remove a site from the list. Returns the updated list. */
export async function removeTopSite(url) {
  const list = (await getWebTopSites()).filter((s) => s.url !== url);
  await cache.set(WEB_SITES_KEY, list);
  return list;
}

/** True when the panel should show the edit controls (website build). */
export function isWebTopSites() {
  return !isExtension();
}

export function faviconUrlFor(pageUrl, size = 32) {
  // In the extension, Chrome's built-in favicon cache (no network).
  // On the website, Google's public favicon service keyed by hostname.
  if (isExtension() && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(
      `_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`,
    );
  }
  const host = hostnameOf(pageUrl);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
