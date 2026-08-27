import {defineField, defineType} from 'sanity'
import {i18nField} from '../../lib/fields'

export default defineType({
  name: 'studioPage',
  title: 'Studio',
  type: 'document',
  groups: [
    {name: 'header', title: 'Seitenkopf'},
    {name: 'menschen', title: 'Abschnitt Menschen'},
    {name: 'gallery', title: 'Galerie & Slider'},
    {name: 'cta', title: 'Aufruf am Seitenende'},
  ],
  fields: [
    defineField({name: 'header', title: 'Seitenkopf', type: 'pageHeader', group: 'header'}),
    defineField({
      name: 'sectionMenschen',
      title: 'Abschnitt Menschen',
      type: 'menschenSection',
      group: 'menschen',
    }),
    defineField({name: 'sliderLabel', title: 'Beschriftung Equipment-Slider', type: 'string', group: 'gallery'}),
    defineField({name: 'sliderHint', title: 'Hinweis am Slider', type: 'string', group: 'gallery'}),
    defineField({
      name: 'sliderImages',
      title: 'Bilder im Slider',
      type: 'array',
      group: 'gallery',
      of: [{type: 'photo'}],
    }),
    defineField({name: 'cta', title: 'Aufruf am Seitenende', type: 'cta', group: 'cta'}),
    i18nField,
  ],
  preview: {prepare: () => ({title: 'Studio'})},
})
