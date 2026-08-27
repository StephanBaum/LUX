import type {StructureResolver} from 'sanity/structure'

/** Fixed ids for the three legal documents. */
export const LEGAL_PAGES: {id: string; title: string}[] = [
  {id: 'legal-impressum', title: 'Impressum'},
  {id: 'legal-datenschutz', title: 'Datenschutz'},
  {id: 'legal-agb', title: 'AGB'},
]

/**
 * Every list item and every list needs its own id. Sanity throws on a missing
 * one and the pane renders blank, which also breaks deep links into a
 * document — opening an image inside an array, for instance.
 */
const singleton = (S: any, type: string, title: string, id = type) =>
  S.listItem()
    .id(id)
    .title(title)
    .child(S.document().id(id).schemaType(type).documentId(id).title(title))

export const structure: StructureResolver = (S) =>
  S.list()
    .id('root')
    .title('Inhalt')
    .items([
      S.listItem()
        .id('seiten')
        .title('Seiten')
        .child(
          S.list()
            .id('seiten')
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
        .id('workshops')
        .title('Workshops')
        .schemaType('workshop')
        .child(
          S.documentTypeList('workshop')
            .title('Workshops')
            .defaultOrdering([{field: 'startAt', direction: 'desc'}]),
        ),

      S.listItem()
        .id('veranstaltungen')
        .title('Veranstaltungen')
        .schemaType('event')
        .child(
          S.documentTypeList('event')
            .title('Veranstaltungen')
            .defaultOrdering([{field: 'startAt', direction: 'desc'}]),
        ),

      S.divider(),

      S.listItem()
        .id('studio')
        .title('Studio')
        .child(
          S.list()
            .id('studio')
            .title('Studio')
            .items([
              S.documentTypeListItem('person').title('Personen'),
              S.documentTypeListItem('room').title('Räume'),
              S.documentTypeListItem('equipmentItem').title('Equipment'),
            ]),
        ),

      S.listItem()
        .id('beratung')
        .title('Beratung')
        .schemaType('service')
        .child(S.documentTypeList('service').title('Leistungen')),

      S.divider(),

      singleton(S, 'siteSettings', 'Einstellungen'),
    ])
