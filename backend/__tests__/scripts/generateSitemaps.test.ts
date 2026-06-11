import { describe, it, expect } from 'vitest'
import { parseChildLocs, countLocs, evaluateCountGuard } from '../../src/scripts/generateSitemaps.js'

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
