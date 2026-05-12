import { describe, it, expect } from 'vitest'
import { lineColor, lineLabel, dedupeLines } from '~/utils/subwayLineColors'

describe('lineLabel — 표준데이터 verbose 노선명 정규화', () => {
  it('이미 정규형은 그대로 반환', () => {
    expect(lineLabel('1호선')).toBe('1호선')
    expect(lineLabel('신분당선')).toBe('신분당선')
    expect(lineLabel('부산3호선')).toBe('부산3호선')
  })

  it('"수도권 광역철도 8호선" → "8호선"', () => {
    expect(lineLabel('수도권 광역철도 8호선')).toBe('8호선')
  })

  it('"수도권 광역철도 신분당선" → "신분당선"', () => {
    expect(lineLabel('수도권 광역철도 신분당선')).toBe('신분당선')
  })

  it('"수도권 광역철도 수인분당선" → "수인분당선"', () => {
    expect(lineLabel('수도권 광역철도 수인분당선')).toBe('수인분당선')
  })

  it('"부산 도시철도 3호선" → "부산3호선" (도시 prefix 보존)', () => {
    expect(lineLabel('부산 도시철도 3호선')).toBe('부산3호선')
  })

  it('"수도권  도시철도 9호선" (이중공백) → "9호선"', () => {
    expect(lineLabel('수도권  도시철도 9호선')).toBe('9호선')
  })

  it('"수도권 경량도시철도 신림선" → "신림선"', () => {
    expect(lineLabel('수도권 경량도시철도 신림선')).toBe('신림선')
  })

  it('환승 row "대구도시철도3호선+대구도시철도1호선" → "대구3호선" (첫 토큰)', () => {
    expect(lineLabel('대구도시철도3호선+대구도시철도1호선')).toBe('대구3호선')
  })

  it('null/empty은 빈 문자열', () => {
    expect(lineLabel(null)).toBe('')
    expect(lineLabel(undefined)).toBe('')
    expect(lineLabel('')).toBe('')
  })

  it('CSV placeholder "-", "—", "N/A"는 빈 문자열로 처리', () => {
    expect(lineLabel('-')).toBe('')
    expect(lineLabel('—')).toBe('')
    expect(lineLabel('  -  ')).toBe('')
    expect(lineLabel('N/A')).toBe('')
    expect(lineLabel('n/a')).toBe('')
  })

  it('알려지지 않은 값은 마지막 토큰 또는 원본 trim', () => {
    expect(lineLabel('우주철도 999')).toBe('999')
    expect(lineLabel('짧은이름')).toBe('짧은이름')
  })

  it('"서울특별시 서울시메트로9호선㈜" → "9호선"', () => {
    expect(lineLabel('서울특별시 서울시메트로9호선㈜')).toBe('9호선')
  })
})

describe('lineColor — verbose 입력에도 정확한 색상 매핑', () => {
  it('"수도권 광역철도 신분당선" → 신분당선 색상', () => {
    expect(lineColor('수도권 광역철도 신분당선')).toBe('#D4003B')
  })

  it('"부산 도시철도 3호선" → 부산3호선 색상', () => {
    expect(lineColor('부산 도시철도 3호선')).toBe('#BB8336')
  })

  it('"수도권 광역철도 8호선" → 8호선 색상', () => {
    expect(lineColor('수도권 광역철도 8호선')).toBe('#E6186C')
  })

  it('알려지지 않은 노선은 회색 fallback', () => {
    expect(lineColor('우주철도 999')).toBe('#64748b')
  })

  it('null/empty은 fallback', () => {
    expect(lineColor(null)).toBe('#64748b')
    expect(lineColor(undefined)).toBe('#64748b')
  })
})

describe('dedupeLines — 정규화 기준 중복 제거', () => {
  it('"신분당선"과 "수도권 광역철도 신분당선"은 1건으로 합쳐짐', () => {
    const result = dedupeLines(['신분당선', '수도권 광역철도 신분당선'])
    expect(result).toHaveLength(1)
    // 첫 등장 순서 유지 (raw "신분당선")
    expect(lineLabel(result[0])).toBe('신분당선')
  })

  it('정규화 후 다른 라벨은 모두 보존', () => {
    const result = dedupeLines(['2호선', '신분당선', '수도권 광역철도 신분당선', '9호선'])
    expect(result).toHaveLength(3)
    expect(result.map((r) => lineLabel(r))).toEqual(['2호선', '신분당선', '9호선'])
  })

  it('빈 배열/null은 []', () => {
    expect(dedupeLines([])).toEqual([])
    expect(dedupeLines(null)).toEqual([])
    expect(dedupeLines(undefined)).toEqual([])
  })

  it('첫 등장 순서가 유지된다', () => {
    const result = dedupeLines(['수도권 광역철도 신분당선', '신분당선'])
    expect(result[0]).toBe('수도권 광역철도 신분당선')
  })

  it('verbose 토큰이 섞인 환승역도 정확 dedupe', () => {
    const result = dedupeLines([
      '1호선',
      '수도권 광역철도 1호선',
      '수도권 광역철도 3호선',
      '3호선',
      '5호선',
    ])
    expect(result.map((r) => lineLabel(r))).toEqual(['1호선', '3호선', '5호선'])
  })
})
