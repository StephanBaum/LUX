# LUX Studio V4 — Sanity CMS, Beratung Page, Calendar Sync

**Date:** 2026-08-26
**Branch:** `v4` (worktree at `Lux/site_v4`, repo root `Lux/site_v3`)
**Status:** Design approved, pending spec review

---

## 1. Goal

Hand the client full control of the website's content so he never edits a
markdown file or asks the developer for a text change.

Concretely, after V4 ships the client can, on his own:

- Change every word on every page, in German.
- Fill English, French and Luxembourgish with one button.
- Upload, replace, crop and remove every photo.
- Add and remove workshops, events, rooms, equipment, people and services.
- Keep his Google Calendar and the website in step, both ways, for the
  name and date of workshops and events.

Two smaller things ship with it: a lightbox on the image galleries and a
new *Beratung* page.

V4 is built on a branch so V3 stays live and untouched until the client
approves.

---

## 2. Non-goals

- No visual redesign. Layout, type and colour stay as they are in V3.
- No page-builder. The client edits content, not structure. He cannot add,
  remove or reorder sections.
- The client does not translate by hand. He writes German only.
- No two-way sync of anything except a workshop's or event's name and date.
- No CMS control over legal page structure beyond its text.

---

## 3. Decisions already taken

| Decision | Choice | Why |
|---|---|---|
| CMS | Sanity | Free tier covers this site many times over; image CDN solves the image problem outright; split-screen visual editing exists |
| Editing scope | Text + images + repeatable entries | Client asked for full control |
| Languages | German is the source; en/fr/lu are generated | Client writes German only |
| Workshops / events source of truth | Sanity | A calendar entry cannot hold a photo, price, teacher or four languages |
| Calendar link | Two-way, but **only** name and date | Narrow surface makes it safe |
| Calendar change trigger | Google push notifications | Vercel Hobby crons run only once per day; push is instant and free |
| Beratung page shape | Service page, not case studies | Client has no cleared reference work yet |
| Version strategy | Git branch `v4` + worktree | Vercel builds branches as previews for free; V3 stays live |

### Sanity free plan headroom

| Limit | Free plan | Expected use |
|---|---|---|
| Users | 20 | 2–3 |
| Documents | 10,000 | ~60 |
| Asset storage | 100 GB | < 1 GB |
| Bandwidth | 100 GB/month | negligible |
| CDN requests | 1,000,000/month | negligible |

---

## 4. Current state (V3), for reference

- Astro 5, `output: 'static'`, `@astrojs/vercel` adapter, `@astrojs/sitemap`.
- Content lives in `public/content/{de,en,fr,lu}/*.md` as YAML frontmatter.
- `src/scripts/i18n.js` fetches those files at runtime and swaps the text of
  every element carrying a `data-i18n` attribute.
- 191 `data-i18n` keys across 8 pages. Coverage is incomplete: the profile
  e-mail and Instagram links, the slider label, the equipment item names and
  all image `alt` text are hard-coded.
- 41 image files in `public/Assets/`, 8.9 MB, referenced by literal path 78
  times across the `.astro` pages. `public/Assets/img/img/` (~3 MB) is dead —
  zero references.
- Astro's image optimizer is unused (0 uses of `astro:assets`).
- `src/pages/api/calendars.json.js` reads up to three iCal feed URLs from env
  and returns parsed events as JSON. Only `ICAL_RESERVATIONS_URL` is set.
- `src/scripts/events-loader.js` builds the Workshops and Veranstaltungen
  accordion items from that JSON, falling back to hard-coded dummy items, and
  assigns each event a random dummy photo.
- `src/scripts/form.js:256` ends at `console.log('Form submitted:', data)`.
  **The contact form sends nothing.**
- `src/pages/impressum.astro:60` carries a placeholder tax number
  (`DE XXX XXX XXX`).
- Lorem ipsum remains on index, studio, workshops and veranstaltungen.

---

## 5. Content model

All types live in `sanity/schemaTypes/`. Field names are English; all
client-facing labels are German.

### 5.1 Singletons (the client cannot create or delete these)

| Type | Holds |
|---|---|
| `siteSettings` | Address, phone, e-mail, social links, partner logos, default OG image |
| `homePage` | Every text and image on `/` |
| `studioPage` | Header, section labels, gallery, slider label, CTA |
| `mietenPage` | Header, section labels, calendar hint, form labels, CTA |
| `workshopsPage` | Header, section labels, CTA (the entries themselves are separate) |
| `veranstaltungenPage` | Same shape as `workshopsPage` |
| `beratungPage` | Header, section labels, process steps, CTA |
| `legalPage` × 3 | Impressum, Datenschutz, AGB — title plus rich text |

Every singleton exposes **all** of its page's visible strings, including
section labels, button words and CTA text.

### 5.2 Repeatable documents

| Type | Fields |
|---|---|
| `person` | name, role, email, instagram, bio, expertise[] (title, detail, year), photo |
| `room` | title, size, features[], description, photo, order |
| `equipmentItem` | name, category (`light` \| `camera` \| `grip`), order |
| `workshop` | title, slug, teacher → `person`, description, infos[] (label, value), photo, startAt, endAt, sync fields (§7) |
| `event` | title, slug, description, photo, startAt, endAt, sync fields (§7) |
| `service` | title, description, photo, order — drives the Beratung page |
| `galleryImage` | image, alt, caption, order, usage (`studio-slider` \| `studio-profile` \| `home`) |

There is deliberately **no** `published` boolean. Sanity's native draft /
publish state controls visibility: the site queries published documents only,
so a draft workshop is invisible until the client publishes it.

`equipmentItem.name` is a product name (e.g. "ARRI SkyPanel S60") and is
therefore **not** translated. Everything else in the table is.

### 5.3 Sanity Studio layout

The Studio is embedded in the Astro app at `/studio` (`sanity/` package,
`@sanity/astro`). The desk structure groups documents as the client thinks
about them, not as the schema is written:

```
Seiten            → the singletons, in menu order
Workshops         → workshop documents, sorted by date
Veranstaltungen   → event documents, sorted by date
Studio            → Personen, Räume, Equipment, Galerien
Beratung          → Leistungen
Einstellungen     → siteSettings
```

---

## 6. Translation

German is the only language the client types.

Every translatable field is a plain string or portable-text field in German.
A hidden `i18n` object on each document mirrors those fields for `en`, `fr`
and `lu`. The client never sees it.

A document action **"Übersetzen"** appears on every translatable document. It:

1. Collects the German values and the current `i18n` snapshot.
2. Sends only the fields whose German text changed since the last translation
   (compared against a stored `translatedFrom` snapshot) to the Claude API.
3. Writes the results into `i18n` and updates `translatedFrom`.
4. Reports what it changed.

Untouched fields are never re-translated, so hand-corrected wording survives.

If the client publishes without translating, the site falls back to German for
that field. The Studio shows a warning badge on documents whose German text is
newer than their translation.

**Model:** Claude (Sonnet tier is sufficient for this) via the Anthropic API,
called from a Vercel function so the API key never reaches the browser.

---

## 7. Google Calendar sync

### 7.1 Scope

Synced both ways: **`title`, `startAt`, `endAt`** on `workshop` and `event`.

Never synced: description, photo, price, teacher, infos, slug, translations.

Two calendars, matching the existing config shape: one for workshops, one for
events. The existing reservations calendar is **read-only** and untouched — it
keeps blocking dates on the Mieten page exactly as it does today.

### 7.2 Access

A Google Cloud service account with the Calendar API enabled. The client shares
both calendars with the service account's e-mail address, granting
"Make changes to events". Credentials live in Vercel env vars.

This replaces the secret iCal URL for these two calendars. The reservations
calendar keeps using its iCal URL.

### 7.3 Sync state stored on each document

```
googleEventId      string   — the matching calendar entry
googleCalendarId   string   — which of the two calendars
syncedTitle        string   — last value we wrote or read
syncedStartAt      datetime
syncedEndAt        datetime
syncedAt           datetime
syncStatus         'ok' | 'error' | 'date-missing' | 'needs-details'
syncMessage        string   — shown in the Studio when status is not ok
```

### 7.4 Sanity → Google (instant)

A Sanity webhook fires on publish of `workshop` or `event` and calls
`POST /api/sync/from-sanity`.

1. Compare `title`/`startAt`/`endAt` against `synced*`. If identical, stop.
   **This is the loop guard.**
2. If `googleEventId` is empty, create the calendar entry and store its ID.
3. Otherwise patch the calendar entry.
4. Write the new values into `synced*`, set `syncedAt` and `syncStatus`.

Deleting a `workshop` or `event` in Sanity deletes the calendar entry.

### 7.5 Google → Sanity (near-instant)

Google Calendar push notifications, not polling.

- `POST /api/sync/register-watch` opens a watch channel on each calendar,
  pointing at `POST /api/sync/from-google`. Channel ID, resource ID, expiry and
  the incremental `syncToken` are stored in a `syncState` document in Sanity.
- Google calls `from-google` whenever anything in the calendar changes. The
  notification says only *something changed*, so the handler calls
  `events.list` with the stored `syncToken` to fetch the delta, then stores the
  new token.
- For each changed calendar entry:
  - Find the Sanity document by `googleEventId`.
  - Compare against `synced*`. If identical, stop. **Loop guard.**
  - Otherwise patch `title`/`startAt`/`endAt`, update `synced*`, set
    `syncStatus: 'ok'`.
- Watch channels expire. A **daily** Vercel cron (`0 4 * * *`, the once-a-day
  limit the Hobby plan allows) re-registers both channels well before expiry
  and repairs a broken channel.
- The handler verifies the `X-Goog-Channel-Token` header against a secret
  stored in env before doing any work.

### 7.6 Conflict rule

Newest write wins, **per field**. Google supplies `updated` on each entry;
Sanity supplies `_updatedAt`. When both changed since `syncedAt`, each field
takes the value from whichever side has the later timestamp. The losing value
is recorded in `syncMessage` so nothing vanishes silently.

### 7.7 Deletion rule (deliberately asymmetric)

| Deleted in | Result |
|---|---|
| Sanity | Calendar entry is deleted |
| Google Calendar | Sanity document **survives**. It is unpublished (returned to draft), gets `syncStatus: 'date-missing'`, and disappears from the website. All its content is intact and waiting |

Rationale: a calendar entry is trivially deleted from a phone. A Sanity
workshop represents twenty minutes of writing plus a photo. Losing it to a
mis-swipe is unacceptable.

### 7.8 Entry created directly in Google Calendar

A new calendar entry with no matching `googleEventId` creates a Sanity
`workshop` (or `event`) **draft** with only `title`, `startAt`, `endAt` and
`syncStatus: 'needs-details'`. Being a draft, it is invisible to the site.

It does not appear on the website until the client fills it in and publishes.
This lets him block a date from his phone and write it up later.

### 7.9 Health

`syncStatus` and `syncedAt` render as a badge in the Studio document list, so
a silent breakage is visible. `siteSettings` shows the last successful watch
registration.

---

## 8. Images

- Every content image becomes a Sanity `image` field with hotspot and crop.
- The frontend builds URLs with `@sanity/image-url`:
  `?w=<width>&auto=format&q=80&fit=max`, plus a `srcset` at 1×/2×.
  Sanity serves WebP/AVIF automatically to browsers that accept them.
- `alt` text becomes a translatable field on the image, closing a current gap.
- The `blurHash`/LQIP metadata Sanity returns is used for a placeholder so
  layout does not jump.

**Migration and clean-up, in this order:**

1. Upload the current images from `public/Assets/img/` into Sanity as the
   **seed photo** for every image field (§16). They stay visible on the site,
   now served by Sanity, and the client swaps them one by one.
2. `public/Assets/img/img/` is dead (zero references, ~3 MB) and is deleted
   outright — nothing there is seeded.
3. Once every image field points at Sanity, delete `public/Assets/img/`.
   Verify with a build plus a grep for `Assets/img` before deleting.
4. Keep `public/Assets/arrow.svg`, `Logo-simple-01.svg`,
   `LogoLux4Web_weiss.png` — brand assets, not content.

---

## 9. Rendering and data flow

The site stays static. The 191 existing `data-i18n` keys and
`src/scripts/i18n.js` **stay** — only the source of the content changes. This
keeps the change small and the risk low.

**At build time:**

1. Fetch all content from Sanity via GROQ.
2. Render German directly into the HTML, so the page is correct and indexable
   with JavaScript disabled.
3. Emit `/content/{de,en,fr,lu}/{page}.json` from the German fields and the
   `i18n` object — the same shape `i18n.js` already consumes, JSON instead of
   YAML frontmatter.
4. `i18n.js` gains only a format change (JSON parse instead of YAML parse).

**On publish:** a Sanity webhook triggers a Vercel deploy hook. The site is
live again in about a minute.

**Coverage gaps to close while rewiring** (currently hard-coded, must become
CMS fields): profile e-mail and Instagram links, the "Das Equipment" slider
label, `equipmentItem` names, and all image `alt` text.

**Visual editing (last phase, optional):** a preview route running in SSR mode
with `@sanity/visual-editing` and stega-encoded content gives the client the
split-screen "click the page, edit the field" experience. Everything above
works without it.

---

## 10. Contact form (currently broken)

`src/scripts/form.js` posts to a new `POST /api/inquiry` function which:

1. Rejects submissions that fill the honeypot field.
2. Validates required fields server-side.
3. Sends an e-mail to `servus@luxenburger.de` via Resend (free tier covers this
   volume), containing the message, the selected rooms and equipment, and the
   requested dates. `Reply-To` is set to the enquirer, so the client just hits
   reply.
4. On success returns 200. **On failure returns an error** and the form shows a
   German message with the studio's phone number and e-mail address, so the
   visitor is never left believing a lost message was sent.

**Enquiries are not stored in Sanity.** The Sanity free plan offers public
datasets only — anyone who learns the project ID could read them. Contact-form
submissions are personal data under GDPR and must not sit in a public dataset.
E-mail is the only store. Resend's own dashboard keeps a delivery log, which
covers "did it actually go out".

A CMS inbox inside the Studio would need a private dataset, which is a paid
Sanity plan. Out of scope; revisit only if the client asks and accepts the cost.

Rate limiting: a simple per-IP cap in the function. Cloudflare Turnstile can be
added later if spam appears; not built now.

---

## 11. Beratung page

New page `src/pages/beratung.astro`, new entries in `MenuOverlay.astro` and
`Footer.astro`, new content in all four languages.

**The layout is being designed separately on a design canvas**, since this is
the only page with no V3 precedent. The section list below is the starting
proposal for that session, not a final decision. Copy and images are best-guess
placeholders drawn from existing assets, per §16.

Sections, top to bottom:

1. **Page header** — title, intro text, image. Reuses `page-header.css`.
2. **Leistungen** — three `service` entries: Art Direction, Fotografie mit KI,
   Director of Photography (Film). Reuses the accordion pattern from
   `mieten.astro`, so each service opens to reveal detail and an image.
3. **Ablauf** — a short numbered process, three or four steps, telling an
   agency how working with him goes. New, small block; reuses `list-row.css`.
4. **Für wen** — who this is for (agencies, brands, production companies).
   Plain text block, reuses `profile.css` typography.
5. **CTA** — same CTA block as the other pages.

Everything on it is CMS-driven: the services are `service` documents, the rest
lives on `beratungPage`.

SEO: JSON-LD `ProfessionalService` with a `hasOfferCatalog` listing the three
services, via the existing `SEO.astro` component.

---

## 12. Lightbox

New `src/scripts/lightbox.js` + `src/styles/components/lightbox.css`.

- Applies to the studio slider and the profile galleries via a
  `data-lightbox="<group>"` attribute.
- Click or Enter opens the image full-screen; arrow keys and swipe move
  between images in the group; Escape or a click outside closes.
- Focus is trapped while open and restored on close; the trigger keeps its
  focus ring. Background scroll is locked.
- Serves a larger Sanity variant than the thumbnail.
- No dependency. Vanilla JS, matching the existing script style, including the
  `astro:page-load` re-init the other scripts use.

---

## 13. Other fixes carried into V4

- Move the tax number out of `impressum.astro` into `siteSettings`. It keeps
  its placeholder value `DE XXX XXX XXX` until the client supplies the real
  one, and the Sanity field carries a German warning that the site must not go
  public until it is replaced. Tracked on the launch checklist (§16).
- Remove all remaining lorem ipsum — it becomes real CMS content.
- Update `astro.config.mjs` `site` once the final domain is confirmed.
- Update `README.md`: script paths moved from `public/js/` to `src/scripts/`,
  and styles from `public/styles/` to `src/styles/`. Rewrite `EDITING.md` as a
  client-facing CMS guide.

---

## 14. Environment variables

```
# Sanity
PUBLIC_SANITY_PROJECT_ID
PUBLIC_SANITY_DATASET
SANITY_API_READ_TOKEN
SANITY_API_WRITE_TOKEN
SANITY_WEBHOOK_SECRET

# Google Calendar (service account)
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
GOOGLE_CALENDAR_ID_WORKSHOPS
GOOGLE_CALENDAR_ID_EVENTS
GOOGLE_PUSH_TOKEN            # verifies incoming push notifications

# Existing — reservations stay on iCal
ICAL_RESERVATIONS_URL

# Translation
ANTHROPIC_API_KEY

# Mail
RESEND_API_KEY
INQUIRY_TO_EMAIL

# Deploy
VERCEL_DEPLOY_HOOK_URL
```

---

## 15. Order of work

Each phase leaves the branch in a working, deployable state.

| # | Phase | Delivers |
|---|---|---|
| 1 | Sanity project + schemas + Studio at `/studio` | Client can log in and see the shape of his site |
| 2 | Migrate V3 German content into Sanity | Real content in the CMS, scripted, repeatable |
| 3 | Rewire pages to read from Sanity at build; JSON content output | Site renders from the CMS; `i18n.js` keeps working |
| 4 | Images onto Sanity + lightbox + delete dummy assets | Client can swap every photo; galleries open big |
| 5 | Beratung page | New page live on the preview URL |
| 6 | "Übersetzen" action | Client fills en/fr/lu with one button |
| 7 | Contact form → Sanity + e-mail | Enquiries actually arrive |
| 8 | Google Calendar two-way sync | Dates stay in step both ways |
| 9 | Visual editing preview *(optional)* | Split-screen editing |

Phase 8 is the largest and riskiest single piece. Phases 1–7 are useful without
it; if it has to be cut, the site still works with Sanity as the sole source
and no calendar link.

---

## 16. Seed content — nothing is blocked on the client

**Decision: we do not wait for the client.** No real copy or photography will
arrive before the build. Sanity is seeded so that every page looks finished on
day one, and the client's job is to *replace* what he does not like rather than
to *fill an empty box*. An empty CMS is the fastest way to lose a client's
interest; a full one invites edits.

### Seeding rules

| Source | Treatment |
|---|---|
| V3 German text that reads well (Mieten rooms, Studio header, Workshops, CTAs) | Migrated verbatim into Sanity |
| V3 lorem ipsum (index, studio bio, workshop and event descriptions) | Replaced with plausible German copy written as a best guess, in the studio's voice. Never shipped as Latin |
| Existing images in `public/Assets/img/` | Uploaded into Sanity as the starting photo for every image field |
| Beratung page | Copy and images are a best guess too; see §11 |

Every seeded field carries a Sanity field description in German telling the
client this is placeholder text he should replace.

### Launch checklist — must be real before the site goes public

These are not build blockers. They are go-live blockers, tracked separately:

1. **VAT / tax number** for the Impressum. Currently `DE XXX XXX XXX`. It moves
   into `siteSettings` with a loud German warning on the field. **The site must
   not go public with a fake one** — it is a legal risk in Germany.
2. **Final domain**, to set `site` in `astro.config.mjs`.
3. **The client's two Google Calendar IDs**, plus sharing both with the service
   account. Only needed at launch — for building and testing phase 8 we use a
   throwaway Google account and test calendars we create ourselves.
4. **Real photography.** The site ships with the current dummy images. They are
   stock and placeholder shots; they are fine for review and for showing the
   client, and they must be replaced before the site is public.

---

## 17. Risks

| Risk | Mitigation |
|---|---|
| Sanity free tier is **public dataset only** — drafts are readable by anyone who learns the project ID | The site's content is public by nature, so this is acceptable for pages, workshops and images. It is why contact-form submissions are e-mail only and never stored in Sanity (§10). Do not add any personal or confidential data to the dataset |
| Two-way calendar sync breaks silently | `syncStatus` badge, daily watch re-registration, `syncMessage` records losing values |
| Google push channels expire | Daily cron re-registers; handler repairs a dead channel on the next Sanity→Google write |
| Machine translation reads wrong in fr/lu | Client or a translator can hand-edit `i18n`; edited fields are not overwritten |
| Client finds the CMS too complicated | This is exactly why V4 is a branch. `master`/V3 stays live and reachable throughout |
| Losing V3 content during migration | Migration script is one-way and re-runnable; V3 markdown files stay in git on `master` |

---

## 18. Branch and deployment

- `master` — V3. Stays Vercel **Production**. Untouched.
- `v4` — this work. Vercel builds it as a **Preview** automatically, with a
  stable URL to show the client.
- Worktree at `Lux/site_v4` so V3 and V4 run locally at the same time.
- On approval: merge `v4` into `master`. On rejection: delete the branch.
- `.env` is copied into the worktree and is git-ignored; new keys go into
  Vercel's environment settings for the Preview environment.
