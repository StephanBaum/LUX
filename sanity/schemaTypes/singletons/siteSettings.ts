import {defineField, defineType} from 'sanity'
import {germanPreview} from '../../lib/fields'

export default defineType({
  name: 'siteSettings',
  title: 'Einstellungen',
  type: 'document',
  groups: [
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
        defineField({name: 'phone', title: 'Telefon', type: 'internationalizedArrayString'}),
        defineField({name: 'fax', title: 'Fax', type: 'string'}),
        defineField({name: 'email', title: 'E-Mail', type: 'string'}),
        defineField({name: 'updated', title: 'Stand', type: 'internationalizedArrayString'}),
        defineField({name: 'contact', title: 'Kontakt', type: 'internationalizedArrayString'}),
        defineField({name: 'inquire', title: 'Anfragen', type: 'internationalizedArrayString'}),
        defineField({name: 'selection', title: 'Auswahl', type: 'internationalizedArrayString'}),
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
        defineField({name: 'impressum', title: 'Impressum', type: 'internationalizedArrayString'}),
        defineField({name: 'datenschutz', title: 'Datenschutz', type: 'internationalizedArrayString'}),
        defineField({name: 'agb', title: 'AGB', type: 'internationalizedArrayString'}),
      ],
    }),
    defineField({name: 'partnersLabel', title: 'Überschrift Partner-Logos', type: 'internationalizedArrayString', group: 'nav'}),
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
            // A brand name is the same in every language.
            defineField({name: 'name', title: 'Name', type: 'string'}),
            defineField({name: 'logo', title: 'Logo', type: 'photo'}),
            defineField({name: 'url', title: 'Webseite', type: 'url'}),
          ],
          preview: germanPreview({title: 'name', media: 'logo'}),
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
        defineField({name: 'namePlaceholder', title: 'Platzhalter Name', type: 'internationalizedArrayString'}),
        defineField({name: 'companyPlaceholder', title: 'Platzhalter Firma', type: 'internationalizedArrayString'}),
        defineField({name: 'emailPlaceholder', title: 'Platzhalter E-Mail', type: 'internationalizedArrayString'}),
        defineField({name: 'phonePlaceholder', title: 'Platzhalter Telefon', type: 'internationalizedArrayString'}),
        defineField({name: 'inquiryPlaceholder', title: 'Platzhalter Anfrage', type: 'internationalizedArrayString'}),
        defineField({name: 'messagePlaceholder', title: 'Platzhalter Nachricht', type: 'internationalizedArrayString'}),
        defineField({name: 'submit', title: 'Button-Text', type: 'internationalizedArrayString'}),
        defineField({name: 'success', title: 'Erfolgsmeldung', type: 'internationalizedArrayString'}),
        defineField({name: 'errorName', title: 'Fehler: Name', type: 'internationalizedArrayString'}),
        defineField({name: 'errorEmail', title: 'Fehler: E-Mail', type: 'internationalizedArrayString'}),
        defineField({name: 'errorMessage', title: 'Fehler: Nachricht', type: 'internationalizedArrayString'}),
        defineField({name: 'errorInquiry', title: 'Fehler: Anfrage', type: 'internationalizedArrayString'}),
        defineField({name: 'selectionLabel', title: 'Beschriftung Auswahl', type: 'internationalizedArrayString'}),
        defineField({name: 'noSelection', title: 'Text ohne Auswahl', type: 'internationalizedArrayString'}),
      ],
    }),

    defineField({
      name: 'calendar',
      title: 'Kalender-Texte',
      type: 'object',
      group: 'calendar',
      fields: [
        defineField({name: 'hint', title: 'Hinweis', type: 'internationalizedArrayString'}),
        defineField({name: 'blockedHint', title: 'Belegt', type: 'internationalizedArrayString'}),
        defineField({name: 'blockedWarning', title: 'Warnung bei belegten Tagen', type: 'internationalizedArrayText'}),
        defineField({
          name: 'months',
          title: 'Monatsnamen',
          type: 'internationalizedArrayString',
          description: 'Zwölf Namen, mit Komma getrennt.',
        }),
        defineField({
          name: 'monthsShort',
          title: 'Monatsnamen kurz',
          type: 'internationalizedArrayString',
          description: 'Zwölf Kurzformen, mit Komma getrennt.',
        }),
      ],
    }),

    defineField({name: 'defaultOgImage', title: 'Standard-Vorschaubild (Social Media)', type: 'photo', group: 'seo'}),
    defineField({name: 'metaDescription', title: 'Standard-Beschreibung', type: 'internationalizedArrayText', group: 'seo'}),

  ],
  preview: {prepare: () => ({title: 'Einstellungen'})},
})
