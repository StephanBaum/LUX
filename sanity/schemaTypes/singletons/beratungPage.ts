import {defineField, defineType} from 'sanity'
import {i18nField} from '../../lib/fields'

/**
 * Follows the approved canvas design "Option B — Haltung zuerst":
 * header, hero images, client logos, Haltung, Leistungen, Für wen, CTA.
 */
export default defineType({
  name: 'beratungPage',
  title: 'Beratung',
  type: 'document',
  groups: [
    {name: 'header', title: 'Seitenkopf'},
    {name: 'clients', title: 'Kunden'},
    {name: 'haltung', title: 'Haltung'},
    {name: 'leistungen', title: 'Leistungen'},
    {name: 'fuerWen', title: 'Für wen'},
    {name: 'cta', title: 'Aufruf am Seitenende'},
  ],
  fields: [
    defineField({name: 'label', title: 'Kleine Beschriftung', type: 'string', group: 'header'}),
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

    defineField({name: 'clientsLabel', title: 'Überschrift Kunden', type: 'string', group: 'clients'}),
    defineField({
      name: 'clients',
      title: 'Kunden-Logos',
      type: 'array',
      group: 'clients',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'name', title: 'Name', type: 'string', validation: (r) => r.required()}),
            defineField({name: 'logo', title: 'Logo', type: 'photo'}),
            defineField({name: 'url', title: 'Webseite', type: 'url'}),
          ],
          preview: {select: {title: 'name', media: 'logo'}},
        },
      ],
    }),

    defineField({name: 'haltungLabel', title: 'Überschrift Haltung', type: 'string', group: 'haltung'}),
    defineField({
      name: 'haltungStatement',
      title: 'Aussage',
      type: 'text',
      rows: 3,
      group: 'haltung',
      description: 'Der große Satz.',
    }),
    defineField({name: 'haltungText', title: 'Fließtext', type: 'text', rows: 5, group: 'haltung'}),

    defineField({name: 'leistungenLabel', title: 'Kleine Beschriftung', type: 'string', group: 'leistungen'}),
    defineField({name: 'leistungenTitle', title: 'Überschrift', type: 'string', group: 'leistungen'}),
    defineField({
      name: 'services',
      title: 'Leistungen',
      type: 'array',
      group: 'leistungen',
      of: [{type: 'reference', to: [{type: 'service'}]}],
    }),

    defineField({name: 'fuerWenLabel', title: 'Überschrift Für wen', type: 'string', group: 'fuerWen'}),
    defineField({
      name: 'fuerWen',
      title: 'Zielgruppen',
      type: 'array',
      group: 'fuerWen',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'title', title: 'Titel', type: 'string', validation: (r) => r.required()}),
            defineField({name: 'text', title: 'Text', type: 'string'}),
          ],
          preview: {select: {title: 'title', subtitle: 'text'}},
        },
      ],
    }),

    defineField({name: 'cta', title: 'Aufruf am Seitenende', type: 'cta', group: 'cta'}),
    i18nField,
  ],
  preview: {prepare: () => ({title: 'Beratung'})},
})
