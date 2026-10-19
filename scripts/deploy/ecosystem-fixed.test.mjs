import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { apps } = require('../../ecosystem.config.js')

test('fixed PM2 apps pin Asia/Seoul so server OS timezone cannot shift dates', () => {
  assert.equal(apps.length, 2)
  for (const app of apps) {
    assert.equal(app.env_production.TZ, 'Asia/Seoul', app.name)
  }
})

const toMb = (value) => {
  const match = /^(\d+)([MG])$/.exec(value)
  assert.ok(match, `unexpected memory format: ${value}`)
  return Number(match[1]) * (match[2] === 'G' ? 1024 : 1)
}

test('frontend restarts gracefully on RSS before the V8 heap cap can abort it', () => {
  const frontend = apps.find((app) => app.name === 'ilsangkit-frontend')
  const rssLimit = toMb(frontend.max_memory_restart)
  const heapCap = Number(/--max-old-space-size=(\d+)/.exec(frontend.node_args)?.[1])
  // OCI(12GB)에서 사이트맵 재생성이 850M 를 넘겨 재시작했다(2026-10-18). 1.5G 아래로 내리지 않는다.
  assert.ok(rssLimit >= 1536, `frontend max_memory_restart ${rssLimit}M`)
  assert.ok(heapCap > rssLimit, `heap cap ${heapCap}M must exceed RSS limit ${rssLimit}M`)
})

test('backend restarts gracefully on RSS before the V8 heap cap can abort it', () => {
  const backend = apps.find((app) => app.name === 'ilsangkit-backend')
  const rssLimit = toMb(backend.max_memory_restart)
  const heapCap = Number(/--max-old-space-size=(\d+)/.exec(backend.node_args)?.[1])
  // OCI 에서 500M 상한에 하루 4~5번 걸려 재시작마다 5xx 10건 안팎이 났다(2026-10-18~19).
  assert.ok(rssLimit >= 1024, `backend max_memory_restart ${rssLimit}M`)
  assert.ok(heapCap > rssLimit, `heap cap ${heapCap}M must exceed RSS limit ${rssLimit}M`)
})
