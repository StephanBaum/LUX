import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {media, mediaAssetSource} from 'sanity-plugin-media'
import {schemaTypes, singletonTypeNames} from './sanity/schemaTypes'
import {structure} from './sanity/structure'

// Read from Vite (browser bundle) or Node (sanity CLI), whichever is present.
const env: Record<string, string | undefined> = {
  ...(typeof process !== 'undefined' ? process.env : {}),
  ...((import.meta as any).env ?? {}),
}

const projectId = env.PUBLIC_SANITY_PROJECT_ID ?? env.SANITY_STUDIO_PROJECT_ID ?? ''
const dataset = env.PUBLIC_SANITY_DATASET ?? env.SANITY_STUDIO_DATASET ?? 'production'

export default defineConfig({
  name: 'lux-studio',
  title: 'LUX Studio',
  basePath: '/admin',
  projectId,
  dataset,

  // `media` adds a browser for everything already uploaded, so the client can
  // reuse a photo instead of uploading it a second time.
  plugins: [structureTool({structure}), media(), visionTool()],

  form: {
    // Make that browser the way images are picked, everywhere.
    image: {
      assetSources: (previous) => [mediaAssetSource, ...previous.filter((s) => s.name !== 'media-library')],
    },
  },

  schema: {
    types: schemaTypes,
    // Hide the singletons from the global "create new" menu.
    templates: (templates) => templates.filter((t) => !singletonTypeNames.has(t.schemaType)),
  },

  document: {
    // The client may not delete or duplicate a singleton.
    actions: (actions, {schemaType}) =>
      singletonTypeNames.has(schemaType)
        ? actions.filter(({action}) => action !== 'delete' && action !== 'duplicate' && action !== 'unpublish')
        : actions,
  },
})
