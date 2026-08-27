import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'expertiseItem',
  title: 'Ausbildung / Expertise',
  type: 'object',
  fields: [
    defineField({name: 'title', title: 'Titel', type: 'string', validation: (r) => r.required()}),
    defineField({name: 'detail', title: 'Detail', type: 'string'}),
    defineField({name: 'year', title: 'Jahr', type: 'string'}),
  ],
  preview: {
    select: {title: 'title', subtitle: 'year'},
  },
})
