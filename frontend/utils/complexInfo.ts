import type { ComplexInfo } from '~/types/housingRedesign'

// 부동산 상세 "단지 정보"(K-apt) 표시 문구. 값이 없는 항목은 빼고, 0 은 그대로 보여 준다.

const count = (n: number) => n.toLocaleString('ko-KR')
const joinParts = (parts: Array<string | null>) => parts.filter((part): part is string => !!part).join(' · ')

export function approvalYear(c: ComplexInfo): number | null {
  const m = /^(\d{4})-\d{2}-\d{2}$/.exec(c.useApprovalDate ?? '')
  return m ? Number(m[1]) : null
}

/** 헤더 요약 줄: "678세대 · 9개 동 · 최고 15층 · 1984년 사용승인" */
export function buildComplexFactsLine(c: ComplexInfo): string {
  const year = approvalYear(c)
  return joinParts([
    c.householdCount != null ? `${count(c.householdCount)}세대` : null,
    c.dongCount != null ? `${count(c.dongCount)}개 동` : null,
    c.topFloor != null ? `최고 ${c.topFloor}층` : null,
    year != null ? `${year}년 사용승인` : null,
  ])
}

function parkingValue(c: ComplexInfo): string | null {
  if (c.totalParking == null) return null
  const perHousehold = c.householdCount ? ` · 세대당 ${(c.totalParking / c.householdCount).toFixed(2)}대` : ''
  const split = c.groundParking != null || c.undergroundParking != null
    ? ` (${joinParts([
      c.groundParking != null ? `지상 ${count(c.groundParking)}` : null,
      c.undergroundParking != null ? `지하 ${count(c.undergroundParking)}` : null,
    ])})`
    : ''
  return `${count(c.totalParking)}면${perHousehold}${split}`
}

function approvalValue(c: ComplexInfo, today: Date): string | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(c.useApprovalDate ?? '')
  if (!m) return null
  const year = Number(m[1])
  return `${year}년 ${Number(m[2])}월 (${today.getFullYear() - year + 1}년차)`
}

/** "단지 정보" 표. 스펙 순서 9줄, 값이 하나도 없는 줄은 뺀다. */
export function buildComplexInfoRows(c: ComplexInfo, today: Date): Array<{ label: string; value: string }> {
  const bothCounted = c.elevatorCount != null && c.cctvCount != null
  const rows: Array<[string, string | null]> = [
    ['세대수 · 동수', joinParts([
      c.householdCount != null ? `${count(c.householdCount)}세대` : null,
      c.dongCount != null ? `${count(c.dongCount)}개 동` : null,
    ])],
    ['층수', joinParts([
      c.topFloor != null ? `최고 ${c.topFloor}층` : null,
      c.basementFloors == null ? null : c.basementFloors === 0 ? '지하 없음' : `지하 ${c.basementFloors}층`,
    ])],
    ['사용승인', approvalValue(c, today)],
    ['주차', parkingValue(c)],
    ['난방 · 복도', joinParts([c.heatingType, c.corridorType])],
    ['시공 · 시행', c.builder && c.builder === c.developer ? c.builder : joinParts([c.builder, c.developer])],
    ['관리 · 분양', joinParts([c.managementType, c.saleType])],
    ['승강기 · CCTV', joinParts([
      c.elevatorCount != null ? `${bothCounted ? '' : '승강기 '}${count(c.elevatorCount)}대` : null,
      c.cctvCount != null ? `${bothCounted ? '' : 'CCTV '}${count(c.cctvCount)}대` : null,
    ])],
    ['전기차 충전', c.evChargerCount != null ? `${count(c.evChargerCount)}기` : null],
  ]
  return rows.filter((row): row is [string, string] => !!row[1]).map(([label, value]) => ({ label, value }))
}

export interface ComplexAreaGroup {
  label: string
  householdCount: number
  /** 가장 큰 묶음 대비 0~1 */
  ratio: number
}

const MAX_AREA_GROUPS = 8

function groupByWidth(areas: ComplexInfo['areas'], width: number) {
  const groups: Array<{ from: number; to: number; householdCount: number }> = []
  for (const area of areas) {
    const rounded = Math.round(area.exclusiveArea)
    const last = groups[groups.length - 1]
    if (last && rounded - last.from <= width) {
      last.to = rounded
      last.householdCount += area.householdCount
    } else {
      groups.push({ from: rounded, to: rounded, householdCount: area.householdCount })
    }
  }
  return groups
}

/** 면적별 세대수 막대: 반올림 전용면적이 묶음 시작값과 5㎡ 이내면 합치고, 8묶음을 넘으면 10㎡ 로 다시 묶는다. */
export function groupComplexAreas(areas: ComplexInfo['areas']): ComplexAreaGroup[] {
  const sorted = areas.filter((a) => a.householdCount > 0).sort((a, b) => a.exclusiveArea - b.exclusiveArea)
  let groups = groupByWidth(sorted, 5)
  if (groups.length > MAX_AREA_GROUPS) groups = groupByWidth(sorted, 10)
  const max = Math.max(0, ...groups.map((g) => g.householdCount))
  return groups.map((g) => ({
    label: g.from === g.to ? `${g.from}㎡` : `${g.from}~${g.to}㎡`,
    householdCount: g.householdCount,
    ratio: max > 0 ? g.householdCount / max : 0,
  }))
}
