import {defineField, defineType} from 'sanity'
import {germanPreview} from '../../lib/fields'

export default defineType({
  name: 'room',
  title: 'Raum',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Name', type: 'internationalizedArrayString', validation: (r) => r.required()}),
    defineField({name: 'size', title: 'Größe', type: 'string', description: 'z. B. 120 m²'}),
    defineField({
      name: 'features',
      title: 'Ausstattung',
      type: 'internationalizedArrayFeatures',
    }),
    defineField({name: 'description', title: 'Beschreibung', type: 'internationalizedArrayText'}),
    defineField({name: 'photo', title: 'Foto', type: 'photo'}),
    defineField({name: 'order', title: 'Reihenfolge', type: 'number'}),
  ],
  orderings: [{title: 'Reihenfolge', name: 'order', by: [{field: 'order', direction: 'asc'}]}],
  preview: germanPreview({title: 'title', subtitle: 'size', media: 'photo'}),
})
