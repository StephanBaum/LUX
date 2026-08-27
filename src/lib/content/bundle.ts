import {getSiteContent} from '../sanity/queries'
import {type Lang} from './localize'
import {portableTextToHtml} from './portable-text'
import {KEY_BY_TYPE} from './navigation'

/**
 * Turns Sanity documents into the key shape `src/scripts/i18n.js` already
 * consumes: one bundle per page, `section.key`, plus a `_global` bundle that
 * every page falls back to.
 *
 * Nested objects and arrays are fine — `i18n.t()` walks a dotted path, so a
 * workshop reads as `workshops.<slug>.title`.
 */
export type Bundle = Record<string, any>
export type Bundles = Record<string, Bundle>

const LEGAL_IDS = {
  impressum: 'legal-impressum',
  datenschutz: 'legal-datenschutz',
  agb: 'legal-agb',
} as const

/** Drop keys with no value so `i18n.t()` falls through to the key name. */
function clean<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === '') continue
    out[key] = value
  }
  return out as T
}

const ctaKeys = (cta: any = {}) =>
  clean({title: cta.title, text: cta.text, link: cta.linkLabel})

const headerKeys = (header: any = {}) => clean({title: header.title, text: header.text})

const menschenKeys = (section: any = {}) =>
  clean({
    label: section.label,
    title: section.title,
    bio: section.bio,
    education_title: section.educationTitle,
    ...Object.fromEntries(
      (section.expertise ?? []).flatMap((item: any, i: number) => [
        [`expertise${i + 1}_title`, item?.title],
        [`expertise${i + 1}_detail`, item?.detail],
        [`expertise${i + 1}_year`, item?.year],
      ]),
    ),
  })

/**
 * Keyed by slug so the page can look a document up by the slug it renders.
 * Keys must not contain a dot — `i18n.t()` splits the lookup path on it — so a
 * document without a slug falls back to the part of its id after the dot.
 */
const keyFor = (doc: any) => doc.slug?.current ?? String(doc._id).replace(/^[a-z]+-/, '')

const bySlug = (docs: any[], toEntry: (doc: any) => Record<string, any>) =>
  Object.fromEntries(
    // A reference the client deleted resolves to null; skip it rather than fail the build.
    (docs ?? []).filter(Boolean).map((doc) => [keyFor(doc), clean(toEntry(doc))]),
  )

const infoKeys = (infos: any[] = []) =>
  infos.map((info) => clean({label: info?.label, value: info?.value}))

export async function getBundles(lang: Lang): Promise<Bundles> {
  const c = await getSiteContent(lang)

  const settings = c.siteSettings ?? {}

  // The menu words live on the pages themselves; collect them by page key.
  const navPages: any[] = (settings.navigation ?? []).filter(Boolean)
  const navLabels = Object.fromEntries(
    navPages
      .filter((page) => KEY_BY_TYPE[page?._type])
      .map((page) => [KEY_BY_TYPE[page._type], page.navLabel || page.header?.title]),
  )

  const _global = {
    nav: clean(navLabels),
    footer: clean({...(settings.footerLabels ?? {}), partners_label: settings.partnersLabel}),
    contact: clean({
      studio_name: settings.studioName,
      company: settings.companyName,
      street: settings.street,
      city: [settings.postalCode, settings.city].filter(Boolean).join(' '),
      phone: settings.phone,
      fax: settings.fax,
      mobile: settings.mobile,
      email: settings.email,
    }),
    form: clean({
      name_placeholder: settings.form?.namePlaceholder,
      company_placeholder: settings.form?.companyPlaceholder,
      email_placeholder: settings.form?.emailPlaceholder,
      phone_placeholder: settings.form?.phonePlaceholder,
      inquiry_placeholder: settings.form?.inquiryPlaceholder,
      message_placeholder: settings.form?.messagePlaceholder,
      submit: settings.form?.submit,
      success: settings.form?.success,
      error_name: settings.form?.errorName,
      error_email: settings.form?.errorEmail,
      error_message: settings.form?.errorMessage,
      error_inquiry: settings.form?.errorInquiry,
      selection_label: settings.form?.selectionLabel,
      no_selection: settings.form?.noSelection,
    }),
    calendar: clean({
      hint: settings.calendar?.hint,
      blocked_hint: settings.calendar?.blockedHint,
      blocked_warning: settings.calendar?.blockedWarning,
      months: settings.calendar?.months,
      months_short: settings.calendar?.monthsShort,
    }),
    labels: clean(settings.contactLabels ?? {}),
    common: clean({
      contact_label: settings.contactLabels?.contact,
      inquire: settings.contactLabels?.inquire,
      selection: settings.contactLabels?.selection,
    }),
  }

  const home = c.homePage ?? {}
  const index = {
    slider: clean({hint: home.sliderHint}),
    section_studio: clean({
      label: home.sectionStudio?.label,
      text: home.sectionStudio?.text,
    }),
    section_menschen: menschenKeys(home.sectionMenschen),
    cta: ctaKeys(home.cta),
  }

  const studioDoc = c.studioPage ?? {}
  const studio = {
    header: headerKeys(studioDoc.header),
    section_menschen: menschenKeys(studioDoc.sectionMenschen),
    slider: clean({label: studioDoc.sliderLabel, hint: studioDoc.sliderHint}),
    cta: ctaKeys(studioDoc.cta),
  }

  const mietenDoc = c.mietenPage ?? {}
  const mieten = {
    header: headerKeys(mietenDoc.header),
    sections: clean(mietenDoc.sectionLabels ?? {}),
    rooms: {
      equipment_label: mietenDoc.roomsEquipmentLabel,
      ...bySlug(c.rooms ?? [], (room) => ({
        title: room.title,
        desc: room.description,
        size: room.size,
        features: room.features ?? [],
      })),
    },
    equipment: clean(mietenDoc.equipmentLabels ?? {}),
    calendar: clean({hint: mietenDoc.calendarHint}),
    form: clean({
      name_placeholder: mietenDoc.form?.namePlaceholder,
      company_placeholder: mietenDoc.form?.companyPlaceholder,
      inquiry_placeholder: mietenDoc.form?.inquiryPlaceholder,
      selection_label: mietenDoc.form?.selectionLabel,
      no_selection: mietenDoc.form?.noSelection,
      submit: mietenDoc.form?.submit,
      success: mietenDoc.form?.success,
      error_name: mietenDoc.form?.errorName,
      error_email: mietenDoc.form?.errorEmail,
      error_inquiry: mietenDoc.form?.errorInquiry,
    }),
  }

  const workshopsDoc = c.workshopsPage ?? {}
  const workshops = {
    header: headerKeys(workshopsDoc.header),
    workshops: {
      registration_label: workshopsDoc.registrationLabel,
      empty: workshopsDoc.emptyText,
      ...bySlug(c.workshops ?? [], (w) => ({
        title: w.title,
        desc: w.description,
        instructor: w.teacher?.name,
        infos: infoKeys(w.infos),
      })),
    },
    cta: ctaKeys(workshopsDoc.cta),
  }

  const eventsDoc = c.veranstaltungenPage ?? {}
  const veranstaltungen = {
    header: headerKeys(eventsDoc.header),
    events: {
      details_title: eventsDoc.detailsTitle,
      registration_label: eventsDoc.registrationLabel,
      empty: eventsDoc.emptyText,
      ...bySlug(c.events ?? [], (e) => ({
        title: e.title,
        desc: e.description,
        infos: infoKeys(e.infos),
      })),
    },
    cta: ctaKeys(eventsDoc.cta),
  }

  const beratungDoc = c.beratungPage ?? {}
  const beratung = {
    header: headerKeys(beratungDoc.header),
    label: beratungDoc.label,
    clients: clean({label: beratungDoc.clientsLabel}),
    haltung: clean({
      label: beratungDoc.haltungLabel,
      statement: beratungDoc.haltungStatement,
      text: beratungDoc.haltungText,
    }),
    leistungen: {
      label: beratungDoc.leistungenLabel,
      title: beratungDoc.leistungenTitle,
      ...bySlug(beratungDoc.services ?? [], (s) => ({
        title: s.title,
        desc: s.description,
      })),
    },
    fuer_wen: {
      label: beratungDoc.fuerWenLabel,
      items: (beratungDoc.fuerWen ?? []).map((item: any) =>
        clean({title: item?.title, text: item?.text}),
      ),
    },
    cta: ctaKeys(beratungDoc.cta),
  }

  const legal = Object.fromEntries(
    Object.entries(LEGAL_IDS).map(([page, id]) => {
      const doc = (c.legal ?? []).find((d: any) => d._id === id) ?? {}
      return [
        page,
        {
          header: clean({title: doc.title, text: doc.intro}),
          labels: clean({updated: doc.updatedLabel}),
          legal: clean({updated: doc.updatedAt}),
          sections: (doc.sections ?? []).map((section: any) =>
            clean({title: section?.title, body: portableTextToHtml(section?.body)}),
          ),
        },
      ]
    }),
  )

  return {
    _global,
    index,
    studio,
    mieten,
    workshops,
    veranstaltungen,
    beratung,
    ...legal,
  }
}

/** The German bundles, for rendering the HTML at build time. */
export const getGermanBundles = () => getBundles('de')
