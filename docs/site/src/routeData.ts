import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

// The API reference has hundreds of generated pages: in the search index they
// bury the guides, so it's reached from its own menu. Every page of it says
// the API isn't a stable contract yet.
export const onRequest = defineRouteMiddleware((context) => {
  if (!context.url.pathname.startsWith('/api/')) return;
  const { data } = context.locals.starlightRoute.entry;
  data.pagefind = false;
  data.banner = { content: 'The API may change between versions while TTX-Zone is 0.x.' };
});
