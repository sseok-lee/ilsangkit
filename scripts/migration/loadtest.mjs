#!/usr/bin/env node
// 원본 서버 부하 시험: DNS·Cloudflare 를 우회해 지정 IP 로 직접 요청하고 지연 분포를 낸다.
import { readFileSync } from 'node:fs'
import https from 'node:https'
import { pathToFileURL } from 'node:url'

export function percentile(sortedMs, p) {
  if (sortedMs.length === 0) return null
  const rank = Math.ceil((p / 100) * sortedMs.length)
  return sortedMs[Math.min(sortedMs.length, Math.max(1, rank)) - 1]
}

export function summarize(samples, durationSec) {
  const ok = samples.filter((s) => s.error === undefined)
  const sorted = ok.map((s) => s.ms).sort((a, b) => a - b)
  const status = {}
  for (const s of ok) status[s.status] = (status[s.status] ?? 0) + 1
  return {
    requests: samples.length,
    rps: Math.round((samples.length / durationSec) * 10) / 10,
    status,
    errors: samples.length - ok.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted.length ? sorted[sorted.length - 1] : null,
  }
}

export function parseArgs(argv) {
  const out = { concurrency: 4, duration: 60, insecure: false }
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]
    if (key === '--insecure') out.insecure = true
    else if (key === '--concurrency' || key === '--duration') out[key.slice(2)] = Number(argv[++i])
    else if (key === '--ip' || key === '--host' || key === '--paths') out[key.slice(2)] = argv[++i]
    else throw new Error(`unknown option ${key}`)
  }
  for (const required of ['ip', 'host', 'paths']) {
    if (!out[required]) throw new Error(`--${required} is required`)
  }
  return { ip: out.ip, host: out.host, paths: out.paths, concurrency: out.concurrency, duration: out.duration, insecure: out.insecure }
}

function requestOnce(agent, args, path) {
  const started = performance.now()
  return new Promise((resolve) => {
    const req = https.request({
      agent, host: args.host, servername: args.host, path, method: 'GET',
      lookup: (_h, opts, cb) => (opts?.all ? cb(null, [{ address: args.ip, family: 4 }]) : cb(null, args.ip, 4)),
      headers: { 'user-agent': 'ilsangkit-loadtest/1.0', 'accept-encoding': 'gzip' },
      timeout: 30_000,
    }, (res) => {
      res.resume()
      res.on('end', () => resolve({ ms: Math.round(performance.now() - started), status: res.statusCode }))
    })
    req.on('timeout', () => req.destroy(new Error('ETIMEDOUT')))
    req.on('error', (e) => resolve({ ms: Math.round(performance.now() - started), error: e.code ?? e.message }))
    req.end()
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const paths = readFileSync(args.paths, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l.startsWith('/'))
  if (paths.length === 0) throw new Error('paths file has no lines starting with /')
  const agent = new https.Agent({ keepAlive: true, maxSockets: args.concurrency, rejectUnauthorized: !args.insecure })
  const deadline = Date.now() + args.duration * 1000
  const samples = []
  let cursor = 0
  await Promise.all(Array.from({ length: args.concurrency }, async () => {
    while (Date.now() < deadline) {
      samples.push(await requestOnce(agent, args, paths[cursor++ % paths.length]))
    }
  }))
  agent.destroy()
  console.log(JSON.stringify({ ip: args.ip, ...summarize(samples, args.duration) }))
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exit(2) })
}
