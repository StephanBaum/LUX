import {defineField, defineType} from 'sanity'
import {i18nField} from '../../lib/fields'

export default defineType({
  name: 'room',
  title: 'Raum',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Name', type: 'string', validation: (r) => r.required()}),
    defineField({name: 'size', title: 'Größe', type: 'string', description: 'z. B. 120 m²'}),
    defineField({
      name: 'features',
      title: 'Ausstattung',
      type: 'array',
      of: [{type: 'string'}],
      options: {layout: 'tags'},
    }),
    defineField({name: 'description', title: 'Beschreibung', type: 'text', rows: 5}),
    defineField({name: 'photo', title: 'Foto', type: 'photo'}),
    defineField({name: 'order', title: 'Reihenfolge', type: 'number'}),
    i18nField,
  ],
  orderings: [{title: 'Reihenfolge', name: 'order', by: [{field: 'order', direction: 'asc'}]}],
  preview: {select: {title: 'title', subtitle: 'size', media: 'photo'}},
})
