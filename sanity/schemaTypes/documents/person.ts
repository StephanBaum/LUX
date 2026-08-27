import {defineField, defineType} from 'sanity'
import {germanPreview} from '../../lib/fields'

/**
 * One document per photographer. Holds everything that belongs to the person
 * alone — biography, expertise and portfolio — and drives their own page.
 * The joint statement shown in "Abschnitt Menschen" lives on the page, not here.
 */
export default defineType({
  name: 'person',
  title: 'Person',
  type: 'document',
  groups: [
    {name: 'profile', title: 'Profil'},
    {name: 'portfolio', title: 'Portfolio'},
  ],
  fields: [
    defineField({name: 'name', title: 'Name', type: 'string', group: 'profile', validation: (r) => r.required()}),
    defineField({
      name: 'slug',
      title: 'URL-Kürzel',
      type: 'slug',
      group: 'profile',
      options: {source: 'name', maxLength: 96},
      validation: (r) => r.required(),
    }),
    defineField({name: 'role', title: 'Rolle', type: 'internationalizedArrayString', group: 'profile'}),
    defineField({name: 'email', title: 'E-Mail', type: 'string', group: 'profile'}),
    defineField({name: 'instagram', title: 'Instagram-URL', type: 'url', group: 'profile'}),
    defineField({name: 'photo', title: 'Foto', type: 'photo', group: 'profile'}),
    defineField({
      name: 'bio',
      title: 'Biografie',
      type: 'internationalizedArrayText',
      group: 'profile',
      description: 'Der ausführliche Text für die eigene Personenseite.',
    }),
    defineField({
      name: 'expertise',
      title: 'Ausbildung / Expertise',
      type: 'array',
      group: 'profile',
      of: [{type: 'expertiseItem'}],
    }),
    defineField({
      name: 'portfolio',
      title: 'Portfolio',
      type: 'array',
      group: 'portfolio',
      of: [{type: 'photo'}],
    }),
    defineField({name: 'order', title: 'Reihenfolge', type: 'number', group: 'profile'}),
  ],
  orderings: [{title: 'Reihenfolge', name: 'order', by: [{field: 'order', direction: 'asc'}]}],
  preview: germanPreview({title: 'name', subtitle: 'role', media: 'photo'}),
})
