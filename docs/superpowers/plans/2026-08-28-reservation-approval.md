# Reservation Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A visitor who picks dates on Mieten holds those days at once; the studio approves or declines from its inbox; approving books the days and tells the visitor, declining frees them and tells the visitor kindly.

**Architecture:** Nothing about a reservation is stored on the website or in Google. A tentative Google Calendar entry holds the days and carries only two dates and a six-character reference code. The visitor's details travel inside an AES-256-GCM encrypted token in the approve and decline links, and live otherwise only in the studio's mailbox. The calendar entry is the state machine — tentative, confirmed, or gone — which is what makes a second click harmless without storing anything.

**Tech Stack:** Astro 5 (server endpoints, `prerender = false`), TypeScript, `node:crypto`, nodemailer, Google Calendar REST v3, Sanity GROQ, `node --test` with `--experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-08-28-lux-reservation-approval-design.md`

## Global Constraints

- **No personal data leaves the mailbox.** Not into Sanity (dataset is `aclMode: "public"`), not into Google Calendar, not into a URL in the clear. A test must assert the calendar entry contains no name.
- **Approve and Decline are never a bare link.** `GET` renders a page with a button; `POST` does the work. Mail scanners fetch every link they are sent.
- **All visitor-facing and studio-facing copy is German.** Comments and identifiers in English, matching the codebase.
- **Tests are `node --test`** with relative imports carrying the `.ts` extension (`from './token.ts'`), because that is what the runner needs. Run with `npm test`.
- **No new npm dependencies.** `node:crypto` and the existing `nodemailer` cover everything.
- **Never import `src/lib/sanity/client.ts` (or anything importing it) into a unit-tested module** — it reads `import.meta.env`, which does not exist under `node --test`. Inject instead, as `src/lib/content/occupancy.ts` already does with `imageFor`.
- **Every endpoint sets `export const prerender = false`.**
- Existing env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `INQUIRY_TO`, `ICAL_RESERVATIONS_URL`, `PUBLIC_SITE_URL`, `SYNC_SECRET`.
- New env, already set in Vercel on 2026-08-28: `GOOGLE_CALENDAR_RESERVATIONS`, `RESERVATION_SECRET`.
- **Missing configuration degrades, never crashes.** The pattern in the codebase is `return json({skipped: '…'})`, and the Mieten form falls back to the plain enquiry.

---

## File Structure

| File | New? | Responsibility |
|---|---|---|
| `src/lib/mail.ts` | new (moved out of `inquiry.ts`) | the nodemailer transport and one `sendMail` helper |
| `src/lib/reservation/token.ts` | new | encrypt a payload into a link, decrypt it back, refuse an expired one |
| `src/lib/reservation/hold.ts` | new | the reference code, the calendar entry body, the expiry rule, the overlap rule |
| `src/lib/reservation/messages.ts` | new | the four German e-mails as pure functions |
| `src/lib/content/busy.ts` | new (moved out of `calendars.json.js`) | read the reservations feed and the studio programme; one source of "which days are taken" |
| `src/pages/api/reservation.ts` | new | take the request, hold the days, send two mails |
| `src/pages/api/reservation/[action].ts` | new | the confirm page, then approve or decline |
| `src/pages/api/calendars.json.js` | modify | becomes a thin wrapper over `busy.ts` |
| `src/pages/api/inquiry.ts` | modify | use `src/lib/mail.ts` |
| `src/pages/api/sync/register-watch.ts` | modify | also expire stale holds |
| `src/lib/google/calendar.ts` | modify | write a raw event body, not only an `Appointment` |
| `src/scripts/form.js` | modify | choose the endpoint; handle `409` |
| `docs/calendar-setup.md` | modify | the new settings and the warnings that go with them |

---

## Task 1: One mailer, shared

**Files:**
- Create: `src/lib/mail.ts`
- Modify: `src/pages/api/inquiry.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `mailer(): nodemailer.Transporter | null` — null when SMTP is not configured
  - `oneLine(value: string): string`
  - `sendMail(message: {to: string; subject: string; text: string; replyTo?: {name: string; address: string}}): Promise<void>` — throws on failure

- [ ] **Step 1: Create `src/lib/mail.ts`**

Move the transport out of `inquiry.ts` unchanged in behaviour — same lazy singleton, same timeouts, same header guard.

```ts
import nodemailer from 'nodemailer'

/**
 * The studio's own mailbox does the sending, so no third party ever sees the
 * message. Nothing here is stored: the inbox is the record.
 */

const env = import.meta.env

let transport: nodemailer.Transporter | null = null

export function mailer() {
  if (transport) return transport

  const host = env.SMTP_HOST
  const user = env.SMTP_USER
  const pass = env.SMTP_PASS
  if (!host || !user || !pass) return null

  const port = Number(env.SMTP_PORT ?? 587)

  transport = nodemailer.createTransport({
    host,
    port,
    // 465 is SSL from the first byte; 587 starts plain and upgrades.
    secure: port === 465,
    auth: {user, pass},
    // A serverless function is killed if it waits too long. Fail loudly instead.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })

  return transport
}

/** A header must never carry a line break, or a robot could add its own headers. */
export const oneLine = (value: string) => value.replace(/[\r\n]+/g, ' ')

/** Where enquiries and requests land. */
export const studioAddress = () => env.INQUIRY_TO || env.SMTP_USER || ''

export async function sendMail(message: {
  to: string
  subject: string
  text: string
  replyTo?: {name: string; address: string}
}) {
  const post = mailer()
  if (!post) throw new Error('Der Mailversand ist nicht eingerichtet.')

  await post.sendMail({
    from: {name: 'LUX Studio Website', address: env.SMTP_FROM || env.SMTP_USER},
    to: message.to,
    replyTo: message.replyTo,
    subject: oneLine(message.subject),
    text: message.text,
  })
}
```

- [ ] **Step 2: Rewrite `inquiry.ts` to use it**

Delete the local `transport`, `mailer()` and `oneLine` from `src/pages/api/inquiry.ts` and import them instead. Replace the `post.sendMail({...})` call with `sendMail({...})`, keeping the same subject, body and `replyTo`. Replace the `if (!post || !to)` guard with:

```ts
import {sendMail, oneLine, mailer, studioAddress} from '../../lib/mail'
```

```ts
  const to = studioAddress()
  if (!mailer() || !to) {
    return json({error: 'Der Mailversand ist nicht eingerichtet.'}, 500)
  }
```

and the send becomes:

```ts
  try {
    await sendMail({
      to,
      replyTo: {name: oneLine(name), address: email},
      subject: `Anfrage von ${oneLine(name)}${firma ? ` (${oneLine(firma)})` : ''}`,
      text: lines.join('\n'),
    })
  } catch (error: any) {
    console.error('[inquiry] send failed', error?.message ?? error)
    return json({error: 'Die Anfrage konnte nicht gesendet werden.'}, 502)
  }
```

- [ ] **Step 3: Verify nothing broke**

Run: `npm test && npm run build`
Expected: 31 tests pass, build completes. No behaviour changed, so there is no new test here.

- [ ] **Step 4: Commit**

```bash
git add src/lib/mail.ts src/pages/api/inquiry.ts
git commit -m "One mailer, so the second endpoint does not grow a copy"
```

---

## Task 2: The encrypted link

**Files:**
- Create: `src/lib/reservation/token.ts`
- Test: `src/lib/reservation/token.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type ReservationClaim = {r: string; c: string; e: string; a: 'approve' | 'decline'; n: string; m: string; d: string; x: number}`
  - `seal(claim: ReservationClaim, key: string): string`
  - `open(token: string, key: string, now?: Date): ReservationClaim` — throws on tamper, wrong key, or expiry
  - `SEVEN_DAYS: number` (milliseconds)

- [ ] **Step 1: Write the failing test**

Create `src/lib/reservation/token.test.ts`:

```ts
import assert from 'node:assert/strict'
import {test} from 'node:test'
import {seal, open, type ReservationClaim} from './token.ts'

const KEY = 'a'.repeat(64)
const OTHER = 'b'.repeat(64)
const NOW = new Date('2026-10-01T12:00:00.000Z')

const claim = (over: Partial<ReservationClaim> = {}): ReservationClaim => ({
  r: '7f3a91',
  c: 'cal@group.calendar.google.com',
  e: 'evt123',
  a: 'approve',
  n: 'Anna Weber',
  m: 'anna@example.com',
  d: '2026-10-02/2026-10-04',
  x: NOW.getTime() + 86_400_000,
  ...over,
})

test('a sealed claim comes back exactly as it went in', () => {
  const c = claim()
  assert.deepEqual(open(seal(c, KEY), KEY, NOW), c)
})

test('the token is unreadable — no name in it anywhere', () => {
  const token = seal(claim(), KEY)
  assert.equal(token.includes('Anna'), false)
  assert.equal(token.includes('anna@example.com'), false)
  assert.equal(Buffer.from(token, 'base64url').toString('latin1').includes('Anna'), false)
})

test('the same claim sealed twice gives two different tokens', () => {
  assert.notEqual(seal(claim(), KEY), seal(claim(), KEY))
})

test('a flipped byte of ciphertext is refused, not returned as rubbish', () => {
  const raw = Buffer.from(seal(claim(), KEY), 'base64url')
  raw[20] = raw[20] ^ 0xff
  assert.throws(() => open(raw.toString('base64url'), KEY, NOW))
})

test('a flipped byte of the authentication tag is refused', () => {
  const raw = Buffer.from(seal(claim(), KEY), 'base64url')
  raw[raw.length - 1] = raw[raw.length - 1] ^ 0xff
  assert.throws(() => open(raw.toString('base64url'), KEY, NOW))
})

test('another key cannot open it', () => {
  assert.throws(() => open(seal(claim(), KEY), OTHER, NOW))
})

test('an expired token is refused even though it decrypts', () => {
  const stale = seal(claim({x: NOW.getTime() - 1000}), KEY)
  assert.throws(() => open(stale, KEY, NOW), /abgelaufen/)
})

test('rubbish in gives a thrown error, not a crash', () => {
  assert.throws(() => open('not-a-token', KEY, NOW))
  assert.throws(() => open('', KEY, NOW))
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --experimental-strip-types --test src/lib/reservation/token.test.ts`
Expected: FAIL — `Cannot find module … token.ts`

- [ ] **Step 3: Write `src/lib/reservation/token.ts`**

```ts
import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto'

/**
 * The approve and decline links.
 *
 * The calendar entry deliberately holds no name, so the link is the only
 * thing that knows who asked. That makes encryption the requirement rather
 * than a signature: a URL ends up in mail logs, browser history and Vercel's
 * request log, and none of those may hold a customer's address in the clear.
 *
 * AES-256-GCM authenticates as well as encrypts, so a tampered token fails to
 * open rather than needing a signature of its own.
 */

const IV_BYTES = 12

export const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

export type ReservationClaim = {
  /** The reference the studio sees in the calendar and in the subject line. */
  r: string
  /** Calendar id. */
  c: string
  /** Event id — the held entry. */
  e: string
  a: 'approve' | 'decline'
  /** The visitor's name and address, which live nowhere else but the mailbox. */
  n: string
  m: string
  /** The days, for the confirmation page and the e-mail. */
  d: string
  /** Expires at, epoch milliseconds. */
  x: number
}

function keyOf(key: string) {
  // Not just a length check: Node's hex decoder stops at the first invalid
  // pair, so a 64-character key with anything appended still yields 32 bytes
  // and would pass unnoticed.
  if (!/^[0-9a-f]{64}$/i.test(key)) {
    throw new Error('RESERVATION_SECRET muss 32 Bytes als Hex sein (openssl rand -hex 32).')
  }
  const bytes = Buffer.from(key, 'hex')
  if (bytes.length !== 32) {
    throw new Error('RESERVATION_SECRET muss 32 Bytes als Hex sein (openssl rand -hex 32).')
  }
  return bytes
}

export function seal(claim: ReservationClaim, key: string) {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', keyOf(key), iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(claim), 'utf8'), cipher.final()])
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64url')
}

export function open(token: string, key: string, now = new Date()): ReservationClaim {
  const raw = Buffer.from(token, 'base64url')
  if (raw.length < IV_BYTES + 16 + 1) throw new Error('Der Link ist unvollständig.')

  const iv = raw.subarray(0, IV_BYTES)
  const tag = raw.subarray(raw.length - 16)
  const body = raw.subarray(IV_BYTES, raw.length - 16)

  const decipher = createDecipheriv('aes-256-gcm', keyOf(key), iv)
  decipher.setAuthTag(tag)

  // Throws if the token was touched, or made with another key.
  const plain = Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
  const claim = JSON.parse(plain) as ReservationClaim

  if (!claim || typeof claim.x !== 'number') throw new Error('Der Link ist ungültig.')
  if (claim.x <= now.getTime()) throw new Error('Der Link ist abgelaufen.')

  return claim
}
```

- [ ] **Step 4: Run the tests**

Run: `node --experimental-strip-types --test src/lib/reservation/token.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reservation/token.ts src/lib/reservation/token.test.ts
git commit -m "Carry the visitor's name in the link, where only the server can read it"
```

---

## Task 3: The hold, and the rules about it

**Files:**
- Create: `src/lib/reservation/hold.ts`
- Test: `src/lib/reservation/hold.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Request = {name: string; email: string; firma?: string; telefon?: string; anfrage?: string; auswahl?: string; startAt: string; endAt: string}`
  - `reference(): string` — six lowercase hex characters
  - `heldEvent(ref: string, startAt: string, endAt: string, now?: Date): object` — the Google event body for a tentative hold
  - `confirmedPatch(ref: string): object` — the patch that turns a hold into a booking
  - `mayExpire(event: {status?: string; extendedProperties?: any}, now?: Date): boolean`
  - `overlaps(range: {startAt: string; endAt: string}, busy: {start: string; end: string}[]): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/lib/reservation/hold.test.ts`:

```ts
import assert from 'node:assert/strict'
import {test} from 'node:test'
import {reference, heldEvent, confirmedPatch, mayExpire, overlaps} from './hold.ts'

const NOW = new Date('2026-10-01T12:00:00.000Z')

test('a reference is six hex characters, and not the same twice', () => {
  const a = reference()
  assert.match(a, /^[0-9a-f]{6}$/)
  assert.notEqual(a, reference())
})

test('a hold is tentative, marked as ours, and stamped with the time', () => {
  const e = heldEvent('7f3a91', '2026-10-02', '2026-10-05', NOW) as any
  assert.equal(e.status, 'tentative')
  assert.equal(e.transparency, 'opaque')
  assert.equal(e.extendedProperties.private.lux, 'reservation')
  assert.equal(e.extendedProperties.private.held, NOW.toISOString())
  assert.equal(e.start.date, '2026-10-02')
  assert.equal(e.end.date, '2026-10-05')
})

test('a hold names nobody — this is the whole point', () => {
  const e = heldEvent('7f3a91', '2026-10-02', '2026-10-05', NOW)
  const everything = JSON.stringify(e)
  for (const forbidden of ['Anna', 'anna@example.com', '0170', 'Weber']) {
    assert.equal(everything.includes(forbidden), false, `${forbidden} must not be in the entry`)
  }
  assert.equal(everything.includes('7f3a91'), true, 'the reference must be, so it can be matched')
})

test('approving confirms it and drops the held stamp', () => {
  const p = confirmedPatch('7f3a91') as any
  assert.equal(p.status, 'confirmed')
  assert.match(p.summary, /^Gebucht/)
  assert.equal(p.extendedProperties.private.lux, 'reservation')
  assert.equal(p.extendedProperties.private.held, null)
})

test('a hold older than seven days may go', () => {
  const old = {status: 'tentative', extendedProperties: {private: {lux: 'reservation', held: '2026-09-20T12:00:00.000Z'}}}
  assert.equal(mayExpire(old, NOW), true)
})

test('a hold six days old stays', () => {
  const fresh = {status: 'tentative', extendedProperties: {private: {lux: 'reservation', held: '2026-09-25T12:00:00.000Z'}}}
  assert.equal(mayExpire(fresh, NOW), false)
})

test('an entry the studio typed itself is never touched, however old', () => {
  assert.equal(mayExpire({status: 'tentative'}, NOW), false)
  assert.equal(mayExpire({status: 'tentative', extendedProperties: {private: {held: '2020-01-01T00:00:00.000Z'}}}, NOW), false)
})

test('a booking that was approved is never expired', () => {
  const booked = {status: 'confirmed', extendedProperties: {private: {lux: 'reservation', held: '2020-01-01T00:00:00.000Z'}}}
  assert.equal(mayExpire(booked, NOW), false)
})

test('a range that touches a taken day is an overlap', () => {
  const busy = [{start: '2026-10-03T00:00:00.000Z', end: '2026-10-05T00:00:00.000Z'}]
  assert.equal(overlaps({startAt: '2026-10-04', endAt: '2026-10-06'}, busy), true)
  assert.equal(overlaps({startAt: '2026-10-01', endAt: '2026-10-04'}, busy), true)
})

test('a range that ends where another begins is free', () => {
  const busy = [{start: '2026-10-05T00:00:00.000Z', end: '2026-10-07T00:00:00.000Z'}]
  assert.equal(overlaps({startAt: '2026-10-02', endAt: '2026-10-05'}, busy), false)
})

test('nothing busy means nothing overlaps', () => {
  assert.equal(overlaps({startAt: '2026-10-02', endAt: '2026-10-05'}, []), false)
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --experimental-strip-types --test src/lib/reservation/hold.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/reservation/hold.ts`**

```ts
import {randomBytes} from 'node:crypto'

/**
 * The held day in the studio's calendar.
 *
 * It carries two dates and a reference, and nothing else. The calendar's
 * owners are consumer Google accounts, so there is no contract making Google
 * a processor for a customer's data — and the calendar never needed the name
 * to do its job, which is to say that a day is taken.
 *
 * The same reference goes in the subject line of the studio's e-mail, so a
 * held day in the calendar can be matched to the message that explains it.
 */

const MARK = 'reservation'
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

const DESCRIPTION =
  'Anfrage über die Website. Name und Kontakt stehen in der E-Mail mit dieser Nummer.'

export type Request = {
  name: string
  email: string
  firma?: string
  telefon?: string
  anfrage?: string
  auswahl?: string
  /** Both are calendar days, YYYY-MM-DD. */
  startAt: string
  endAt: string
}

export const reference = () => randomBytes(3).toString('hex')

/**
 * Google treats an all-day `end.date` as exclusive, which is the same rule the
 * Mieten calendar already uses for the iCal feed. The caller passes the day
 * after the last booked day.
 */
export const heldEvent = (ref: string, startAt: string, endAt: string, now = new Date()) => ({
  summary: `Angefragt — ${ref}`,
  description: DESCRIPTION,
  status: 'tentative',
  transparency: 'opaque',
  start: {date: startAt},
  end: {date: endAt},
  extendedProperties: {private: {lux: MARK, held: now.toISOString()}},
})

/** Google deletes a private property when it is set to null. */
export const confirmedPatch = (ref: string) => ({
  summary: `Gebucht — ${ref}`,
  status: 'confirmed',
  extendedProperties: {private: {lux: MARK, held: null}},
})

/**
 * Only an unanswered hold this feature made, and only after a week. A booking
 * the studio typed in by hand has no marker and is never touched.
 */
export function mayExpire(
  event: {status?: string; extendedProperties?: any},
  now = new Date(),
) {
  if (event.status !== 'tentative') return false
  const own = event.extendedProperties?.private
  if (own?.lux !== MARK) return false
  const held = Date.parse(own?.held ?? '')
  if (!Number.isFinite(held)) return false
  return now.getTime() - held > SEVEN_DAYS
}

/**
 * The end of a range is exclusive on both sides, so a booking that ends on
 * the day another begins is not a clash — that is a changeover, not a
 * double booking.
 */
export function overlaps(
  range: {startAt: string; endAt: string},
  busy: {start: string; end: string}[],
) {
  const from = Date.parse(range.startAt)
  const to = Date.parse(range.endAt)
  return busy.some((b) => {
    const bFrom = Date.parse(b.start)
    const bTo = Date.parse(b.end)
    if (!Number.isFinite(bFrom)) return false
    const bEnd = Number.isFinite(bTo) && bTo > bFrom ? bTo : bFrom + 86_400_000
    return from < bEnd && bFrom < to
  })
}
```

- [ ] **Step 4: Run the tests**

Run: `node --experimental-strip-types --test src/lib/reservation/hold.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reservation/hold.ts src/lib/reservation/hold.test.ts
git commit -m "A held day that names nobody, and the rules for letting it go"
```

---

## Task 4: One source for "which days are taken"

The reservation endpoint has to ask the same question the Mieten calendar asks. Today the answer lives inside `calendars.json.js`. Move it out so there is one copy.

**Files:**
- Create: `src/lib/content/busy.ts`
- Test: `src/lib/content/busy.test.ts`
- Modify: `src/pages/api/calendars.json.js`

**Interfaces:**
- Consumes: `asBlockedDates`, `asBookedDates`, `PAST_WINDOW`, `FUTURE_WINDOW` from `src/lib/content/occupancy.ts`.
- Produces:
  - `parseIcal(text: string): {uid: string; summary: string; start: string | null; end: string | null}[]`
  - `withinWindow(events, now?): typeof events`
  - `fetchReservations(url: string, now?: Date): Promise<{name: 'reservations'; type: 'blocked'; events: BlockedDate[]; error?: string}>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/content/busy.test.ts`. The iCal parser has never had a test; it gets one now because a second caller is about to depend on it.

```ts
import assert from 'node:assert/strict'
import {test} from 'node:test'
import {parseIcal, withinWindow} from './busy.ts'

const ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:abc-1
SUMMARY:Hochzeit Familie Müller
DTSTART;VALUE=DATE:20261002
DTEND;VALUE=DATE:20261005
END:VEVENT
BEGIN:VEVENT
UID:abc-2
SUMMARY:Shooting
DTSTART:20261110T090000Z
DTEND:20261110T170000Z
END:VEVENT
END:VCALENDAR`

test('an all-day entry becomes plain dates', () => {
  const [first] = parseIcal(ICS)
  assert.equal(first.uid, 'abc-1')
  assert.equal(first.start, '2026-10-02')
  assert.equal(first.end, '2026-10-05')
})

test('a timed entry keeps its time', () => {
  const second = parseIcal(ICS)[1]
  assert.equal(second.start, '2026-11-10T09:00:00Z')
})

test('an entry with no start is dropped rather than half-read', () => {
  assert.deepEqual(parseIcal('BEGIN:VEVENT\nUID:x\nSUMMARY:nothing\nEND:VEVENT'), [])
})

test('an empty feed is an empty list, not a crash', () => {
  assert.deepEqual(parseIcal(''), [])
})

test('only what falls in the window survives', () => {
  const now = new Date('2026-10-01T00:00:00.000Z')
  const kept = withinWindow(
    [
      {uid: 'old', summary: '', start: '2020-01-01', end: null},
      {uid: 'soon', summary: '', start: '2026-10-20', end: null},
      {uid: 'far', summary: '', start: '2030-01-01', end: null},
    ],
    now,
  )
  assert.deepEqual(kept.map((e) => e.uid), ['soon'])
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --experimental-strip-types --test src/lib/content/busy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/content/busy.ts`**

Move `parseIcal`, `extractField`, `parseIcalDate` and `fetchFeed` out of `src/pages/api/calendars.json.js` **unchanged in behaviour**, typed, with the window filter split out so it can be tested on its own.

```ts
import {asBookedDates, PAST_WINDOW, FUTURE_WINDOW, type BlockedDate} from './occupancy'

/**
 * The reservations feed.
 *
 * Read here rather than in the endpoint because two callers now need the same
 * answer: the Mieten calendar, which draws the taken days, and the
 * reservation endpoint, which must not hold a day that is already gone.
 */

const DAY = 24 * 60 * 60 * 1000

export type IcalEvent = {uid: string; summary: string; start: string | null; end: string | null}

/** Handles fields with parameters, e.g. DTSTART;VALUE=DATE:20240115 */
function extractField(block: string, fieldName: string) {
  const match = block.match(new RegExp(`${fieldName}[^:]*:([^\\r\\n]+)`, 'i'))
  if (!match) return ''
  return match[1]
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\\\/g, '\\')
    .trim()
}

/** 20240115, 20240115T100000, or 20240115T100000Z */
function parseIcalDate(dateStr: string) {
  if (!dateStr) return null
  const clean = dateStr.split(':').pop() || dateStr

  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
  }
  if (clean.length >= 15) {
    const utc = clean.endsWith('Z') ? 'Z' : ''
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}${utc}`
  }
  return null
}

export function parseIcal(icalData: string): IcalEvent[] {
  const events: IcalEvent[] = []
  const blocks = String(icalData ?? '').split('BEGIN:VEVENT')

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0]
    const start = parseIcalDate(extractField(block, 'DTSTART'))
    if (!start) continue
    events.push({
      uid: extractField(block, 'UID'),
      summary: extractField(block, 'SUMMARY'),
      start,
      end: parseIcalDate(extractField(block, 'DTEND')),
    })
  }

  return events
}

export function withinWindow(events: IcalEvent[], now = new Date()) {
  const from = now.getTime() - PAST_WINDOW * DAY
  const until = now.getTime() + FUTURE_WINDOW * DAY
  return events.filter((event) => {
    const at = Date.parse(event.start as string)
    return Number.isFinite(at) && at >= from && at <= until
  })
}

export async function fetchReservations(url: string, now = new Date()) {
  if (!url) {
    return {name: 'reservations' as const, type: 'blocked' as const, events: [] as BlockedDate[], error: 'No URL configured'}
  }

  try {
    const response = await fetch(url, {
      headers: {Accept: 'text/calendar', 'User-Agent': 'LUX-Studio-Calendar/1.0'},
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const events = withinWindow(parseIcal(await response.text()), now)

    /*
     * asBookedDates keeps the dates and throws the rest away. A reservation's
     * summary is a customer's name, and everything returned here is sent to
     * the browser, so it is dropped now rather than hidden in the markup
     * later — no future change to the calendar can leak what is not there.
     */
    return {name: 'reservations' as const, type: 'blocked' as const, events: asBookedDates(events)}
  } catch (error: any) {
    console.error('Error fetching reservations calendar:', error.message)
    return {name: 'reservations' as const, type: 'blocked' as const, events: [] as BlockedDate[], error: error.message}
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `node --experimental-strip-types --test src/lib/content/busy.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Rewrite `calendars.json.js` to use it**

Delete `parseIcal`, `extractField`, `parseIcalDate` and `fetchFeed` from the endpoint. Keep `fetchStudioDates` exactly as it is. The file becomes:

```js
/**
 * The days the studio is not free, for the calendar on the Mieten page.
 *
 * Two sources, and they are not alike:
 *
 * - **Reservations** stay a read-only iCal feed. Nothing writes to it by
 *   hand; the studio fills it from Google, and the approval flow adds holds.
 * - **Workshops and events** come from Sanity. A workshop fills the rooms, so
 *   its day cannot also be rented out.
 *
 * The reading itself lives in src/lib/content/busy.ts, because the
 * reservation endpoint has to ask the same question before it holds a day.
 */

import {sanityClient} from '../../lib/sanity/client'
import {imageUrl} from '../../lib/sanity/image'
import {asBlockedDates} from '../../lib/content/occupancy'
import {fetchReservations} from '../../lib/content/busy'

export const prerender = false;

async function fetchStudioDates() {
  try {
    const docs = await sanityClient.fetch(
      `*[_type in ["workshop", "event"] && defined(startAt)]{_id, _type, title, slug, photo, startAt, endAt}`
    );
    return {
      name: 'studio',
      type: 'blocked',
      events: asBlockedDates(docs, new Date(), imageUrl)
    };
  } catch (error) {
    console.error('Error reading workshops and events from Sanity:', error.message);
    return {name: 'studio', type: 'blocked', events: [], error: error.message};
  }
}

export async function GET() {
  const results = {timestamp: new Date().toISOString(), feeds: {}};

  // Both sources in parallel; the slowest one sets the pace.
  const feedResults = await Promise.all([
    fetchReservations(import.meta.env.ICAL_RESERVATIONS_URL || ''),
    fetchStudioDates()
  ]);

  for (const result of feedResults) {
    results.feeds[result.name] = {
      type: result.type,
      events: result.events,
      count: result.events.length,
      error: result.error || null
    };
  }

  results.blocked = feedResults
    .filter(r => r.type === 'blocked')
    .flatMap(r => r.events)
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  return new Response(JSON.stringify(results, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}
```

- [ ] **Step 6: Verify the endpoint is unchanged in behaviour**

Run: `npm test && npm run build`, then `npm run dev` and in another shell:

```bash
curl -s http://localhost:4321/api/calendars.json
```

Expected: the same shape as before — `feeds.reservations`, `feeds.studio`, a sorted `blocked` array, studio entries carrying `summary`/`href`/`image` and reservation entries carrying none.

- [ ] **Step 7: Commit**

```bash
git add src/lib/content/busy.ts src/lib/content/busy.test.ts src/pages/api/calendars.json.js
git commit -m "Ask one place which days are taken, now that two callers need to know"
```

---

## Task 5: Write a whole event, not only a title and two dates

`createEvent` and `patchEvent` take an `Appointment` — `{title, startAt, endAt}` — and `asEvent` only ever sets `summary`, `start` and `end`. A hold needs `status`, `description` and `extendedProperties`.

**Files:**
- Modify: `src/lib/google/calendar.ts`

**Interfaces:**
- Consumes: the private `call()` already in the file.
- Produces:
  - `createRawEvent(calendarId: string, body: object): Promise<CalendarEvent>`
  - `patchRawEvent(calendarId: string, eventId: string, body: object): Promise<CalendarEvent>`
  - `listEvents(calendarId: string, params?: Record<string, string>): Promise<{items?: CalendarEvent[]}>`

- [ ] **Step 1: Add the three functions**

Append to `src/lib/google/calendar.ts`, below `patchEvent`. The existing `Appointment` helpers stay exactly as they are — the sync uses them.

```ts
/*
 * The Appointment helpers above carry a title and two dates, which is all the
 * workshop sync ever needs. A reservation hold also has a status, a
 * description and a private marker, so these three take the event body whole.
 */

export const createRawEvent = (calendarId: string, body: object): Promise<CalendarEvent> =>
  call(`/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const patchRawEvent = (
  calendarId: string,
  eventId: string,
  body: object,
): Promise<CalendarEvent> =>
  call(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

export const listEvents = (
  calendarId: string,
  params: Record<string, string> = {},
): Promise<{items?: CalendarEvent[]}> =>
  call(`/calendars/${encodeURIComponent(calendarId)}/events?${new URLSearchParams(params)}`)
```

- [ ] **Step 2: Check `CalendarEvent` covers what the hold needs**

Open `src/lib/google/calendar.ts:8`. If `CalendarEvent` does not already have `status` and `extendedProperties`, add them:

```ts
  status?: string
  extendedProperties?: {private?: Record<string, string | null>}
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: completes. Nothing calls the new functions yet.

- [ ] **Step 4: Commit**

```bash
git add src/lib/google/calendar.ts
git commit -m "Let the calendar helper write an event that is more than a title"
```

---

## Task 6: The four e-mails

**Files:**
- Create: `src/lib/reservation/messages.ts`
- Test: `src/lib/reservation/messages.test.ts`

**Interfaces:**
- Consumes: `Request` from `./hold.ts`.
- Produces:
  - `toStudio(req, ref, links): {subject: string; text: string}`
  - `received(req: Told, ref): {subject: string; text: string}`
  - `approved(req, ref): {subject: string; text: string}`
  - `declined(req, ref): {subject: string; text: string}`
  - `germanRange(startAt: string, endAt: string): string`

- [ ] **Step 1: Write the failing test**

Create `src/lib/reservation/messages.test.ts`:

```ts
import assert from 'node:assert/strict'
import {test} from 'node:test'
import {toStudio, received, approved, declined, germanRange} from './messages.ts'

const req = {
  name: 'Anna Weber',
  email: 'anna@example.com',
  firma: 'Weber Fotografie',
  telefon: '0170 1234567',
  anfrage: 'Wir brauchen das große Studio für ein Editorial.',
  auswahl: 'Großes Studio, Profoto D2 1000',
  startAt: '2026-10-02',
  endAt: '2026-10-05',
}

test('the studio sees the reference, the person and both buttons', () => {
  const m = toStudio(req, '7f3a91', {approve: 'https://x/a', decline: 'https://x/d'})
  assert.ok(m.subject.includes('7f3a91'), m.subject)
  assert.ok(m.text.includes('Anna Weber'))
  assert.ok(m.text.includes('anna@example.com'))
  assert.ok(m.text.includes('https://x/a'))
  assert.ok(m.text.includes('https://x/d'))
})

test('the visitor is told we have it, and never sees a link meant for the studio', () => {
  const m = received(req, '7f3a91')
  assert.ok(m.text.includes('Anna'))
  assert.equal(m.text.includes('http'), false, 'no approve link may reach the visitor')
})

test('a yes and a no both name the days', () => {
  assert.ok(approved(req, '7f3a91').text.includes('2. Oktober'))
  assert.ok(declined(req, '7f3a91').text.includes('2. Oktober'))
})

test('a decline is kind and invites another date', () => {
  const m = declined(req, '7f3a91')
  assert.ok(/leider/i.test(m.text))
  assert.ok(/anderen? (Termin|Zeitraum)/i.test(m.text))
})

test('one day reads as one day, not as a range to itself', () => {
  assert.equal(germanRange('2026-10-02', '2026-10-03'), '2. Oktober 2026')
  assert.equal(germanRange('2026-10-02', '2026-10-05'), '2. bis 4. Oktober 2026')
})

test('a missing company or telephone leaves no empty line behind', () => {
  const bare = {...req, firma: undefined, telefon: undefined}
  const m = toStudio(bare, '7f3a91', {approve: 'https://x/a', decline: 'https://x/d'})
  assert.equal(m.text.includes('Firma:'), false)
  assert.equal(m.text.includes('Telefon:'), false)
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --experimental-strip-types --test src/lib/reservation/messages.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/reservation/messages.ts`**

Note `germanRange` takes the **exclusive** end, the same value the calendar entry uses, and prints the last booked day.

```ts
import type {Request} from './hold'

/** The three fields every message needs; the rest only the studio's does. */
type Told = Pick<Request, 'name' | 'startAt' | 'endAt'> & Partial<Request>

/**
 * The four messages. Pure functions returning a subject and plain text, so
 * they can be read in a test rather than in an inbox.
 */

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

const day = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`)
  return {n: d.getUTCDate(), m: MONTHS[d.getUTCMonth()], y: d.getUTCFullYear()}
}

/** `endAt` is exclusive, as everywhere else, so the last booked day is the day before. */
export function germanRange(startAt: string, endAt: string) {
  const from = day(startAt)
  const lastDay = new Date(`${endAt}T12:00:00Z`)
  lastDay.setUTCDate(lastDay.getUTCDate() - 1)
  const to = day(lastDay.toISOString().slice(0, 10))

  if (from.n === to.n && from.m === to.m && from.y === to.y) {
    return `${from.n}. ${from.m} ${from.y}`
  }
  if (from.m === to.m && from.y === to.y) {
    return `${from.n}. bis ${to.n}. ${to.m} ${to.y}`
  }
  return `${from.n}. ${from.m} bis ${to.n}. ${to.m} ${to.y}`
}

const SIGN_OFF = ['', 'Herzliche Grüße', 'LUX Studio'].join('\n')

export function toStudio(req: Request, ref: string, links: {approve: string; decline: string}) {
  const when = germanRange(req.startAt, req.endAt)
  const text = [
    `Anfrage ${ref} — ${when}`,
    '',
    `Name:     ${req.name}`,
    req.firma && `Firma:    ${req.firma}`,
    `E-Mail:   ${req.email}`,
    req.telefon && `Telefon:  ${req.telefon}`,
    req.auswahl && `Auswahl:  ${req.auswahl}`,
    '',
    req.anfrage,
    '',
    '—',
    'Zusagen:',
    links.approve,
    '',
    'Absagen:',
    links.decline,
    '',
    'Beide Links öffnen eine Seite mit einer Schaltfläche. Erst die Schaltfläche',
    'sagt zu oder ab, damit kein Mailprogramm das aus Versehen für Sie tut.',
    'Die Links laufen nach sieben Tagen ab; der Tag wird dann wieder frei.',
  ]
    .filter((line) => line !== undefined && line !== null && line !== false)
    .join('\n')

  return {subject: `Anfrage ${ref}: ${req.name}, ${when}`, text}
}

export function received(req: Told, ref: string) {
  const when = germanRange(req.startAt, req.endAt)
  return {
    subject: `Ihre Anfrage bei LUX Studio (${ref})`,
    text: [
      `Guten Tag ${req.name},`,
      '',
      `vielen Dank für Ihre Anfrage für ${when}.`,
      'Wir haben die Tage für Sie vorgemerkt und melden uns innerhalb von zwei',
      'Werktagen mit einer Zu- oder Absage.',
      '',
      `Ihre Nummer für Rückfragen: ${ref}`,
      SIGN_OFF,
    ].join('\n'),
  }
}

export function approved(req: Told, ref: string) {
  const when = germanRange(req.startAt, req.endAt)
  return {
    subject: `Zusage: ${when} im LUX Studio (${ref})`,
    text: [
      `Guten Tag ${req.name},`,
      '',
      `gerne — ${when} gehört Ihnen.`,
      '',
      'Melden Sie sich bitte kurz vor dem Termin, damit wir Schlüssel und',
      'Einweisung abstimmen können. Für Änderungen genügt eine Antwort auf',
      'diese E-Mail.',
      '',
      `Ihre Nummer: ${ref}`,
      SIGN_OFF,
    ].join('\n'),
  }
}

export function declined(req: Told, ref: string) {
  const when = germanRange(req.startAt, req.endAt)
  return {
    subject: `Ihre Anfrage für ${when} (${ref})`,
    text: [
      `Guten Tag ${req.name},`,
      '',
      `vielen Dank für Ihr Interesse. ${when} können wir das Studio leider`,
      'nicht vergeben.',
      '',
      'Für einen anderen Zeitraum sind wir gerne für Sie da — antworten Sie',
      'einfach auf diese E-Mail oder fragen Sie über die Website erneut an.',
      SIGN_OFF,
    ].join('\n'),
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `node --experimental-strip-types --test src/lib/reservation/messages.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reservation/messages.ts src/lib/reservation/messages.test.ts
git commit -m "Four messages, written where they can be read in a test"
```

---

## Task 7: Take the request and hold the days

**Files:**
- Create: `src/pages/api/reservation.ts`

**Interfaces:**
- Consumes: `sendMail`, `oneLine`, `mailer`, `studioAddress` (Task 1); `seal`, `SEVEN_DAYS` (Task 2); `reference`, `heldEvent`, `overlaps`, `Request` (Task 3); `fetchReservations` (Task 4); `createRawEvent`, `deleteEvent` (Task 5); `toStudio`, `received` (Task 6); `asBlockedDates` and `sanityClient`.
- Produces: `POST /api/reservation` answering `{ok: true, ref}`, `409 {error, code: 'taken'}`, `400`, `502`, or `{skipped}`.

- [ ] **Step 1: Write the endpoint**

```ts
import type {APIRoute} from 'astro'
import {sanityClient} from '../../lib/sanity/client'
import {asBlockedDates} from '../../lib/content/occupancy'
import {fetchReservations} from '../../lib/content/busy'
import {createRawEvent, deleteEvent} from '../../lib/google/calendar'
import {calendarCredentials} from '../../lib/google/auth'
import {seal, SEVEN_DAYS, type ReservationClaim} from '../../lib/reservation/token'
import {reference, heldEvent, overlaps, type Request as Req} from '../../lib/reservation/hold'
import {toStudio, received} from '../../lib/reservation/messages'
import {sendMail, oneLine, mailer, studioAddress} from '../../lib/mail'

/**
 * A rental request, on its way to the studio's inbox — and its days held in
 * the calendar while the studio makes up its mind.
 *
 * Nothing is stored here. The days are held by a tentative calendar entry
 * that names nobody, and everything the approval needs travels encrypted
 * inside the two links in the studio's e-mail.
 */
export const prerender = false

const env = import.meta.env

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json; charset=utf-8'},
  })

const clean = (value: unknown, limit: number) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : ''

const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const LOOKS_LIKE_DAY = /^\d{4}-\d{2}-\d{2}$/

export const POST: APIRoute = async ({request}) => {
  const calendarId = env.GOOGLE_CALENDAR_RESERVATIONS
  const key = env.RESERVATION_SECRET
  const site = env.PUBLIC_SITE_URL
  const to = studioAddress()

  // Not set up is not an error: the form falls back to the plain enquiry.
  if (!calendarId || !key || !site || !calendarCredentials() || !mailer() || !to) {
    return json({skipped: 'Reservierungen sind nicht eingerichtet.'})
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return json({error: 'Ungültige Anfrage.'}, 400)
  }

  // The honeypot: silent success, so a robot has nothing to learn from.
  if (clean(body.website, 100)) return json({ok: true, ref: reference()})

  const req: Req = {
    name: clean(body.name, 120),
    email: clean(body.email, 160),
    firma: clean(body.firma, 120) || undefined,
    telefon: clean(body.telefon, 60) || undefined,
    anfrage: clean(body.anfrage, 4000),
    auswahl: clean(body.auswahl, 300) || undefined,
    startAt: clean(body.startAt, 10),
    endAt: clean(body.endAt, 10),
  }

  if (!req.name || !LOOKS_LIKE_EMAIL.test(req.email)) {
    return json({error: 'Bitte Name und E-Mail ausfüllen.'}, 400)
  }
  if (!LOOKS_LIKE_DAY.test(req.startAt) || !LOOKS_LIKE_DAY.test(req.endAt)) {
    return json({error: 'Bitte einen Zeitraum wählen.'}, 400)
  }
  if (req.endAt <= req.startAt) {
    return json({error: 'Das Ende muss nach dem Beginn liegen.'}, 400)
  }
  if (req.startAt < new Date().toISOString().slice(0, 10)) {
    return json({error: 'Der Zeitraum liegt in der Vergangenheit.'}, 400)
  }

  /*
   * The browser already greys out taken days, but two people can send the
   * same day within seconds of each other and only the server can settle it.
   * This is not a lock — see section 8 of the design — but it catches
   * everything except a true tie.
   */
  const [reservations, docs] = await Promise.all([
    fetchReservations(env.ICAL_RESERVATIONS_URL || ''),
    sanityClient
      .fetch(`*[_type in ["workshop", "event"] && defined(startAt)]{_id, _type, title, startAt, endAt}`)
      .catch(() => []),
  ])
  const busy = [...reservations.events, ...asBlockedDates(docs)]

  if (overlaps(req, busy)) {
    return json({error: 'Diese Tage sind inzwischen vergeben.', code: 'taken'}, 409)
  }

  const ref = reference()

  let eventId: string
  try {
    const created = await createRawEvent(calendarId, heldEvent(ref, req.startAt, req.endAt))
    eventId = created.id as string
  } catch (error: any) {
    console.error('[reservation] hold failed', error?.message ?? error)
    return json({error: 'Die Anfrage konnte nicht gespeichert werden.'}, 502)
  }

  const link = (a: 'approve' | 'decline') => {
    const claim: ReservationClaim = {
      r: ref,
      c: calendarId,
      e: eventId,
      a,
      n: req.name,
      m: req.email,
      d: `${req.startAt}/${req.endAt}`,
      x: Date.now() + SEVEN_DAYS,
    }
    return `${site.replace(/\/$/, '')}/api/reservation/${a}?t=${seal(claim, key)}`
  }

  /*
   * The mail to the studio is the only record of who asked, so a hold whose
   * mail never arrived is a day blocked for a request nobody can read. If it
   * fails, the hold goes with it.
   */
  const message = toStudio(req, ref, {approve: link('approve'), decline: link('decline')})
  try {
    await sendMail({
      to,
      replyTo: {name: oneLine(req.name), address: req.email},
      subject: message.subject,
      text: message.text,
    })
  } catch (error: any) {
    console.error('[reservation] studio mail failed', error?.message ?? error)
    await deleteEvent(calendarId, eventId)
    return json({error: 'Die Anfrage konnte nicht gesendet werden.'}, 502)
  }

  // The request is safe in the studio's inbox by now, so this one may fail.
  const note = received(req, ref)
  try {
    await sendMail({to: req.email, subject: note.subject, text: note.text})
  } catch (error: any) {
    console.error('[reservation] visitor mail failed', error?.message ?? error)
  }

  return json({ok: true, ref})
}
```

- [ ] **Step 2: Verify it builds and refuses sensibly**

Run: `npm run build`, then `npm run dev` and:

```bash
curl -s -X POST -H 'Content-Type: application/json' -d '{}' http://localhost:4321/api/reservation
```

Expected: `{"error":"Bitte Name und E-Mail ausfüllen."}` with `400`, or `{"skipped":…}` if `GOOGLE_CALENDAR_RESERVATIONS` is not in your local `.env` yet.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/reservation.ts
git commit -m "Hold the days the moment somebody asks for them"
```

---

## Task 8: The page with the button

**Files:**
- Create: `src/pages/api/reservation/[action].ts`

**Interfaces:**
- Consumes: `open` (Task 2); `confirmedPatch` (Task 3); `getEvent`, `patchRawEvent`, `deleteEvent` (Task 5); `approved`, `declined`, `germanRange` (Task 6); `sendMail`.
- Produces: `GET` renders HTML; `POST` performs the action and renders HTML.

- [ ] **Step 1: Write the endpoint**

```ts
import type {APIRoute} from 'astro'
import {open, type ReservationClaim} from '../../../lib/reservation/token'
import {confirmedPatch} from '../../../lib/reservation/hold'
import {getEvent, patchRawEvent, deleteEvent} from '../../../lib/google/calendar'
import {approved, declined, germanRange} from '../../../lib/reservation/messages'
import {sendMail} from '../../../lib/mail'

/**
 * Zusagen und Absagen.
 *
 * GET only shows a page. POST does the deed.
 *
 * This split is load-bearing and must not be "simplified" away. Gmail,
 * Outlook and every mail scanner fetch each link in a message to check it,
 * so a bare GET that approved a booking would approve every booking the
 * moment the e-mail landed, unattended.
 */
export const prerender = false

const page = (title: string, body: string) =>
  new Response(
    `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${title} — LUX Studio</title>
<style>
 body{font-family:system-ui,sans-serif;max-width:34rem;margin:12vh auto;padding:0 1.5rem;line-height:1.5;color:#111}
 h1{font-size:1.4rem;font-weight:600}
 dl{display:grid;grid-template-columns:auto 1fr;gap:.35rem 1rem;margin:1.5rem 0}
 dt{color:#666} dd{margin:0}
 button{font:inherit;padding:.7rem 1.4rem;border:0;background:#111;color:#fff;cursor:pointer}
 .muted{color:#666;font-size:.9rem}
</style></head><body>${body}</body></html>`,
    {status: 200, headers: {'Content-Type': 'text/html; charset=utf-8'}},
  )

const problem = (message: string) =>
  page('Nicht möglich', `<h1>Nicht möglich</h1><p>${message}</p>`)

/** The claim, or a page explaining why not. */
function read(url: URL, action: string): ReservationClaim | Response {
  const key = import.meta.env.RESERVATION_SECRET
  if (!key) return problem('Reservierungen sind auf dieser Seite nicht eingerichtet.')

  const token = url.searchParams.get('t') ?? ''
  let claim: ReservationClaim
  try {
    claim = open(token, key)
  } catch (error: any) {
    return problem(
      /abgelaufen/.test(error?.message ?? '')
        ? 'Dieser Link ist abgelaufen. Der Zeitraum ist wieder frei — bitte antworten Sie der Anfrage per E-Mail.'
        : 'Dieser Link ist ungültig.',
    )
  }

  if (claim.a !== action) return problem('Dieser Link gehört zu einer anderen Aktion.')
  return claim
}

const dates = (claim: ReservationClaim) => {
  const [from, to] = claim.d.split('/')
  return germanRange(from, to)
}

export const GET: APIRoute = async ({params, url}) => {
  const action = params.action === 'approve' ? 'approve' : params.action === 'decline' ? 'decline' : ''
  if (!action) return problem('Unbekannte Aktion.')

  const claim = read(url, action)
  if (claim instanceof Response) return claim

  const verb = action === 'approve' ? 'Zusagen' : 'Absagen'
  return page(verb, `
    <h1>Anfrage ${claim.r}</h1>
    <dl>
      <dt>Wer</dt><dd>${escapeHtml(claim.n)}</dd>
      <dt>E-Mail</dt><dd>${escapeHtml(claim.m)}</dd>
      <dt>Zeitraum</dt><dd>${dates(claim)}</dd>
    </dl>
    <form method="post">
      <button type="submit">${verb}</button>
    </form>
    <p class="muted">${
      action === 'approve'
        ? 'Der Zeitraum wird gebucht und der Gast bekommt eine Zusage.'
        : 'Der Zeitraum wird wieder frei und der Gast bekommt eine freundliche Absage.'
    }</p>`)
}

export const POST: APIRoute = async ({params, url}) => {
  const action = params.action === 'approve' ? 'approve' : params.action === 'decline' ? 'decline' : ''
  if (!action) return problem('Unbekannte Aktion.')

  const claim = read(url, action)
  if (claim instanceof Response) return claim

  const [from, to] = claim.d.split('/')
  const request = {name: claim.n, email: claim.m, startAt: from, endAt: to}

  // The calendar entry is the state: tentative, confirmed, or gone.
  let event: any = null
  try {
    event = await getEvent(claim.c, claim.e)
  } catch {
    event = null
  }

  if (!event || event.status === 'cancelled') {
    return page('Schon erledigt', `<h1>Schon erledigt</h1>
      <p>Diese Anfrage wurde bereits beantwortet oder der Eintrag wurde entfernt.
      Es wurde nichts noch einmal verschickt.</p>`)
  }

  if (action === 'approve') {
    if (event.status === 'confirmed') {
      return page('Schon zugesagt', `<h1>Schon zugesagt</h1>
        <p>Diese Anfrage ist bereits bestätigt. Es wurde nichts noch einmal verschickt.</p>`)
    }
    await patchRawEvent(claim.c, claim.e, confirmedPatch(claim.r))
    const mail = approved(request, claim.r)
    await sendMail({to: claim.m, subject: mail.subject, text: mail.text})
    return page('Zugesagt', `<h1>Zugesagt</h1>
      <p>${escapeHtml(claim.n)} hat die Zusage für ${dates(claim)} bekommen.
      Der Zeitraum ist im Kalender gebucht.</p>`)
  }

  await deleteEvent(claim.c, claim.e)
  const mail = declined(request, claim.r)
  await sendMail({to: claim.m, subject: mail.subject, text: mail.text})
  return page('Abgesagt', `<h1>Abgesagt</h1>
    <p>${escapeHtml(claim.n)} hat eine freundliche Absage bekommen.
    ${dates(claim)} ist wieder frei.</p>`)
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) =>
    ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c] as string,
  )
```

- [ ] **Step 2: Verify a rubbish token is refused**

Run: `npm run build`, then `npm run dev` and:

```bash
curl -s "http://localhost:4321/api/reservation/approve?t=rubbish" | grep -o "<h1>.*</h1>"
```

Expected: `<h1>Nicht möglich</h1>`

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/reservation/[action].ts
git commit -m "Approve behind a button, because a mail scanner clicks every link"
```

---

## Task 9: The form picks the right endpoint

**Files:**
- Modify: `src/scripts/form.js`
- Modify: `src/pages/mieten.astro` (one hidden field pair, if the dates are not already posted as ISO days)

**Interfaces:**
- Consumes: `POST /api/reservation` (Task 7).
- Produces: nothing other tasks use.

- [ ] **Step 1: Find how the chosen dates reach the form**

Read `src/scripts/calendar.js:Calendar.prototype.updateInputs` and the `[data-calendar-start]` / `[data-calendar-end]` inputs in `src/pages/mieten.astro`. Note the exact format they hold. The endpoint needs `YYYY-MM-DD`, and `endAt` **exclusive** — the day after the last booked day.

- [ ] **Step 2: Send to the reservation endpoint when there is a range**

In `src/scripts/form.js`, replace the `fetch('/api/inquiry', …)` block with:

```js
    /*
     * A request with dates holds those days and needs approving; one without
     * is an enquiry and stays an e-mail, exactly as before.
     */
    var startEl = document.querySelector('[data-calendar-start]');
    var endEl = document.querySelector('[data-calendar-end]');
    var start = startEl && startEl.value;
    var end = endEl && endEl.value;
    var endpoint = '/api/inquiry';

    if (start && end) {
      endpoint = '/api/reservation';
      data.startAt = start;
      // The end is exclusive everywhere else, so the last chosen day is included.
      var after = new Date(end + 'T12:00:00Z');
      after.setUTCDate(after.getUTCDate() + 1);
      data.endAt = after.toISOString().slice(0, 10);
    }

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function(response) {
        if (response.status === 409) {
          return response.json().then(function(body) {
            self.showTaken(body && body.error);
            throw new Error('taken');
          });
        }
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then(function(body) {
        // Not set up yet: the request was not taken, so say so plainly.
        if (body && body.skipped) throw new Error('skipped');
        self.showSuccess();
      })
      .catch(function(error) {
        if (error && error.message === 'taken') return;
        // The enquiry is not lost — it is still in the form, and the failure
        // message carries the studio's address so it can be sent by hand.
        if (failed) failed.hidden = false;
        if (self.submitButton) self.submitButton.disabled = false;
      })
      .then(function() {
        self.form.classList.remove('is-sending');
      });
```

- [ ] **Step 3: Add `showTaken`**

Beside `Form.prototype.showSuccess` in the same file:

```js
  /**
   * Somebody else took the days between the page loading and the send. Say so,
   * re-read the calendar so they grey out, and leave the form filled in.
   */
  Form.prototype.showTaken = function(message) {
    var failed = this.form.querySelector('[data-form-failed]');
    if (failed) {
      failed.hidden = false;
      var text = message || 'Diese Tage sind inzwischen vergeben.';
      var slot = failed.querySelector('[data-form-failed-text]') || failed;
      slot.textContent = text;
    }
    if (this.submitButton) this.submitButton.disabled = false;

    var cal = document.querySelector('.calendar');
    if (cal && cal._calendarInstance) cal._calendarInstance.loadBlockedDates();
  };
```

- [ ] **Step 4: Verify by hand**

Run `npm run dev`, open `/mieten`, pick a range, fill the form, send. With `GOOGLE_CALENDAR_RESERVATIONS` unset locally you should get the failure panel (the endpoint answers `skipped`); with it set you should get the success panel and a tentative entry in the calendar.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/form.js src/pages/mieten.astro
git commit -m "Send a request with dates somewhere that can hold them"
```

---

## Task 10: Let an unanswered hold go

**Files:**
- Create: `src/lib/reservation/expire.ts`
- Test: `src/lib/reservation/expire.test.ts`
- Modify: `src/pages/api/sync/register-watch.ts`

**Interfaces:**
- Consumes: `mayExpire` (Task 3); `listEvents`, `deleteEvent` (Task 5).
- Produces: `expireHolds(deps, now?): Promise<{expired: number}>`

- [ ] **Step 1: Write the failing test**

The function takes its two Google calls as arguments so it can be tested without a network.

Create `src/lib/reservation/expire.test.ts`:

```ts
import assert from 'node:assert/strict'
import {test} from 'node:test'
import {expireHolds} from './expire.ts'

const NOW = new Date('2026-10-01T12:00:00.000Z')
const held = (id: string, when: string, status = 'tentative') => ({
  id,
  status,
  extendedProperties: {private: {lux: 'reservation', held: when}},
})

test('a hold older than a week is deleted', async () => {
  const deleted: string[] = []
  const result = await expireHolds(
    {
      calendarId: 'cal',
      list: async () => ({items: [held('a', '2026-09-01T00:00:00.000Z')]}),
      remove: async (_c, id) => { deleted.push(id) },
    },
    NOW,
  )
  assert.deepEqual(deleted, ['a'])
  assert.equal(result.expired, 1)
})

test('a fresh hold, a confirmed booking and a hand-typed entry are all left alone', async () => {
  const deleted: string[] = []
  await expireHolds(
    {
      calendarId: 'cal',
      list: async () => ({
        items: [
          held('fresh', '2026-09-28T00:00:00.000Z'),
          held('booked', '2026-09-01T00:00:00.000Z', 'confirmed'),
          {id: 'byhand', status: 'tentative'},
        ],
      }),
      remove: async (_c, id) => { deleted.push(id) },
    },
    NOW,
  )
  assert.deepEqual(deleted, [])
})

test('no calendar configured does nothing rather than throwing', async () => {
  const result = await expireHolds({calendarId: '', list: async () => ({items: []}), remove: async () => {}}, NOW)
  assert.equal(result.expired, 0)
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --experimental-strip-types --test src/lib/reservation/expire.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/reservation/expire.ts`**

```ts
import {mayExpire} from './hold'

/**
 * A hold nobody answered.
 *
 * Seven days is long enough for a studio to make up its mind and short
 * enough that a forgotten request does not block a room all season. The
 * marker in the entry is what keeps this away from bookings the studio typed
 * in itself.
 *
 * The two Google calls are handed in so this can be tested without a network.
 */

type Deps = {
  calendarId: string
  list: (calendarId: string, params: Record<string, string>) => Promise<{items?: any[]}>
  remove: (calendarId: string, eventId: string) => Promise<unknown>
}

export async function expireHolds(deps: Deps, now = new Date()) {
  if (!deps.calendarId) return {expired: 0}

  const {items = []} = await deps.list(deps.calendarId, {
    maxResults: '250',
    showDeleted: 'false',
    singleEvents: 'false',
  })

  let expired = 0
  for (const event of items) {
    if (!mayExpire(event, now)) continue
    await deps.remove(deps.calendarId, event.id)
    expired++
  }

  return {expired}
}
```

- [ ] **Step 4: Run the tests**

Run: `node --experimental-strip-types --test src/lib/reservation/expire.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Fold it into the nightly job**

In `src/pages/api/sync/register-watch.ts`, after the watch registration finishes and before the response is returned, add the expiry. Wrap each independently: a failure to expire must not stop the watch renewal, nor the other way round.

```ts
import {expireHolds} from '../../../lib/reservation/expire'
import {listEvents, deleteEvent} from '../../../lib/google/calendar'
```

```ts
  /*
   * The same 04:00 job drops holds nobody answered. It rides along here
   * rather than taking a second cron entry, because Vercel Hobby has very
   * few of those and both jobs want the same hour.
   */
  let holds: unknown = 'übersprungen'
  try {
    holds = await expireHolds({
      calendarId: import.meta.env.GOOGLE_CALENDAR_RESERVATIONS ?? '',
      list: listEvents,
      remove: deleteEvent,
    })
  } catch (error: any) {
    console.error('[register-watch] expiring holds failed', error?.message ?? error)
    holds = {error: error?.message ?? 'unbekannt'}
  }
```

and include `holds` in the JSON the endpoint already returns.

- [ ] **Step 6: Verify**

Run: `npm test && npm run build`
Expected: all tests pass (31 existing + 8 token + 11 hold + 5 busy + 6 messages + 3 expire = 64), build completes.

- [ ] **Step 7: Commit**

```bash
git add src/lib/reservation/expire.ts src/lib/reservation/expire.test.ts src/pages/api/sync/register-watch.ts
git commit -m "Let a hold nobody answered go, after a week"
```

---

## Task 11: Write it down for the studio

**Files:**
- Modify: `docs/calendar-setup.md`

- [ ] **Step 1: Add a reservations section**

Append to `docs/calendar-setup.md`:

````markdown
---

## Reservierungen zu- und absagen

Wählt jemand auf der Mieten-Seite einen Zeitraum, wird er sofort im
Reservierungskalender vorgemerkt und Sie bekommen eine E-Mail mit zwei
Links: **Zusagen** und **Absagen**.

Beide öffnen eine Seite mit einer Schaltfläche. Erst die Schaltfläche sagt zu
oder ab. Das ist Absicht: Mailprogramme rufen jeden Link in einer Nachricht
selbst auf, um ihn zu prüfen, und würden sonst für Sie zusagen.

Antworten Sie sieben Tage nicht, wird die Vormerkung nachts von selbst
gelöscht und der Zeitraum wieder frei.

### Zwei neue Einstellungen

| Variable | Wert |
|---|---|
| `GOOGLE_CALENDAR_RESERVATIONS` | die Kalender-ID des Reservierungskalenders |
| `RESERVATION_SECRET` | `openssl rand -hex 32` |

Wird `RESERVATION_SECRET` gewechselt, lassen sich bereits verschickte Links
nicht mehr öffnen. Die Anfragen sind nicht verloren — sie stehen in Ihrem
Postfach und die Tage bleiben vorgemerkt —, aber Sie müssen sie von Hand
beantworten.

### Was im Kalender steht, und was nicht

Im Kalendereintrag stehen **nur die Tage und eine Nummer**, zum Beispiel
`Angefragt — 7f3a91`. Name, E-Mail und Telefonnummer stehen ausschließlich in
der E-Mail mit derselben Nummer.

Das ist kein Zufall: Der Kalender gehört einem normalen Google-Konto, für das
es keinen Auftragsverarbeitungsvertrag gibt. Kundendaten gehören dort nicht
hinein. **Bitte tragen Sie Namen nicht nachträglich in den Kalendertitel
ein.**

Ihr Postfach ist damit der einzige Ort, an dem die Angaben liegen. Eine
Anfrage löschen heißt: die E-Mail löschen.

### Der Kalender muss privat bleiben

Am 28.08.2026 stand der Reservierungskalender auf **öffentlich** — jeder im
Internet konnte alle Einträge lesen. Das ist behoben: Die Website liest ihn
über die **geheime** iCal-Adresse, und „Öffentlich verfügbar machen" ist aus.

Schalten Sie das bitte nicht wieder ein. Muss der Kalender einmal neu
eingerichtet werden, ist die Reihenfolge:

1. Geheime iCal-Adresse kopieren und als `ICAL_RESERVATIONS_URL` eintragen.
2. Neu deployen.
3. Prüfen, dass `/api/calendars.json` bei `reservations` `"error": null` zeigt.
4. Erst danach „Öffentlich verfügbar machen" abschalten.

Andersherum ist der Mieten-Kalender bis zum nächsten Deploy leer.
````

- [ ] **Step 2: Commit**

```bash
git add docs/calendar-setup.md
git commit -m "Tell the studio how the approving works, and why no name is in the calendar"
```

---

## Task 12: Prove it on the deployment

The two endpoints talk to Google and to a mail server, so they are checked by hand against the live site, the way the calendar sync was.

- [ ] **Step 1: Push and wait for the production build**

```bash
git push origin v4
```

Wait for the deploy, then confirm the endpoint is reachable:

```bash
curl -s -X POST -H 'Content-Type: application/json' -d '{}' \
  https://lux-snowy-theta.vercel.app/api/reservation
```

Expected: `{"error":"Bitte Name und E-Mail ausfüllen."}` — **not** `{"skipped":…}`. A `skipped` means one of `GOOGLE_CALENDAR_RESERVATIONS`, `RESERVATION_SECRET`, the SMTP settings or `PUBLIC_SITE_URL` is missing in Vercel.

- [ ] **Step 2: Send a real request to yourself**

Use an address you can read as the visitor.

```bash
curl -s -X POST -H 'Content-Type: application/json' -d '{
  "name":"Testanfrage","email":"YOUR-ADDRESS@example.com",
  "anfrage":"Bitte ignorieren, Test.","startAt":"2026-11-16","endAt":"2026-11-18"
}' https://lux-snowy-theta.vercel.app/api/reservation
```

Expected: `{"ok":true,"ref":"…"}`. Then check, in order:

1. A tentative entry `Angefragt — <ref>` appears in the reservations calendar, holding 16–17 November.
2. **It contains no name** — open it and look.
3. `/api/calendars.json` shows those days as blocked within about fifteen seconds.
4. The studio mailbox has the request with both links.
5. The test address has the "we have it" message.

- [ ] **Step 3: Prove a mail scanner cannot approve it**

```bash
curl -s "<the approve link from the e-mail>" | grep -o "<h1>.*</h1>"
```

Expected: `<h1>Anfrage …</h1>` — the page. **Nothing must change.** Check the calendar entry is still `Angefragt` and that no approval mail arrived.

- [ ] **Step 4: Approve it properly**

Open the approve link in a browser and press the button. Expected: the entry becomes `Gebucht — <ref>` and confirmed, and the test address gets the approval.

Press the button again. Expected: "Schon zugesagt", and **no second mail**.

- [ ] **Step 5: Decline a second request**

Repeat step 2 with different days, then open the decline link and press the button. Expected: the calendar entry is gone, the days free up in `/api/calendars.json`, and the test address gets the friendly no.

Press it again. Expected: "Schon erledigt", and no second mail.

- [ ] **Step 6: Check the clash**

Send a request for days that a workshop already occupies.

Expected: `409` with `{"error":"Diese Tage sind inzwischen vergeben.","code":"taken"}` and **no** calendar entry created.

- [ ] **Step 7: Tidy up**

Delete every test entry from the calendar and note anything surprising in the plan before closing it out.

---

## Notes for the executor

- **Run `npm test` after every task.** The count only ever goes up: 31 at the start, 64 at the end.
- **`npm run build` is the real check** for anything touching an endpoint — a type error in an Astro page only shows up there.
- **Do not add a second Vercel cron.** Hobby has very few slots and the 04:00 job already exists.
- **If a task turns out to need something the plan does not mention**, stop and say so rather than inventing it. The spec is `docs/superpowers/specs/2026-08-28-lux-reservation-approval-design.md`.
