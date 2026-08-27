import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'infoRow',
  title: 'Info-Zeile',
  type: 'object',
  fields: [
    defineField({name: 'label', title: 'Bezeichnung', type: 'string', validation: (r) => r.required()}),
    defineField({name: 'value', title: 'Wert', type: 'string', validation: (r) => r.required()}),
  ],
  preview: {select: {title: 'label', subtitle: 'value'}},
})
