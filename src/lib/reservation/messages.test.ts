import assert from 'node:assert/strict'
import {test} from 'node:test'
import {toStudio, received, approved, declined, germanRange} from './messages.ts'

const req = {
  name: 'Anna Weber',
  email: 'anna@example.com',
  firma: 'Weber Fotografie',
  telefon: '0170 1234567',
  anfrage: 'Wir brauchen das große Studio für ein Editorial.',
  auswahl: 'Großes Studio, Profoto D2 1000',
  startAt: '2026-10-02',
  endAt: '2026-10-05',
}

test('the studio sees the reference, the person and both buttons', () => {
  const m = toStudio(req, '7f3a91', {approve: 'https://x/a', decline: 'https://x/d'})
  assert.ok(m.subject.includes('7f3a91'), m.subject)
  assert.ok(m.text.includes('Anna Weber'))
  assert.ok(m.text.includes('anna@example.com'))
  assert.ok(m.text.includes('https://x/a'))
  assert.ok(m.text.includes('https://x/d'))
})

test('the visitor is told we have it, and never sees a link meant for the studio', () => {
  const m = received(req, '7f3a91')
  assert.ok(m.text.includes('Anna'))
  assert.equal(m.text.includes('http'), false, 'no approve link may reach the visitor')
})

test('a yes and a no both name the days', () => {
  assert.ok(approved(req, '7f3a91').text.includes('2. bis 4. Oktober 2026'))
  assert.ok(declined(req, '7f3a91').text.includes('2. bis 4. Oktober 2026'))
})

test('a decline is kind and invites another date', () => {
  const m = declined(req, '7f3a91')
  assert.ok(/leider/i.test(m.text))
  assert.ok(/anderen? (Termin|Zeitraum)/i.test(m.text))
})

test('one day reads as one day, not as a range to itself', () => {
  assert.equal(germanRange('2026-10-02', '2026-10-03'), '2. Oktober 2026')
  assert.equal(germanRange('2026-10-02', '2026-10-05'), '2. bis 4. Oktober 2026')
})

test('a missing company or telephone leaves no empty line behind', () => {
  const bare = {...req, firma: undefined, telefon: undefined}
  const m = toStudio(bare, '7f3a91', {approve: 'https://x/a', decline: 'https://x/d'})
  assert.equal(m.text.includes('Firma:'), false)
  assert.equal(m.text.includes('Telefon:'), false)
})

test('a range that crosses a month names both months', () => {
  assert.equal(germanRange('2026-09-28', '2026-10-04'), '28. September bis 3. Oktober 2026')
})

test('a range that crosses the new year keeps the old month', () => {
  assert.equal(germanRange('2026-12-30', '2027-01-02'), '30. Dezember bis 1. Januar 2027')
})
