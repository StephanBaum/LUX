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
