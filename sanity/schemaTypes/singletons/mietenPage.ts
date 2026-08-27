import {defineField, defineType} from 'sanity'
import {i18nField} from '../../lib/fields'

export default defineType({
  name: 'mietenPage',
  title: 'Mieten',
  type: 'document',
  groups: [
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
        defineField({name: 'rooms', title: 'Räume', type: 'string'}),
        defineField({name: 'equipment', title: 'Equipment', type: 'string'}),
        defineField({name: 'period', title: 'Zeitraum', type: 'string'}),
        defineField({name: 'inquiry', title: 'Anfrage', type: 'string'}),
      ],
    }),
    defineField({name: 'roomsEquipmentLabel', title: 'Beschriftung "Ausstattung"', type: 'string', group: 'sections'}),
    defineField({
      name: 'equipmentLabels',
      title: 'Equipment-Kategorien',
      type: 'object',
      group: 'sections',
      fields: [
        defineField({name: 'light', title: 'Licht', type: 'string'}),
        defineField({name: 'camera', title: 'Kamera', type: 'string'}),
        defineField({name: 'grip', title: 'Grip', type: 'string'}),
      ],
    }),
    defineField({name: 'calendarHint', title: 'Hinweis am Kalender', type: 'string', group: 'sections'}),
    defineField({
      name: 'form',
      title: 'Formular-Texte',
      type: 'object',
      group: 'form',
      fields: [
        defineField({name: 'namePlaceholder', title: 'Platzhalter Name', type: 'string'}),
        defineField({name: 'companyPlaceholder', title: 'Platzhalter Firma', type: 'string'}),
        defineField({name: 'inquiryPlaceholder', title: 'Platzhalter Anfrage', type: 'string'}),
        defineField({name: 'selectionLabel', title: 'Beschriftung Auswahl', type: 'string'}),
        defineField({name: 'noSelection', title: 'Text ohne Auswahl', type: 'string'}),
        defineField({name: 'submit', title: 'Button-Text', type: 'string'}),
        defineField({name: 'success', title: 'Erfolgsmeldung', type: 'string'}),
        defineField({name: 'errorName', title: 'Fehler: Name', type: 'string'}),
        defineField({name: 'errorEmail', title: 'Fehler: E-Mail', type: 'string'}),
        defineField({name: 'errorInquiry', title: 'Fehler: Anfrage', type: 'string'}),
      ],
    }),
    i18nField,
  ],
  preview: {prepare: () => ({title: 'Mieten'})},
})
