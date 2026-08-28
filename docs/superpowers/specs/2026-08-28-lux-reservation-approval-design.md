# Reservation approval — design

**Date:** 2026-08-28
**Status:** approved in conversation, not yet built
**Branch:** `v4` (currently Vercel Production)

---

## 1. Goal

Today a rental enquiry is an e-mail and nothing else. The studio reads it,
decides, and writes back by hand. Nothing on the site knows the answer, so a
day stays bookable until somebody remembers to block it in Google Calendar.

After this change:

- A visitor who picks dates and sends the form **holds** those days at once.
- The studio gets one e-mail with **Approve** and **Decline**.
- Approving turns the hold into a booking and tells the visitor.
- Declining frees the days and tells the visitor, kindly.
- A hold nobody answers expires by itself after seven days.

---

## 2. Non-goals

- **No list screen in the Studio.** The pending list is the Google calendar.
  Building a screen means storing personal data, and section 3 explains why
  that is not on the table.
- **No payment, no contract, no deposit.** An approval is an e-mail saying yes.
- **No change to the enquiry that has no dates.** That is still an e-mail and
  nothing else, exactly as it works today.
- **No account for the visitor.** They send a form and they get e-mails.

---

## 3. The decision that shapes everything: nothing is stored

The Sanity dataset is `aclMode: "public"`. Every document in it is readable by
anyone who knows the project id, which is public by design — it is compiled
into the Studio that runs in the browser. A reservation carries a name, an
e-mail address, a telephone number and a plan. None of that may go there.

The alternatives were a paid private dataset — the Growth trial ends around
2026-09-27 and the Free plan has no private datasets — or a new database
service. Both cost money and both create a second place where personal data
lives and has to be deleted on request.

**So nothing about a reservation is stored on the website.** This is the same
reasoning that already governs `src/pages/api/inquiry.ts`.

### Google is not a second place to put it either

The first draft of this design wrote the visitor's name, address and telephone
number into the calendar entry. It does not any more.

The calendar's owners are `baumsteph@gmail.com` and
`florian.luxenburger@gmail.com` — free consumer Google accounts, not Google
Workspace. A consumer account comes with no *Auftragsverarbeitungsvertrag*, so
there is no contract making Google a processor for the studio's customer data.
Nobody involved here is a lawyer, and this is not legal advice; it is a bet
not worth making when it is avoidable, and it is avoidable.

**The calendar only ever needed to know which days are taken.** It never
needed the name. So the entry carries two dates and a reference code, and
nothing else. Section 7 has the shape.

That leaves the visitor's details in exactly two places, both of which the
studio already runs: **its own mailbox at its own host**, and the visitor's
own inbox. Deleting the mail deletes the record.

The catch is that the approve and decline links then have no name to read
back, so the token has to carry it — which is why section 6 encrypts the
token instead of merely signing it.

---

## 4. The flow

```
Visitor fills the Mieten form, dates chosen
  │
  ├─ POST /api/reservation
  │    honeypot, field checks, dates sane and in the future
  │    are the days still free?  (same source the calendar shows)
  │    │
  │    ├─ no  → 409, the form says the days have just gone
  │    └─ yes → create a TENTATIVE entry in the reservations calendar
  │             "Angefragt: Anna Weber"
  │             the day now shows as taken on /mieten
  │             │
  │             ├─ mail to the studio: details + Approve / Decline links
  │             └─ mail to the visitor: we have it, you will hear back
  │
Studio clicks Approve
  └─ GET /api/reservation/approve?t=…   → a page with one button
       └─ POST the same URL
            entry becomes "Gebucht: Anna Weber", status confirmed
            mail to the visitor: yes
            page says done

Studio clicks Decline
  └─ GET /api/reservation/decline?t=…   → a page with one button
       └─ POST the same URL
            entry deleted, the days free up
            mail to the visitor: a friendly no
            page says done

Nobody clicks anything
  └─ the nightly job deletes tentative entries older than seven days
```

---

## 5. Why the link needs a second click

Mail clients follow links before a human does. Gmail, Outlook and most
scanners fetch every URL in a message to check it for malware. A plain
`GET /approve?t=…` would therefore approve the booking the moment the e-mail
arrived.

So the link is a two-step: **GET renders a page, POST does the work.** The page
shows who asked, for which days, and one button. A scanner fetches the page and
changes nothing.

This is not optional. Without it the feature approves everything by itself.

---

## 6. The token

Because the calendar holds no name, the token has to. So it is **encrypted**,
not signed — the link is the only carrier of the visitor's address between the
request and the studio's click.

```json
{
  "r": "7f3a91",              "// reference, also in the calendar summary": null,
  "c": "<calendarId>",
  "e": "<eventId>",
  "a": "approve",
  "n": "Anna Weber",
  "m": "anna@example.com",
  "d": "2026-10-02/2026-10-04",
  "x": 1789200000
}
```

**AES-256-GCM.** The output is `base64url(iv ‖ ciphertext ‖ authTag)` — a
12-byte random IV, and GCM's tag authenticates as well as encrypts, so a
tampered token fails to decrypt rather than needing a separate signature.

- **The key** is `RESERVATION_SECRET`, a new variable, 32 bytes of hex. Not
  `SYNC_SECRET`: that one is handed to Google and to Sanity, and a secret
  sitting in the studio's mailbox must not be able to drive the sync
  endpoints if it leaks.
- **`x` is an expiry**, seven days out, checked after decryption. A late
  click is refused with a page saying so.
- **Roughly 500 characters** in the URL. Well inside every mail client's
  limit.

### Is a name in a URL acceptable now?

It is ciphertext, readable only by the server holding the key. It travels in
the same e-mail whose body already lists the visitor's details in plain
German, so it adds no exposure the studio does not already have — and unlike
the body, it stays unreadable in Vercel's request logs.

### Pressing the button twice

The **calendar entry is the state machine**, even though it holds no name:

- **Approve twice** — the entry is already `confirmed`, so the code changes
  nothing and sends no second mail.
- **Decline twice** — the entry is gone. Google answers 404 or 410, read as
  "already handled". No second mail.
- **Approve after Decline** — the entry is gone, so it is refused with "this
  request no longer exists".
- **The studio deleted the entry by hand** — same as declined. The link says
  the request no longer exists.

---

## 7. The calendar entry is the record

One entry in the **reservations** calendar, the same feed `/mieten` already
reads. That is what makes the hold visible with no new plumbing.

One entry, and **no personal data in it**:

| Field | Tentative (held) | Confirmed (approved) |
|---|---|---|
| `summary` | `Angefragt — 7f3a91` | `Gebucht — 7f3a91` |
| `status` | `tentative` | `confirmed` |
| `transparency` | `opaque` | `opaque` |
| `description` | `Anfrage über die Website. Die Angaben stehen in der E-Mail mit dieser Nummer.` | unchanged |
| `extendedProperties.private` | `lux=reservation`, `held=<ISO timestamp>` | `lux=reservation` |
| `start` / `end` | the chosen days | unchanged |

**The reference code is how the two halves meet.** `7f3a91` is six random hex
characters. It is in the calendar summary and in the subject line of the
studio's e-mail, so seeing a held day in the calendar tells them which message
to open. It identifies nobody on its own.

`extendedProperties.private.lux` marks the entries this feature owns, so the
expiry job can never touch a booking the studio typed in by hand.

A collision between two live reference codes is possible and harmless — the
e-mail also carries the dates. Six hex characters is 16 million values against
a handful of open requests.

> **The calendar was world-readable on 2026-08-28, and is not any more.**
> Its sharing list held `reader: ANYONE (public)` and the site read it through
> the **public** iCal address; one unauthenticated request returned every
> entry. This was demonstrated, not assumed. It was closed the same day: the
> site now uses the secret address, the public address answers 404, and the
> whole path was tested end to end with a temporary entry.
>
> Section 13 keeps the procedure, because the setting can be switched back
> with two clicks.

---

## 8. Are the days still free?

Checked twice, and the second check is the one that counts:

1. In the browser, so the visitor is not offered a day that is plainly taken.
2. **In the endpoint**, immediately before writing the hold. Two people can
   send the same day within seconds of each other; only the server can settle
   it.

The endpoint reads the same two sources `/api/calendars.json` reads — the
reservations feed and the studio's own programme from Sanity — and refuses
with `409` if the range overlaps anything. The form shows the days have just
gone and asks for another range.

This is not a lock. Two requests landing in the same instant can both pass.
The consequence is one extra e-mail and a decline, which is acceptable for a
studio that gets a handful of enquiries a week. A real lock needs stored
state, and section 3 rules that out.

---

## 9. Expiring a hold

A tentative entry with `lux=reservation` and a `held` timestamp older than
seven days is deleted.

**Where it runs:** inside the existing nightly job at 04:00, not a second
cron. Vercel Hobby allows very few cron jobs and the calendar watch renewal
already uses one; adding another spends a scarce slot on a job that runs at
the same time anyway. `/api/sync/register-watch` gains a second task, and the
work is a call to a separate, testable function so the two do not tangle.

A failure to expire holds must not stop the watch renewal, and the other way
round. Each is wrapped on its own and both results are reported.

---

## 10. Mail

Four messages, all German, all plain text with a simple HTML twin.

| # | To | When | Says |
|---|---|---|---|
| 1 | studio | on request | the reference code in the subject, then who, when, which rooms, which equipment, the message, and the two buttons |
| 2 | visitor | on request | we have your request for these days, you will hear within two working days |
| 3 | visitor | on approve | the days are yours, what happens next, how to reach the studio |
| 4 | visitor | on decline | those days are not possible, please ask again for another date |

The mailer in `inquiry.ts` moves to `src/lib/mail.ts` unchanged in behaviour —
the same lazy transport, the same timeouts, the same `oneLine` guard against a
robot writing its own headers. Both endpoints then use it.

**If the mail to the studio fails after the hold was written**, the hold is
deleted again before answering the visitor with an error. The mail is now the
only record of who asked, so a hold whose mail never arrived is a day blocked
for a request nobody can read. That is worse than no hold.

Mail 2, to the visitor, is sent after mail 1 and its failure is not fatal —
the request is safely in the studio's inbox by then, and the visitor learns of
it from the reply.

---

## 11. What the visitor sees

The Mieten form gains no new fields. `src/scripts/form.js` sends to
`/api/reservation` when a date range is chosen and to `/api/inquiry` when it is
not — one branch, one line.

Three outcomes:

- **Sent** — the existing success panel, with wording about hearing back.
- **Days taken** (`409`) — a message asking for another range, and the
  calendar re-reads its blocked days so the newly taken ones grey out.
- **Anything else** — the existing failure panel, which already shows the
  studio's address so the visitor can write by hand.

---

## 12. Files

| File | New? | Purpose |
|---|---|---|
| `src/lib/mail.ts` | new (moved) | the transport and the send helper |
| `src/lib/reservation/token.ts` | new | encrypt, decrypt, expire |
| `src/lib/reservation/hold.ts` | new | the reference code, build the entry, decide if it may expire |
| `src/lib/reservation/messages.ts` | new | the four e-mails |
| `src/pages/api/reservation.ts` | new | take the request |
| `src/pages/api/reservation/[action].ts` | new | the confirm page, then the deed |
| `src/pages/api/inquiry.ts` | edit | use `src/lib/mail.ts` |
| `src/pages/api/sync/register-watch.ts` | edit | also expire stale holds |
| `src/lib/google/calendar.ts` | edit | create, patch and delete on any calendar |
| `src/scripts/form.js` | edit | choose the endpoint; handle 409 |
| `.env.example`, `docs/calendar-setup.md` | edit | the two new settings |

### Tests

Pure functions, tested with `node --test` as the rest of `src/lib` is:

- **token** — round trip returns every field; a flipped byte of ciphertext
  fails to decrypt rather than returning rubbish; a flipped byte of the auth
  tag fails; an expired token fails; a token made with another key fails; two
  tokens of the same payload differ, because the IV is random.
- **hold** — the entry has the right summary, status and marker in both
  states; **no field of it contains the visitor's name, address or telephone
  number**, asserted directly, because that is the whole point; the reference
  code appears in both the summary and the mail subject.
- **expiry** — an entry eight days old with the marker may go; one six days
  old may not; one **without** the marker may never go, however old; a
  confirmed booking may never go.
- **overlap** — a range touching a blocked day is refused; a range ending the
  day another begins is allowed.

The two endpoints are checked by hand against the live deployment, as the
calendar sync was.

---

## 13. New settings

There is **no new calendar**. It is the one the studio already uses, named
`LUX`:

```
112671d25347dedba554c498361ae5880852ba0687c788da886e5c4a331ac88b@group.calendar.google.com
```

| Variable | What |
|---|---|
| `GOOGLE_CALENDAR_RESERVATIONS` | the id above |
| `RESERVATION_SECRET` | 32 bytes of hex; the key the links are encrypted with |

Generate the key with `openssl rand -hex 32`. Changing it later makes every
link already sent unopenable, which is a safe failure — the studio answers
those requests by hand.

### Already done on 2026-08-28

- **The service account was shared in** and verified: it can read the entries
  and the sharing list, so it holds owner rights and can write the holds.
- **The calendar was made private.** The site was moved to the secret iCal
  address first, then the public setting was switched off — that order, or
  the Mieten calendar goes empty until the next deploy. Verified after each
  step: the public address answers 404, and a temporary entry travelled from
  the private calendar to `/api/calendars.json` in fifteen seconds.

If the calendar ever has to be moved or rebuilt, that is the order to repeat:
secret address into `ICAL_RESERVATIONS_URL`, deploy, check
`/api/calendars.json` answers with `"error": null`, and only then untick
**Make available to public**.

The outstanding SMTP settings are still needed. Nothing mails without them.

---

## 14. Risks

- **The two-click page is load-bearing.** If it is ever "simplified" back to a
  plain link, mail scanners will approve every booking. The reason is written
  in the endpoint, not only here.
- **No lock.** Two requests in the same second can both be held. Accepted; see
  section 8.
- **The iCal feed is not instant.** A hold appears in the feed as fast as
  Google publishes it, which is usually seconds but is not guaranteed. The
  visitor is told their request is in, not that the day is now theirs, so a
  short lag is invisible.
- **The mailbox is now the only record.** Deleting a request means deleting
  the e-mail; the calendar entry carries nothing to delete. That is simpler,
  but it also means an accidentally emptied mailbox loses the details of any
  request not yet answered. The held day survives, so nothing is
  double-booked — the studio just has to ask again. Written into
  `docs/calendar-setup.md`.
- **Somebody re-adds the name to the calendar summary** because it is more
  convenient to read. That is how the personal data gets back into Google.
  The reason lives in a test that asserts the entry contains no name, so the
  change fails rather than passes quietly.
- **A calendar can be made public again with two clicks.** It carries no names
  now, so the damage is limited to the studio's bookings being visible — but
  `docs/calendar-setup.md` must still say so beside the setting, in the words
  the studio will read.
- **`RESERVATION_SECRET` is lost or rotated.** Every link already sent stops
  opening. The requests are not lost — they are in the mailbox and the days
  are still held — but they have to be answered by hand. Worth a line in the
  setup document.
- **The Growth trial ends around 2026-09-27.** This design does not depend on
  it — that is why nothing is stored.

---

## 15. Order of work

0. **The calendar goes private** — done on 2026-08-28, see section 13.
1. `src/lib/mail.ts` extracted, `inquiry.ts` still green.
2. `token.ts` with its tests.
3. `hold.ts` and the expiry rule, with tests.
4. `calendar.ts` able to write to an arbitrary calendar.
5. `POST /api/reservation` — hold plus two mails.
6. The confirm page and the two actions.
7. `form.js` — the branch and the 409.
8. Expiry folded into the nightly job.
9. Docs and `.env.example`.

Each step leaves the branch deployable. Steps 1 to 4 change nothing a visitor
can see.
