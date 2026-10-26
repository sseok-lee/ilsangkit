import type { Facility } from '~/types/facility'

/** 시/도 축약형 — 주소 맨 앞에 오면 접두로 보고 뺀다 */
const SHORT_CITY_NAMES = new Set([
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
])
const CITY_SUFFIX = /(특별시|광역시|특별자치시|특별자치도|도)$/
const SIGUNGU = /^[가-힣]+(시|군|구)$/

/**
 * 주소 → 짧은 주소(도로명+번호). 괄호 부분과 첫 쉼표 뒤(층·호)를 지우고,
 * 맨 앞 시/도와 이어지는 시/군/구 토큰을 뺀다.
 * 예) `경기도 화성시 병점노을4로 29, 1층 101~102호 (병점동)` → `병점노을4로 29`
 */
export function shortAddress(address: string | null | undefined): string {
  if (!address) return ''
  const main = address.replace(/\s*\([^)]*\)/g, '').split(',')[0].trim()
  const tokens = main.split(/\s+/).filter(Boolean)
  if (tokens.length > 1 && (CITY_SUFFIX.test(tokens[0]) || SHORT_CITY_NAMES.has(tokens[0]))) tokens.shift()
  while (tokens.length > 1 && SIGUNGU.test(tokens[0])) tokens.shift()
  return tokens.join(' ')
}

/** 약국 진료시간 HHMM(또는 HMM) → HH:MM. FacilityCard·FacilityList 와 같은 규칙. */
export function formatDutyTime(raw: string | number): string {
  const s = String(raw).padStart(4, '0')
  return `${s.slice(0, 2)}:${s.slice(2)}`
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** 양의 정수만(0·빈 값은 "정보 없음"으로 본다) */
function positive(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

function count(value: unknown, format: (n: string) => string): string {
  const n = positive(value)
  return n === null ? '' : format(n.toLocaleString('ko-KR'))
}

/** 카테고리별 핵심 정보(값 없는 항목은 빈 문자열 → 호출부에서 걸러짐) */
function categoryInfo(facility: Facility): string[] {
  const e = facility.extras ?? {}
  switch (facility.category) {
    case 'toilet':
      return [text(e.operatingHours) && `개방 ${text(e.operatingHours)}`, e.hasDisabledToilet === true ? '장애인화장실' : '']
    case 'wifi':
      return [text(e.installLocation)]
    case 'clothes':
      return [text(e.detailLocation)]
    case 'parking': {
      // FacilityCard 와 같은 판단(feeType 기준). 유료인데 기본요금이 없으면 "0원~" 대신 생략.
      const feeType = text(e.feeType)
      const fee = feeType === '무료' ? '무료' : feeType ? count(e.baseFee, (n) => `${n}원~`) : ''
      return [fee, count(e.capacity, (n) => `${n}면`)]
    }
    case 'aed':
      return [text(e.buildPlace), text(e.org)]
    case 'library': {
      const open = text(e.weekdayOpenTime)
      const close = text(e.weekdayCloseTime)
      return [open && close ? `평일 ${open}~${close}` : '', count(e.seatCount, (n) => `${n}석`)]
    }
    case 'hospital':
      return [text(e.clCdNm), count(e.drTotCnt, (n) => `의사 ${n}명`)]
    case 'pharmacy': {
      const open = text(e.dutyTime1s) || (typeof e.dutyTime1s === 'number' ? String(e.dutyTime1s) : '')
      const close = text(e.dutyTime1c) || (typeof e.dutyTime1c === 'number' ? String(e.dutyTime1c) : '')
      return [open && close ? `평일 ${formatDutyTime(open)}~${formatDutyTime(close)}` : '']
    }
    case 'park':
      return [text(e.parkType)]
    case 'school':
      return [text(e.schoolLevel), text(e.coeducationType)]
    case 'market':
      return [text(e.marketType), count(e.storeCount, (n) => `점포 ${n}개`)]
    case 'childcare':
      return [text(e.crtypename), count(e.crcapat, (n) => `정원 ${n}명`)]
    case 'ev-charger':
      return [count(e.rapidCount, (n) => `급속 ${n}대`), count(e.slowCount, (n) => `완속 ${n}대`)]
    case 'sports':
      return [text(e.ftypeNm)]
    default:
      return []
  }
}

/**
 * 시설 상세 "주변 시설" 행의 보조 줄 — 짧은 주소 + 카테고리 핵심 정보 최대 2개를 ` · ` 로 잇는다.
 * AED 는 주소보다 설치 위치가 핵심이라 정보가 있으면 주소를 생략한다. 아무것도 없으면 ''.
 */
export function nearbyFacilitySub(facility: Facility): string {
  const info = categoryInfo(facility).filter(Boolean).slice(0, 2)
  const address = shortAddress(facility.roadAddress || facility.address)
  const parts = facility.category === 'aed' && info.length > 0 ? info : [address, ...info]
  return parts.filter(Boolean).join(' · ')
}
