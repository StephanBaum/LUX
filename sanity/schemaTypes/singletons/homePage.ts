import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'homePage',
  title: 'Startseite',
  type: 'document',
  groups: [
    {name: 'seo', title: 'Menü & Google'},
    {name: 'hero', title: 'Titelbild'},
    {name: 'studio', title: 'Abschnitt Studio'},
    {name: 'menschen', title: 'Abschnitt Menschen'},
    {name: 'slider', title: 'Bilder-Slider'},
    {name: 'cta', title: 'Aufruf am Seitenende'},
  ],
  fields: [
    defineField({
      name: 'heroImages',
      title: 'Titelbilder',
      type: 'array',
      group: 'hero',
      of: [{type: 'photo'}],
    }),
    defineField({
      name: 'sectionStudio',
      title: 'Abschnitt Studio',
      type: 'object',
      group: 'studio',
      fields: [
        defineField({name: 'label', title: 'Kleine Beschriftung', type: 'internationalizedArrayString'}),
        defineField({name: 'text', title: 'Text', type: 'internationalizedArrayText'}),
      ],
    }),
    defineField({
      name: 'sectionMenschen',
      title: 'Abschnitt Menschen',
      type: 'menschenSection',
      group: 'menschen',
    }),
    defineField({name: 'sliderHint', title: 'Hinweis am Slider', type: 'internationalizedArrayString', group: 'slider'}),
    defineField({
      name: 'sliderImages',
      title: 'Bilder im Slider',
      type: 'array',
      group: 'slider',
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
  preview: {prepare: () => ({title: 'Startseite'})},
})
