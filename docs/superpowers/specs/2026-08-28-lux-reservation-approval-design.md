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

**So nothing about a reservation is stored on the website.** The three places
a visitor's details exist are the studio's mailbox, the studio's Google
calendar, and the visitor's own inbox. All three are places the studio already
keeps such things, and deleting the calendar entry and the mail deletes it
everywhere.

This is the same reasoning that already governs `src/pages/api/inquiry.ts`.

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

The link carries a signed token and nothing else:

```json
{"c": "<calendarId>", "e": "<eventId>", "a": "approve", "x": 1788600000}
```

`base64url(payload) + "." + base64url(HMAC-SHA256(payload, secret))`

- **Signed, not encrypted, and deliberately empty of personal data.** A URL
  ends up in mail logs, browser history and proxy logs. The name and address
  are read back from the calendar entry when the button is pressed, so the
  link itself says nothing about anybody.
- **`x` is an expiry**, seven days out. A late click is refused with a page
  saying so.
- **Signed with `RESERVATION_SECRET`**, a new variable — not `SYNC_SECRET`.
  The calendar sync secret is handed to Google and to Sanity; a link secret
  that ends up in the studio's mailbox should not be able to drive the sync
  endpoints if it leaks.
- **Timing-safe comparison** (`crypto.timingSafeEqual`) so the signature
  cannot be guessed a byte at a time.

### Pressing the button twice

- **Approve twice** — the entry is patched to the same values again. Nothing
  changes and the visitor is not mailed a second time, because the code only
  mails when the entry was still tentative.
- **Decline twice** — the entry is already gone. Google answers 404 or 410,
  which is read as "already handled" and shown as such. No second mail.
- **Approve after Decline** — the entry is gone, so approving is refused with
  "this request no longer exists".

---

## 7. The calendar entry is the record

One entry in the **reservations** calendar, the same feed `/mieten` already
reads. That is what makes the hold visible with no new plumbing.

| Field | Tentative (held) | Confirmed (approved) |
|---|---|---|
| `summary` | `Angefragt: <name>` | `Gebucht: <name>` |
| `status` | `tentative` | `confirmed` |
| `transparency` | `opaque` | `opaque` |
| `description` | name, e-mail, telephone, company, rooms, equipment, message | unchanged |
| `extendedProperties.private` | `lux=reservation`, `held=<ISO timestamp>` | `lux=reservation` |
| `start` / `end` | the chosen days | unchanged |

`extendedProperties.private.lux` marks the entries this feature owns, so the
expiry job can never touch a booking the studio typed in by hand.

**The description carries the personal data.** That is on purpose: it is the
studio's own private calendar, it is where they would have written it anyway,
and it means the token can stay empty.

> **The calendar must be private first, and on 2026-08-28 it was not.**
> Its sharing list held `reader: ANYONE (public)`, and the site was reading it
> through the **public** iCal address. Anyone could fetch every entry with one
> unauthenticated request; this was demonstrated, not assumed. Writing a
> visitor's name, address and telephone number into a calendar in that state
> would publish them. Section 13 carries the fix, and it must be done before
> a single line of this feature is written.

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
| 1 | studio | on request | who, when, which rooms, which equipment, the message, and the two buttons |
| 2 | visitor | on request | we have your request for these days, you will hear within two working days |
| 3 | visitor | on approve | the days are yours, what happens next, how to reach the studio |
| 4 | visitor | on decline | those days are not possible, please ask again for another date |

The mailer in `inquiry.ts` moves to `src/lib/mail.ts` unchanged in behaviour —
the same lazy transport, the same timeouts, the same `oneLine` guard against a
robot writing its own headers. Both endpoints then use it.

**If the mail fails after the hold was written**, the hold is deleted again
before answering the visitor with an error. A held day nobody was told about
is worse than no hold.

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
| `src/lib/reservation/token.ts` | new | sign, verify, expire |
| `src/lib/reservation/hold.ts` | new | build the entry, read it back, decide if it may expire |
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

- **token** — round trip; a tampered payload fails; a tampered signature
  fails; an expired token fails; a token signed with another secret fails.
- **hold** — the entry has the right summary, status and marker in both
  states; the description contains what it should; reading it back gives the
  visitor's address again.
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
| `RESERVATION_SECRET` | a long random string; signs the links |

Sharing with the service account is **done** — it was added on 2026-08-28 and
verified: it can read the entries and the sharing list, so it has owner
rights and can write the holds.

### Closing the calendar, in this order

Doing it the other way round leaves the Mieten calendar empty until the next
deploy, because the public address stops answering the moment the calendar
turns private. The secret address works either way, so it goes first.

1. Google Calendar → the `LUX` calendar → Settings → **Secret address in iCal
   format** → copy it.
2. Put it in `ICAL_RESERVATIONS_URL`, in `.env` **and** in Vercel. Deploy.
3. Check `/api/calendars.json` still answers with `"error": null`.
4. Only now: Settings → **untick "Make available to public"**.
5. Check `/api/calendars.json` one more time.

Until step 4 is done, nothing may write a name into this calendar.

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
- **Personal data in the calendar description.** The studio must know that
  deleting a request means deleting the calendar entry. Written into
  `docs/calendar-setup.md`.
- **A calendar can be made public again with two clicks.** If that happens
  after this feature exists, every visitor's name and telephone number becomes
  world-readable. `docs/calendar-setup.md` must say so beside the setting, in
  the words the studio will read, not only in this spec.
- **The Growth trial ends around 2026-09-27.** This design does not depend on
  it — that is why nothing is stored.

---

## 15. Order of work

0. **The calendar goes private** (section 13). Nothing else starts until it is,
   because every later step writes a name into it.
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
