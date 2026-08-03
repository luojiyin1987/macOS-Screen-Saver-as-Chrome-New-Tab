// Cloudflare Pages Functions port of cloudflare-worker/worker.js — the
// sylvan.apple.com reverse proxy for aerial videos. Pages Functions run
// on the website's own origin, so the web build needs no VITE_MACIFY_BASE.
//
// Differences from the standalone Worker:
//   - Authentication: the standalone Worker relies on an edge WAF rule
//     for the ?k= token. Pages Functions have no WAF hook here, so the
//     token check moves into this file when APPLE_PROXY_KEY is set.
//   - Everything else (sanitize + forward) is identical: only media
//     methods/paths, scrubbed request and response headers.
//
//  1. Method must be one of GET / HEAD / OPTIONS.
//  2. Path must start with /itunes-assets/ (Apple's aerial asset
//     prefix). This Function can't be turned into an open Apple proxy
//     for arbitrary paths.
//  3. Request headers are scrubbed — only media-relevant ones are
//     forwarded. Authorization / Cookie / X-* never reach Apple.
//  4. Response headers are scrubbed too — Set-Cookie and Apple internal
//     X-Apple-* tracing headers are dropped.

const APPLE_HOST = 'https://sylvan.apple.com';
const ALLOWED_PATH_PREFIX = '/itunes-assets/';
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const FORWARDED_REQUEST_HEADERS = new Set([
  'range',
  'accept',
  'accept-encoding',
  'accept-language',
  'user-agent',
]);

const FORWARDED_RESPONSE_HEADERS = new Set([
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'cache-control',
  'etag',
  'last-modified',
  'expires',
  'age',
]);

const CORS_HEADERS = {
  // <video> playback doesn't actually consult CORS, but be permissive
  // anyway so a future fetch()-based code path Just Works. The token
  // (when enabled) is validated above so '*' is safe here.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range',
  'Access-Control-Expose-Headers':
    'Content-Length, Content-Range, Accept-Ranges',
  'Access-Control-Max-Age': '86400',
};

function pickHeaders(source, allowed) {
  const out = new Headers();
  for (const [name, value] of source) {
    if (allowed.has(name.toLowerCase())) out.set(name, value);
  }
  return out;
}

function deny(status, body) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain', ...CORS_HEADERS },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!ALLOWED_METHODS.has(request.method)) {
    return deny(405, 'Method not allowed');
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (!url.pathname.startsWith(ALLOWED_PATH_PREFIX)) {
    return deny(404, 'Not found');
  }

  // Optional anti-abuse token, mirroring the WAF rule documented for
  // the standalone Worker. Set the APPLE_PROXY_KEY secret in Pages
  // settings; the web build then sends ?k=<token> on every request.
  const expectedKey = env?.APPLE_PROXY_KEY;
  if (expectedKey && url.searchParams.get('k') !== expectedKey) {
    return deny(403, 'Forbidden');
  }

  // Strip query params before forwarding. Apple's CDN doesn't need
  // them and including them would just leak the token into Apple's
  // request logs.
  const targetUrl = `${APPLE_HOST}${url.pathname}`;

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method: request.method,
      headers: pickHeaders(request.headers, FORWARDED_REQUEST_HEADERS),
      // Don't auto-follow redirects — sylvan shouldn't 3xx for aerial
      // assets, and silently landing somewhere else hides bugs.
      redirect: 'manual',
    });
  } catch (e) {
    return deny(502, `Upstream fetch failed: ${e.message}`);
  }

  const headers = pickHeaders(upstream.headers, FORWARDED_RESPONSE_HEADERS);
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    headers.set(name, value);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
