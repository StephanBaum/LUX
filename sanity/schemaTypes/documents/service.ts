import {defineField, defineType} from 'sanity'
import {i18nField} from '../../lib/fields'

export default defineType({
  name: 'service',
  title: 'Leistung',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Titel', type: 'string', validation: (r) => r.required()}),
    defineField({name: 'description', title: 'Beschreibung', type: 'text', rows: 6}),
    defineField({name: 'photo', title: 'Bild', type: 'photo'}),
    defineField({name: 'order', title: 'Reihenfolge', type: 'number'}),
    i18nField,
  ],
  orderings: [{title: 'Reihenfolge', name: 'order', by: [{field: 'order', direction: 'asc'}]}],
  preview: {select: {title: 'title', media: 'photo'}},
})
