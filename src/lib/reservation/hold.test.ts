import assert from 'node:assert/strict'
import {test} from 'node:test'
import {reference, title, heldEvent, confirmedPatch, mayExpire, overlaps} from './hold.ts'

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

test('the reference is never on show, only in the private properties', () => {
  const e = heldEvent('7f3a91', '2026-10-02', '2026-10-05', ['Großes Studio'], NOW) as any
  assert.equal(e.summary.includes('7f3a91'), false, 'a code means nothing to whoever reads the calendar')
  assert.equal(e.description.includes('7f3a91'), false)
  assert.equal(e.extendedProperties.private.ref, '7f3a91', 'but the system still needs it')
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
