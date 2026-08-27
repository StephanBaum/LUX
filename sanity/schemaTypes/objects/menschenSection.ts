import {defineField, defineType} from 'sanity'

/**
 * The "Menschen" block on the Startseite and the Studio page.
 *
 * The joint statement and the shared expertise list read like a studio CV, so
 * they live here on the page. The individual photographers are separate
 * `person` documents with their own biography and portfolio.
 */
export default defineType({
  name: 'menschenSection',
  title: 'Abschnitt Menschen',
  type: 'object',
  fields: [
    defineField({name: 'label', title: 'Kleine Beschriftung', type: 'internationalizedArrayString'}),
    defineField({name: 'title', title: 'Überschrift', type: 'internationalizedArrayString'}),
    defineField({
      name: 'bio',
      title: 'Gemeinsamer Text',
      type: 'internationalizedArrayText',
      description: 'Der kurze Text über beide Fotografen. Ausführliche Biografien stehen bei der jeweiligen Person.',
    }),
    defineField({name: 'educationTitle', title: 'Überschrift Expertise', type: 'internationalizedArrayString'}),
    defineField({
      name: 'expertise',
      title: 'Expertise des Studios',
      type: 'array',
      of: [{type: 'expertiseItem'}],
    }),
    defineField({
      name: 'people',
      title: 'Personen',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'person'}]}],
      description: 'Wer in diesem Abschnitt gezeigt wird.',
    }),
    defineField({
      name: 'gallery',
      title: 'Bilder neben dem Text',
      type: 'array',
      of: [{type: 'photo'}],
      description: 'Vier Bilder. Reihenfolge und Format bestimmen das Raster.',
    }),
  ],
})
