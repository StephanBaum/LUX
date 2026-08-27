/**
 * Phase 2 — move the V3 German content into Sanity.
 *
 * Every document gets a fixed _id and is written with createOrReplace, so the
 * script can be run again at any time and always produces the same result.
 *
 * Replacing a document also drops the image fields, so the image seed has to
 * run after this one. `npm run migrate` does both in order — prefer that over
 * calling this script on its own.
 */
import {client, readContent} from './lib.mjs'
import {h3, p, li, body} from './portable-text.mjs'

const global = readContent('_global')
const index = readContent('index')
const studio = readContent('studio')
const mieten = readContent('mieten')
const workshops = readContent('workshops')
const veranstaltungen = readContent('veranstaltungen')
const impressum = readContent('impressum')
const datenschutz = readContent('datenschutz')
const agb = readContent('agb')

const ref = (id) => ({_type: 'reference', _ref: id})
const keyed = (items) => items.map((item, i) => ({...item, _key: `i${i}`}))

function cta(source) {
  return {
    title: source.title,
    text: source.text,
    linkLabel: source.link,
    linkHref: `mailto:${global.contact.email}`,
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ---------------------------------------------------------------- people ----

/**
 * One document per photographer. V3 only ever showed a joint profile, so the
 * individual biographies below are a best guess written from the V3 sentence
 * "Martin – Portrait & Landschaft. Florian – Werbung & Portrait." The joint
 * text stays on the page section, not here.
 */
const people = [
  {
    _id: 'person-martin',
    _type: 'person',
    name: 'Martin Luxenburger',
    slug: {_type: 'slug', current: 'martin-luxenburger'},
    role: 'Portrait & Landschaft',
    email: global.contact.email,
    bio: 'Martin fotografiert seit 1985 analog. Portrait und Landschaft, meist auf Groß- und Mittelformat, entwickelt und vergrößert in der eigenen Dunkelkammer. Er gibt sein Handwerk in den Workshops des Studios weiter.',
    expertise: keyed([
      {
        _type: 'expertiseItem',
        title: 'Analoge Fotografie',
        detail: 'Großformat, Mittelformat, Dunkelkammer',
        year: 'seit 1985',
      },
    ]),
    order: 1,
  },
  {
    _id: 'person-florian',
    _type: 'person',
    name: 'Florian Luxenburger',
    slug: {_type: 'slug', current: 'florian-luxenburger'},
    role: 'Werbung & Portrait',
    email: global.contact.email,
    bio: 'Florian arbeitet für Agenturen, Marken und Produktionen — als Art Director, Fotograf und Director of Photography. Er unterrichtet analoge Fotografie an der Hochschule und setzt generative Verfahren als Werkzeug in der Bildproduktion ein.',
    expertise: keyed([
      {
        _type: 'expertiseItem',
        title: 'Digitale Produktion',
        detail: 'Werbung, Portrait, Produktfotografie',
      },
    ]),
    order: 2,
  },
]

// ----------------------------------------------------------------- rooms ----

const rooms = [
  {id: 'room-large', key: 'large', size: '250 m²', features: 3, order: 1},
  {id: 'room-small', key: 'small', size: '80 m²', features: 2, order: 2},
  {id: 'room-analog', key: 'analog', size: '45 m²', features: 3, order: 3},
].map((r) => ({
  _id: r.id,
  _type: 'room',
  title: mieten.rooms[`${r.key}_title`],
  description: mieten.rooms[`${r.key}_desc`],
  size: r.size,
  features: Array.from({length: r.features}, (_, i) => mieten.rooms[`${r.key}_feature${i + 1}`]).filter(Boolean),
  order: r.order,
}))

// ------------------------------------------------------------- equipment ----

const EQUIPMENT = [
  ['profoto-d2', 'Profoto D2 1000', 'light'],
  ['profoto-b10', 'Profoto B10 Plus', 'light'],
  ['aputure-600d', 'Aputure 600D Pro', 'light'],
  ['arri-skypanel', 'ARRI SkyPanel S60', 'light'],
  ['dedolight', 'Dedolight DLED7', 'light'],
  ['hasselblad-x2d', 'Hasselblad X2D 100C', 'camera'],
  ['phase-one', 'Phase One IQ4 150MP', 'camera'],
  ['red-v-raptor', 'RED V-Raptor 8K', 'camera'],
  ['c-stand', 'C-Stand Set', 'grip'],
  ['softbox', 'Softbox 120cm', 'grip'],
  ['reflector', 'Reflektor 5-in-1', 'grip'],
]

const equipment = EQUIPMENT.map(([slug, name, category], i) => ({
  _id: `equipment-${slug}`,
  _type: 'equipmentItem',
  name,
  category,
  order: i + 1,
}))

// --------------------------------------------------------------- courses ----

const WORKSHOP_INFOS = {
  1: [['item1_info1_title', 'item1_info1_detail'], ['item1_info2_title', 'item1_info2_detail']],
  2: [['item2_info_title', 'item2_info_detail']],
  3: [['item3_info1_title', 'item3_info1_detail'], ['item3_info2_title', 'item3_info2_detail']],
}

const workshopDocs = [1, 2, 3].map((n) => ({
  _id: `workshop-v3-${n}`,
  _type: 'workshop',
  title: workshops.workshops[`item${n}_title`],
  slug: {_type: 'slug', current: slugify(workshops.workshops[`item${n}_title`])},
  description: workshops.workshops[`item${n}_desc`],
  teacher: ref('person-martin'),
  infos: keyed(
    WORKSHOP_INFOS[n].map(([labelKey, valueKey]) => ({
      _type: 'infoRow',
      label: workshops.workshops[labelKey],
      value: workshops.workshops[valueKey],
    })),
  ),
  // V3 never carried a real date for workshops, only a duration.
  syncStatus: 'date-missing',
  syncMessage: 'Kein Termin hinterlegt – bitte Beginn und Ende eintragen.',
}))

const EVENT_INFOS = {
  1: [['item1_info_title', 'item1_info_detail']],
  2: [['item2_info_title', 'item2_info_detail']],
  3: [['item3_info1_title', 'item3_info1_detail'], ['item3_info2_title', 'item3_info2_detail']],
}

// Parsed from the German date strings the V3 page printed in its info rows.
const EVENT_DATES = {
  1: ['2026-12-20T18:00:00.000Z', '2026-12-20T21:00:00.000Z'],
  2: ['2026-03-21T19:00:00.000Z', '2026-03-21T22:00:00.000Z'],
  3: ['2026-08-01T12:00:00.000Z', '2026-08-01T15:00:00.000Z'],
}

const eventDocs = [1, 2, 3].map((n) => ({
  _id: `event-v3-${n}`,
  _type: 'event',
  title: veranstaltungen.events[`item${n}_title`],
  slug: {_type: 'slug', current: slugify(veranstaltungen.events[`item${n}_title`])},
  description: veranstaltungen.events[`item${n}_desc`],
  infos: keyed(
    EVENT_INFOS[n].map(([labelKey, valueKey]) => ({
      _type: 'infoRow',
      label: veranstaltungen.events[labelKey],
      value: veranstaltungen.events[valueKey],
    })),
  ),
  startAt: EVENT_DATES[n][0],
  endAt: EVENT_DATES[n][1],
}))

// -------------------------------------------------------------- services ----

/**
 * The Beratung page has no V3 precedent. All of its copy comes from the
 * approved canvas design "Option B — Haltung zuerst" and is written in the
 * first person, because the page sells Florian personally, not the studio.
 */
const services = [
  {
    _id: 'service-art-direction',
    title: 'Art Direction',
    description:
      'Ich verantworte die Bildsprache eines Projekts: Konzept, Referenz, Auswahl, Freigabe. Am Ende steht eine Kampagne, die eine Haltung hat.',
    order: 1,
  },
  {
    _id: 'service-ki-fotografie',
    title: 'Fotografie mit KI',
    description:
      'Generative Bildproduktion auf fotografischer Grundlage. Kein Prompt-Zufall, sondern Licht, Optik und Komposition — mit anderen Mitteln.',
    order: 2,
  },
  {
    _id: 'service-dop',
    title: 'Director of Photography',
    description:
      'Kamera und Licht für Film und Bewegtbild. Von der Auflösung des Buchs bis zum letzten Drehtag.',
    order: 3,
  },
].map((s) => ({...s, _type: 'service'}))

// ------------------------------------------------------------ singletons ----

const siteSettings = {
  _id: 'siteSettings',
  _type: 'siteSettings',
  studioName: global.contact.studio_name,
  companyName: global.contact.company,
  street: global.contact.street,
  postalCode: global.contact.city.split(' ')[0],
  city: global.contact.city.split(' ').slice(1).join(' '),
  country: 'Deutschland',
  phone: global.contact.phone,
  fax: global.contact.fax,
  mobile: global.contact.mobile,
  email: global.contact.email,
  contactLabels: {
    phone: impressum.labels.phone,
    fax: impressum.labels.fax,
    email: impressum.labels.email,
    updated: impressum.labels.updated,
    contact: global.common.contact_label,
    inquire: global.common.inquire,
    selection: global.common.selection,
  },
  navLabels: {
    studio: global.nav.studio,
    mieten: global.nav.mieten,
    workshops: global.nav.workshops,
    veranstaltungen: global.nav.veranstaltungen,
    beratung: 'Beratung',
  },
  footerLabels: {
    impressum: global.footer.impressum,
    datenschutz: global.footer.datenschutz,
    agb: global.footer.agb,
  },
  instagram: 'https://www.instagram.com/studioluxenburger',
  partnersLabel: global.footer.partners_label,
  // V3 hard-coded these three names in the footer and the menu overlay.
  partnerLogos: keyed(['HASSELBLAD', 'ARRI', 'RED'].map((name) => ({name}))),
  form: {
    namePlaceholder: global.form.name_placeholder,
    companyPlaceholder: global.form.company_placeholder,
    emailPlaceholder: global.form.email_placeholder,
    phonePlaceholder: global.form.phone_placeholder,
    inquiryPlaceholder: global.form.inquiry_placeholder,
    messagePlaceholder: global.form.message_placeholder,
    submit: global.form.submit,
    success: global.form.success,
    errorName: global.form.error_name,
    errorEmail: global.form.error_email,
    errorMessage: global.form.error_message,
    errorInquiry: global.form.error_inquiry,
    selectionLabel: global.form.selection_label,
    noSelection: global.form.no_selection,
  },
  calendar: {
    hint: global.calendar.hint,
    blockedHint: global.calendar.blocked_hint,
    blockedWarning: global.calendar.blocked_warning,
    months: global.calendar.months,
    monthsShort: global.calendar.months_short,
  },
}

const homePage = {
  _id: 'homePage',
  _type: 'homePage',
  sectionStudio: {
    label: index.section_studio.label,
    text: index.section_studio.text,
  },
  sectionMenschen: {
    label: index.section_menschen.label,
    title: index.section_menschen.title,
    bio: index.section_menschen.bio,
    educationTitle: index.section_menschen.education_title,
    expertise: keyed([
      {
        _type: 'expertiseItem',
        title: index.section_menschen.expertise1_title,
        detail: index.section_menschen.expertise1_detail,
        year: index.section_menschen.expertise1_year,
      },
      {
        _type: 'expertiseItem',
        title: index.section_menschen.expertise2_title,
        detail: index.section_menschen.expertise2_detail,
      },
    ]),
    people: keyed([ref('person-martin'), ref('person-florian')]),
  },
  sliderHint: index.slider.hint,
  cta: cta(index.cta),
}

const studioPage = {
  _id: 'studioPage',
  _type: 'studioPage',
  header: {title: studio.header.title, text: studio.header.text},
  sectionMenschen: {
    label: studio.section_menschen.label,
    title: studio.section_menschen.title,
    bio: studio.section_menschen.bio,
    educationTitle: studio.section_menschen.education_title,
    expertise: keyed([
      {
        _type: 'expertiseItem',
        title: studio.section_menschen.expertise1_title,
        detail: studio.section_menschen.expertise1_detail,
        year: studio.section_menschen.expertise1_year,
      },
      {
        _type: 'expertiseItem',
        title: studio.section_menschen.expertise2_title,
        detail: studio.section_menschen.expertise2_detail,
      },
    ]),
    people: keyed([ref('person-martin'), ref('person-florian')]),
  },
  // V3 hard-coded this label above the equipment slider; it was never in the content files.
  sliderLabel: 'Das Equipment',
  sliderHint: index.slider.hint,
  cta: cta(studio.cta),
}

const mietenPage = {
  _id: 'mietenPage',
  _type: 'mietenPage',
  header: {title: mieten.header.title, text: mieten.header.text},
  sectionLabels: {
    rooms: mieten.sections.rooms,
    equipment: mieten.sections.equipment,
    period: mieten.sections.period,
    inquiry: mieten.sections.inquiry,
  },
  roomsEquipmentLabel: mieten.rooms.equipment_label,
  equipmentLabels: {
    light: mieten.equipment.light,
    camera: mieten.equipment.camera,
    grip: mieten.equipment.grip,
  },
  calendarHint: mieten.calendar.hint,
  form: {
    namePlaceholder: mieten.form.name_placeholder,
    companyPlaceholder: mieten.form.company_placeholder,
    inquiryPlaceholder: mieten.form.inquiry_placeholder,
    selectionLabel: mieten.form.selection_label,
    noSelection: mieten.form.no_selection,
    submit: mieten.form.submit,
    success: mieten.form.success,
    errorName: mieten.form.error_name,
    errorEmail: global.form.error_email,
    errorInquiry: mieten.form.error_inquiry,
  },
}

const workshopsPage = {
  _id: 'workshopsPage',
  _type: 'workshopsPage',
  header: {title: workshops.header.title, text: workshops.header.text},
  registrationLabel: workshops.workshops.registration_label,
  emptyText: 'Zurzeit sind keine Workshops ausgeschrieben.',
  cta: cta(workshops.cta),
}

const veranstaltungenPage = {
  _id: 'veranstaltungenPage',
  _type: 'veranstaltungenPage',
  header: {title: veranstaltungen.header.title, text: veranstaltungen.header.text},
  detailsTitle: veranstaltungen.events.details_title,
  registrationLabel: veranstaltungen.events.registration_label,
  emptyText: 'Zurzeit sind keine Veranstaltungen geplant.',
  cta: cta(veranstaltungen.cta),
}

const beratungPage = {
  _id: 'beratungPage',
  _type: 'beratungPage',
  label: 'Beratung',
  header: {
    title: 'Externe Beratung',
    text: 'Experten-Bildkompetenz für Agenturen, Marken und Produktionen.',
  },
  clientsLabel: 'Ausgewählte Kunden',
  // Six real client names still have to come from the client.
  clients: keyed(
    [1, 2, 3, 4, 5, 6].map((i) => ({name: `Kunde ${i}`})),
  ),
  haltungLabel: 'Haltung',
  haltungStatement:
    'Bildsprache ist kein Geschmack. Sie ist eine Entscheidung — und ich treffe sie. Im Konzept, am Set und im generativen Bild.',
  haltungText:
    'Ich unterrichte analoge Fotografie an der Hochschule und arbeite seit Jahren mit generativen Verfahren. Beides gehört zusammen: Wer weiß, wie ein Bild physikalisch entsteht, weiß auch, was eine Maschine daraus machen kann — und was nicht.',
  leistungenLabel: 'Leistungen',
  leistungenTitle: 'Drei Rollen. Eine Handschrift.',
  services: keyed(services.map((s) => ref(s._id))),
  fuerWenLabel: 'Für wen',
  fuerWen: keyed([
    {title: 'Agenturen', text: 'Kampagnen und Pitches, die visuell eine Haltung brauchen'},
    {title: 'Marken', text: 'Bildwelten aufbauen und über Jahre konsistent halten'},
    {title: 'Produktionen', text: 'Kamera und Licht für Film und Bewegtbild'},
  ]),
  cta: {
    title: 'Anfragen',
    text: 'Erzählen Sie mir, worum es geht. Wenn es passt, sage ich zu. Wenn nicht, sage ich Ihnen, wer besser passt.',
    linkLabel: 'Kontakt',
    linkHref: `mailto:${global.contact.email}`,
  },
}

// ----------------------------------------------------------------- legal ----

const section = (title, ...blocks) => ({
  _type: 'legalSection',
  title,
  body: body(...blocks),
})

const legalImpressum = {
  _id: 'legal-impressum',
  _type: 'legalPage',
  title: impressum.header.title,
  updatedLabel: impressum.labels.updated,
  sections: keyed([
    section(
      impressum.sections.provider,
      p(global.contact.company),
      p(global.contact.street),
      p(global.contact.city),
    ),
    section(
      impressum.sections.contact,
      p(`${impressum.labels.phone} ${global.contact.phone}`),
      p(`${impressum.labels.fax} ${global.contact.fax}`),
      p(`${impressum.labels.email} ${global.contact.email}`),
    ),
    section(impressum.sections.representatives, p('Florian Luxenburger, Martin Luxenburger')),
    section(impressum.sections.vat, p(impressum.content.vat_info)),
    section(
      impressum.sections.responsibility,
      p(impressum.content.responsibility_info),
      p(`${global.contact.company}, ${global.contact.street}, ${global.contact.city}`),
    ),
    section(
      impressum.sections.dispute,
      p(impressum.content.dispute_info),
      p('https://ec.europa.eu/consumers/odr/'),
      p(impressum.content.dispute_note),
    ),
  ]),
}

const legalDatenschutz = {
  _id: 'legal-datenschutz',
  _type: 'legalPage',
  title: datenschutz.header.title,
  updatedLabel: datenschutz.labels.updated,
  sections: keyed([
    section(datenschutz.sections.overview, p(datenschutz.content.overview_intro)),
    section(
      datenschutz.sections.responsible,
      p(global.contact.company),
      p(global.contact.street),
      p(global.contact.city),
      p(`${datenschutz.labels.phone} ${global.contact.phone}`),
      p(`${datenschutz.labels.email} ${global.contact.email}`),
    ),
    section(
      datenschutz.sections.data_collection,
      h3(datenschutz.content.server_logs_title),
      p(datenschutz.content.server_logs_text),
      [1, 2, 3, 4, 5, 6].map((i) => li(datenschutz.content[`log_item${i}`])),
      p(datenschutz.content.server_logs_note),
    ),
    section(datenschutz.sections.contact_form, p(datenschutz.content.contact_form_text)),
    section(datenschutz.sections.cookies, p(datenschutz.content.cookies_text)),
    section(
      datenschutz.sections.rights,
      p(datenschutz.content.rights_intro),
      [1, 2, 3, 4, 5].map((i) => li(datenschutz.content[`right_item${i}`])),
      p(datenschutz.content.rights_contact),
    ),
    // V3 said the site loads Google Fonts. It no longer does, and a privacy
    // policy that describes a service the site does not use is worse than
    // useless — so this section is rewritten to match what actually happens.
    section(
      datenschutz.sections.external,
      p('Schriftarten: Diese Webseite lädt alle Schriften von unserem eigenen Server. Es werden keine Google Fonts und keine anderen externen Schriftdienste eingebunden. Beim Aufruf der Seite wird deshalb keine Verbindung zu Google hergestellt.'),
      p('Hosting: Die Webseite wird bei der Vercel Inc. gehostet. Beim Aufruf werden die üblichen Server-Log-Daten verarbeitet (siehe Abschnitt 3).'),
      p('Bilder: Die Bilder dieser Webseite werden über den Medien-Dienst Sanity (Sanity AS, Norwegen) ausgeliefert. Dabei wird Ihre IP-Adresse an diesen Dienst übermittelt, damit das Bild an Ihren Browser gesendet werden kann. Es werden keine Cookies gesetzt und kein Nutzungsverhalten ausgewertet.'),
      p('Cookies: Diese Webseite setzt nur ein technisch notwendiges Cookie, das Ihre gewählte Sprache speichert. Dafür ist keine Einwilligung erforderlich.'),
    ),
  ]),
}

const legalAgb = {
  _id: 'legal-agb',
  _type: 'legalPage',
  title: agb.header.title,
  intro: agb.header.text,
  updatedLabel: agb.labels.updated,
  sections: keyed(
    [1, 2, 3, 4, 5, 6, 7, 8].map((i) =>
      section(
        agb.agb[`section${i}_title`],
        p(agb.agb[`section${i}_text1`]),
        p(agb.agb[`section${i}_text2`]),
      ),
    ),
  ),
}

// ------------------------------------------------------------------- run ----

const documents = [
  ...people,
  ...rooms,
  ...equipment,
  ...services,
  ...workshopDocs,
  ...eventDocs,
  siteSettings,
  homePage,
  studioPage,
  mietenPage,
  workshopsPage,
  veranstaltungenPage,
  beratungPage,
  legalImpressum,
  legalDatenschutz,
  legalAgb,
]

const missing = documents.filter((doc) => Object.values(doc).some((v) => v === undefined))
if (missing.length) {
  throw new Error(`Undefined field in: ${missing.map((d) => d._id).join(', ')}`)
}

// Documents that earlier versions of this script created and the model dropped.
const RETIRED = [
  // A dotted _id makes a Sanity document private (token-only), so every id
  // seeded that way had to be re-created with hyphens.
  'person.luxenburger',
  'person.martin',
  'person.florian',
  'room.large',
  'room.small',
  'room.analog',
  ...EQUIPMENT.map(([slug]) => `equipment.${slug}`),
  'service.art-direction',
  'service.ki-fotografie',
  'service.dop',
  ...[1, 2, 3].map((n) => `workshop.v3-${n}`),
  ...[1, 2, 3].map((n) => `event.v3-${n}`),
  'legal.impressum',
  'legal.datenschutz',
  'legal.agb',
]

/**
 * Seeding writes the published version of every document. Any draft left over
 * from a previous run would keep shadowing it in the Studio, so drafts of the
 * seeded documents are cleared as well.
 *
 * That means re-running this script DISCARDS unpublished edits. It is a build
 * tool, not something to run once the client is working in the Studio.
 */
const tx = documents.reduce((t, doc) => t.createOrReplace(doc), client.transaction())
documents.forEach((doc) => tx.delete(`drafts.${doc._id}`))
RETIRED.forEach((id) => tx.delete(`drafts.${id}`).delete(id))
await tx.commit()

console.log(`Migrated ${documents.length} documents into Sanity.`)
for (const doc of documents) console.log(`  ${doc._type.padEnd(22)} ${doc._id}`)
