/**
 * Who wins when the website and the calendar disagree.
 *
 * This file knows nothing about Google or Sanity — it takes three pictures of
 * the same appointment and says what to write where. That is deliberate: the
 * dangerous part of a two-way sync is not the network, it is the rules, and
 * rules with no network in them can be tested.
 *
 * The three pictures:
 *   here   — what Sanity says now
 *   there  — what the calendar says now (null if there is no entry yet)
 *   last   — what both of them said the last time they agreed
 *
 * `last` is the loop guard. Writing to the calendar makes the calendar change,
 * which tells us the calendar changed, which would make us write again. By
 * remembering what we wrote, a change we caused ourselves is recognised and
 * ignored.
 */

/** The only three fields that travel. Everything else stays where it is. */
export type Appointment = {
  title: string
  startAt: string | null
  endAt: string | null
}

export const FIELDS = ['title', 'startAt', 'endAt'] as const
export type FieldName = (typeof FIELDS)[number]

export type Plan =
  | {do: 'nothing'; why: string}
  /** No calendar entry yet — make one. */
  | {do: 'create-there'; write: Appointment}
  /** The calendar entry is gone. The document survives; see §7.7 of the spec. */
  | {do: 'orphan-here'; why: string}
  /** Send the website's values to the calendar. */
  | {do: 'write-there'; write: Appointment; note?: string}
  /** Bring the calendar's values back to the website. */
  | {do: 'write-here'; write: Appointment; note?: string}
  /** Both sides moved. Each field goes to whoever changed it last. */
  | {do: 'write-both'; write: Appointment; note: string}

const same = (a: unknown, b: unknown) => {
  // Dates come back from Google in a different shape than they went in.
  if (typeof a === 'string' && typeof b === 'string') {
    const one = Date.parse(a)
    const two = Date.parse(b)
    if (!Number.isNaN(one) && !Number.isNaN(two)) return one === two
  }
  return (a ?? null) === (b ?? null)
}

const differing = (a: Partial<Appointment>, b: Partial<Appointment>): FieldName[] =>
  FIELDS.filter((field) => !same(a[field], b[field]))

const LABEL: Record<FieldName, string> = {
  title: 'Titel',
  startAt: 'Beginn',
  endAt: 'Ende',
}

const show = (value: string | null) => (value ? String(value) : '—')

export type Input = {
  here: Appointment
  there: Appointment | null
  last: Partial<Appointment>
  /** When each side last changed, for the case where both did. */
  hereAt: string
  thereAt: string | null
  /** True once the calendar entry has been made, so a missing one is a deletion. */
  linked: boolean
}

export function reconcile({here, there, last, hereAt, thereAt, linked}: Input): Plan {
  if (!here.startAt || !here.endAt) {
    return {do: 'nothing', why: 'Ohne Beginn und Ende gibt es nichts einzutragen.'}
  }

  if (!there) {
    return linked
      ? {do: 'orphan-here', why: 'Der Termin wurde im Google Kalender gelöscht.'}
      : {do: 'create-there', write: here}
  }

  const movedHere = differing(here, last)
  const movedThere = differing(there, last)

  if (movedHere.length === 0 && movedThere.length === 0) {
    return {do: 'nothing', why: 'Beide Seiten sagen dasselbe.'}
  }

  if (movedThere.length === 0) return {do: 'write-there', write: here}
  if (movedHere.length === 0) return {do: 'write-here', write: there}

  /*
   * Both sides moved since they last agreed. Rather than picking a winning
   * side, each field goes to whoever touched it last — so a title corrected on
   * the website and a time moved on the phone both survive. Whatever loses is
   * written into the note, so nothing disappears without a word.
   */
  const hereIsNewer = Date.parse(hereAt) >= Date.parse(thereAt ?? '')
  const result = {} as Appointment
  const lost: string[] = []

  for (const field of FIELDS) {
    const changedHere = movedHere.includes(field)
    const changedThere = movedThere.includes(field)

    if (changedHere && changedThere) {
      const winner = hereIsNewer ? here : there
      const loser = hereIsNewer ? there : here
      result[field] = winner[field] as any
      lost.push(`${LABEL[field]}: ${show(loser[field])} wurde durch ${show(winner[field])} ersetzt`)
    } else if (changedHere) {
      result[field] = here[field] as any
    } else if (changedThere) {
      result[field] = there[field] as any
    } else {
      result[field] = here[field] as any
    }
  }

  return {
    do: 'write-both',
    write: result,
    note:
      'Website und Kalender wurden gleichzeitig geändert. ' +
      `Es gilt jeweils die neuere Änderung. ${lost.join('. ')}.`,
  }
}
