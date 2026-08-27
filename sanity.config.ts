import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {media} from 'sanity-plugin-media'
import {internationalizedArray} from 'sanity-plugin-internationalized-array'
import {defineField} from 'sanity'
import {schemaTypes, singletonTypeNames} from './sanity/schemaTypes'
import {structure} from './sanity/structure'
import {translateAction, withAutoTranslate, UNTRANSLATED_TYPES} from './sanity/actions/translate'
import {translationBadge} from './sanity/badges/translation'
import {syncBadge} from './sanity/badges/sync'
import {CompactTranslation} from './sanity/components/CompactTranslation'
import {PhotoInput} from './sanity/components/PhotoInput'
import {SeoInput} from './sanity/components/SeoInput'

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
  // reuse a photo instead of uploading it a second time. It registers itself
  // as an asset source; adding it again by hand duplicates it.
  plugins: [
    structureTool({structure}),

    /*
     * Every translatable field carries its languages inline: German is what the
     * client types, the other three are filled in on publish. Storing them on
     * the field keeps the German next to its translation instead of in a
     * separate mirror.
     */
    internationalizedArray({
      languages: [
        {id: 'de', title: 'Deutsch'},
        {id: 'en', title: 'English'},
        {id: 'fr', title: 'Français'},
        {id: 'lu', title: 'Lëtzebuergesch'},
      ],
      defaultLanguages: ['de'],
      fieldTypes: [
        'string',
        'text',
        // Room features: a short list of words per language.
        defineField({
          name: 'features',
          type: 'array',
          of: [{type: 'string'}],
          options: {layout: 'tags'},
        }),
        // The legal pages, which are rich text.
        defineField({
          name: 'richText',
          type: 'array',
          of: [
            {
              type: 'block',
              styles: [
                {title: 'Absatz', value: 'normal'},
                {title: 'Zwischen-Überschrift', value: 'h3'},
              ],
              lists: [{title: 'Liste', value: 'bullet'}],
              marks: {
                decorators: [
                  {title: 'Fett', value: 'strong'},
                  {title: 'Kursiv', value: 'em'},
                ],
              },
            },
          ],
        }),
      ],
    }),

    media(),
    visionTool(),
  ],

  form: {
    components: {
      /*
       * Plain translatable text gets the compact one-input-plus-switcher view.
       * The list and rich-text ones keep the plugin's own input, which handles
       * those shapes properly. A picture describes itself as soon as it is
       * chosen, so the alt text is never the field that stays empty.
       */
      input: (props: any) => {
        // A field named "heroImage" of type "photo" carries its own name, so
        // walk up the chain to find out what it really is.
        const isA = (name: string) => {
          for (let type = props.schemaType; type; type = type.type) {
            if (type.name === name) return true
          }
          return false
        }

        if (isA('internationalizedArrayString') || isA('internationalizedArrayText')) {
          return CompactTranslation(props)
        }
        if (isA('photo')) return PhotoInput(props)
        if (isA('pageSeo')) return SeoInput(props)
        return props.renderDefault(props)
      },
    },
  },

  schema: {
    types: schemaTypes,
    // Hide the singletons from the global "create new" menu.
    templates: (templates) => templates.filter((t) => !singletonTypeNames.has(t.schemaType)),
  },

  document: {
    actions: (actions, {schemaType}) => {
      // The client may not delete or duplicate a singleton.
      const allowed = singletonTypeNames.has(schemaType)
        ? actions.filter(({action}) => action !== 'delete' && action !== 'duplicate' && action !== 'unpublish')
        : actions

      if (UNTRANSLATED_TYPES.has(schemaType)) return allowed

      // Publishing brings the other languages up to date on its own; the
      // separate action stays for re-running a translation without publishing.
      return [
        ...allowed.map((action) =>
          action.action === 'publish' ? withAutoTranslate(action) : action,
        ),
        translateAction,
      ]
    },

    badges: (badges, {schemaType}) => {
      const all = [...badges, syncBadge]
      return UNTRANSLATED_TYPES.has(schemaType) ? all : [...all, translationBadge]
    },
  },
})
