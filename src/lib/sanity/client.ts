import {createClient} from '@sanity/client'

export const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID as string
export const dataset = (import.meta.env.PUBLIC_SANITY_DATASET as string) || 'production'
export const apiVersion = '2026-08-01'

/**
 * Build-time read client. `perspective: 'published'` means a draft the client
 * has not published yet is invisible to the site — that is what replaces a
 * `published` boolean in the schema.
 */
export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  perspective: 'published',
})
