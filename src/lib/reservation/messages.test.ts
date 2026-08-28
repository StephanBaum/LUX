import assert from 'node:assert/strict'
import {test} from 'node:test'
import {toStudio, received, approved, declined, germanRange} from './messages.ts'

const req = {
  name: 'Anna Weber',
  email: 'anna@example.com',
  firma: 'Weber Fotografie',
  telefon: '0170 1234567',
  anfrage: 'Wir brauchen das große Studio für ein Editorial.',
  raeume: ['Großes Studio'],
  technik: ['Profoto D2 1000', 'ARRI SkyPanel S60', 'Reflektor 5-in-1'],
  startAt: '2026-10-02',
  endAt: '2026-10-05',
}

test('the studio sees who, when and both buttons — and no code', () => {
  const m = toStudio(req, '7f3a91', {approve: 'https://x/a', decline: 'https://x/d'})
  assert.ok(m.subject.includes('Anna Weber'), m.subject)
  assert.ok(m.subject.includes('2. bis 4. Oktober 2026'), m.subject)
  assert.equal(m.subject.includes('7f3a91'), false, 'a code in the subject helps nobody')
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

// ------------------------------------------------------------------- HTML

test('every message goes out as HTML as well as text', () => {
  for (const m of [
    toStudio(req, 'r', {approve: 'https://x/a', decline: 'https://x/d'}),
    received(req, 'r'),
    approved(req, 'r'),
    declined(req, 'r'),
  ]) {
    assert.ok(m.html.startsWith('<!doctype html>'), 'needs a document')
    assert.ok(m.html.includes('LUX STUDIO'), 'needs the wordmark')
    assert.ok(m.text.length > 40, 'and a readable plain-text twin')
  }
})

test('the studio email lists every piece of equipment, not a blob', () => {
  const m = toStudio(req, 'r', {approve: 'https://x/a', decline: 'https://x/d'})
  for (const kit of req.technik) {
    assert.ok(m.html.includes(kit), `${kit} missing from the HTML`)
    assert.ok(m.text.includes(kit), `${kit} missing from the text`)
  }
  assert.ok(m.html.includes('Großes Studio'))
  assert.ok(m.html.includes('Technik'), 'kit gets its own labelled row')
  assert.ok(m.html.includes('Räume'), 'rooms get their own labelled row')
})

test('the visitor is told what they asked for, too', () => {
  const m = received(req, 'r')
  assert.ok(m.html.includes('Profoto D2 1000'))
  assert.ok(m.html.includes('Großes Studio'))
})

test('no reference code reaches anybody, in either part', () => {
  for (const m of [
    toStudio(req, '7f3a91', {approve: 'https://x/a', decline: 'https://x/d'}),
    received(req, '7f3a91'),
    approved(req, '7f3a91'),
    declined(req, '7f3a91'),
  ]) {
    assert.equal(m.subject.includes('7f3a91'), false)
    assert.equal(m.text.includes('7f3a91'), false)
    assert.equal(m.html.includes('7f3a91'), false)
  }
})

test('the visitor never receives a link meant for the studio', () => {
  for (const m of [received(req, 'r'), approved(req, 'r'), declined(req, 'r')]) {
    assert.equal(/https?:\/\//.test(m.text), false, 'no link in the text')
    assert.equal(m.html.includes('/api/reservation/'), false, 'no approve link in the HTML')
  }
})

test('a visitor cannot inject markup through their own name', () => {
  const nasty = {...req, name: '<script>alert(1)</script>', firma: 'A & B "Co"'}
  const m = toStudio(nasty, 'r', {approve: 'https://x/a', decline: 'https://x/d'})
  assert.equal(m.html.includes('<script>'), false, 'the tag must be escaped')
  assert.ok(m.html.includes('&lt;script&gt;'))
  assert.ok(m.html.includes('&amp;'), 'and the ampersand too')
})

test('a request with no kit and no room simply omits those rows', () => {
  const bare = {...req, raeume: [], technik: [], telefon: undefined, firma: undefined}
  const m = toStudio(bare, 'r', {approve: 'https://x/a', decline: 'https://x/d'})
  assert.equal(m.html.includes('Technik'), false)
  assert.equal(m.html.includes('Räume'), false)
  assert.equal(m.html.includes('Telefon'), false)
  assert.ok(m.html.includes('Zeitraum'), 'but the dates stay')
})
