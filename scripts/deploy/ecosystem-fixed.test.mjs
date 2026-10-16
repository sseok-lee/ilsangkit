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
