/**
 * 한국 도시철도 노선별 공식 색상.
 *
 * 입력: 표준데이터 "노선명" 컬럼 (예: "부산 도시철도 3호선", "수도권 광역철도 신분당선",
 *        "동해선", "2호선" 등). 같은 N호선이라도 부산/대구/인천/광주/대전은 자체 색상을 사용한다.
 */

const DEFAULT_COLOR = '#64748b'

// 자체 색상 체계를 갖는 광역시 (수도권 1~9호선과 별도)
const CITIES_WITH_OWN_COLORS = ['부산', '대구', '인천', '광주', '대전'] as const

const LINE_COLORS: Record<string, string> = {
  // 수도권 (서울교통공사 + 코레일)
  '1호선': '#0052A4',
  '2호선': '#00A84D',
  '3호선': '#EF7C1C',
  '4호선': '#00A5DE',
  '5호선': '#996CAC',
  '6호선': '#CD7C2F',
  '7호선': '#747F00',
  '8호선': '#E6186C',
  '9호선': '#BDB092',
  '신분당선': '#D4003B',
  '경의중앙선': '#77C4A3',
  '공항철도': '#0090D2',
  '경춘선': '#0C8E72',
  '수인분당선': '#F5A200',
  '분당선': '#FABE00',
  '경강선': '#003DA5',
  '서해선': '#81A914',
  '신림선': '#6789CA',
  '우이신설선': '#B7C452',
  '김포골드라인': '#A17800',
  'GTX-A': '#9E5D45',
  '의정부경전철': '#FDA600',
  '에버라인': '#85A11F',
  '용인경전철': '#85A11F',
  // 인천
  '인천1호선': '#7CA8D5',
  '인천2호선': '#ED8B00',
  // 부산
  '부산1호선': '#F06A00',
  '부산2호선': '#81BF48',
  '부산3호선': '#BB8336',
  '부산4호선': '#217DCB',
  '동해선': '#1AAA51',
  '부산김해경전철': '#76C100',
  // 대구
  '대구1호선': '#D93F5C',
  '대구2호선': '#00A84D',
  '대구3호선': '#FFB100',
  // 광주
  '광주1호선': '#009088',
  // 대전
  '대전1호선': '#007448',
}

function findCityWithOwnColor(name: string): string | null {
  for (const c of CITIES_WITH_OWN_COLORS) {
    if (name.includes(c)) return c
  }
  return null
}

export function lineColor(line: string | null | undefined): string {
  if (!line) return DEFAULT_COLOR
  const trimmed = line.trim()

  // 1. 정확한 매칭
  const exact = LINE_COLORS[trimmed]
  if (exact) return exact

  // 2. 공백 제거 매칭 ("의정부 경전철" → "의정부경전철")
  const compact = trimmed.replace(/\s+/g, '')
  if (LINE_COLORS[compact]) return LINE_COLORS[compact]

  // 3. 도시 + N호선 추출 ("부산 도시철도 3호선" → "부산3호선")
  const numMatch = trimmed.match(/(\d+)호선/)
  if (numMatch) {
    const num = numMatch[1]
    const city = findCityWithOwnColor(trimmed)
    if (city) {
      const key = `${city}${num}호선`
      if (LINE_COLORS[key]) return LINE_COLORS[key]
    }
    // 수도권/서울/코레일은 표준 색상
    if (LINE_COLORS[`${num}호선`]) return LINE_COLORS[`${num}호선`]
  }

  // 4. 마지막 토큰 ("수도권 광역철도 신분당선" → "신분당선")
  const tokens = trimmed.split(/\s+/)
  const last = tokens[tokens.length - 1]
  if (LINE_COLORS[last]) return LINE_COLORS[last]

  return DEFAULT_COLOR
}

// 단일 진실원 — LINE_COLORS는 직접 export 하지 않는다. 색상은 lineColor()로만 조회.
