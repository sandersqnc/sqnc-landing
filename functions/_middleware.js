/* Server-side visit counter — the north-star denominator.
 *
 * Runs at the edge on every request BEFORE the HTML is served, so ad-blockers, JS-off and
 * script-blocking extensions cannot hide from it. Only HTML document requests are counted:
 * assets, the API and prefetches are not visits.
 *
 * It fires a non-blocking POST to the links worker (/e/visit), which owns the D1 write, so
 * this file needs no bindings and the Pages project needs no configuration.
 */

export async function onRequest(context) {
  const { request, next, waitUntil } = context;
  const url = new URL(request.url);

  const isDocument =
    request.method === 'GET' &&
    (request.headers.get('Accept') || '').includes('text/html') &&
    // Sec-Fetch-Dest is the reliable signal: 'document' means a real navigation, which
    // excludes prefetch, iframe and fetch()-initiated HTML requests.
    (request.headers.get('Sec-Fetch-Dest') || 'document') === 'document' &&
    !url.pathname.startsWith('/api/') &&
    !url.pathname.startsWith('/assets/') &&
    !url.searchParams.has('static'); // ?static is the screenshot/QA mode, not a human

  if (isDocument) {
    waitUntil(
      fetch(`${url.origin}/e/visit`, {
        method: 'POST',
        headers: {
          // Forwarded so the counter applies the same bot filter as the click log —
          // numerator and denominator must agree on what counts as a human.
          'User-Agent': request.headers.get('User-Agent') || '',
        },
      }).catch(() => {})
    );
  }

  return next();
}
