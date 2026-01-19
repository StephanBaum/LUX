// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // TODO: Update with actual domain before deployment
  site: 'https://luxenburger.de',
  output: 'static',
  adapter: vercel(),
  integrations: [sitemap()]
});
