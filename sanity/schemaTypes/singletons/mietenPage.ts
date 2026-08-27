import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'mietenPage',
  title: 'Mieten',
  type: 'document',
  groups: [
    {name: 'seo', title: 'Menü & Google'},
    {name: 'header', title: 'Seitenkopf'},
    {name: 'sections', title: 'Abschnitts-Überschriften'},
    {name: 'form', title: 'Anfrage-Formular'},
  ],
  fields: [
    defineField({name: 'header', title: 'Seitenkopf', type: 'pageHeader', group: 'header'}),
    defineField({
      name: 'sectionLabels',
      title: 'Abschnitts-Überschriften',
      type: 'object',
      group: 'sections',
      fields: [
        defineField({name: 'rooms', title: 'Räume', type: 'internationalizedArrayString'}),
        defineField({name: 'equipment', title: 'Equipment', type: 'internationalizedArrayString'}),
        defineField({name: 'period', title: 'Zeitraum', type: 'internationalizedArrayString'}),
        defineField({name: 'inquiry', title: 'Anfrage', type: 'internationalizedArrayString'}),
      ],
    }),
    defineField({name: 'roomsEquipmentLabel', title: 'Beschriftung "Ausstattung"', type: 'internationalizedArrayString', group: 'sections'}),
    defineField({
      name: 'equipmentLabels',
      title: 'Equipment-Kategorien',
      type: 'object',
      group: 'sections',
      fields: [
        defineField({name: 'light', title: 'Licht', type: 'internationalizedArrayString'}),
        defineField({name: 'camera', title: 'Kamera', type: 'internationalizedArrayString'}),
        defineField({name: 'grip', title: 'Grip', type: 'internationalizedArrayString'}),
      ],
    }),
    defineField({name: 'calendarHint', title: 'Hinweis am Kalender', type: 'internationalizedArrayString', group: 'sections'}),
    defineField({
      name: 'form',
      title: 'Formular-Texte',
      type: 'object',
      group: 'form',
      fields: [
        defineField({name: 'namePlaceholder', title: 'Platzhalter Name', type: 'internationalizedArrayString'}),
        defineField({name: 'companyPlaceholder', title: 'Platzhalter Firma', type: 'internationalizedArrayString'}),
        defineField({name: 'inquiryPlaceholder', title: 'Platzhalter Anfrage', type: 'internationalizedArrayString'}),
        defineField({name: 'selectionLabel', title: 'Beschriftung Auswahl', type: 'internationalizedArrayString'}),
        defineField({name: 'noSelection', title: 'Text ohne Auswahl', type: 'internationalizedArrayString'}),
        defineField({name: 'submit', title: 'Button-Text', type: 'internationalizedArrayString'}),
        defineField({name: 'success', title: 'Erfolgsmeldung', type: 'internationalizedArrayString'}),
        defineField({name: 'errorName', title: 'Fehler: Name', type: 'internationalizedArrayString'}),
        defineField({name: 'errorEmail', title: 'Fehler: E-Mail', type: 'internationalizedArrayString'}),
        defineField({name: 'errorInquiry', title: 'Fehler: Anfrage', type: 'internationalizedArrayString'}),
      ],
    }),
    defineField({
      name: 'navLabel',
      title: 'Name im Menü',
      type: 'internationalizedArrayString',
      group: 'seo',
      description: 'So heißt die Seite in Menü und Fußzeile.',
    }),
    defineField({name: 'seo', title: 'Suchmaschine & Vorschau', type: 'pageSeo', group: 'seo'}),
  ],
  preview: {prepare: () => ({title: 'Mieten'})},
})
