import type {DocumentBadgeComponent} from 'sanity'

/**
 * How this appointment stands with the Google Calendar.
 *
 * A sync that quietly stops working is worse than no sync: the client trusts
 * a date that is no longer true. The state is on the document, so it says so.
 */

const SYNCED_TYPES = new Set(['workshop', 'event'])

const BADGE: Record<string, {label: string; color: 'success' | 'warning' | 'danger'; title: string}> = {
  ok: {
    label: 'Im Kalender',
    color: 'success',
    title: 'Titel und Termin stehen so auch im Google Kalender.',
  },
  error: {
    label: 'Kalender-Fehler',
    color: 'danger',
    title: 'Der Termin konnte nicht in den Kalender geschrieben werden.',
  },
  'date-missing': {
    label: 'Im Kalender gelöscht',
    color: 'warning',
    title: 'Der Termin wurde im Google Kalender gelöscht. Der Inhalt hier ist vollständig erhalten.',
  },
  'needs-details': {
    label: 'Aus dem Kalender',
    color: 'warning',
    title: 'Aus dem Google Kalender übernommen. Bitte ergänzen und veröffentlichen.',
  },
}

export const syncBadge: DocumentBadgeComponent = ({draft, published, schemaType}) => {
  if (!SYNCED_TYPES.has(schemaType)) return null

  const doc: any = draft ?? published
  if (!doc) return null

  if (!doc.startAt || !doc.endAt) {
    return {
      label: 'Ohne Termin',
      color: 'warning',
      title: 'Ohne Beginn und Ende steht dieser Eintrag nicht im Kalender.',
    }
  }

  const badge = BADGE[doc.syncStatus]
  if (!badge) return null

  return {...badge, title: doc.syncMessage || badge.title}
}
