import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bindDeploymentManifest, inventoryForRelease, persistActiveInventory } from './deployment-state.mjs'
const probes = id => [{ name: 'release-readiness', expectedReleaseId: id, expectedJson: { ready: true, releaseId: id, 'summary.mode': 'address', 'summary.runId': 'old-run' } }, { name: 'frontend-ssr', expectedReleaseId: id, expectBodyIncludes: '성원' }]
const release = (id, frontend, backend) => ({ releaseId: id, ports: { frontend, backend }, runtime: { backendEnvFile: '/shared/backend.env', frontendEnvFile: '/shared/frontend.env', sitemapDir: '/shared/maps' }, summary: { mode: 'address', runId: 'run-1', state: 'ready' }, probes: probes(id), publicSmokeProbes: [{ name: 'public-health', expectedReleaseId: id }], rollback: { releaseId: 'rollback' } })
function fixture() {
 const manifest = release('first', 13000, 18000)
 const inventory = inventoryForRelease({ releasesRoot: '/releases', reservePorts: [13000, 18000, 13001, 18001, 13002, 18002], candidatePortPairs: [{ frontend: 13000, backend: 18000 }, { frontend: 13001, backend: 18001 }, { frontend: 13002, backend: 18002 }], activePointers: { backend: '/current-backend', frontend: '/current-frontend' } }, manifest)
 const options = { portAvailable: async () => true, realpath: p => '/releases/first/' + (p.endsWith('backend') ? 'backend' : 'frontend') }
 const readiness = { ready: true, releaseId: 'first', summary: { mode: 'address', runId: 'new-run' } }
 return { inventory, options, readiness }
}
test('second deployment binds new identity/runId and rolls back to actual active release', async () => {
 const {inventory, options, readiness} = fixture()
 const next = await bindDeploymentManifest(inventory, {releaseId: 'second'}, [], readiness, options)
 assert.equal(next.rollbackReleaseId, 'first')
 assert.equal(next.ports.frontend, 13001)
 assert.equal(next.probes[0].expectedJson.releaseId, 'second')
 assert.equal(next.probes[0].expectedJson['summary.runId'], 'new-run')
 assert.equal(next.rollback.probes[0].expectedJson.releaseId, 'first')
 assert.equal(inventory.businessProbes.active[0].expectedJson['summary.runId'], 'old-run')
 assert.equal(next.runtime.frontendEnvFile, '/shared/frontend.env')
})
test('occupied retained ports are skipped; no capacity fails without choosing active ports', async () => {
 const {inventory,options,readiness} = fixture()
 options.portAvailable = async p => p === 13002 || p === 18002
 assert.equal((await bindDeploymentManifest(inventory,{releaseId:'second'},[],readiness,options)).ports.frontend,13002)
 options.portAvailable = async () => false
 await assert.rejects(bindDeploymentManifest(inventory,{releaseId:'second'},[],readiness,options), /no unused/)
})
test('stale readiness or active pointer abort manifest binding', async () => {
 const {inventory,options,readiness} = fixture()
 await assert.rejects(bindDeploymentManifest(inventory,{},[],{...readiness,releaseId:'stale'},options), /mismatch/)
 options.realpath = () => '/releases/stale/backend'
 await assert.rejects(bindDeploymentManifest(inventory,{},[],readiness,options), /pointer mismatch/)
})
test('persist switch and rollback retain correct runtime/probes without stale candidate ports', () => {
 const {inventory} = fixture(); inventory.candidate = {ports:{frontend:13000,backend:18000}}
 const dir=mkdtempSync(join(tmpdir(),'deploy-state-')); const path=join(dir,'inventory.json')
 try {
  persistActiveInventory(path,inventory,release('second',13001,18001))
  let next=JSON.parse(readFileSync(path)); assert.equal(next.active.releaseId,'second'); assert.equal(next.candidate,undefined)
  persistActiveInventory(path,next,release('first',13000,18000))
  next=JSON.parse(readFileSync(path)); assert.equal(next.active.releaseId,'first'); assert.equal(next.businessProbes.active[0].expectedReleaseId,'first')
 } finally {rmSync(dir,{recursive:true,force:true})}
})
