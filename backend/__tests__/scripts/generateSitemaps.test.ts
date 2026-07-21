import { describe, it, expect } from 'vitest'
import { parseChildLocs, countLocs, evaluateCountGuard, runGeneration } from '../../src/scripts/generateSitemaps.js'
import { mkdtemp, readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function mockFetcher(map: Record<string, string>) {
  return async (url: string, _headers?: Record<string, string>) => {
    const path = new URL(url).pathname
    const body = map[path]
    if (body === undefined) return { ok: false, status: 404, text: async () => '' }
    return { ok: true, status: 200, text: async () => body }
  }
}

const INDEX = `<?xml version="1.0"?><sitemapindex>
  <sitemap><loc>https://ilsangkit.co.kr/sitemap/static.xml</loc></sitemap>
  <sitemap><loc>https://ilsangkit.co.kr/sitemap/toilet.xml</loc></sitemap>
</sitemapindex>`
const STATIC = '<?xml version="1.0"?><urlset><url><loc>https://ilsangkit.co.kr/about</loc></url></urlset>'
const TOILET = '<?xml version="1.0"?><urlset><url><loc>https://ilsangkit.co.kr/toilet/1</loc></url><url><loc>https://ilsangkit.co.kr/toilet/2</loc></url></urlset>'

describe('parseChildLocs', () => {
  it('sitemapindex에서 모든 <loc> 추출', () => {
    const xml = `<?xml version="1.0"?>
<sitemapindex>
  <sitemap><loc>https://ilsangkit.co.kr/sitemap/static.xml</loc></sitemap>
  <sitemap><loc>https://ilsangkit.co.kr/sitemap/toilet.xml</loc><lastmod>2026-06-10</lastmod></sitemap>
</sitemapindex>`
    expect(parseChildLocs(xml)).toEqual([
      'https://ilsangkit.co.kr/sitemap/static.xml',
      'https://ilsangkit.co.kr/sitemap/toilet.xml',
    ])
  })
})

describe('countLocs', () => {
  it('urlset의 <loc> 개수', () => {
    const xml = '<urlset><url><loc>a</loc></url><url><loc>b</loc></url></urlset>'
    expect(countLocs(xml)).toBe(2)
  })
  it('loc 없으면 0', () => {
    expect(countLocs('<urlset></urlset>')).toBe(0)
  })
})

describe('evaluateCountGuard', () => {
  const threshold = 0.2 // -20%
  it('첫 실행(old 비어있음)은 통과', () => {
    const r = evaluateCountGuard({}, { 'sitemap/toilet.xml': 100 }, threshold)
    expect(r.ok).toBe(true)
  })
  it('임계 이내 변동은 통과', () => {
    const r = evaluateCountGuard({ 'sitemap/toilet.xml': 100 }, { 'sitemap/toilet.xml': 85 }, threshold)
    expect(r.ok).toBe(true)
  })
  it('임계 초과 급감은 거부', () => {
    const r = evaluateCountGuard({ 'sitemap/toilet.xml': 100 }, { 'sitemap/toilet.xml': 50 }, threshold)
    expect(r.ok).toBe(false)
    expect(r.regressions).toContainEqual({ file: 'sitemap/toilet.xml', old: 100, next: 50 })
  })
  it('old에 있던 파일이 사라지면 거부', () => {
    const r = evaluateCountGuard({ 'sitemap/toilet.xml': 100 }, {}, threshold)
    expect(r.ok).toBe(false)
  })
  it('신규 파일(old 없음)은 통과 사유 아님', () => {
    const r = evaluateCountGuard({}, { 'sitemap/new.xml': 5 }, threshold)
    expect(r.ok).toBe(true)
  })
})

describe('runGeneration', () => {
  it('인덱스+자식을 디스크에 저장, .counts.json 기록', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'smap-'))
    const result = await runGeneration({
      dir,
      base: 'http://127.0.0.1:3000',
      token: 'tok',
      threshold: 0.2, sleep: () => Promise.resolve(),
      fetcher: mockFetcher({
        '/sitemap.xml': INDEX,
        '/sitemap/static.xml': STATIC,
        '/sitemap/toilet.xml': TOILET,
      }),
    })
    expect(result.ok).toBe(true)
    await expect(stat(`${dir}.old`)).rejects.toThrow()
    await expect(stat(`${dir}.tmp`)).rejects.toThrow()
    expect(await readFile(join(dir, 'sitemap.xml'), 'utf-8')).toContain('<sitemapindex')
    expect(await readFile(join(dir, 'sitemap', 'toilet.xml'), 'utf-8')).toContain('/toilet/2')
    const counts = JSON.parse(await readFile(join(dir, '.counts.json'), 'utf-8'))
    expect(counts['sitemap/toilet.xml']).toBe(2)
  })

  it('자식 fetch 실패 시 교체 안 함(기존 유지)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'smap-'))
    await writeFile(join(dir, 'sitemap.xml'), '<existing/>')
    const result = await runGeneration({
      dir, base: 'http://127.0.0.1:3000', token: 'tok', threshold: 0.2, sleep: () => Promise.resolve(),
      fetcher: mockFetcher({ '/sitemap.xml': INDEX /* 자식 없음 → 404 */ }),
    })
    expect(result.ok).toBe(false)
    expect(await readFile(join(dir, 'sitemap.xml'), 'utf-8')).toBe('<existing/>')
  })

  it('자식 fetch가 일시적 503 후 성공하면 재시도로 완성한다', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'smap-'))
    let toiletAttempts = 0
    const flaky = async (url: string) => {
      const path = new URL(url).pathname
      if (path === '/sitemap.xml') return { ok: true, status: 200, text: async () => INDEX }
      if (path === '/sitemap/static.xml') return { ok: true, status: 200, text: async () => STATIC }
      if (path === '/sitemap/toilet.xml') {
        toiletAttempts++
        if (toiletAttempts <= 2) return { ok: false, status: 503, text: async () => '' }
        return { ok: true, status: 200, text: async () => TOILET }
      }
      return { ok: false, status: 404, text: async () => '' }
    }
    const result = await runGeneration({
      dir, base: 'http://127.0.0.1:3000', token: 'tok', threshold: 0.2,
      fetcher: flaky, sleep: () => Promise.resolve(),
    })
    expect(result.ok).toBe(true)
    expect(toiletAttempts).toBe(3) // 503, 503, 200 — 재시도로 흡수
    expect(await readFile(join(dir, 'sitemap', 'toilet.xml'), 'utf-8')).toBe(TOILET)
  })

  it('개수 회귀 가드 거부 시 교체 안 함', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'smap-'))
    await mkdir(join(dir, 'sitemap'), { recursive: true })
    await writeFile(join(dir, '.counts.json'), JSON.stringify({ 'sitemap/toilet.xml': 1000, 'sitemap/static.xml': 1 }))
    await writeFile(join(dir, 'sitemap', 'toilet.xml'), '<old-big/>')
    const result = await runGeneration({
      dir, base: 'http://127.0.0.1:3000', token: 'tok', threshold: 0.2, sleep: () => Promise.resolve(),
      fetcher: mockFetcher({ '/sitemap.xml': INDEX, '/sitemap/static.xml': STATIC, '/sitemap/toilet.xml': TOILET }),
    })
    expect(result.ok).toBe(false)
    expect(result.regressions?.length).toBeGreaterThan(0)
    expect(await readFile(join(dir, 'sitemap', 'toilet.xml'), 'utf-8')).toBe('<old-big/>')
  })
})
