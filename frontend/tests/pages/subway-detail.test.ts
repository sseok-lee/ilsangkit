import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ─── noindex 회귀 가드 ─────────────────────────────────────────────────
// /subway/[slug].vue는 정식 인덱싱 대상이므로 noindex 디렉티브가 추가되어서는 안 된다.
// 과거 'noindex, nofollow' 상태였으나 그룹핑된 sitemap distinct 보장과 함께 해제됨.

describe('subway/[slug].vue noindex regression', () => {
  const filePath = resolve(__dirname, '../../pages/subway/[slug].vue')
  const content = readFileSync(filePath, 'utf-8')

  it("useSeoMeta 호출 영역에 'noindex' 키워드가 없다", () => {
    // <script> 안에 noindex가 절대 들어가면 안 됨. 템플릿 텍스트도 마찬가지.
    expect(content).not.toMatch(/noindex/i)
  })

  it("'nofollow' 디렉티브가 없다", () => {
    expect(content).not.toMatch(/nofollow/i)
  })

  it('setMeta 호출이 여전히 존재한다 (메타태그 누락 방지)', () => {
    expect(content).toMatch(/setMeta\(/)
  })

  it('title과 description 등 기본 SEO 항목이 보존된다', () => {
    expect(content).toMatch(/buildSubwayTitle/)
    expect(content).toMatch(/buildSubwayDescription/)
  })
})

describe('subway/[slug].vue 공용 헤더 마이그레이션', () => {
  const filePath = resolve(__dirname, '../../pages/subway/[slug].vue')
  const content = readFileSync(filePath, 'utf-8')

  it('공용 common/MobileDetailHeader를 import한다', () => {
    expect(content).toMatch(/from '~\/components\/common\/MobileDetailHeader\.vue'/)
  })

  it('구 facility/detail/MobileDetailHeader는 더 이상 import하지 않는다', () => {
    expect(content).not.toMatch(/components\/facility\/detail\/MobileDetailHeader/)
  })

  it("헤더에 category-label 대신 eyebrow prop을 쓴다", () => {
    expect(content).not.toMatch(/category-label=/)
    expect(content).toMatch(/eyebrow="지하철역"/)
  })
})

describe('subway/[slug].vue 역정보 headline', () => {
  const filePath = resolve(__dirname, '../../pages/subway/[slug].vue')
  const content = readFileSync(filePath, 'utf-8')

  it('노선 배지를 line-headline 블록으로 노출한다', () => {
    expect(content).toMatch(/data-test="line-headline"/)
  })

  it('노선 배지는 dedupe된 lines computed를 순회한다', () => {
    expect(content).toMatch(/v-for="ln in lines"/)
    expect(content).toMatch(/lineColor\(ln\)/)
  })
})

describe('subway/[slug].vue 데스크톱 전화 버튼', () => {
  const filePath = resolve(__dirname, '../../pages/subway/[slug].vue')
  const content = readFileSync(filePath, 'utf-8')

  it('사이드바 Actions에 station.phoneNumber 조건부 tel: 버튼이 있다', () => {
    expect(content).toMatch(/data-test="sidebar-call"/)
    expect(content).toMatch(/:href="`tel:\$\{station\.phoneNumber\}`"/)
  })

  it('전화 버튼은 phoneNumber가 있을 때만 렌더된다 (v-if 가드)', () => {
    expect(content).toMatch(/v-if="station\.phoneNumber"[^>]*data-test="sidebar-call"|data-test="sidebar-call"[\s\S]{0,200}?v-if="station\.phoneNumber"/)
  })
})

describe('subway/[slug].vue FAQPage JSON-LD', () => {
  const filePath = resolve(__dirname, '../../pages/subway/[slug].vue')
  const content = readFileSync(filePath, 'utf-8')

  it('useStructuredData를 import한다', () => {
    expect(content).toMatch(/useStructuredData/)
  })

  it('setFAQSchema에 faqItems를 전달해 발행한다', () => {
    expect(content).toMatch(/setFAQSchema\(\s*faqItems\.value\s*\)/)
  })

  it('TrainStation JSON-LD(buildSubwayJsonLd)도 함께 유지한다', () => {
    expect(content).toMatch(/buildSubwayJsonLd/)
  })
})
