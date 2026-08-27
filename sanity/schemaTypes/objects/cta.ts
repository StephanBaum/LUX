import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'cta',
  title: 'Aufruf am Seitenende',
  type: 'object',
  fields: [
    defineField({name: 'title', title: 'Überschrift', type: 'internationalizedArrayString'}),
    defineField({name: 'text', title: 'Text', type: 'internationalizedArrayText'}),
    defineField({name: 'linkLabel', title: 'Button-Text', type: 'internationalizedArrayString'}),
    defineField({name: 'linkHref', title: 'Button-Ziel', type: 'string', description: 'z. B. /mieten oder mailto:info@…'}),
  ],
})
