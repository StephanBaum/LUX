import {defineField, defineType} from 'sanity'
import {syncFields} from '../../lib/fields'

export default defineType({
  name: 'event',
  title: 'Veranstaltung',
  type: 'document',
  groups: [
    {name: 'content', title: 'Inhalt'},
    {name: 'date', title: 'Termin'},
    {name: 'sync', title: 'Google Kalender'},
  ],
  fields: [
    defineField({name: 'title', title: 'Titel', type: 'internationalizedArrayString', group: 'content', validation: (r) => r.required()}),
    defineField({
      name: 'slug',
      title: 'URL-Kürzel',
      type: 'slug',
      group: 'content',
      options: {source: 'title', maxLength: 96},
      validation: (r) => r.required(),
    }),
    defineField({name: 'description', title: 'Beschreibung', type: 'internationalizedArrayText', group: 'content'}),
    defineField({name: 'infos', title: 'Infos', type: 'array', of: [{type: 'infoRow'}], group: 'content'}),
    defineField({name: 'photo', title: 'Bild', type: 'photo', group: 'content'}),

    defineField({name: 'startAt', title: 'Beginn', type: 'datetime', group: 'date'}),
    defineField({name: 'endAt', title: 'Ende', type: 'datetime', group: 'date'}),

    ...syncFields,
  ],
  orderings: [{title: 'Termin', name: 'startAt', by: [{field: 'startAt', direction: 'desc'}]}],
  preview: {select: {title: 'title', subtitle: 'startAt', media: 'photo'}},
})
