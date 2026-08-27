import type {APIRoute} from 'astro'

/**
 * Only the real site invites crawlers.
 *
 * A preview deployment carries the same pages as the live one. Left open, it
 * competes with the site it is a preview of, and the wrong address ends up in
 * the search results. So everything except a production deployment says no,
 * and the editing interface always does.
 */
export const prerender = false

export const GET: APIRoute = ({site}) => {
  const isProduction = import.meta.env.VERCEL_ENV
    ? import.meta.env.VERCEL_ENV === 'production'
    : import.meta.env.PROD

  const body = isProduction
    ? [
        'User-agent: *',
        'Disallow: /admin',
        'Disallow: /api/',
        '',
        site ? `Sitemap: ${new URL('sitemap-index.xml', site).href}` : '',
      ]
    : ['# Vorschau-Version. Nicht indexieren.', 'User-agent: *', 'Disallow: /']

  return new Response(body.filter(Boolean).join('\n') + '\n', {
    headers: {'Content-Type': 'text/plain; charset=utf-8'},
  })
}
