import assert from 'node:assert/strict'
import {test} from 'node:test'
import {asBlockedDates} from './occupancy.ts'

const NOW = new Date('2026-09-01T12:00:00.000Z')

const doc = (over = {}) => ({
  _id: 'workshop-1',
  _type: 'workshop',
  title: [
    {_key: 'de', language: 'de', value: 'Dunkelkammer Basics'},
    {_key: 'en', language: 'en', value: 'Darkroom Basics'},
  ],
  startAt: '2026-09-10T08:00:00.000Z',
  endAt: '2026-09-10T16:00:00.000Z',
  ...over,
})

test('a workshop becomes a blocked range with its German name', () => {
  const [blocked] = asBlockedDates([doc()], NOW)
  assert.equal(blocked.type, 'blocked')
  assert.equal(blocked.summary, 'Dunkelkammer Basics')
  assert.equal(blocked.start, '2026-09-10T08:00:00.000Z')
  assert.equal(blocked.end, '2026-09-10T16:00:00.000Z')
  assert.equal(blocked.uid, 'workshop-1')
})

test('an appointment with no end blocks its start day', () => {
  const [blocked] = asBlockedDates([doc({endAt: null})], NOW)
  assert.equal(blocked.end, blocked.start)
})

test('an appointment with no date blocks nothing', () => {
  assert.deepEqual(asBlockedDates([doc({startAt: null, endAt: null})], NOW), [])
})

test('a date outside the window is left out', () => {
  const longAgo = doc({_id: 'old', startAt: '2020-01-01T08:00:00.000Z', endAt: null})
  const farOff = doc({_id: 'far', startAt: '2030-01-01T08:00:00.000Z', endAt: null})
  assert.deepEqual(asBlockedDates([longAgo, farOff], NOW), [])
})

test('yesterday still counts, so a booking cannot be laid over it', () => {
  const yesterday = doc({startAt: '2026-08-31T08:00:00.000Z', endAt: null})
  assert.equal(asBlockedDates([yesterday], NOW).length, 1)
})

test('a title in another language is no reason to skip the day', () => {
  const [blocked] = asBlockedDates(
    [doc({title: [{_key: 'en', language: 'en', value: 'Darkroom Basics'}]})],
    NOW,
  )
  assert.equal(blocked.summary, 'Darkroom Basics')
})

test('a nameless appointment still blocks, and says what it is', () => {
  const [workshop] = asBlockedDates([doc({title: null})], NOW)
  assert.equal(workshop.summary, 'Workshop')
  const [event] = asBlockedDates([doc({_type: 'event', title: []})], NOW)
  assert.equal(event.summary, 'Veranstaltung')
})

test('the earliest appointment comes first', () => {
  const later = doc({_id: 'b', startAt: '2026-09-20T08:00:00.000Z'})
  const sooner = doc({_id: 'a', startAt: '2026-09-05T08:00:00.000Z'})
  assert.deepEqual(
    asBlockedDates([later, sooner], NOW).map((b) => b.uid),
    ['a', 'b'],
  )
})

test('nothing in, nothing out', () => {
  assert.deepEqual(asBlockedDates([], NOW), [])
  assert.deepEqual(asBlockedDates(null, NOW), [])
})
