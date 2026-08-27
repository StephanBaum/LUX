import type {StructureResolver} from 'sanity/structure'

/** Fixed ids for the three legal documents. */
export const LEGAL_PAGES: {id: string; title: string}[] = [
  {id: 'legal-impressum', title: 'Impressum'},
  {id: 'legal-datenschutz', title: 'Datenschutz'},
  {id: 'legal-agb', title: 'AGB'},
]

const singleton = (S: any, type: string, title: string, id = type) =>
  S.listItem()
    .title(title)
    .id(id)
    .child(S.document().schemaType(type).documentId(id).title(title))

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Inhalt')
    .items([
      S.listItem()
        .title('Seiten')
        .child(
          S.list()
            .title('Seiten')
            .items([
              singleton(S, 'homePage', 'Startseite'),
              singleton(S, 'studioPage', 'Studio'),
              singleton(S, 'mietenPage', 'Mieten'),
              singleton(S, 'workshopsPage', 'Workshops'),
              singleton(S, 'veranstaltungenPage', 'Veranstaltungen'),
              singleton(S, 'beratungPage', 'Beratung'),
              S.divider(),
              ...LEGAL_PAGES.map((p) => singleton(S, 'legalPage', p.title, p.id)),
            ]),
        ),

      S.divider(),

      S.listItem()
        .title('Workshops')
        .schemaType('workshop')
        .child(S.documentTypeList('workshop').title('Workshops').defaultOrdering([{field: 'startAt', direction: 'desc'}])),

      S.listItem()
        .title('Veranstaltungen')
        .schemaType('event')
        .child(S.documentTypeList('event').title('Veranstaltungen').defaultOrdering([{field: 'startAt', direction: 'desc'}])),

      S.divider(),

      S.listItem()
        .title('Studio')
        .child(
          S.list()
            .title('Studio')
            .items([
              S.documentTypeListItem('person').title('Personen'),
              S.documentTypeListItem('room').title('Räume'),
              S.documentTypeListItem('equipmentItem').title('Equipment'),
              S.documentTypeListItem('galleryImage').title('Galerien'),
            ]),
        ),

      S.listItem()
        .title('Beratung')
        .child(S.documentTypeList('service').title('Leistungen')),

      S.divider(),

      singleton(S, 'siteSettings', 'Einstellungen'),
    ])
