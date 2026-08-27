import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
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

  plugins: [structureTool({structure}), visionTool()],

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
