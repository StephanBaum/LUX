import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'pageHeader',
  title: 'Seitenkopf',
  type: 'object',
  fields: [
    defineField({name: 'title', title: 'Überschrift', type: 'internationalizedArrayString', validation: (r) => r.required()}),
    defineField({name: 'text', title: 'Einleitungstext', type: 'internationalizedArrayText'}),
  ],
})
