// frontend/tests/pages/real-estate/buildingDetailFacilitySummary.test.ts
//
// 회귀 가드: 부동산 상세 SSR 의 "주변 생활시설" 요약은 개수 전용 엔드포인트를 써야 한다.
//
// 배경(2026-08 프로덕션 실측): 이 요약은 원래 POST /api/facilities/search 로 목록을 받아
// 그 안의 카테고리를 세는 방식이었고, 두 가지가 동시에 잘못돼 있었다.
//
//  1) 느림 — search 의 좌표 분기는 15개 카테고리를 전부 최대 1000행씩 가져와 거리정렬·dedupe
//     한 뒤 20건을 돌려준다. 강남 기준 0.22~0.37s 로, 이 페이지 SSR p50(0.456s)의 약 80%.
//     다른 섹션 SSR 이 0.016~0.059s 인 것과 대비된다.
//  2) 틀림 — 돌아온 "20건 페이지"에서 카테고리를 세다 보니 실제 개수와 어긋났다.
//     논현프라임아파트 반경 1km 병원 실제 893곳 / 약국 130곳인데 "병원 6곳·공원 1곳" 으로
//     렌더됐다. 이 문구는 37만 부동산 상세의 SEO 가시 HTML 에 들어간다.
//
// 고정 불변식: 요약 개수는 페이지네이션된 목록에서 세지 말고, 개수를 돌려주는 API 에서 받는다.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd().endsWith('/frontend') ? process.cwd() : join(process.cwd(), 'frontend')
const src = readFileSync(
  resolve(root, 'pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue'),
  'utf8',
)

describe('부동산 상세 SSR 시설 요약', () => {
  it('개수 전용 엔드포인트(nearby-counts)를 호출한다', () => {
    expect(src).toContain('/api/facilities/nearby-counts')
  })

  it('요약을 만들려고 목록 API(POST /api/facilities/search)를 부르지 않는다', () => {
    // 목록 경로로 되돌아가면 느려지고(15카테고리 스캔) 개수도 페이지 크기에 잘린다.
    expect(src).not.toMatch(/facilities\/search`?,\s*\{\s*\n?\s*method:\s*'POST'/)
  })

  it('개수를 목록 길이로 세지 않는다 — 응답의 count 를 쓴다', () => {
    // 구 버그: facilityItems.filter(i => i.category === cat).length
    expect(src).not.toMatch(/\.filter\(\s*\(?i:?\s*any\)?\s*=>\s*i\.category === cat\s*\)\.length/)
    expect(src).toMatch(/entry!?\.count/)
  })

  it('스캔 상한에 걸린 개수는 하한값임을 문구로 알린다', () => {
    // exact=false 면 "N곳" 이 아니라 "N곳 이상".
    expect(src).toMatch(/exact\s*\?\s*''\s*:\s*' 이상'/)
  })

  it('요약 반경은 도보권(300m)이다', () => {
    // 1km 로 넓히면 도심에서 "병원 893곳" 같은 값이 나와 생활권 정보로 읽히지 않고,
    // 바운딩박스 스캔 비용도 반경 제곱으로 커진다.
    expect(src).toMatch(/radius:\s*300/)
  })

  it('노출 우선순위 카테고리 목록이 단일 정의로 유지된다', () => {
    const decl = src.match(/const FACILITY_SUMMARY_CATS = \[([^\]]+)\]/)
    expect(decl).not.toBeNull()
    const cats = decl![1].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean)
    expect(cats).toEqual(['school', 'hospital', 'park', 'childcare', 'sports', 'pharmacy'])
    // 라벨이 빠진 카테고리가 있으면 문구에 undefined 가 새어 나간다
    for (const c of cats) expect(src).toMatch(new RegExp(`${c}:\\s*'`))
  })
})
