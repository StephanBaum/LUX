// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import sanity from '@sanity/astro';
import react from '@astrojs/react';
import { loadEnv } from 'vite';

// astro.config runs in Node, where .env is not loaded automatically.
const env = loadEnv(process.env.NODE_ENV ?? '', process.cwd(), '');

/**
 * In development Vite re-bundles dependencies as soon as the Studio lazily
 * loads a pane it has not seen before. Chunk filenames carry a hash, so the
 * page is left asking for files that no longer exist and Sanity paints a white
 * pane. Reload once when that happens; the flag stops it looping.
 */
/**
 * Last resort in dev, if a chunk address moves anyway.
 *
 * `optimizeDeps.include` below is the actual fix; this is what catches the
 * case it did not foresee — a package that only some page reaches for. It
 * reloads rather than leaving a dead pane, and refuses to do so twice within
 * ten seconds, so a genuinely missing file cannot become a reload loop.
 */
function staleChunkGuard() {
  return {
    name: 'lux:stale-chunk-guard',
    hooks: {
      'astro:config:setup': ({injectScript, command}) => {
        if (command !== 'dev') return;
        injectScript(
          'head-inline',
          `(() => {
            const AT = 'lux-stale-chunk-reload-at';
            const stale = (m) =>
              typeof m === 'string' &&
              (m.includes('Failed to fetch dynamically imported module') ||
                m.includes('error loading dynamically imported module') ||
                m.includes('Importing a module script failed'));
            const recover = (m) => {
              if (!stale(m)) return;
              const last = Number(sessionStorage.getItem(AT) || 0);
              if (Date.now() - last < 10000) return;
              sessionStorage.setItem(AT, String(Date.now()));
              location.reload();
            };
            addEventListener('error', (e) => recover(e.message || e.error?.message));
            addEventListener('unhandledrejection', (e) => recover(e.reason?.message));
            // Vite's own signal for a chunk it could not load.
            addEventListener('vite:preloadError', (e) => recover(e.payload?.message));
          })();`,
        );
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  // TODO: Update with actual domain before deployment
  site: 'https://luxenburger.de',
  output: 'static',
  adapter: vercel(),
  integrations: [
    staleChunkGuard(),
    sitemap({
      // The editing interface must never be indexed.
      filter: (page) => !page.includes('/admin'),
    }),
    sanity({
      projectId: env.PUBLIC_SANITY_PROJECT_ID,
      dataset: env.PUBLIC_SANITY_DATASET ?? 'production',
      apiVersion: '2026-08-01',
      useCdn: false,
      // Sanity Studio lives at /admin — /studio is a public page of the site.
      studioBasePath: '/admin',
    }),
    react(),
  ],
  vite: {
    optimizeDeps: {
      /*
       * Let the scanner start at the Studio's own configuration.
       *
       * Vite normally learns what to pre-bundle by reading the pages it can
       * see. It cannot see the Studio: that route is built inside
       * @sanity/astro, so the first it hears of `sanity` is when the browser
       * asks for it — mid-session. It then re-bundles, every chunk gets a new
       * address, and the page you are looking at is still holding the old
       * ones: "Failed to fetch dynamically imported module", on whichever page
       * you happened to open first.
       *
       * Pointing the scanner at sanity.config.ts makes it find all of that
       * before the server accepts a request, so the addresses never move
       * underneath an open Studio. Naming the packages in `include` instead
       * does not work — forcing `sanity/structure` through the optimiser
       * loses its named exports.
       */
      entries: ['sanity.config.ts', 'src/pages/**/*.astro'],
      include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'styled-components'],
    },
  },
});
