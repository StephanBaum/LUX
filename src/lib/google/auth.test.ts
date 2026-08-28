import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {normalisePrivateKey} from './auth.ts'

const BODY = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQ'

test('turns the two characters \\n into a real line break', () => {
  const escaped = `-----BEGIN PRIVATE KEY-----\\n${BODY}\\n-----END PRIVATE KEY-----\\n`
  const key = normalisePrivateKey(escaped)
  assert.equal(key.includes('\\n'), false, 'no escape sequence may survive')
  assert.equal(key.split('\n').length, 4)
  assert.ok(key.startsWith('-----BEGIN PRIVATE KEY-----\n'))
})

test('leaves a key that already has real line breaks alone', () => {
  const real = `-----BEGIN PRIVATE KEY-----\n${BODY}\n-----END PRIVATE KEY-----\n`
  assert.equal(normalisePrivateKey(real), real)
})

test('a missing key is an empty string, not a crash', () => {
  assert.equal(normalisePrivateKey(undefined), '')
  assert.equal(normalisePrivateKey(''), '')
})

test('strips the quotes a .env file may carry', () => {
  const quoted = `"-----BEGIN PRIVATE KEY-----\\n${BODY}\\n-----END PRIVATE KEY-----\\n"`
  assert.ok(normalisePrivateKey(quoted).startsWith('-----BEGIN'))
  assert.equal(normalisePrivateKey(quoted).includes('"'), false)
})
