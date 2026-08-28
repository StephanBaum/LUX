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

test('the list is narrowed to entries this feature marked itself', async () => {
  let params: Record<string, string> | undefined
  await expireHolds(
    {
      calendarId: 'cal',
      list: async (_c, p) => { params = p; return {items: []} },
      remove: async () => {},
    },
    NOW,
  )
  assert.equal(params && params.privateExtendedProperty, 'lux=reservation')
})
