import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import test from 'node:test'
const require = createRequire(import.meta.url)
const dotenv = require('../../backend/node_modules/dotenv')
const source = readFileSync(new URL('../../ecosystem.release.config.cjs', import.meta.url), 'utf8')
function load(files, overrides = {}) {
  const env = { ILSK_RELEASE_ID: 'candidate-1', ILSK_RELEASE_ROOT: '/release', ILSK_BACKEND_PORT: '18000', ILSK_FRONTEND_PORT: '13000', NUXT_INTERNAL_API_BASE: 'http://127.0.0.1:18000', ILSK_BACKEND_ENV_FILE: '/shared/backend.env', ILSK_FRONTEND_ENV_FILE: '/shared/frontend.env', SITEMAP_DIR: '/shared/sitemaps/candidate-1', ...overrides }
  const module = { exports: {} }
  vm.runInNewContext(source, { process: { env }, module, require(name) {
    if (name === 'node:fs') return { readFileSync(path) { if (!(path in files)) throw new Error('ENOENT'); return files[path] } }
    if (name === 'node:path') return require(name)
    if (name.endsWith('/node_modules/dotenv')) return dotenv
    throw new Error('Unexpected module')
  } })
  return module.exports.apps
}
const files = { '/shared/backend.env': 'DATABASE_URL=mysql://private\nPORT=8000\n', '/shared/frontend.env': 'NUXT_NCP_MAP_CLIENT_SECRET=private-map-secret\nSITEMAP_REGEN_TOKEN=private-token\nPORT=3000\nSITEMAP_DIR=/legacy\n' }
test('frontend protected configuration survives release startup while release ports and sitemap win', () => {
  const [backend, frontend] = load(files)
  assert.equal(frontend.env.NUXT_NCP_MAP_CLIENT_SECRET, 'private-map-secret')
  assert.equal(frontend.env.SITEMAP_REGEN_TOKEN, 'private-token')
  assert.equal(frontend.env.SITEMAP_DIR, '/shared/sitemaps/candidate-1')
  assert.equal(frontend.env.PORT, '13000')
  assert.equal(frontend.env.NUXT_INTERNAL_API_BASE, 'http://127.0.0.1:18000')
  assert.equal(frontend.env.DATABASE_URL, undefined)
  assert.equal(backend.env.NUXT_NCP_MAP_CLIENT_SECRET, undefined)
})
test('configured missing frontend environment fails closed', () => {
  assert.throws(() => load({ '/shared/backend.env': files['/shared/backend.env'] }), /frontend env file/)
})
test('existing deployments can omit frontend env but still receive the release sitemap directory', () => {
  const [, frontend] = load(files, { ILSK_FRONTEND_ENV_FILE: undefined })
  assert.equal(frontend.env.SITEMAP_DIR, '/shared/sitemaps/candidate-1')
})
