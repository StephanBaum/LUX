import {defineField, defineType} from 'sanity'
import {germanPreview} from '../../lib/fields'

/**
 * Follows the approved canvas design "Option B — Haltung zuerst":
 * header, hero images, client logos, Haltung, Leistungen, Für wen, CTA.
 */
export default defineType({
  name: 'beratungPage',
  title: 'Beratung',
  type: 'document',
  groups: [
    {name: 'seo', title: 'Menü & Google'},
    {name: 'header', title: 'Seitenkopf'},
    {name: 'clients', title: 'Kunden'},
    {name: 'haltung', title: 'Haltung'},
    {name: 'leistungen', title: 'Leistungen'},
    {name: 'fuerWen', title: 'Für wen'},
    {name: 'cta', title: 'Aufruf am Seitenende'},
  ],
  fields: [
    defineField({name: 'label', title: 'Kleine Beschriftung', type: 'internationalizedArrayString', group: 'header'}),
    defineField({name: 'header', title: 'Seitenkopf', type: 'pageHeader', group: 'header'}),
    defineField({
      name: 'heroImages',
      title: 'Titelbilder',
      type: 'array',
      group: 'header',
      of: [{type: 'photo'}],
      description:
        'Die Bilder im Seitenkopf. Sie werden verstreut angeordnet und ziehen beim Scrollen weg.',
    }),

    defineField({name: 'clientsLabel', title: 'Überschrift Kunden', type: 'internationalizedArrayString', group: 'clients'}),
    defineField({
      name: 'clients',
      title: 'Kunden-Logos',
      type: 'array',
      group: 'clients',
      of: [
        {
          type: 'object',
          fields: [
            // A brand name is the same in every language.
            defineField({name: 'name', title: 'Name', type: 'string', validation: (r) => r.required()}),
            defineField({name: 'logo', title: 'Logo', type: 'photo'}),
            defineField({name: 'url', title: 'Webseite', type: 'url'}),
          ],
          preview: germanPreview({title: 'name', media: 'logo'}),
        },
      ],
    }),

    defineField({name: 'haltungLabel', title: 'Überschrift Haltung', type: 'internationalizedArrayString', group: 'haltung'}),
    defineField({
      name: 'haltungStatement',
      title: 'Aussage',
      type: 'internationalizedArrayText',
      group: 'haltung',
      description: 'Der große Satz.',
    }),
    defineField({name: 'haltungText', title: 'Fließtext', type: 'internationalizedArrayText', group: 'haltung'}),

    defineField({name: 'leistungenLabel', title: 'Kleine Beschriftung', type: 'internationalizedArrayString', group: 'leistungen'}),
    defineField({name: 'leistungenTitle', title: 'Überschrift', type: 'internationalizedArrayString', group: 'leistungen'}),
    defineField({
      name: 'services',
      title: 'Leistungen',
      type: 'array',
      group: 'leistungen',
      of: [{type: 'reference', to: [{type: 'service'}]}],
    }),

    defineField({name: 'fuerWenLabel', title: 'Überschrift Für wen', type: 'internationalizedArrayString', group: 'fuerWen'}),
    defineField({
      name: 'fuerWen',
      title: 'Zielgruppen',
      type: 'array',
      group: 'fuerWen',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'title', title: 'Titel', type: 'internationalizedArrayString', validation: (r) => r.required()}),
            defineField({name: 'text', title: 'Text', type: 'internationalizedArrayString'}),
          ],
          preview: germanPreview({title: 'title', subtitle: 'text'}),
        },
      ],
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
  preview: {prepare: () => ({title: 'Beratung'})},
})
