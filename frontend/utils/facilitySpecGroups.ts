import type { FacilityCategory } from '~/types/facility'

export interface SpecRow {
  label: string
  value: string | number | null | undefined
  unit?: string
  /** 'value' = 빈 값도 행 유지(컴포넌트가 '정보 없음'). 'flag' = 값 없으면 행 생략. */
  kind?: 'value' | 'flag'
}
export interface SpecTable {
  columns: string[]
  rows: Array<{ label: string; cells: Array<string | number | null> }>
}
export interface SpecGroup {
  heading?: string
  render: 'kv' | 'table'
  rows?: SpecRow[]
  table?: SpecTable
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
}

export function buildSpecGroups(category: FacilityCategory, details: Record<string, unknown>): SpecGroup[] {
  const builder = REGISTRY[category]
  return builder ? builder(details ?? {}) : []
}
