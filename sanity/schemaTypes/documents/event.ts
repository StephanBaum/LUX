import {defineField, defineType} from 'sanity'
import {i18nField, syncFields} from '../../lib/fields'

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
    defineField({name: 'title', title: 'Titel', type: 'string', group: 'content', validation: (r) => r.required()}),
    defineField({
      name: 'slug',
      title: 'URL-Kürzel',
      type: 'slug',
      group: 'content',
      options: {source: 'title', maxLength: 96},
      validation: (r) => r.required(),
    }),
    defineField({name: 'description', title: 'Beschreibung', type: 'text', rows: 6, group: 'content'}),
    defineField({name: 'infos', title: 'Infos', type: 'array', of: [{type: 'infoRow'}], group: 'content'}),
    defineField({name: 'photo', title: 'Bild', type: 'photo', group: 'content'}),

    defineField({name: 'startAt', title: 'Beginn', type: 'datetime', group: 'date'}),
    defineField({name: 'endAt', title: 'Ende', type: 'datetime', group: 'date'}),

    ...syncFields,
    i18nField,
  ],
  orderings: [{title: 'Termin', name: 'startAt', by: [{field: 'startAt', direction: 'desc'}]}],
  preview: {select: {title: 'title', subtitle: 'startAt', media: 'photo'}},
})
