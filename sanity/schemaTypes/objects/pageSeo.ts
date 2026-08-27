import {defineField, defineType} from 'sanity'

/**
 * What Google and the social networks show for a page — and the picture the
 * page is represented by in the navigation, so the two can never drift apart.
 */
export default defineType({
  name: 'pageSeo',
  title: 'Suchmaschine & Vorschau',
  type: 'object',
  options: {collapsible: true, collapsed: false},
  fields: [
    defineField({
      name: 'metaTitle',
      title: 'Titel bei Google',
      type: 'internationalizedArrayString',
      description: 'Etwa 55 Zeichen. Bleibt das Feld leer, wird die Überschrift der Seite benutzt.',
      validation: (rule) => rule.max(70).warning('Über 70 Zeichen kürzt Google ab.'),
    }),
    defineField({
      name: 'metaDescription',
      title: 'Beschreibung bei Google',
      type: 'internationalizedArrayText',
      description: 'Etwa 155 Zeichen. Der Text unter dem Titel im Suchergebnis.',
      validation: (rule) => rule.max(180).warning('Über 180 Zeichen kürzt Google ab.'),
    }),
    defineField({
      name: 'shareImage',
      title: 'Bild der Seite',
      type: 'photo',
      description:
        'Wird beim Teilen in sozialen Netzwerken gezeigt — und im Menü der Startseite, ' +
        'wenn man mit der Maus über den Namen dieser Seite fährt.',
    }),
  ],
})
