import assert from 'node:assert/strict'
import test from 'node:test'
import { parseArgs, percentile, summarize } from './loadtest.mjs'

test('percentile uses nearest-rank on sorted samples', () => {
  const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
  assert.equal(percentile(sorted, 50), 50)
  assert.equal(percentile(sorted, 95), 100)
  assert.equal(percentile([7], 99), 7)
  assert.equal(percentile([], 95), null)
})

test('summarize separates status codes and network errors', () => {
  const samples = [
    { ms: 100, status: 200 }, { ms: 300, status: 200 }, { ms: 200, status: 502 }, { ms: 50, error: 'ECONNRESET' },
  ]
  const s = summarize(samples, 2)
  assert.equal(s.requests, 4)
  assert.equal(s.rps, 2)
  assert.deepEqual(s.status, { 200: 2, 502: 1 })
  assert.equal(s.errors, 1)
  assert.equal(s.p50, 200)
  assert.equal(s.max, 300)
})

test('parseArgs requires ip, host and paths and applies defaults', () => {
  const a = parseArgs(['--ip', '1.2.3.4', '--host', 'ilsangkit.co.kr', '--paths', 'p.txt'])
  assert.deepEqual(a, { ip: '1.2.3.4', host: 'ilsangkit.co.kr', paths: 'p.txt', concurrency: 4, duration: 60, insecure: false })
  assert.equal(parseArgs(['--ip', '1.2.3.4', '--host', 'h', '--paths', 'p', '--insecure', '--concurrency', '8']).concurrency, 8)
  assert.throws(() => parseArgs(['--host', 'h', '--paths', 'p']), /--ip/)
})
