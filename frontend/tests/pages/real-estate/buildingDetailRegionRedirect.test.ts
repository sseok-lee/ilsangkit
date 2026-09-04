// frontend/tests/pages/real-estate/buildingDetailRegionRedirect.test.ts
//
// 회귀 가드: 부동산 건물 상세는 "요청 지역 ≠ 실제 건물 지역" 문서를 실제 지역 URL 로 301 해서
// 한 문서로 합쳐야 한다.
//
// 배경(프로덕션 실측 2026-09-04): 백엔드 getBuildingInfo 가 bjdCode 를 힌트로만 쓰고, 요청 지역에
// 그 이름의 건물이 없으면 buildingName 만으로 전국 groupBy 를 돌려 bjdCode 를 다시 고른다.
// 그 결과
//   /real-estate/villa-sale/seoul/gangnam/현대   → 200, index, "… | 제주 서귀포시 | 일상킷"
//   /real-estate/villa-sale/busan/haeundae/현대  → 200, index, 같은 title
//   /real-estate/villa-sale/daegu/suseong/현대   → 200, index, 같은 title
// 세 URL 모두 self-canonical. DISTRICT_SLUG_MAP 이 전국 평면 맵이라 city × district 조합이
// 전부 검증을 통과하므로, 흔한 건물명 하나가 (구·군 250 × 타입 6) 만큼 동일 문서를 발행했다.
// 네이버 SEO 진단은 canonical 이 아니라 크롤한 문서 단위로 중복을 세므로 이게 그대로
// 중복 title 22.5만 건 지표가 됐다.
//
// 고정 불변식
// 1. 대량 404 로 죽이지 않는다 — 301 통합이다.
// 2. SSR 일시 장애(fetchFailed)에는 301 도 noindex 도 하지 않는다(fail-open).
// 3. 301 목적지를 만들 수 없는 불일치는 indexable 로 남기지 않는다.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd().endsWith('/frontend') ? process.cwd() : join(process.cwd(), 'frontend')
const src = readFileSync(
  resolve(root, 'pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue'),
  'utf8',
)

describe('부동산 상세 — 지역 불일치 문서를 301 로 통합한다', () => {
  it('공유 헬퍼 resolveRegionRedirectPath 로 목적지를 계산한다 (재구현 금지)', () => {
    expect(src).toContain('resolveRegionRedirectPath({')
    expect(src).toContain("from '~/utils/realEstateRegion'")
  })

  it('서버에서만 301 로 이동한다 (trash/[id].vue 와 동일 패턴)', () => {
    expect(src).toMatch(
      /if \(import\.meta\.server && redirectPath\) \{\s*await navigateTo\(redirectPath, \{ redirectCode: 301 \}\)/,
    )
  })

  it('지역 불일치를 404 로 전환하지 않는다', () => {
    // 이미 색인된 URL 을 대량 404 로 바꾸면 회복 경로(재크롤)가 사라진다.
    expect(src).not.toMatch(/regionRedirect|regionUnresolvable[\s\S]{0,200}statusCode: 404/)
  })

  it('SSR 일시 장애에는 지역 판정을 하지 않는다 (fail-open)', () => {
    expect(src).toContain('if (regionSourceInfo && !fetchFailed.value) {')
  })

  it('301 을 만들 수 없는 불일치는 noindex 로 떨어뜨린다', () => {
    expect(src).toContain('regionUnresolvable.value = mismatched && !redirectPath')
    expect(src).toMatch(/shouldNoindexRealEstateDetail\(\{[\s\S]*?\}\) \|\| regionUnresolvable\.value/)
  })

  it('regionUnresolvable 선언이 noindex 계산보다 위에 있다 (TDZ 회귀 방지)', () => {
    // watchEffect(() => suppressAds(... noindex.value)) 가 즉시 평가되므로, 아래로 옮기면
    // const TDZ ReferenceError → page unmount → error.vue fallback 이 된다.
    expect(src.indexOf('const regionUnresolvable = ref(false)')).toBeGreaterThan(-1)
    expect(src.indexOf('const regionUnresolvable = ref(false)'))
      .toBeLessThan(src.indexOf('const noindex = computed('))
  })
})
