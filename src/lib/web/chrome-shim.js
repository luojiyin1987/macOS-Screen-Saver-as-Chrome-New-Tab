// Web-mode shim for the subset of chrome.* APIs Macify uses.
//
// The Chrome extension and the Cloudflare-hosted website share the same
// Svelte source. This module installs a `chrome` global so the shared
// code runs unchanged in a plain browser tab.
//
// Only loaded when VITE_WEB_BUILD=true (see .env.web). The extension
// build never imports it.
//
// Mapping:
//   chrome.storage.sync/local  -> localStorage  (area-prefixed keys)
//   chrome.storage.session     -> localStorage  (shared across tabs)
//   chrome.storage.onChanged   -> same-tab events + native `storage`
//                                 events for cross-tab sync
//   chrome.i18n.getUILanguage  -> navigator.language
//   chrome.runtime.getManifest -> version read from package.json
//   chrome.runtime.getURL      -> path on this origin
//   chrome.runtime.openOptionsPage -> /options
//   chrome.tabs.create         -> window.open
//   chrome.idle                -> no-op; the page wires visibilitychange
//                                 to zen-tracking itself

import pkg from '../../../package.json' with { type: 'json' };
import { beginAway, endAway } from '../zen-tracking.js';

const IS_WEB_BUILD = import.meta.env.VITE_WEB_BUILD === 'true';

const AREA_PREFIX = {
  sync: 'macify:sync:',
  local: 'macify:local:',
  session: 'macify:session:',
};

function areaFor(key) {
  for (const [area, prefix] of Object.entries(AREA_PREFIX)) {
    if (key.startsWith(prefix)) return area;
  }
  return null;
}

function parseJSON(raw) {
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function installShim() {
  if (typeof globalThis.chrome !== 'undefined') return;

  const listeners = { sync: new Set(), local: new Set(), session: new Set() };

  function emit(area, changes) {
    for (const fn of listeners[area]) {
      try {
        fn(changes, area);
      } catch {
        // best-effort, same as the extension API
      }
    }
  }

  function makeArea(area) {
    const prefix = AREA_PREFIX[area];
    return {
      async get(keys) {
        const list = Array.isArray(keys) ? keys : [keys];
        const out = {};
        for (const key of list) {
          const value = parseJSON(localStorage.getItem(prefix + key));
          if (value !== undefined) out[key] = value;
        }
        return out;
      },
      async set(items) {
        const changes = {};
        for (const [key, value] of Object.entries(items)) {
          const oldValue = parseJSON(localStorage.getItem(prefix + key));
          localStorage.setItem(prefix + key, JSON.stringify(value));
          changes[key] = { newValue: value, oldValue };
        }
        emit(area, changes);
      },
      async remove(keys) {
        const changes = {};
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          const oldValue = parseJSON(localStorage.getItem(prefix + key));
          if (oldValue === undefined) continue;
          localStorage.removeItem(prefix + key);
          changes[key] = { newValue: undefined, oldValue };
        }
        emit(area, changes);
      },
      onChanged: {
        addListener(fn) {
          listeners[area].add(fn);
        },
        removeListener(fn) {
          listeners[area].delete(fn);
        },
      },
    };
  }

  // Native `storage` events fire in OTHER tabs on this origin. They
  // carry the raw prefixed key, so we can route them to the right area
  // and unwrap the JSON.
  window.addEventListener('storage', (e) => {
    if (!e.key) return;
    const area = areaFor(e.key);
    if (!area) return;
    const key = e.key.slice(AREA_PREFIX[area].length);
    emit(area, {
      [key]: { newValue: parseJSON(e.newValue), oldValue: parseJSON(e.oldValue) },
    });
  });

  globalThis.chrome = {
    storage: {
      sync: makeArea('sync'),
      local: makeArea('local'),
      session: makeArea('session'),
    },
    i18n: {
      getUILanguage: () => navigator.language ?? 'en',
    },
    runtime: {
      getManifest: () => ({
        name: 'Macify',
        version: pkg.version.replace(/-dev$/, ''),
      }),
      getURL: (path) => {
        if (path === 'options/index.html') return '/options';
        return `/${path}`;
      },
      openOptionsPage: () => {
        window.open('/options', '_blank', 'noopener,noreferrer');
      },
    },
    tabs: {
      create: ({ url }) => {
        window.open(url, '_blank', 'noopener,noreferrer');
      },
    },
    idle: {
      setDetectionInterval() {},
      onStateChanged: { addListener() {} },
    },
  };

  // Replaces background.js's install-time stamping. The extension has
  // a service worker that stamps `installedAt` once; the website does
  // it on first visit so the donate pill has an age anchor.
  void (async () => {
    const { installedAt } = await globalThis.chrome.storage.local.get('installedAt');
    if (installedAt) return;
    await globalThis.chrome.storage.local.set({ installedAt: Date.now() });
    await globalThis.chrome.storage.local.remove([
      'lastDonatePromptAt',
      'donateSponsored',
    ]);
  })();

  // The extension detects idle via chrome.idle in its background
  // worker. A website can't, so a hidden tab is treated as away —
  // zen-tracking then pauses the active-time accumulator.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      beginAway().catch(() => {});
    } else {
      endAway().catch(() => {});
    }
  });
}

if (IS_WEB_BUILD) {
  installShim();
}
