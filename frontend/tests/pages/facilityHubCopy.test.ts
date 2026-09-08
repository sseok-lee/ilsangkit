import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 허브 본문(`SEO_DESCRIPTIONS`)이 "지금 문 연", "현재 진료 중인", "지금 이용 가능한" 처럼
 * 자동 선별 결과처럼 읽히는 문구를 썼다. 사이트에는 영업중·야간·24시간 필터가 없다
 * (API 스키마 backend/src/schemas/facility.ts:73~ 에 해당 필드 없음, 허브 검색은
 *  category/page/limit/city/keyword/departments 만 보냄).
 *
 * 페이지 지역 상수라 이 저장소의 기존 선례(tests/pages/trash-region-ssr.test.ts)와 같이
 * 소스 텍스트로 단언한다.
 * (RESEARCH/naver-decline-2026-09-08/recheck-metadata.md)
 */
const frontendRoot = process.cwd().endsWith('/frontend')
  ? process.cwd()
  : join(process.cwd(), 'frontend')
const source = readFileSync(resolve(frontendRoot, 'pages/[category]/index.vue'), 'utf8')
const hubDescriptions = source.split('const SEO_DESCRIPTIONS')[1]?.split('\n}')[0] ?? ''

describe('허브 본문 설명 - 없는 선별 기능을 약속하지 않는다', () => {
  it('SEO_DESCRIPTIONS 블록을 찾는다', () => {
    expect(hubDescriptions).toContain('toilet:')
    expect(hubDescriptions).toContain('pharmacy:')
  })

  it.each(['지금 문 연', '현재 진료 중', '지금 이용 가능한', '지금 영업'])(
    "'%s' 처럼 자동 선별된 결과로 읽히는 표현을 쓰지 않는다",
    (phrase) => {
      expect(hubDescriptions).not.toContain(phrase)
    },
  )

  it('실제 제공하는 정보 설명은 유지한다', () => {
    // 화장실 24시간·장애인 배지(FacilityCard.vue:61)와 병원 진료과목 필터는 실재한다.
    expect(hubDescriptions).toContain('장애인화장실')
    expect(hubDescriptions).toContain('진료과목')
  })
})
