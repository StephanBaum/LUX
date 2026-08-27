// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import sanity from '@sanity/astro';
import react from '@astrojs/react';
import { loadEnv } from 'vite';

// astro.config runs in Node, where .env is not loaded automatically.
const env = loadEnv(process.env.NODE_ENV ?? '', process.cwd(), '');

// https://astro.build/config
export default defineConfig({
  // TODO: Update with actual domain before deployment
  site: 'https://luxenburger.de',
  output: 'static',
  adapter: vercel(),
  integrations: [
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
       * The Studio pulls its panes in lazily. If Vite meets a dependency for
       * the first time at runtime it re-bundles, and the chunk URLs the open
       * page is holding go stale — "Import error: failed to fetch dynamically
       * imported module", and a blank pane. Naming React up front covers the
       * common case.
       *
       * The `sanity` packages must NOT be listed here: pre-bundling them
       * mangles their exports (`structureTool` goes missing) for the same
       * reason the Windows alias patch exists.
       */
      include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'styled-components'],
    },
  },
});
