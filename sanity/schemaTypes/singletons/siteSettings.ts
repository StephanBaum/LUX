import {defineField, defineType} from 'sanity'
import {i18nField} from '../../lib/fields'

export default defineType({
  name: 'siteSettings',
  title: 'Einstellungen',
  type: 'document',
  groups: [
    {name: 'i18n', title: 'Übersetzungen'},
    {name: 'contact', title: 'Kontakt'},
    {name: 'nav', title: 'Menü & Fußzeile'},
    {name: 'social', title: 'Social Media'},
    {name: 'form', title: 'Formular'},
    {name: 'calendar', title: 'Kalender'},
    {name: 'seo', title: 'SEO'},
  ],
  fields: [
    defineField({name: 'studioName', title: 'Studio-Name', type: 'string', group: 'contact'}),
    defineField({name: 'companyName', title: 'Firmenname', type: 'string', group: 'contact'}),
    defineField({name: 'street', title: 'Straße', type: 'string', group: 'contact'}),
    defineField({name: 'postalCode', title: 'PLZ', type: 'string', group: 'contact'}),
    defineField({name: 'city', title: 'Ort', type: 'string', group: 'contact'}),
    defineField({name: 'country', title: 'Land', type: 'string', group: 'contact'}),
    defineField({name: 'phone', title: 'Telefon', type: 'string', group: 'contact'}),
    defineField({name: 'fax', title: 'Fax', type: 'string', group: 'contact'}),
    defineField({name: 'mobile', title: 'Mobil', type: 'string', group: 'contact'}),
    defineField({name: 'email', title: 'E-Mail', type: 'string', group: 'contact'}),
    defineField({name: 'vatId', title: 'USt-IdNr.', type: 'string', group: 'contact'}),
    defineField({
      name: 'contactLabels',
      title: 'Beschriftungen',
      type: 'object',
      group: 'contact',
      fields: [
        defineField({name: 'phone', title: 'Telefon', type: 'string'}),
        defineField({name: 'fax', title: 'Fax', type: 'string'}),
        defineField({name: 'email', title: 'E-Mail', type: 'string'}),
        defineField({name: 'updated', title: 'Stand', type: 'string'}),
        defineField({name: 'contact', title: 'Kontakt', type: 'string'}),
        defineField({name: 'inquire', title: 'Anfragen', type: 'string'}),
        defineField({name: 'selection', title: 'Auswahl', type: 'string'}),
      ],
    }),

    defineField({
      name: 'navigation',
      title: 'Reihenfolge im Menü',
      type: 'array',
      group: 'nav',
      description:
        'Ziehen zum Sortieren. Name und Bild jeder Seite werden auf der Seite selbst ' +
        'gepflegt, unter "Menü & Google" — so passen sie immer zusammen.',
      of: [
        {
          type: 'reference',
          to: [
            {type: 'studioPage'},
            {type: 'mietenPage'},
            {type: 'workshopsPage'},
            {type: 'veranstaltungenPage'},
            {type: 'beratungPage'},
          ],
        },
      ],
    }),
    defineField({
      name: 'footerLabels',
      title: 'Fußzeile',
      type: 'object',
      group: 'nav',
      fields: [
        defineField({name: 'impressum', title: 'Impressum', type: 'string'}),
        defineField({name: 'datenschutz', title: 'Datenschutz', type: 'string'}),
        defineField({name: 'agb', title: 'AGB', type: 'string'}),
      ],
    }),
    defineField({name: 'partnersLabel', title: 'Überschrift Partner-Logos', type: 'string', group: 'nav'}),
    defineField({
      name: 'menuImages',
      title: 'Bilder im Menü-Overlay',
      type: 'array',
      group: 'nav',
      of: [{type: 'photo'}],
      description: 'Bei jedem Öffnen des Menüs wird eines davon zufällig gezeigt.',
    }),
    defineField({
      name: 'partnerLogos',
      title: 'Partner-Logos',
      type: 'array',
      group: 'nav',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'name', title: 'Name', type: 'string'}),
            defineField({name: 'logo', title: 'Logo', type: 'photo'}),
            defineField({name: 'url', title: 'Webseite', type: 'url'}),
          ],
          preview: {select: {title: 'name', media: 'logo'}},
        },
      ],
    }),

    defineField({name: 'instagram', title: 'Instagram-URL', type: 'url', group: 'social'}),
    defineField({name: 'facebook', title: 'Facebook-URL', type: 'url', group: 'social'}),
    defineField({name: 'linkedin', title: 'LinkedIn-URL', type: 'url', group: 'social'}),

    defineField({
      name: 'form',
      title: 'Formular-Texte',
      type: 'object',
      group: 'form',
      description: 'Gilt für alle Formulare auf der Seite.',
      fields: [
        defineField({name: 'namePlaceholder', title: 'Platzhalter Name', type: 'string'}),
        defineField({name: 'companyPlaceholder', title: 'Platzhalter Firma', type: 'string'}),
        defineField({name: 'emailPlaceholder', title: 'Platzhalter E-Mail', type: 'string'}),
        defineField({name: 'phonePlaceholder', title: 'Platzhalter Telefon', type: 'string'}),
        defineField({name: 'inquiryPlaceholder', title: 'Platzhalter Anfrage', type: 'string'}),
        defineField({name: 'messagePlaceholder', title: 'Platzhalter Nachricht', type: 'string'}),
        defineField({name: 'submit', title: 'Button-Text', type: 'string'}),
        defineField({name: 'success', title: 'Erfolgsmeldung', type: 'string'}),
        defineField({name: 'errorName', title: 'Fehler: Name', type: 'string'}),
        defineField({name: 'errorEmail', title: 'Fehler: E-Mail', type: 'string'}),
        defineField({name: 'errorMessage', title: 'Fehler: Nachricht', type: 'string'}),
        defineField({name: 'errorInquiry', title: 'Fehler: Anfrage', type: 'string'}),
        defineField({name: 'selectionLabel', title: 'Beschriftung Auswahl', type: 'string'}),
        defineField({name: 'noSelection', title: 'Text ohne Auswahl', type: 'string'}),
      ],
    }),

    defineField({
      name: 'calendar',
      title: 'Kalender-Texte',
      type: 'object',
      group: 'calendar',
      fields: [
        defineField({name: 'hint', title: 'Hinweis', type: 'string'}),
        defineField({name: 'blockedHint', title: 'Belegt', type: 'string'}),
        defineField({name: 'blockedWarning', title: 'Warnung bei belegten Tagen', type: 'text', rows: 2}),
        defineField({
          name: 'months',
          title: 'Monatsnamen',
          type: 'string',
          description: 'Zwölf Namen, mit Komma getrennt.',
        }),
        defineField({
          name: 'monthsShort',
          title: 'Monatsnamen kurz',
          type: 'string',
          description: 'Zwölf Kurzformen, mit Komma getrennt.',
        }),
      ],
    }),

    defineField({name: 'defaultOgImage', title: 'Standard-Vorschaubild (Social Media)', type: 'photo', group: 'seo'}),
    defineField({name: 'metaDescription', title: 'Standard-Beschreibung', type: 'text', rows: 3, group: 'seo'}),

    i18nField,
  ],
  preview: {prepare: () => ({title: 'Einstellungen'})},
})
