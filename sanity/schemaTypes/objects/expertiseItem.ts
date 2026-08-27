import {defineField, defineType} from 'sanity'
import {germanPreview} from '../../lib/fields'

export default defineType({
  name: 'expertiseItem',
  title: 'Ausbildung / Expertise',
  type: 'object',
  fields: [
    defineField({name: 'title', title: 'Titel', type: 'internationalizedArrayString', validation: (r) => r.required()}),
    defineField({name: 'detail', title: 'Detail', type: 'internationalizedArrayString'}),
    defineField({name: 'year', title: 'Jahr', type: 'internationalizedArrayString'}),
  ],
  preview: germanPreview({title: 'title', subtitle: 'year'}),
})
