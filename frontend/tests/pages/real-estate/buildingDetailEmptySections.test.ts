import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 부동산 상세 — 데이터 결측 시 섹션을 숨기지 않고 빈 상태로 렌더한다.
 *
 * 왜:
 *  1) 광고 앵커 — 광고③(order-7)과 광고④(order-12) 사이 블록이 전부 v-if 였다.
 *     좌표·인근단지가 모두 없으면 셋 다 사라져 두 광고가 연속 노출된다.
 *     (메모리 원칙: "광고는 조건부가 아닌 항상-렌더 블록에 앵커" — 청약 상세 PR #505)
 *  2) 사용자 — "없음"으로 끝내지 않고 주소 검색·지역 목록으로 경로를 준다.
 *
 * near-dup 완화: 문구에 단지명·주소·지역이 들어가 페이지마다 텍스트가 다르다.
 */
const PAGE = 'pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue'

function source(): string {
  const root = process.cwd().endsWith('/frontend') ? process.cwd() : resolve(process.cwd(), 'frontend')
  return readFileSync(resolve(root, PAGE), 'utf8')
}

/** <template> 블록만 — script 의 함수 지역변수와 구분해서 본다. */
function template(): string {
  return source().split('<script setup lang="ts">')[0]
}

describe('부동산 상세 빈 섹션', () => {
  it('세 섹션이 좌표·인근단지 유무로 통째 사라지지 않는다', () => {
    const t = template()
    // 이 v-if 들이 SectionBlock/wrapper 루트에 있으면 블록이 사라져 광고가 붙는다.
    expect(t).not.toMatch(/<SectionBlock[^>]*v-if="buildingInfo\?\.lat && buildingInfo\?\.lng"/)
    expect(t).not.toMatch(/v-if="nearbyByType\.apt\.length > 0 \|\| nearbyByType\.offitel/)
  })

  it('좌표가 없으면 위치 섹션이 주소 검색 경로를 준다', () => {
    const t = template()
    expect(t).toContain('kakaoSearchUrl')
    expect(t).toContain('naverSearchUrl')
    // 주소 검색 링크는 좌표 결측(!hasMapCoords) 분기 안에만 있어야 한다.
    const empty = t.split('v-if="!hasMapCoords"')[1]?.split('</EmptyState>')[0] ?? ''
    expect(empty).toContain('kakaoSearchUrl')
    expect(empty).toContain('naverSearchUrl')
  })

  it('좌표가 필요한 길찾기·지도는 좌표가 있을 때만 렌더한다', () => {
    const t = template()
    // kakaoMapUrl/naverMapUrl 은 lat/lng 를 URL 에 박으므로 결측 시 깨진 링크가 된다.
    // 데스크톱 길찾기 버튼 묶음과 지도/로드뷰 그리드가 hasMapCoords 로 가드돼야 한다.
    expect(t).toMatch(/<div v-if="hasMapCoords" class="hidden md:flex/)
    expect(t).toMatch(/<div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">/)
  })

  it('빈 상태 아이콘이 nuxt.config 서브셋에 존재한다', () => {
    // EmptyState 의 icon 은 동적 prop 이라 materialSymbols 테스트가 못 잡는다.
    // (explore_off 를 썼다가 서브셋에 없어 빈 네모로 렌더될 뻔했다.)
    const root = process.cwd().endsWith('/frontend') ? process.cwd() : resolve(process.cwd(), 'frontend')
    const config = readFileSync(resolve(root, 'nuxt.config.ts'), 'utf8')
    const subset = new Set(/icon_names=([a-z0-9_,]+)/.exec(config)?.[1].split(',') ?? [])
    const used = [...template().matchAll(/icon="([a-z0-9_]+)"/g)].map(m => m[1])
    expect(used.length).toBeGreaterThan(0)
    expect(used.filter(i => !subset.has(i))).toEqual([])
  })

  it('빈 상태 문구에 페이지 고유 데이터가 들어간다 (near-dup 완화)', () => {
    const t = template()
    // 전 페이지 동일한 고정 문구만 쓰면 공유 본문이 늘어 near-dup 이 악화된다.
    expect(t).toContain('${buildingName}')
    expect(t).toContain('${districtName}')
  })

  it('빈 상태에서도 지역 페이지로 내부 링크를 낸다', () => {
    const t = template()
    expect(t).toContain('`/${citySlugParam}/${districtSlugParam}`')
    expect(t).toContain('`/real-estate/${realEstateTypeParam}/${citySlugParam}/${districtSlugParam}`')
  })

  it('결측 판정은 최상위 computed 하나로 모은다', () => {
    const s = source()
    expect(s).toMatch(/const hasMapCoords = computed/)
    expect(s).toMatch(/const hasNearby = computed/)
  })

  it('hasMapCoords/hasNearby 는 의존 선언 뒤에 온다 (TDZ)', () => {
    const s = source()
    expect(s.indexOf('const nearbyByType')).toBeLessThan(s.indexOf('const hasNearby = computed'))
    expect(s.indexOf('const fullAddress')).toBeLessThan(s.indexOf('const kakaoSearchUrl'))
  })
})
