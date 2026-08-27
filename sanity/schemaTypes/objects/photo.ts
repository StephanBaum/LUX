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
      type: 'string',
      description: 'Kurze Beschreibung für Suchmaschinen und Screenreader.',
      validation: (rule) => rule.required().warning('Alt-Text fehlt.'),
    }),
    defineField({name: 'caption', title: 'Bildunterschrift', type: 'string'}),
  ],
  preview: {
    select: {alt: 'alt', caption: 'caption', media: 'asset'},
    // Without this an image inside an array just reads "Untitled".
    prepare: ({alt, caption, media}) => ({
      title: alt || caption || 'Bild ohne Beschreibung',
      media,
    }),
  },
})
