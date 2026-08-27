# Switching on the calendar sync

Everything is built. Nothing runs until these six settings exist. Until then
every sync endpoint answers `{"skipped": "Google ist nicht eingerichtet."}` and
the site behaves exactly as it does today.

Roughly 20 minutes, most of it clicking in Google Cloud.

---

## 1. One Google Cloud project

<https://console.cloud.google.com> → new project, name it `LUX Studio Website`.

Inside it, enable two APIs (APIs & Services → Library):

- **Google Calendar API** — for the sync
- **Generative Language API** — for the translations and the alt texts

Re-issue the Gemini key here (AI Studio → the key, set to this project) so
everything the site uses sits in one place the studio owns.

## 2. A service account

IAM & Admin → Service Accounts → Create.

- Name: `lux-website`
- No project role is needed. It gets its access from the calendar sharing, not
  from the project.
- Keys → Add key → JSON → download.

Two values out of that JSON file:

| JSON field | Environment variable |
|---|---|
| `client_email` | `GOOGLE_SERVICE_ACCOUNT_EMAIL` |
| `private_key` | `GOOGLE_PRIVATE_KEY` |

`private_key` contains real line breaks. Vercel cannot hold those, so paste it
as one line with each break written as `\n` — the code puts them back. It must
still start `-----BEGIN PRIVATE KEY-----\n`.

## 3. Share both calendars with it

In Google Calendar, for the **workshops** calendar and the **events** calendar:

Settings → Share with specific people → add the `client_email` address →
permission **"Make changes to events"**.

The reservations calendar is not shared. It stays read-only over its iCal URL
and keeps blocking dates on the Mieten page exactly as it does today.

Then, on each calendar's settings page, copy the **Calendar ID**:

| Calendar | Environment variable |
|---|---|
| Workshops | `GOOGLE_CALENDAR_WORKSHOPS` |
| Veranstaltungen | `GOOGLE_CALENDAR_EVENTS` |

## 4. Two more settings

| Variable | Value |
|---|---|
| `SYNC_SECRET` | A long random string you invent. It guards all three endpoints. |
| `PUBLIC_SITE_URL` | The public address, e.g. `https://lux-studio.lu`. Google calls back to it. |

Put all six in `.env` and in Vercel (Settings → Environment Variables), then
redeploy.

## 5. Tell Sanity to call the site on publish

<https://sanity.io/manage> → the project → API → Webhooks → Create.

| Field | Value |
|---|---|
| Name | `Kalender-Sync` |
| URL | `https://<your domain>/api/sync/from-sanity` |
| Dataset | `production` |
| Trigger on | Create, Update, Delete |
| Filter | `_type in ["workshop", "event"]` |
| Projection | `{_id, _type, googleEventId, googleCalendarId}` |
| HTTP method | POST |
| HTTP headers | `x-sync-secret: <your SYNC_SECRET>` |

The projection matters for deletes: once a document is gone, the only way to
know which calendar entry belonged to it is what the webhook carried.

## 6. Open the push channels

Google has to be asked to call us, and the permission lapses after about a
week. A Vercel cron re-registers it every night at 04:00 — that is already in
`vercel.json`. To open it the first time, or after changing a calendar:

```
curl -H "x-sync-secret: <your SYNC_SECRET>" \
  https://<your domain>/api/sync/register-watch
```

Add `?force=1` to replace a channel that has not expired yet.

---

## Checking it works

1. In the Studio, change a workshop's title and publish. The entry in Google
   Calendar changes within a second or two.
2. In Google Calendar, move the same workshop to another day. The Studio shows
   the new date within a few seconds.
3. Delete it in Google Calendar. The workshop stays in the Studio, goes back to
   being a draft, and shows **"Im Kalender gelöscht"**. Nothing is lost.
4. Make a new entry in Google Calendar. A draft workshop appears in the Studio
   marked **"Aus dem Kalender"**, invisible to the website until it is filled
   in and published.

Every document carries a badge saying where it stands, so a sync that stops
working is visible rather than silent. `sync-state` in Sanity holds the
channels, the reading positions and the last error.

## What travels, and what does not

Only **title, start and end**. Description, photograph, price, teacher, infos,
slug and translations never leave Sanity — the calendar has nowhere to put
them, and round-tripping them would lose them.

When both sides change between syncs, each field goes to whoever changed it
last, and whatever loses is written into the document's note. Nothing
disappears without a word.
