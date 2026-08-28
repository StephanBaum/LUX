import assert from 'node:assert/strict'
import {test} from 'node:test'
import {reference, title, shown, heldEvent, confirmedPatch, mayExpire, overlaps, canCancel, cancelUntil} from './hold.ts'

const NOW = new Date('2026-10-01T12:00:00.000Z')

test('a reference is six hex characters, and not the same twice', () => {
  const a = reference()
  assert.match(a, /^[0-9a-f]{6}$/)
  assert.notEqual(a, reference())
})

test('a hold is tentative, marked as ours, and stamped with the time', () => {
  const e = heldEvent('7f3a91', '2026-10-02', '2026-10-05', ['Großes Studio'], NOW) as any
  assert.equal(e.status, 'tentative')
  assert.equal(e.transparency, 'opaque')
  assert.equal(e.extendedProperties.private.lux, 'reservation')
  assert.equal(e.extendedProperties.private.ref, '7f3a91')
  assert.equal(e.extendedProperties.private.held, NOW.toISOString())
  assert.equal(e.start.date, '2026-10-02')
  assert.equal(e.end.date, '2026-10-05')
})

test('the calendar says which room was asked for, not a code', () => {
  const one = heldEvent('7f3a91', '2026-10-02', '2026-10-05', ['Großes Studio'], NOW) as any
  assert.equal(one.summary, 'Anfrage „Großes Studio“')

  const two = heldEvent('7f3a91', '2026-10-02', '2026-10-05', ['Großes Studio', 'Analog Studio'], NOW) as any
  assert.equal(two.summary, 'Anfrage „Großes Studio, Analog Studio“')
})

test('no room chosen leaves the word standing alone, not empty quotes', () => {
  const none = heldEvent('7f3a91', '2026-10-02', '2026-10-05', [], NOW) as any
  assert.equal(none.summary, 'Anfrage')
  const blank = heldEvent('7f3a91', '2026-10-02', '2026-10-05', ['', '  '], NOW) as any
  assert.equal(blank.summary, 'Anfrage')
})

test('the title stays free of the number; the description carries it', () => {
  const e = heldEvent('7f3a91', '2026-10-02', '2026-10-05', ['Großes Studio'], NOW) as any
  assert.equal(e.summary.includes('7F3A91'), false, 'the title is for reading at a glance')
  assert.ok(e.description.includes('Buchung 7F3A91'), 'the description is what Google searches')
  assert.equal(e.extendedProperties.private.ref, '7f3a91')
})

test('the description warns that deleting by hand tells the guest nothing', () => {
  const e = heldEvent('7f3a91', '2026-10-02', '2026-10-05', [], NOW) as any
  assert.ok(/von Hand gelöscht/.test(e.description))
  assert.ok(/erfährt nichts/.test(e.description))
})

test('a booking number is shown in uppercase', () => {
  assert.equal(shown('7f3a91'), '7F3A91')
})

test('a guest may cancel up to seven days before the first day', () => {
  const start = '2026-10-15'
  assert.equal(canCancel(start, new Date('2026-10-01T12:00:00Z')), true, 'two weeks out')
  assert.equal(canCancel(start, new Date('2026-10-07T23:00:00Z')), true, 'just over eight days')
  assert.equal(canCancel(start, new Date('2026-10-08T12:00:00Z')), false, 'exactly seven days is too late')
  assert.equal(canCancel(start, new Date('2026-10-14T12:00:00Z')), false, 'the day before, certainly not')
  assert.equal(canCancel(start, new Date('2026-10-20T12:00:00Z')), false, 'after it has happened')
})

test('a nonsense date cannot be cancelled rather than throwing', () => {
  assert.equal(canCancel('not-a-date', NOW), false)
})

test('the guest can be told the last day they may cancel', () => {
  assert.equal(cancelUntil('2026-10-15'), '2026-10-08')
  assert.equal(cancelUntil('2026-01-03'), '2025-12-27')
})

test('a hold names nobody — this is the whole point', () => {
  const e = heldEvent('7f3a91', '2026-10-02', '2026-10-05', ['Großes Studio'], NOW)
  const everything = JSON.stringify(e)
  for (const forbidden of ['Anna', 'anna@example.com', '0170', 'Weber']) {
    assert.equal(everything.includes(forbidden), false, `${forbidden} must not be in the entry`)
  }
  assert.equal(everything.includes('Großes Studio'), true, 'the studio\'s own room may be named')
})

test('approving keeps the room and only changes the word', () => {
  const p = confirmedPatch('Anfrage „Großes Studio“') as any
  assert.equal(p.summary, 'Gebucht „Großes Studio“')
  assert.equal(p.status, 'confirmed')
  assert.equal(p.extendedProperties.private.lux, 'reservation')
  assert.equal(p.extendedProperties.private.held, null)
})

test('approving something oddly named still says Gebucht', () => {
  assert.equal((confirmedPatch(undefined) as any).summary, 'Gebucht')
  assert.equal((confirmedPatch('von Hand eingetragen') as any).summary, 'Gebucht')
})

test('the title helper joins rooms and skips the empties', () => {
  assert.equal(title('Anfrage', ['A', 'B']), 'Anfrage „A, B“')
  assert.equal(title('Gebucht', []), 'Gebucht')
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
