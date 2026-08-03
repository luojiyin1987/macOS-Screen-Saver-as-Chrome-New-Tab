// Serves zen-mode ambient music from an R2 bucket (binding:
// MUSIC_BUCKET), keyed as music/music00001.mp3 … music/music00040.mp3.
//
// Optional: without the binding every request returns 404 and Zen mode
// simply runs without music — the web app already treats audio failure
// as non-fatal.

export async function onRequest(context) {
  const { request, env } = context;
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
    object = await bucket.get(key, {
      range: request.headers.get('Range') || undefined,
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

  if (object.range) {
    const end = object.range.end ?? object.size - 1;
    headers.set('content-range', `bytes ${object.range.offset}-${end}/${object.size}`);
    headers.set('content-length', String(end - object.range.offset + 1));
    return new Response(object.body, { status: 206, headers });
  }
  return new Response(object.body, { headers });
}
