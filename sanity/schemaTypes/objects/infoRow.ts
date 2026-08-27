import {defineField, defineType} from 'sanity'
import {germanPreview} from '../../lib/fields'

export default defineType({
  name: 'infoRow',
  title: 'Info-Zeile',
  type: 'object',
  fields: [
    defineField({name: 'label', title: 'Bezeichnung', type: 'internationalizedArrayString', validation: (r) => r.required()}),
    defineField({name: 'value', title: 'Wert', type: 'internationalizedArrayString', validation: (r) => r.required()}),
  ],
  preview: germanPreview({title: 'label', subtitle: 'value'}),
})
