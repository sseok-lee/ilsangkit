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

  // 2026-07-22~27 사고: real-estate-2.xml 하나가 4회 재시도 후에도 503 → 78개 파일 전부
  // 폐기되고 5일간 구버전이 서빙됐다. 자식 1건 실패가 전체를 버리지 않도록,
  // 기존 파일이 있으면 그것을 이월(carry-forward)하고 나머지는 갱신한다.
  describe('carry-forward (자식 실패 격리)', () => {
    it('자식 fetch 실패해도 기존 파일이 있으면 이월하고 나머지는 갱신한다', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'smap-'))
      await mkdir(join(dir, 'sitemap'), { recursive: true })
      await writeFile(join(dir, 'sitemap.xml'), '<old-index/>')
      await writeFile(join(dir, 'sitemap', 'static.xml'), '<old-static/>')
      await writeFile(join(dir, 'sitemap', 'toilet.xml'), TOILET)
      await writeFile(
        join(dir, '.counts.json'),
        JSON.stringify({ 'sitemap.xml': 2, 'sitemap/static.xml': 1, 'sitemap/toilet.xml': 2 }),
      )

      const result = await runGeneration({
        dir, base: 'http://127.0.0.1:3000', threshold: 0.2, token: 'tok', sleep: () => Promise.resolve(),
        // toilet 만 계속 503 — static 은 정상
        fetcher: async (url: string) => {
          const path = new URL(url).pathname
          if (path === '/sitemap.xml') return { ok: true, status: 200, text: async () => INDEX }
          if (path === '/sitemap/static.xml') return { ok: true, status: 200, text: async () => STATIC }
          return { ok: false, status: 503, text: async () => '' }
        },
      })

      expect(result.ok).toBe(true)
      expect(result.carriedForward).toEqual(['sitemap/toilet.xml'])
      // 성공한 자식은 새 내용으로 갱신된다
      expect(await readFile(join(dir, 'sitemap', 'static.xml'), 'utf-8')).toBe(STATIC)
      // 실패한 자식은 기존 내용이 보존된다
      expect(await readFile(join(dir, 'sitemap', 'toilet.xml'), 'utf-8')).toBe(TOILET)
      // 인덱스도 갱신된다
      expect(await readFile(join(dir, 'sitemap.xml'), 'utf-8')).toBe(INDEX)
    })

    it('이월할 기존 파일이 없으면 종전대로 실패하고 교체하지 않는다', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'smap-'))
      await writeFile(join(dir, 'sitemap.xml'), '<existing/>')

      const result = await runGeneration({
        dir, base: 'http://127.0.0.1:3000', threshold: 0.2, token: 'tok', sleep: () => Promise.resolve(),
        fetcher: mockFetcher({ '/sitemap.xml': INDEX }), // 자식 전부 404, 이월할 파일 없음
      })

      expect(result.ok).toBe(false)
      expect(await readFile(join(dir, 'sitemap.xml'), 'utf-8')).toBe('<existing/>')
    })

    it('이월된 파일은 개수 회귀 가드에 걸리지 않는다', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'smap-'))
      await mkdir(join(dir, 'sitemap'), { recursive: true })
      await writeFile(join(dir, 'sitemap.xml'), '<old-index/>')
      await writeFile(join(dir, 'sitemap', 'static.xml'), STATIC)
      await writeFile(join(dir, 'sitemap', 'toilet.xml'), TOILET)
      await writeFile(
        join(dir, '.counts.json'),
        JSON.stringify({ 'sitemap.xml': 2, 'sitemap/static.xml': 1, 'sitemap/toilet.xml': 2 }),
      )

      const result = await runGeneration({
        dir, base: 'http://127.0.0.1:3000', threshold: 0.2, token: 'tok', sleep: () => Promise.resolve(),
        fetcher: async (url: string) => {
          const path = new URL(url).pathname
          if (path === '/sitemap.xml') return { ok: true, status: 200, text: async () => INDEX }
          if (path === '/sitemap/static.xml') return { ok: true, status: 200, text: async () => STATIC }
          return { ok: false, status: 503, text: async () => '' }
        },
      })

      expect(result.ok).toBe(true)
      expect(result.regressions).toEqual([])
      // 이월본의 개수가 그대로 기록되어야 다음 실행에서도 회귀로 오인되지 않는다
      const counts = JSON.parse(await readFile(join(dir, '.counts.json'), 'utf-8'))
      expect(counts['sitemap/toilet.xml']).toBe(2)
    })

    it('전부 성공하면 carriedForward 는 비어있다', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'smap-'))
      const result = await runGeneration({
        dir, base: 'http://127.0.0.1:3000', threshold: 0.2, token: 'tok', sleep: () => Promise.resolve(),
        fetcher: mockFetcher({ '/sitemap.xml': INDEX, '/sitemap/static.xml': STATIC, '/sitemap/toilet.xml': TOILET }),
      })
      expect(result.ok).toBe(true)
      expect(result.carriedForward).toEqual([])
    })
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
