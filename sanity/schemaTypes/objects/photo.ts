import {defineField, defineType} from 'sanity'
import {PLACEHOLDER_IMG} from '../../lib/fields'

/** Image with hotspot/crop plus translatable alt text and optional caption. */
export default defineType({
  name: 'photo',
  title: 'Bild',
  type: 'image',
  options: {hotspot: true},
  description: PLACEHOLDER_IMG,
  fields: [
    defineField({
      name: 'alt',
      title: 'Bildbeschreibung (Alt-Text)',
      type: 'internationalizedArrayString',
      description: 'Kurze Beschreibung für Suchmaschinen und Screenreader.',
      validation: (rule) => rule.required().warning('Alt-Text fehlt.'),
    }),
    defineField({name: 'caption', title: 'Bildunterschrift', type: 'internationalizedArrayString'}),
  ],
  preview: {
    select: {alt: 'alt', caption: 'caption', media: 'asset'},
    // alt and caption are internationalized arrays now; show the German entry.
    prepare: ({alt, caption, media}: any) => {
      const german = (value: any) =>
        Array.isArray(value) ? value.find((entry) => entry?.language === 'de')?.value : value

      return {
        title: german(alt) || german(caption) || 'Bild ohne Beschreibung',
        media,
      }
    },
  },
})
