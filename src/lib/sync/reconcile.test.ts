import {test} from 'node:test'
import assert from 'node:assert/strict'
import {reconcile, type Input} from './reconcile.ts'

const MONDAY = '2026-09-07T10:00:00.000Z'
const MONDAY_END = '2026-09-07T16:00:00.000Z'
const TUESDAY = '2026-09-08T10:00:00.000Z'
const TUESDAY_END = '2026-09-08T16:00:00.000Z'

const appointment = (title: string, startAt = MONDAY, endAt = MONDAY_END) => ({title, startAt, endAt})

const input = (over: Partial<Input>): Input => ({
  here: appointment('Analogkurs'),
  there: appointment('Analogkurs'),
  last: appointment('Analogkurs'),
  hereAt: '2026-08-27T12:00:00.000Z',
  thereAt: '2026-08-27T12:00:00.000Z',
  linked: true,
  ...over,
})

test('a workshop without a date is not put in the calendar', () => {
  const plan = reconcile(input({here: {title: 'Analogkurs', startAt: null, endAt: null}}))
  assert.equal(plan.do, 'nothing')
})

test('a workshop that has never been synced creates a calendar entry', () => {
  const plan = reconcile(input({there: null, last: {}, linked: false}))
  assert.equal(plan.do, 'create-there')
})

test('a calendar entry that has been deleted leaves the document alone', () => {
  const plan = reconcile(input({there: null}))
  assert.equal(plan.do, 'orphan-here')
})

test('nothing happens when both sides agree — this is the loop guard', () => {
  const plan = reconcile(input({}))
  assert.equal(plan.do, 'nothing')
})

test('what we just wrote to the calendar does not come back as a change', () => {
  // The website moved the workshop and the calendar now shows the new date.
  // Both match what was written down, so there is nothing to do.
  const plan = reconcile(
    input({
      here: appointment('Analogkurs', TUESDAY, TUESDAY_END),
      there: appointment('Analogkurs', TUESDAY, TUESDAY_END),
      last: appointment('Analogkurs', TUESDAY, TUESDAY_END),
    }),
  )
  assert.equal(plan.do, 'nothing')
})

test('a change on the website goes to the calendar', () => {
  const plan = reconcile(input({here: appointment('Analogkurs für Fortgeschrittene')}))
  assert.equal(plan.do, 'write-there')
  assert.equal(plan.do === 'write-there' && plan.write.title, 'Analogkurs für Fortgeschrittene')
})

test('a change in the calendar comes back to the website', () => {
  const plan = reconcile(input({there: appointment('Analogkurs', TUESDAY, TUESDAY_END)}))
  assert.equal(plan.do, 'write-here')
  assert.equal(plan.do === 'write-here' && plan.write.startAt, TUESDAY)
})

test('a date written differently but meaning the same time is not a change', () => {
  const plan = reconcile(input({there: appointment('Analogkurs', '2026-09-07T12:00:00+02:00')}))
  assert.equal(plan.do, 'nothing')
})

test('when both sides move, each field goes to whoever changed it last', () => {
  // The title was corrected on the website; the time was moved on the phone.
  // Neither of them touched what the other one touched, so both survive.
  const plan = reconcile(
    input({
      here: appointment('Analogkurs II'),
      there: appointment('Analogkurs', TUESDAY, TUESDAY_END),
    }),
  )
  assert.equal(plan.do, 'write-both')
  if (plan.do !== 'write-both') return
  assert.equal(plan.write.title, 'Analogkurs II')
  assert.equal(plan.write.startAt, TUESDAY)
})

test('when both sides change the same field, the later change wins', () => {
  const plan = reconcile(
    input({
      here: appointment('Website-Titel'),
      there: appointment('Kalender-Titel'),
      hereAt: '2026-08-27T09:00:00.000Z',
      thereAt: '2026-08-27T15:00:00.000Z',
    }),
  )
  assert.equal(plan.do, 'write-both')
  if (plan.do !== 'write-both') return
  assert.equal(plan.write.title, 'Kalender-Titel')
  assert.match(plan.note, /Website-Titel/)
})

test('the value that loses is written down, so nothing vanishes in silence', () => {
  const plan = reconcile(
    input({
      here: appointment('Website-Titel'),
      there: appointment('Kalender-Titel'),
      hereAt: '2026-08-27T15:00:00.000Z',
      thereAt: '2026-08-27T09:00:00.000Z',
    }),
  )
  assert.equal(plan.do, 'write-both')
  if (plan.do !== 'write-both') return
  assert.equal(plan.write.title, 'Website-Titel')
  assert.match(plan.note, /Kalender-Titel/)
})
