import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { parseArgs, percentile, summarize, requestOnce } from './loadtest.mjs'

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

test('requestOnce resolves normal 200 response with correct headers', async () => {
  const server = http.createServer((req, res) => {
    assert.equal(req.headers['user-agent'], 'ilsangkit-loadtest/1.0')
    assert.equal(req.headers['host'], 'example.test')
    res.writeHead(200)
    res.end('OK')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const agent = new http.Agent()
  const args = { ip: '127.0.0.1', host: 'example.test', port }
  try {
    const sample = await requestOnce(agent, args, '/test', http)
    assert.equal(sample.status, 200)
    assert.equal(typeof sample.ms, 'number')
    assert.equal(sample.error, undefined)
  } finally {
    agent.destroy()
    server.close()
  }
})

test('requestOnce settles within 2s when server destroys socket mid-response', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200)
    res.write('partial')
    setImmediate(() => req.socket.destroy())
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const agent = new http.Agent()
  const args = { ip: '127.0.0.1', host: 'example.test', port }
  try {
    const startTime = Date.now()
    const sample = await requestOnce(agent, args, '/test', http)
    const elapsed = Date.now() - startTime
    assert(elapsed < 2000, `settlement took ${elapsed}ms, expected < 2000ms`)
    assert.equal(sample.error, 'ECONNRESET_MIDBODY')
    assert.equal(typeof sample.ms, 'number')
  } finally {
    agent.destroy()
    server.close()
  }
})
