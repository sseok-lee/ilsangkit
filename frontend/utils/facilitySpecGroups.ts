import type { FacilityCategory } from '~/types/facility'

export interface SpecRow {
  label: string
  value: string | number | null | undefined
  unit?: string
  /** 'value' = 빈 값도 행 유지(컴포넌트가 '정보 없음'). 'flag' = 값 없으면 행 생략. */
  kind?: 'value' | 'flag'
  href?: string
}
export interface SpecTable {
  columns: string[]
  rows: Array<{ label: string; cells: Array<string | number | null> }>
}
export interface SpecTag { label: string; suffix?: string; colorClass?: string }
export interface SpecWeeklyRow { day: string; time: string; lunch?: string; closed?: boolean; allDay?: boolean; todayIdx?: number }
export interface SpecGroup {
  heading?: string
  render: 'kv' | 'table' | 'tags' | 'weekly'
  rows?: SpecRow[]
  table?: SpecTable
  tags?: SpecTag[]
  tagVariant?: 'teal' | 'gray' | 'sky' | 'custom'
  weekly?: { timeHeader: string; showLunch?: boolean; rows: SpecWeeklyRow[]; notes?: string[] }
}

type D = Record<string, unknown>
const num = (v: unknown): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)
const formatPhone = (v: unknown): string | null => {
  const s = str(v)?.replace(/[^0-9]/g, '')
  if (!s) return null
  if (s.startsWith('02')) return s.length > 9 ? `${s.slice(0, 2)}-${s.slice(2, 6)}-${s.slice(6)}` : `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5)}`
  return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7)}`
}
const formatYm = (v: unknown): string | null => {
  const s = str(v)
  if (!s) return null
  const m = s.match(/^(\d{4})(\d{2})$/)
  return m ? `${m[1]}년 ${Number(m[2])}월` : s
}

// ── 공유 헬퍼 (Task 2) ──────────────────────────────────────────────────────
const localeNum = (v: unknown): string | null => { const n = num(v); return n == null ? null : n.toLocaleString() }
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []) // eslint-disable-line @typescript-eslint/no-explicit-any
const splitList = (v: unknown): string[] => { const s = str(v); return s ? s.split('+').map(x => x.trim()).filter(Boolean) : [] }
const joinList = (v: unknown): string | null => { const i = splitList(v); return i.length ? i.join(', ') : null }
const yesNo = (v: unknown): string | null => (typeof v === 'boolean' ? (v ? '있음' : '없음') : null)
const httpUrl = (v: unknown): string | null => { const s = str(v); if (!s) return null; return /^https?:\/\//.test(s) ? s : `http://${s}` }
const trimDashes = (v: unknown): string | null => { const s = str(v); return s ? (s.replace(/^[\s-]+|[\s-]+$/g, '').trim() || null) : null }
const fmtHm = (v: unknown): string | null => { const s = str(v)?.replace(/\D/g, ''); if (!s || s.length < 3) return null; const p = s.padStart(4, '0'); return `${p.slice(0, 2)}:${p.slice(2, 4)}` }
const formatYmd = (v: unknown): string | null => { const s = str(v)?.replace(/\D/g, ''); if (!s || s.length !== 8) return str(v); return `${s.slice(0, 4)}년 ${Number(s.slice(4, 6))}월 ${Number(s.slice(6, 8))}일` }
const formatArea = (v: unknown): string | null => { const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : null); if (n == null) return null; return `${n.toLocaleString()}㎡ (약 ${Math.round(n * 0.3025).toLocaleString()}평)` }
const formatOpeningCycle = (v: unknown): string | null => { const s = str(v); if (!s) return null; if (s === '매일') return '매일'; if (/\d/.test(s)) return `매월 ${splitList(s).join(', ')}`; return s }
const feePair = (fee: unknown, time: unknown): string | null => { const f = num(fee); const t = num(time); if (f == null && t == null) return null; if (f != null && t != null) return `${f.toLocaleString()}원 / ${t}분`; return f != null ? `${f.toLocaleString()}원` : `${t}분` }
const formatLibraryHours = (open: unknown, close: unknown): string | null => { const s = str(open); const e = str(close); if (!s) return null; if (s === '00:00' && (!e || e === '00:00')) return '휴관'; return `${s} ~ ${e || s}` }
// ───────────────────────────────────────────────────────────────────────────

// ── Group A builders (Task 2): wifi, park, parking, library, sports ─────────

function wifiGroups(d: D): SpecGroup[] {
  const loc = str(d.installLocation); const locDetail = str(d.installLocationDetail)
  return [
    { heading: '접속 정보', render: 'kv', rows: [
      { label: '네트워크 이름(SSID)', value: str(d.ssid), kind: 'value' },
      { label: '설치 장소', value: loc, kind: 'value' },
      { label: '설치 장소 상세', value: locDetail && locDetail !== loc ? locDetail : null, kind: 'value' },
    ] },
    { heading: '운영 · 관리', render: 'kv', rows: [
      { label: '서비스 제공사', value: str(d.serviceProvider), kind: 'value' },
      { label: '관리기관', value: str(d.managementAgency), kind: 'value' },
      { label: '설치 시기', value: formatYm(d.installDate), kind: 'value' },
      { label: '연락처', value: formatPhone(d.phoneNumber), kind: 'value' },
      { label: '자료 기준일', value: str(d.dataDate), kind: 'value' },
    ] },
  ]
}

function parkGroups(d: D): SpecGroup[] {
  const groups: SpecGroup[] = []
  groups.push({ heading: '공원 개요', render: 'kv', rows: [
    { label: '공원 유형', value: str(d.parkType), kind: 'value' },
    { label: '면적', value: formatArea(d.area), kind: 'value' },
    { label: '지정일', value: formatYmd(d.designatedDate), kind: 'value' },
    { label: '관리기관', value: str(d.managingOrg), kind: 'value' },
    { label: '연락처', value: formatPhone(d.phoneNumber), kind: 'value' },
    { label: '자료 기준일', value: str(d.dataDate), kind: 'value' },
  ] })
  const facilityRows: SpecRow[] = [
    { label: '운동시설', value: joinList(d.exerciseFacilities), kind: 'value' },
    { label: '놀이시설', value: joinList(d.playFacilities), kind: 'value' },
    { label: '편의시설', value: joinList(d.convenienceFacilities), kind: 'value' },
    { label: '교양시설', value: joinList(d.cultureFacilities), kind: 'value' },
    { label: '기타시설', value: joinList(d.otherFacilities), kind: 'value' },
  ]
  if (facilityRows.some(r => r.value != null)) groups.push({ heading: '보유 시설', render: 'kv', rows: facilityRows })
  return groups
}

function parkingGroups(d: D): SpecGroup[] {
  const groups: SpecGroup[] = []
  groups.push({ heading: '요금 정보', render: 'kv', rows: [
    { label: '요금 구분', value: str(d.feeType), kind: 'value' },
    { label: '기본 요금', value: feePair(d.baseFee, d.baseTime), kind: 'value' },
    { label: '추가 요금', value: feePair(d.additionalFee, d.additionalTime), kind: 'value' },
    { label: '일 최대 요금', value: localeNum(d.dailyMaxFee), unit: '원', kind: 'value' },
    { label: '일 최대요금 적용시간', value: str(d.dailyMaxFeeHours), kind: 'value' },
    { label: '월 정기권', value: localeNum(d.monthlyFee), unit: '원', kind: 'value' },
  ] })
  groups.push({ heading: '운영 정보', render: 'kv', rows: [
    { label: '운영시간', value: str(d.operatingHours), kind: 'value' },
    { label: '운영요일', value: str(d.operatingDays), kind: 'value' },
    { label: '결제수단', value: str(d.paymentMethod), kind: 'value' },
    { label: '부제 운영', value: str(d.alternateParking), kind: 'value' },
    { label: '연락처', value: formatPhone(d.phone), kind: 'value' },
    { label: '관리기관', value: str(d.managingOrg), kind: 'value' },
  ] })
  groups.push({ heading: '시설 정보', render: 'kv', rows: [
    { label: '주차 구분', value: str(d.parkingType), kind: 'value' },
    { label: '주차장 유형', value: str(d.lotType), kind: 'value' },
    { label: '주차면수', value: localeNum(d.capacity), unit: '면', kind: 'value' },
    { label: '구역 구분', value: str(d.zoneClass), kind: 'value' },
    { label: '장애인 주차구역', value: yesNo(d.hasDisabledParking), kind: 'value' },
  ] })
  const remarks = str(d.remarks)
  if (remarks) groups.push({ heading: '비고', render: 'kv', rows: [{ label: '특기사항', value: remarks, kind: 'value' }] })
  return groups
}

function libraryGroups(d: D): SpecGroup[] {
  const groups: SpecGroup[] = []
  const home = httpUrl(d.homepageUrl)
  groups.push({ heading: '운영 정보', render: 'kv', rows: [
    { label: '도서관 유형', value: str(d.libraryType), kind: 'value' },
    { label: '운영기관', value: str(d.operatingOrg), kind: 'value' },
    { label: '휴관일', value: str(d.closedDays), kind: 'value' },
    { label: '연락처', value: formatPhone(d.phoneNumber), kind: 'value' },
    { label: '홈페이지', value: home, href: home ?? undefined, kind: 'value' },
  ] })
  const hourRows = ([
    ['평일', formatLibraryHours(d.weekdayOpenTime, d.weekdayCloseTime)],
    ['토요일', formatLibraryHours(d.saturdayOpenTime, d.saturdayCloseTime)],
    ['공휴일', formatLibraryHours(d.holidayOpenTime, d.holidayCloseTime)],
  ] as Array<[string, string | null]>).filter(([, t]) => t != null).map(([label, t]) => ({ label, cells: [t] as Array<string | number | null> }))
  if (hourRows.length) groups.push({ heading: '운영시간', render: 'table', table: { columns: ['구분', '운영시간'], rows: hourRows } })
  groups.push({ heading: '장서 현황', render: 'kv', rows: [
    { label: '장서', value: localeNum(d.bookCount), unit: '권', kind: 'value' },
    { label: '연속간행물', value: localeNum(d.serialCount), unit: '종', kind: 'value' },
    { label: '비도서 자료', value: localeNum(d.nonBookCount), unit: '점', kind: 'value' },
    { label: '대출가능 권수', value: localeNum(d.loanableBooks), unit: '권', kind: 'value' },
    { label: '대출가능 일수', value: localeNum(d.loanableDays), unit: '일', kind: 'value' },
  ] })
  groups.push({ heading: '좌석 · 규모', render: 'kv', rows: [
    { label: '좌석수', value: localeNum(d.seatCount), unit: '석', kind: 'value' },
    { label: '부지면적', value: str(d.lotArea), unit: '㎡', kind: 'value' },
    { label: '건물면적', value: str(d.buildingArea), unit: '㎡', kind: 'value' },
  ] })
  return groups
}

function sportsGroups(d: D): SpecGroup[] {
  const home = httpUrl(d.faciHomepage)
  return [
    { heading: '시설 개요', render: 'kv', rows: [
      { label: '시설유형', value: str(d.ftypeNm), kind: 'value' },
      { label: '시설구분', value: str(d.faciGbNm), kind: 'value' },
      { label: '업종', value: str(d.fcobNm), kind: 'value' },
      { label: '국가대표 시설', value: str(d.nationYn) === 'Y' ? '해당' : null, kind: 'flag' },
    ] },
    { heading: '규모', render: 'kv', rows: [
      { label: '시설 총면적', value: str(d.faciGfa), unit: '㎡', kind: 'value' },
      { label: '관람석 수용', value: localeNum(d.standCptPsnCnt), unit: '석', kind: 'value' },
    ] },
    { heading: '운영 · 소유', render: 'kv', rows: [
      { label: '소유 시·도', value: str(d.fmngCpNm), kind: 'value' },
      { label: '소유 시·군·구', value: str(d.fmngCpbNm), kind: 'value' },
      { label: '관리 유형', value: str(d.fmngTypeGbNm), kind: 'value' },
      { label: '홈페이지', value: home, href: home ?? undefined, kind: 'value' },
    ] },
  ]
}
// ───────────────────────────────────────────────────────────────────────────

function toiletGroups(d: D): SpecGroup[] {
  const groups: SpecGroup[] = []

  const fixtureRows: SpecTable['rows'] = [
    { label: '대변기', cells: [num(d.maleToilets), num(d.femaleToilets)] },
    { label: '소변기', cells: [num(d.maleUrinals), null] },
    { label: '장애인용', cells: [num(d.maleDisabledToilets), num(d.femaleDisabledToilets)] },
    { label: '어린이 대변기', cells: [num(d.maleChildToilets), num(d.femaleChildToilets)] },
    { label: '어린이 소변기', cells: [num(d.maleChildUrinals), null] },
  ].filter(r => r.cells.some(c => c != null))
  if (fixtureRows.length) {
    groups.push({ heading: '변기 현황', render: 'table', table: { columns: ['구분', '남성', '여성'], rows: fixtureRows } })
  }

  const bellLoc = str(d.emergencyBellLocation)
  const diaperLoc = str(d.diaperChangingLocation)
  groups.push({
    heading: '안전 · 편의',
    render: 'kv',
    rows: [
      { label: 'CCTV', value: d.hasCCTV ? '설치됨' : null, kind: 'flag' },
      { label: '비상벨', value: d.hasEmergencyBell ? (bellLoc ? `설치 · ${bellLoc}` : '설치됨') : null, kind: 'flag' },
      { label: '기저귀 교환대', value: d.hasDiaperChangingTable ? (diaperLoc ? `있음 · ${diaperLoc}` : '있음') : null, kind: 'flag' },
      { label: '장애인 화장실', value: d.hasDisabledToilet ? '있음' : null, kind: 'flag' },
    ],
  })

  groups.push({
    heading: '운영 · 관리',
    render: 'kv',
    rows: [
      { label: '개방 형태', value: str(d.facilityType), kind: 'value' },
      { label: '소유 구분', value: str(d.ownershipType), kind: 'value' },
      { label: '정화 방식', value: str(d.sewageTreatment), kind: 'value' },
      { label: '운영시간', value: str(d.operatingHours), kind: 'value' },
      { label: '설치 시기', value: formatYm(d.installDate), kind: 'value' },
      { label: '개보수 시기', value: formatYm(d.remodelingDate), kind: 'value' },
      { label: '관리기관', value: str(d.managingOrg), kind: 'value' },
      { label: '연락처', value: formatPhone(d.phoneNumber), kind: 'value' },
    ],
  })

  return groups
}

function clothesGroups(d: D): SpecGroup[] {
  // thin: 값 있는 행만
  const rows: SpecRow[] = [
    { label: '설치 위치', value: str(d.detailLocation) },
    { label: '관리기관', value: str(d.managementAgency) },
    { label: '연락처', value: formatPhone(d.phoneNumber) },
    { label: '운영기관', value: str(d.providerName) },
    { label: '자료 기준일', value: str(d.dataDate) },
  ].filter(r => r.value != null)
  return rows.length ? [{ heading: '상세 정보', render: 'kv', rows }] : []
}

const REGISTRY: Partial<Record<FacilityCategory, (d: D) => SpecGroup[]>> = {
  toilet: toiletGroups,
  clothes: clothesGroups,
  wifi: wifiGroups,
  park: parkGroups,
  parking: parkingGroups,
  library: libraryGroups,
  sports: sportsGroups,
}

export function buildSpecGroups(category: FacilityCategory, details: Record<string, unknown>): SpecGroup[] {
  const builder = REGISTRY[category]
  return builder ? builder(details ?? {}) : []
}
