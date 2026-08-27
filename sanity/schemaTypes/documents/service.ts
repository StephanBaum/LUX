import {defineField, defineType} from 'sanity'
import {germanPreview} from '../../lib/fields'

export default defineType({
  name: 'service',
  title: 'Leistung',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Titel', type: 'internationalizedArrayString', validation: (r) => r.required()}),
    defineField({name: 'description', title: 'Beschreibung', type: 'internationalizedArrayText'}),
    defineField({name: 'photo', title: 'Bild', type: 'photo'}),
    defineField({name: 'order', title: 'Reihenfolge', type: 'number'}),
  ],
  orderings: [{title: 'Reihenfolge', name: 'order', by: [{field: 'order', direction: 'asc'}]}],
  preview: germanPreview({title: 'title', media: 'photo'}),
})
