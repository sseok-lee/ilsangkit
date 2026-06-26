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

// ── Group B builders (Task 3): market, school, childcare ─────────────────

const CHILD_CLASS_DEFS: [string, string, string][] = [
  ['0세', 'classCnt00', 'childCnt00'], ['1세', 'classCnt01', 'childCnt01'], ['2세', 'classCnt02', 'childCnt02'],
  ['3세', 'classCnt03', 'childCnt03'], ['4세', 'classCnt04', 'childCnt04'], ['5세', 'classCnt05', 'childCnt05'],
  ['만2세미만', 'classCntM2', 'childCntM2'], ['만5세이상', 'classCntM5', 'childCntM5'], ['장애아', 'classCntSp', 'childCntSp'],
]
const CHILD_STAFF_DEFS: [string, string][] = [
  ['원장', 'emCntA1'], ['보육교사', 'emCntA2'], ['특수교사', 'emCntA3'], ['치료사', 'emCntA4'], ['영양사', 'emCntA5'],
  ['간호사(조무사)', 'emCntA6'], ['조리원', 'emCntA10'], ['사무원', 'emCntA7'], ['기타', 'emCntA8'],
]
const CHILD_CAREER_DEFS: [string, string][] = [
  ['1년 미만', 'emCnt0y'], ['1년 이상', 'emCnt1y'], ['2년 이상', 'emCnt2y'], ['4년 이상', 'emCnt4y'], ['6년 이상', 'emCnt6y'],
]

function marketGroups(d: D): SpecGroup[] {
  const groups: SpecGroup[] = []
  const storeCount = num(d.storeCount); const foundedYear = num(d.foundedYear)
  const home = httpUrl(d.homepageUrl)
  groups.push({ heading: '시장 개요', render: 'kv', rows: [
    { label: '시장 유형', value: str(d.marketType), kind: 'value' },
    { label: '개설 주기', value: formatOpeningCycle(d.openingCycle), kind: 'value' },
    { label: '점포 수', value: storeCount != null ? storeCount.toLocaleString() : null, unit: '개', kind: 'value' },
    { label: '개설 연도', value: foundedYear != null ? String(foundedYear) : null, unit: '년', kind: 'value' },
  ] })
  const productTags = splitList(d.products)
  if (productTags.length) groups.push({ heading: '주요 판매품목', render: 'tags', tagVariant: 'gray', tags: productTags.map(t => ({ label: t })) })
  groups.push({ heading: '편의시설', render: 'kv', rows: [
    { label: '공중화장실', value: yesNo(d.hasPublicToilet), kind: 'value' },
    { label: '주차시설', value: yesNo(d.hasParking), kind: 'value' },
    { label: '취급 상품권', value: str(d.giftCertificates), kind: 'value' },
  ] })
  groups.push({ heading: '연락 · 안내', render: 'kv', rows: [
    { label: '연락처', value: formatPhone(d.phoneNumber), kind: 'value' },
    { label: '홈페이지', value: home, href: home ?? undefined, kind: 'value' },
    { label: '자료 기준일', value: str(d.dataDate), kind: 'value' },
  ] })
  return groups
}

function schoolGroups(d: D): SpecGroup[] {
  const groups: SpecGroup[] = []
  const home = httpUrl(d.homepageUrl)
  const ovRows: SpecRow[] = [
    { label: '학교급', value: str(d.schoolLevel), kind: 'value' },
    { label: '설립형태', value: str(d.foundationType), kind: 'value' },
    { label: '운영상태', value: str(d.operationStatus), kind: 'value' },
  ]
  const pushIf = (label: string, v: string | null) => { if (v) ovRows.push({ label, value: v, kind: 'value' }) }
  pushIf('남녀공학', str(d.coeducationType))
  pushIf('고교유형', str(d.highSchoolType))
  pushIf('주야구분', str(d.dayNightType))
  pushIf('본/분교', str(d.branchType))
  pushIf('설립일', formatYmd(d.foundedDate))
  groups.push({ heading: '학교 개요', render: 'kv', rows: ovRows })
  groups.push({ heading: '연락 · 관할', render: 'kv', rows: [
    { label: '팩스', value: str(d.faxNumber), kind: 'value' },
    { label: '홈페이지', value: home, href: home ?? undefined, kind: 'value' },
    { label: '시도교육청', value: str(d.sidoEduName), kind: 'value' },
    { label: '교육지원청', value: str(d.localEduName), kind: 'value' },
  ] })
  const enr = arr(d.enrollments).map((e: any) => ({ grade: num(e?.grade), cls: num(e?.classCount) })) // eslint-disable-line @typescript-eslint/no-explicit-any
    .filter(e => e.grade != null).sort((a, b) => (a.grade as number) - (b.grade as number))
  if (enr.length) {
    const rows: SpecTable['rows'] = enr.map(e => ({ label: `${e.grade}학년`, cells: [e.cls] }))
    if (enr.length > 1) rows.push({ label: '합계', cells: [enr.reduce((s, e) => s + (e.cls ?? 0), 0)] })
    groups.push({ heading: '학급 현황', render: 'table', table: { columns: ['학년', '학급 수'], rows } })
  }
  const deptTags: SpecTag[] = arr(d.departments).map((x: any) => ({ label: str(x?.departmentName) ?? '' })).filter(t => !!t.label) // eslint-disable-line @typescript-eslint/no-explicit-any
  if (deptTags.length) groups.push({ heading: '계열 정보', render: 'tags', tagVariant: 'sky', tags: deptTags })
  return groups
}

function childcareGroups(d: D): SpecGroup[] {
  const groups: SpecGroup[] = []
  const home = httpUrl(d.crhome)
  const opRows: SpecRow[] = [
    { label: '어린이집 유형', value: str(d.crtypename), kind: 'value' },
    { label: '운영 상태', value: str(d.crstatusname), kind: 'value' },
  ]
  const pb = str(d.crpausebegindt); const pe = str(d.crpauseenddt)
  if (pb && pe) opRows.push({ label: '휴지기간', value: `${pb} ~ ${pe}`, kind: 'value' })
  opRows.push(
    { label: '인가일', value: formatYmd(d.crcnfmdt), kind: 'value' },
    { label: '대표자', value: str(d.crrepname), kind: 'value' },
    { label: '통학차량', value: str(d.crcargbname), kind: 'value' },
    { label: '팩스', value: str(d.crfaxno), kind: 'value' },
    { label: '홈페이지', value: home, href: home ?? undefined, kind: 'value' },
    { label: '데이터 기준일', value: str(d.datastdrdt), kind: 'value' },
  )
  groups.push({ heading: '운영 현황', render: 'kv', rows: opRows })
  const capRows: SpecRow[] = [
    { label: '정원', value: num(d.crcapat), unit: '명', kind: 'value' },
    { label: '현원', value: num(d.crchcnt), unit: '명', kind: 'value' },
    { label: '보육실', value: num(d.nrtrroomcnt), unit: '개', kind: 'value' },
    { label: '보육실 면적', value: str(d.nrtrroomsize), unit: '㎡', kind: 'value' },
    { label: '놀이터', value: num(d.plgrdco), unit: '개', kind: 'value' },
    { label: 'CCTV', value: num(d.cctvinstlcnt), unit: '대', kind: 'value' },
    { label: '교직원', value: num(d.chcrtescnt), unit: '명', kind: 'value' },
  ]
  const cap = num(d.crcapat); const cur = num(d.crchcnt)
  if (cap != null && cur != null && cap > 0) capRows.push({ label: '가용률', value: `${Math.round((cap - cur) / cap * 100)}% (여석 ${Math.max(cap - cur, 0)}명)`, kind: 'value' })
  groups.push({ heading: '정원·시설 현황', render: 'kv', rows: capRows })
  const classRows: SpecTable['rows'] = CHILD_CLASS_DEFS.map(([label, ck, nk]) => {
    const c = num(d[ck]); const n = num(d[nk])
    const avg = (c != null && c > 0 && n != null) ? Math.round(n / c * 10) / 10 : null
    return { label, cells: [c, n, avg] }
  }).filter(r => (r.cells[0] != null && r.cells[0] !== 0) || (r.cells[1] != null && r.cells[1] !== 0))
  if (classRows.length) {
    const tc = num(d.classCntTot); const tn = num(d.childCntTot)
    if (tc != null || tn != null) classRows.push({ label: '합계', cells: [tc, tn, (tc && tn != null) ? Math.round(tn / tc * 10) / 10 : null] })
    groups.push({ heading: '연령별 반·아동 현황', render: 'table', table: { columns: ['연령', '반 수', '아동 수', '반당 평균'], rows: classRows } })
  }
  const staffRows = CHILD_STAFF_DEFS.map(([label, k]) => ({ label, value: num(d[k]), unit: '명' })).filter(r => r.value != null && r.value > 0)
  if (staffRows.length) { const tot = num(d.emCntTot); groups.push({ heading: tot != null ? `직원 현황 (총 ${tot}명)` : '직원 현황', render: 'kv', rows: staffRows }) }
  const careerTags = CHILD_CAREER_DEFS.map(([label, k]) => ({ label, n: num(d[k]) })).filter(t => t.n != null && t.n > 0).map(t => ({ label: t.label, suffix: `${t.n}명` }))
  if (careerTags.length) groups.push({ heading: '교사 경력 분포', render: 'tags', tagVariant: 'custom', tags: careerTags })
  if (str(d.crspec)) groups.push({ heading: '특이사항', render: 'kv', rows: [{ label: '특이사항', value: str(d.crspec), kind: 'value' }] })
  return groups
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

// ── Group C builders (Task 4): aed, pharmacy, hospital ──────────────────────

function aedGroups(d: D): SpecGroup[] {
  const groups: SpecGroup[] = []
  const dayDefs = [
    { day: '월', s: d.monSttTme, e: d.monEndTme, i: 1 }, { day: '화', s: d.tueSttTme, e: d.tueEndTme, i: 2 },
    { day: '수', s: d.wedSttTme, e: d.wedEndTme, i: 3 }, { day: '목', s: d.thuSttTme, e: d.thuEndTme, i: 4 },
    { day: '금', s: d.friSttTme, e: d.friEndTme, i: 5 }, { day: '토', s: d.satSttTme, e: d.satEndTme, i: 6 },
    { day: '일', s: d.sunSttTme, e: d.sunEndTme, i: 0 }, { day: '공휴일', s: d.holSttTme, e: d.holEndTme, i: -1 },
  ]
  const rows: SpecWeeklyRow[] = dayDefs.map(({ day, s, e, i }) => {
    const st = fmtHm(s); const en = fmtHm(e)
    const allDay = st === '00:00' && en === '24:00'; const closed = !st && !en
    return { day, time: allDay ? '24시간' : closed ? '이용불가' : st && en ? `${st} ~ ${en}` : '정보없음', allDay, closed, todayIdx: i }
  })
  if (rows.some(r => !r.closed && r.time !== '정보없음')) groups.push({ heading: '요일별 이용시간', render: 'weekly', weekly: { timeHeader: '이용시간', rows } })
  groups.push({ heading: '설치 · 장비', render: 'kv', rows: [
    { label: '설치 위치', value: str(d.buildPlace), kind: 'value' },
    { label: '설치 기관', value: trimDashes(d.org), kind: 'value' },
    { label: '담당자 전화', value: formatPhone(d.clerkTel), kind: 'value' },
    { label: '제조사', value: str(d.mfg), kind: 'value' },
    { label: '모델명', value: str(d.model), kind: 'value' },
    { label: '자료 기준일', value: str(d.dataDate), kind: 'value' },
  ] })
  return groups
}

function pharmacyGroups(d: D): SpecGroup[] {
  const groups: SpecGroup[] = []
  const dayDefs = [
    { day: '월', s: d.dutyTime1s, e: d.dutyTime1c, i: 1 }, { day: '화', s: d.dutyTime2s, e: d.dutyTime2c, i: 2 },
    { day: '수', s: d.dutyTime3s, e: d.dutyTime3c, i: 3 }, { day: '목', s: d.dutyTime4s, e: d.dutyTime4c, i: 4 },
    { day: '금', s: d.dutyTime5s, e: d.dutyTime5c, i: 5 }, { day: '토', s: d.dutyTime6s, e: d.dutyTime6c, i: 6 },
    { day: '일', s: d.dutyTime7s, e: d.dutyTime7c, i: 0 }, { day: '공휴일', s: d.dutyTime8s, e: d.dutyTime8c, i: -1 },
  ]
  const rows: SpecWeeklyRow[] = dayDefs.map(({ day, s, e, i }) => {
    const st = fmtHm(s); const en = fmtHm(e); const time = st && en ? `${st} ~ ${en}` : null
    return { day, time: time ?? '휴무', closed: time === null, todayIdx: i }
  })
  if (rows.some(r => !r.closed)) {
    const notes = [
      ['접수(평일)', str(d.recpWeek)], ['접수(토)', str(d.recpSat)],
      ['일요일 안내', str(d.noTrmtSun)], ['공휴일 안내', str(d.noTrmtHoli)],
    ].filter(([, v]) => v != null).map(([l, v]) => `${l}: ${v}`)
    groups.push({ heading: '요일별 운영시간', render: 'weekly', weekly: { timeHeader: '운영시간', rows, notes } })
  }
  groups.push({ heading: '점심시간', render: 'kv', rows: [
    { label: '점심(평일)', value: str(d.lunchWeek), kind: 'value' },
    { label: '점심(토)', value: str(d.lunchSat), kind: 'value' },
  ] })
  groups.push({ heading: '약국 정보', render: 'kv', rows: [
    { label: '약사 수', value: num(d.pharmacistCnt), unit: '명', kind: 'value' },
    { label: '응급전화', value: formatPhone(d.dutyTel3), kind: 'value' },
    { label: '자료 기준일', value: str(d.dataDate), kind: 'value' },
  ] })
  const guideRows: SpecRow[] = [
    { label: '안내', value: str(d.dutyInf) }, { label: '기타', value: str(d.dutyEtc) },
  ].filter(r => r.value != null)
  if (guideRows.length) groups.push({ heading: '이용 안내', render: 'kv', rows: guideRows })
  return groups
}

const HOSPITAL_BED_DEFS: [string, string][] = [
  ['generalUpperBeds', '일반(상급)'], ['generalNormalBeds', '일반(일반)'], ['adultIcuBeds', '성인 중환자'],
  ['childIcuBeds', '소아 중환자'], ['neonatalIcuBeds', '신생아 중환자'], ['deliveryBeds', '분만실'],
  ['operatingBeds', '수술실'], ['emergencyBeds', '응급실'], ['physicalTherapyBeds', '물리치료실'],
  ['psychClosedUpper', '정신과 폐쇄(상급)'], ['psychClosedNormal', '정신과 폐쇄(일반)'],
  ['psychOpenUpper', '정신과 개방(상급)'], ['psychOpenNormal', '정신과 개방(일반)'],
  ['isolationBeds', '격리병실'], ['sterileBeds', '무균치료실'],
]
const HOSPITAL_DAYS: [string, string, string, number][] = [
  ['월', 'trmtMonStart', 'trmtMonEnd', 1], ['화', 'trmtTueStart', 'trmtTueEnd', 2],
  ['수', 'trmtWedStart', 'trmtWedEnd', 3], ['목', 'trmtThuStart', 'trmtThuEnd', 4],
  ['금', 'trmtFriStart', 'trmtFriEnd', 5], ['토', 'trmtSatStart', 'trmtSatEnd', 6],
  ['일', 'trmtSunStart', 'trmtSunEnd', 0],
]
function hospitalGroups(d: D): SpecGroup[] {
  const groups: SpecGroup[] = []
  const home = httpUrl(d.homepage)
  groups.push({ heading: '병원 정보', render: 'kv', rows: [
    { label: '종별', value: str(d.clCdNm), kind: 'value' },
    { label: '설립구분', value: str(d.foundationCdNm), kind: 'value' },
    { label: '간호등급', value: str(d.nurseGrade), unit: '등급', kind: 'value' },
    { label: '개설일자', value: formatYmd(d.estbDd), kind: 'value' },
    { label: '홈페이지', value: home, href: home ?? undefined, kind: 'value' },
  ] })
  const wRows: SpecWeeklyRow[] = HOSPITAL_DAYS.map(([day, sk, ek, i]) => {
    const s = fmtHm(d[sk]); const e = fmtHm(d[ek]); const closed = !s && !e
    const lunch = closed ? undefined : day === '토' ? (str(d.lunchSat) || str(d.lunchWeek) || undefined) : day === '일' ? undefined : (str(d.lunchWeek) || undefined)
    return { day, time: closed ? '휴진' : `${s} ~ ${e}`, lunch, closed, todayIdx: i }
  })
  wRows.push({ day: '공휴일', time: '휴진', closed: true, todayIdx: -1 })
  if (wRows.some(r => !r.closed)) {
    const notes: string[] = []
    if (str(d.noTrmtSun)) notes.push(`일요일 안내: ${d.noTrmtSun}`)
    if (str(d.noTrmtHoli)) notes.push(`공휴일 안내: ${d.noTrmtHoli}`)
    groups.push({ heading: '요일별 진료시간', render: 'weekly', weekly: { timeHeader: '진료시간', showLunch: true, rows: wRows, notes } })
  }
  const staff: SpecRow[] = [
    { label: '의사 총수', value: num(d.drTotCnt), unit: '명' }, { label: '간호사', value: num(d.pnursCnt), unit: '명' },
  ].filter(r => r.value != null)
  if (staff.length) groups.push({ heading: '의료진', render: 'kv', rows: staff })
  const docRows: SpecTable['rows'] = [
    { label: '의과', cells: [num(d.mdeptSdrCnt), num(d.mdeptGdrCnt), num(d.mdeptIntnCnt), num(d.mdeptResdntCnt)] },
    { label: '치과', cells: [num(d.detySdrCnt), num(d.detyGdrCnt), num(d.detyIntnCnt), num(d.detyResdntCnt)] },
    { label: '한방', cells: [num(d.cmdcSdrCnt), num(d.cmdcGdrCnt), num(d.cmdcIntnCnt), num(d.cmdcResdntCnt)] },
  ].filter(r => r.cells.some(c => c != null))
  if (docRows.length) groups.push({ heading: '진료영역별 의사', render: 'table', table: { columns: ['구분', '전문의', '일반의', '인턴', '레지던트'], rows: docRows } })
  const deptTags: SpecTag[] = arr(d.departments).map((x: any) => ({ label: str(x?.dgsbjtCdNm) ?? '', suffix: num(x?.dgsbjtPrSdrCnt) != null ? `${x.dgsbjtPrSdrCnt}명` : undefined })).filter(t => !!t.label) // eslint-disable-line @typescript-eslint/no-explicit-any
  if (deptTags.length) groups.push({ heading: '진료과목', render: 'tags', tagVariant: 'teal', tags: deptTags })
  const bedRows = HOSPITAL_BED_DEFS.map(([k, label]) => ({ label, value: num(d[k]), unit: '병상' })).filter(r => r.value != null && (r.value as number) > 0)
  if (bedRows.length) { const total = bedRows.reduce((s, r) => s + (r.value as number), 0); groups.push({ heading: `병상 정보 (총 ${total}병상)`, render: 'kv', rows: bedRows }) }
  const parkRows: SpecRow[] = []
  if (num(d.parkQty) != null) parkRows.push({ label: '주차가능대수', value: num(d.parkQty), unit: '대' })
  if (str(d.parkEtc)) parkRows.push({ label: '주차안내', value: str(d.parkEtc) })
  if (parkRows.length) groups.push({ heading: '주차정보', render: 'kv', rows: parkRows })
  return groups
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Task 5: ev-charger ────────────────────────────────────────────────────────
// 정적 필드만 담당. 실시간 충전 상태(chargers[]) 는 EvChargerDetail 라이브 컴포넌트가 처리.
function evChargerGroups(d: D): SpecGroup[] {
  const groups: SpecGroup[] = []

  // 운영 정보
  const limitVal = str(d.limitYn) === 'Y'
    ? (str(d.limitDetail) || '제한 있음')
    : str(d.limitYn) === 'N' ? '제한 없음' : null
  const opRows: SpecRow[] = [
    { label: '운영기관', value: str(d.busiNm), kind: 'value' },
    { label: '운영기관 연락처', value: formatPhone(d.busiCall), kind: 'value' },
    { label: '이용 가능 시간', value: str(d.useTime), kind: 'value' },
    { label: '주차', value: str(d.parkingFree) === 'Y' ? '무료' : str(d.parkingFree) === 'N' ? '유료' : null, kind: 'value' },
    { label: '이용 제한', value: limitVal, kind: 'value' },
    { label: '안내', value: trimDashes(d.note), kind: 'value' },
  ].filter(r => r.value != null)
  if (opRows.length) groups.push({ heading: '운영 정보', render: 'kv', rows: opRows })

  // 위치 상세
  const locRows: SpecRow[] = [
    { label: '상세 위치', value: str(d.addrDetail) || str(d.location), kind: 'value' },
    { label: '설치 연도', value: str(d.year), kind: 'value' },
  ].filter(r => r.value != null)
  if (locRows.length) groups.push({ heading: '위치 상세', render: 'kv', rows: locRows })

  return groups
}
// ─────────────────────────────────────────────────────────────────────────────

const REGISTRY: Partial<Record<FacilityCategory, (d: D) => SpecGroup[]>> = {
  toilet: toiletGroups,
  clothes: clothesGroups,
  wifi: wifiGroups,
  park: parkGroups,
  parking: parkingGroups,
  library: libraryGroups,
  sports: sportsGroups,
  market: marketGroups,
  school: schoolGroups,
  childcare: childcareGroups,
  pharmacy: pharmacyGroups,
  aed: aedGroups,
  hospital: hospitalGroups,
  'ev-charger': evChargerGroups,
}

export function buildSpecGroups(category: FacilityCategory, details: Record<string, unknown>): SpecGroup[] {
  const builder = REGISTRY[category]
  return builder ? builder(details ?? {}) : []
}
