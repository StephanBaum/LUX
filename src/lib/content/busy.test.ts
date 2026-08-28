import assert from 'node:assert/strict'
import {test} from 'node:test'
import {parseIcal, withinWindow, fetchReservations} from './busy.ts'

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

// Deliberate shape: type: 'blocked' and events: [] are set even with no URL
// configured, so this feed still lands in the endpoint's `blocked` filter.
// The pre-refactor endpoint omitted `type` here by accident (an early return
// left it undefined, which JSON.stringify then dropped), silently excluding
// the feed. That was a bug, not a contract — this pins the corrected shape.
test('with no URL configured, the feed still reports its type rather than omitting it', async () => {
  const result = await fetchReservations('')
  assert.deepEqual(result, {
    name: 'reservations',
    type: 'blocked',
    events: [],
    error: 'No URL configured',
  })
})
