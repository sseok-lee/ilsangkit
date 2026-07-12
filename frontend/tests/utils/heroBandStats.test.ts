import { describe, it, expect } from 'vitest'
import { buildRegionCategoryStats, buildCategoryListStats } from '~/utils/heroBandStats'

describe('buildRegionCategoryStats', () => {
  const base = { regionCount: 120, nationalCount: 45000, unit: '곳', syncCellValue: '월 1회 자동 · 2026.06.19', syncLabel: '업데이트' }
  it('정확히 3칸: 이 지역·전국 등록·업데이트(마지막)', () => {
    const s = buildRegionCategoryStats(base)
    expect(s.map(x => x.label)).toEqual(['이 지역', '전국 등록', '업데이트'])
    expect(s[0].value).toBe('120곳')
    expect(s[1].value).toBe('45,000곳')
    expect(s[2].value).toBe('월 1회 자동 · 2026.06.19')
  })
  it('전국 카운트 null이면 전국 셀 생략 (fail-open, 2칸)', () => {
    const s = buildRegionCategoryStats({ ...base, nationalCount: null })
    expect(s.map(x => x.label)).toEqual(['이 지역', '업데이트'])
  })
  it('전국 카운트 0이면 생략', () => {
    expect(buildRegionCategoryStats({ ...base, nationalCount: 0 }).map(x => x.label)).toEqual(['이 지역', '업데이트'])
  })
  it('지역 카운트 0이면 이 지역 생략', () => {
    expect(buildRegionCategoryStats({ ...base, regionCount: 0 }).map(x => x.label)).toEqual(['전국 등록', '업데이트'])
  })
  it('업데이트 셀은 항상 마지막 (모바일 전폭 규칙)', () => {
    expect(buildRegionCategoryStats(base).at(-1)?.label).toBe('업데이트')
  })
})

describe('buildCategoryListStats', () => {
  const base = { displayTotal: 45000, nationalCount: 45000, unit: '곳', syncCellValue: '월 1회 자동 · 2026.06.19', basisValue: '지역 선택 후 정렬' }
  it('미필터: 전국 등록 단독(중복 없음)·데이터 갱신·목록 기준', () => {
    const s = buildCategoryListStats({ ...base, isRegionScoped: false })
    expect(s.map(x => x.label)).toEqual(['전국 등록', '데이터 갱신', '목록 기준'])
    expect(s[0].value).toBe('45,000곳')
  })
  it('필터: 이 지역·전국 등록·데이터 갱신(목록 기준 드롭, ≤3)', () => {
    const s = buildCategoryListStats({ ...base, isRegionScoped: true, displayTotal: 120, nationalCount: 45000 })
    expect(s.map(x => x.label)).toEqual(['이 지역', '전국 등록', '데이터 갱신'])
    expect(s.length).toBeLessThanOrEqual(3)
  })
  it('필터인데 전국 null이면 이 지역·데이터 갱신(2칸, fail-open)', () => {
    const s = buildCategoryListStats({ ...base, isRegionScoped: true, displayTotal: 120, nationalCount: null })
    expect(s.map(x => x.label)).toEqual(['이 지역', '데이터 갱신'])
  })
})
