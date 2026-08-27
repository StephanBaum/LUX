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
function staleChunkGuard() {
  return {
    name: 'lux:stale-chunk-guard',
    hooks: {
      'astro:config:setup': ({injectScript, command}) => {
        if (command !== 'dev') return;
        injectScript(
          'head-inline',
          `(() => {
            const FLAG = 'lux-stale-chunk-reload';
            const stale = (m) =>
              typeof m === 'string' && m.includes('Failed to fetch dynamically imported module');
            const recover = (m) => {
              if (!stale(m) || sessionStorage.getItem(FLAG)) return;
              sessionStorage.setItem(FLAG, '1');
              location.reload();
            };
            addEventListener('error', (e) => recover(e.message || e.error?.message));
            addEventListener('unhandledrejection', (e) => recover(e.reason?.message));
            addEventListener('load', () => setTimeout(() => sessionStorage.removeItem(FLAG), 4000));
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
       * Pre-bundle React so the Studio does not send Vite off to re-bundle in
       * the middle of a session; see `staleChunkGuard` above for the rest.
       */
      include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'styled-components'],
    },
  },
});
