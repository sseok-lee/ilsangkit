import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const conf = readFileSync('scripts/deploy/nginx/cloudflare-realip.conf', 'utf8')
const trusted = [...conf.matchAll(/^set_real_ip_from\s+(\S+);$/gm)].map((m) => m[1])

test('realip trusts exactly the published Cloudflare ranges', () => {
  assert.equal(trusted.filter((c) => c.includes('.')).length, 15)
  assert.equal(trusted.filter((c) => c.includes(':')).length, 7)
  for (const cidr of ['173.245.48.0/20', '104.16.0.0/13', '172.64.0.0/13', '2400:cb00::/32', '2c0f:f248::/32']) {
    assert.ok(trusted.includes(cidr), cidr)
  }
  assert.ok(!trusted.some((c) => c === '0.0.0.0/0' || c === '::/0'))
})

test('realip reads the Cloudflare client header without recursion', () => {
  assert.match(conf, /^real_ip_header CF-Connecting-IP;$/m)
  assert.doesNotMatch(conf, /real_ip_recursive on/)
})
