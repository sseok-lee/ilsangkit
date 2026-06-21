import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd().endsWith('/frontend') ? process.cwd() : join(process.cwd(), 'frontend')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')
const count = (s: string, re: RegExp) => (s.match(re) || []).length

describe('시설 상세 광고 밀도', () => {
  const src = () => read('pages/[category]/[id].vue')
  it('AdBanner는 5개(모바일 4 + 데스크톱 사이드바 1)', () => {
    expect(count(src(), /<AdBanner/g)).toBe(5)
  })
  it('로드뷰 직후 광고는 제거됐다', () => {
    expect(src()).not.toContain('Ad: ROADVIEW ↔ NEARBY 사이')
  })
  it('주변시설 바로 아래 광고는 제거됐다', () => {
    expect(src()).not.toContain('Ad: 주변 시설 바로 아래')
  })
})

describe('부동산 상세 광고 밀도', () => {
  const src = () => read('pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
  it('AdBanner는 4개', () => {
    expect(count(src(), /<AdBanner/g)).toBe(4)
  })
  it('로드뷰 이후 광고는 제거됐다', () => {
    expect(src()).not.toContain('Ad: 로드뷰 이후')
  })
  it('인근 단지 이후 광고는 제거됐다', () => {
    expect(src()).not.toContain('Ad: 인근 단지 이후')
  })
})
