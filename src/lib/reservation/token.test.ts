import assert from 'node:assert/strict'
import {test} from 'node:test'
import {seal, open, type ReservationClaim} from './token.ts'

const KEY = 'a'.repeat(64)
const OTHER = 'b'.repeat(64)
const NOW = new Date('2026-10-01T12:00:00.000Z')

const claim = (over: Partial<ReservationClaim> = {}): ReservationClaim => ({
  r: '7f3a91',
  c: 'cal@group.calendar.google.com',
  e: 'evt123',
  a: 'approve',
  n: 'Anna Weber',
  m: 'anna@example.com',
  d: '2026-10-02/2026-10-04',
  x: NOW.getTime() + 86_400_000,
  ...over,
})

test('a sealed claim comes back exactly as it went in', () => {
  const c = claim()
  assert.deepEqual(open(seal(c, KEY), KEY, NOW), c)
})

test('the token is unreadable — no name in it anywhere', () => {
  const token = seal(claim(), KEY)
  assert.equal(token.includes('Anna'), false)
  assert.equal(token.includes('anna@example.com'), false)
  assert.equal(Buffer.from(token, 'base64url').toString('latin1').includes('Anna'), false)
})

test('the same claim sealed twice gives two different tokens', () => {
  assert.notEqual(seal(claim(), KEY), seal(claim(), KEY))
})

test('a flipped byte of ciphertext is refused, not returned as rubbish', () => {
  const raw = Buffer.from(seal(claim(), KEY), 'base64url')
  raw[20] = raw[20] ^ 0xff
  assert.throws(() => open(raw.toString('base64url'), KEY, NOW))
})

test('a flipped byte of the authentication tag is refused', () => {
  const raw = Buffer.from(seal(claim(), KEY), 'base64url')
  raw[raw.length - 1] = raw[raw.length - 1] ^ 0xff
  assert.throws(() => open(raw.toString('base64url'), KEY, NOW))
})

test('another key cannot open it', () => {
  assert.throws(() => open(seal(claim(), KEY), OTHER, NOW))
})

test('an expired token is refused even though it decrypts', () => {
  const stale = seal(claim({x: NOW.getTime() - 1000}), KEY)
  assert.throws(() => open(stale, KEY, NOW), /abgelaufen/)
})

test('rubbish in gives a thrown error, not a crash', () => {
  assert.throws(() => open('not-a-token', KEY, NOW))
  assert.throws(() => open('', KEY, NOW))
})
