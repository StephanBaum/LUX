import {defineField, defineType} from 'sanity'
import {i18nField} from '../../lib/fields'

export default defineType({
  name: 'galleryImage',
  title: 'Galerie-Bild',
  type: 'document',
  fields: [
    defineField({name: 'image', title: 'Bild', type: 'photo', validation: (r) => r.required()}),
    defineField({
      name: 'usage',
      title: 'Verwendung',
      type: 'string',
      validation: (r) => r.required(),
      options: {
        list: [
          {title: 'Studio-Slider', value: 'studio-slider'},
          {title: 'Studio-Profil', value: 'studio-profile'},
          {title: 'Startseite', value: 'home'},
        ],
        layout: 'radio',
      },
    }),
    defineField({name: 'order', title: 'Reihenfolge', type: 'number'}),
    i18nField,
  ],
  orderings: [{title: 'Reihenfolge', name: 'order', by: [{field: 'order', direction: 'asc'}]}],
  preview: {select: {title: 'image.alt', subtitle: 'usage', media: 'image'}},
})
