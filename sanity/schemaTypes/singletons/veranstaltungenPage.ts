import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'veranstaltungenPage',
  title: 'Veranstaltungen',
  type: 'document',
  groups: [
    {name: 'seo', title: 'Menü & Google'},
    {name: 'header', title: 'Seitenkopf'},
    {name: 'sections', title: 'Beschriftungen'},
    {name: 'cta', title: 'Aufruf am Seitenende'},
  ],
  fields: [
    defineField({name: 'header', title: 'Seitenkopf', type: 'pageHeader', group: 'header'}),
    defineField({name: 'detailsTitle', title: 'Überschrift Details', type: 'internationalizedArrayString', group: 'sections'}),
    defineField({name: 'registrationLabel', title: 'Beschriftung Anmeldung', type: 'internationalizedArrayString', group: 'sections'}),
    defineField({name: 'emptyText', title: 'Text wenn keine Termine anstehen', type: 'internationalizedArrayString', group: 'sections'}),
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
      type: 'internationalizedArrayString',
      group: 'seo',
      description: 'So heißt die Seite in Menü und Fußzeile.',
    }),
    defineField({name: 'seo', title: 'Suchmaschine & Vorschau', type: 'pageSeo', group: 'seo'}),
  ],
  preview: {prepare: () => ({title: 'Veranstaltungen'})},
})
