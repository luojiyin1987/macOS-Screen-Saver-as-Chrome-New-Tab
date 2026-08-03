// Serves zen-mode ambient music from an R2 bucket (binding:
// MUSIC_BUCKET), keyed as music/music00001.mp3 … music/music00040.mp3.
//
// Optional: without the binding every request returns 404 and Zen mode
// simply runs without music — the web app already treats audio failure
// as non-fatal.
//
// Range requests: R2 resolves the Range header itself and reports the
// served span as { offset, length, suffix } on the returned object —
// never `end`. The resolved span is echoed back in Content-Range so
// <audio> seeking and resume work.

const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function onRequest(context) {
  const { request, env } = context;

  if (!ALLOWED_METHODS.has(request.method)) {
    return new Response('Method not allowed', { status: 405 });
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  const bucket = env?.MUSIC_BUCKET;
  if (!bucket) {
    return new Response('Music storage not configured', { status: 404 });
  }

  const url = new URL(request.url);
  const key = url.pathname.slice('/music/'.length);
  if (!key || key.includes('..')) {
    return new Response('Not found', { status: 404 });
  }

  let object;
  try {
    // Pass the full headers when a Range is present — R2 accepts a
    // Headers object and resolves it into offset/length internally.
    object = await bucket.get(key, {
      range: request.headers.has('Range') ? request.headers : undefined,
    });
  } catch (e) {
    return new Response(`R2 read failed: ${e.message}`, { status: 502 });
  }
  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  let status = 200;
  if (object.range) {
    const { offset, length, suffix } = object.range;
    let contentRange = null;
    let contentLength = null;
    if (offset != null && length != null) {
      contentLength = length;
      contentRange = `bytes ${offset}-${offset + length - 1}/${object.size}`;
    } else if (suffix != null) {
      contentLength = suffix;
      contentRange = `bytes ${object.size - suffix}-${object.size - 1}/${object.size}`;
    }
    if (contentRange) {
      status = 206;
      headers.set('content-range', contentRange);
      headers.set('content-length', String(contentLength));
    }
  }
  if (!headers.has('content-length')) {
    headers.set('content-length', String(object.size));
  }

  // HEAD must not carry a body; the headers (status, range, length)
  // stay identical to what a GET would return.
  return new Response(request.method === 'HEAD' ? null : object.body, {
    status,
    headers,
  });
}
