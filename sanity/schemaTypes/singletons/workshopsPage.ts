import {defineField, defineType} from 'sanity'
import {i18nField} from '../../lib/fields'

export default defineType({
  name: 'workshopsPage',
  title: 'Workshops',
  type: 'document',
  groups: [
    {name: 'seo', title: 'Menü & Google'},
    {name: 'header', title: 'Seitenkopf'},
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
    defineField({
      name: 'navLabel',
      title: 'Name im Menü',
      type: 'string',
      group: 'seo',
      description: 'So heißt die Seite in Menü und Fußzeile.',
    }),
    defineField({name: 'seo', title: 'Suchmaschine & Vorschau', type: 'pageSeo', group: 'seo'}),
    i18nField,
  ],
  preview: {prepare: () => ({title: 'Workshops'})},
})
