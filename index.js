/*
 * SPOT — dish photo proxy (Cloudflare Worker)  [Pexels]
 * ------------------------------------------------------------------
 * Returns a real, COMMERCIALLY-LICENSED food photo matched to a dish
 * name, so you never embed copyrighted images (Pinterest, random blogs).
 *
 * Pexels license: free for commercial use, no attribution required
 * (crediting the photographer is appreciated). https://www.pexels.com/license/
 *
 * HOW IT WORKS
 *  Your app requests:   https://<this-worker>/?q=Grilled%20Chicken%20Rice%20Broccoli
 *  The Worker searches Pexels for that dish and 302-redirects to a
 *  matching photo, so it works directly as an <img src>.
 *
 * DEPLOY (about 5 min, free):
 *  1. Get a free Pexels API key: https://www.pexels.com/api/  (sign up -> "Your API Key").
 *  2. Cloudflare dashboard -> Workers & Pages -> Create -> Worker.
 *  3. Paste THIS file, Deploy.
 *  4. Worker -> Settings -> Variables and Secrets -> add SECRET
 *       PEXELS_API_KEY = <your key>.
 *  5. Copy the Worker URL, then in index.html set:
 *       const IMG_ENDPOINT = "https://spot-photos.<you>.workers.dev";
 *     Every meal card will now pull a matched, licensed photo automatically.
 *
 * NOTES
 *  - Free Pexels tier: ~200 requests/hour, 20,000/month. The Worker caches
 *    each dish for 30 days (below) so real usage stays tiny.
 *  - Prefer Unsplash instead? Swap the fetch block for the Unsplash API
 *    (https://api.unsplash.com/search/photos) with your Unsplash key.
 */

const PLACEHOLDER = "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&w=600";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "healthy meal").slice(0, 80);

    if (!env.PEXELS_API_KEY) return Response.redirect(PLACEHOLDER, 302);

    // Cache the resolved photo URL per dish for 30 days.
    const cache = caches.default;
    const cacheKey = new Request("https://cache/dish?q=" + encodeURIComponent(q));
    const cached = await cache.match(cacheKey);
    if (cached) return Response.redirect(await cached.text(), 302);

    try {
      const api =
        "https://api.pexels.com/v1/search?orientation=landscape&per_page=1&query=" +
        encodeURIComponent(q + " food dish plated");
      const r = await fetch(api, { headers: { Authorization: env.PEXELS_API_KEY } });
      const j = await r.json();
      const p = j && j.photos && j.photos[0];
      const src = p && p.src && (p.src.large || p.src.medium || p.src.original);
      if (!src) return Response.redirect(PLACEHOLDER, 302);

      // store resolved URL in cache
      ctx.waitUntil(
        cache.put(
          cacheKey,
          new Response(src, { headers: { "Cache-Control": "max-age=2592000" } })
        )
      );
      return Response.redirect(src, 302);
    } catch (e) {
      return Response.redirect(PLACEHOLDER, 302);
    }
  },
};
