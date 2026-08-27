import {defineField, defineType} from 'sanity'
import {i18nField} from '../../lib/fields'

export default defineType({
  name: 'workshopsPage',
  title: 'Workshops',
  type: 'document',
  groups: [
    {name: 'header', title: 'Seitenkopf', default: true},
    {name: 'sections', title: 'Beschriftungen'},
    {name: 'cta', title: 'Aufruf am Seitenende'},
  ],
  fields: [
    defineField({name: 'header', title: 'Seitenkopf', type: 'pageHeader', group: 'header'}),
    defineField({name: 'detailsTitle', title: 'Überschrift Details', type: 'string', group: 'sections'}),
    defineField({name: 'registrationLabel', title: 'Beschriftung Anmeldung', type: 'string', group: 'sections'}),
    defineField({name: 'emptyText', title: 'Text wenn keine Termine anstehen', type: 'string', group: 'sections'}),
    defineField({
      name: 'sliderImages',
      title: 'Bilder im Slider',
      type: 'array',
      group: 'sections',
      of: [{type: 'photo'}],
    }),
    defineField({name: 'cta', title: 'Aufruf am Seitenende', type: 'cta', group: 'cta'}),
    i18nField,
  ],
  preview: {prepare: () => ({title: 'Workshops'})},
})
