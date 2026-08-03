// Chrome's topSites API only exists inside the extension. The website
// build falls back to a curated default list — same panel, no history
// permission to ask for.

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

export async function getTopSites() {
  if (typeof chrome !== 'undefined' && chrome.topSites?.get) {
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
  return WEB_DEFAULT_TOP_SITES.map((s) => ({ ...s }));
}

export function faviconUrlFor(pageUrl, size = 32) {
  // In the extension, Chrome's built-in favicon cache (no network).
  // On the website, Google's public favicon service keyed by hostname.
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
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
