import {defineField, defineType} from 'sanity'
import {germanPreview} from '../../lib/fields'

/** Product names are never translated, so this type carries no i18n field. */
export default defineType({
  name: 'equipmentItem',
  title: 'Equipment',
  type: 'document',
  fields: [
    defineField({name: 'name', title: 'Bezeichnung', type: 'string', validation: (r) => r.required()}),
    defineField({
      name: 'category',
      title: 'Kategorie',
      type: 'string',
      validation: (r) => r.required(),
      options: {
        list: [
          {title: 'Licht', value: 'light'},
          {title: 'Kamera', value: 'camera'},
          {title: 'Grip', value: 'grip'},
        ],
        layout: 'radio',
      },
    }),
    defineField({name: 'order', title: 'Reihenfolge', type: 'number'}),
  ],
  orderings: [
    {title: 'Kategorie, Reihenfolge', name: 'catOrder', by: [{field: 'category', direction: 'asc'}, {field: 'order', direction: 'asc'}]},
  ],
  preview: germanPreview({title: 'name', subtitle: 'category'}),
})
