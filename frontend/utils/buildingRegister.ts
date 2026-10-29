import type { BuildingRegisterInfo } from '~/types/housingRedesign'

// 부동산 상세 "단지/건물 정보"(건축물대장) 표시 문구. K-apt 단지 정보가 없을 때만 쓴다.
// 값이 없는 항목은 빼고, 승강기 0 은 "없음"으로 보여 준다.

const count = (n: number) => n.toLocaleString('ko-KR')
const joinParts = (parts: Array<string | null>) => parts.filter((part): part is string => !!part).join(' · ')
const multiDong = (r: BuildingRegisterInfo) => (r.dongCount ?? 0) >= 2

/** 동이 2개 이상이면 단지, 아니면 건물 */
export function registerSectionTitle(r: BuildingRegisterInfo): '단지 정보' | '건물 정보' {
  return multiDong(r) ? '단지 정보' : '건물 정보'
}

/** "216세대" / "오피스텔 471호" */
export function registerUnitsText(r: BuildingRegisterInfo): string | null {
  if (r.kind === 'offitel') return r.offitelUnitCount != null ? `오피스텔 ${count(r.offitelUnitCount)}호` : null
  return r.householdCount != null ? `${count(r.householdCount)}세대` : null
}

export function registerApprovalYear(r: BuildingRegisterInfo): number | null {
  const m = /^(\d{4})-\d{2}-\d{2}$/.exec(r.useApprovalDate ?? '')
  return m ? Number(m[1]) : null
}

/** 헤더 요약 줄: "216세대 · 9개 동 · 최고 4층 · 1994년 사용승인" (동 1개면 동 항목 생략) */
export function buildRegisterFactsLine(r: BuildingRegisterInfo): string {
  const year = registerApprovalYear(r)
  return joinParts([
    registerUnitsText(r),
    multiDong(r) ? `${count(r.dongCount!)}개 동` : null,
    r.topFloor != null ? `최고 ${r.topFloor}층` : null,
    year != null ? `${year}년 사용승인` : null,
  ])
}

function approvalValue(r: BuildingRegisterInfo, today: Date): string | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(r.useApprovalDate ?? '')
  if (!m) return null
  const year = Number(m[1])
  return `${year}년 ${Number(m[2])}월 (${today.getFullYear() - year + 1}년차)`
}

function parkingValue(r: BuildingRegisterInfo): string | null {
  if (r.totalParking == null) return null
  const units = r.kind === 'offitel' ? r.offitelUnitCount : r.householdCount
  const per = units ? ` · ${r.kind === 'offitel' ? '호당' : '세대당'} ${(r.totalParking / units).toFixed(2)}대` : ''
  return `${count(r.totalParking)}면${per}`
}

/** "단지/건물 정보" 표. 값이 하나도 없는 줄은 뺀다. */
export function buildRegisterInfoRows(r: BuildingRegisterInfo, today: Date): Array<{ label: string; value: string }> {
  const unitsLabel = r.kind === 'offitel' ? '호수' : '세대수'
  const rows: Array<[string, string | null]> = [
    [multiDong(r) ? `${unitsLabel} · 동수` : unitsLabel, joinParts([
      registerUnitsText(r),
      multiDong(r) ? `${count(r.dongCount!)}개 동` : null,
    ])],
    ['층수', joinParts([
      r.topFloor != null ? `최고 ${r.topFloor}층` : null,
      r.basementFloors == null ? null : r.basementFloors === 0 ? '지하 없음' : `지하 ${r.basementFloors}층`,
    ])],
    ['사용승인', approvalValue(r, today)],
    ['주차', parkingValue(r)],
    ['승강기', r.elevatorCount == null ? null : r.elevatorCount === 0 ? '없음' : `${count(r.elevatorCount)}대`],
    ['용도 · 구조', joinParts([r.purposes.length > 0 ? r.purposes.join(', ') : null, r.structure])],
  ]
  return rows.filter((row): row is [string, string] => !!row[1]).map(([label, value]) => ({ label, value }))
}

/** '2026-09' → '2026년 9월' */
export function formatRegisterMonth(month: string | null): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month ?? '')
  return m ? `${m[1]}년 ${Number(m[2])}월` : null
}
