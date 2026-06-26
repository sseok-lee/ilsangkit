import { describe, it, expect } from 'vitest'
import { buildSpecGroups } from '~/utils/facilitySpecGroups'

describe('buildSpecGroups — toilet (rich)', () => {
  const details = {
    maleToilets: 25, maleUrinals: 47, femaleToilets: 128,
    maleDisabledToilets: 2, femaleDisabledToilets: 1,
    maleChildToilets: 2, maleChildUrinals: 2, femaleChildToilets: 4,
    hasCCTV: true, hasEmergencyBell: true, emergencyBellLocation: '남자화장실+여자화장실',
    hasDiaperChangingTable: true, diaperChangingLocation: '여자화장실', hasDisabledToilet: true,
    facilityType: '개방화장실', ownershipType: '민간', sewageTreatment: '수세식',
    installDate: '199701', remodelingDate: '', managingOrg: '현대백화점 천호지점',
    phoneNumber: '0222258761', operatingHours: '10:30~20:00',
  }
  const groups = buildSpecGroups('toilet', details)

  it('변기 현황 표 group을 만든다', () => {
    const table = groups.find(g => g.render === 'table')
    expect(table).toBeTruthy()
    expect(table!.table!.columns).toEqual(['구분', '남성', '여성'])
    const daebyeon = table!.table!.rows.find(r => r.label === '대변기')
    expect(daebyeon!.cells).toEqual([25, 128])
  })

  it('안전·편의 flag 행을 만든다 (있는 것만 value 채움)', () => {
    const g = groups.find(g => g.heading === '안전 · 편의')!
    const cctv = g.rows!.find(r => r.label === 'CCTV')!
    expect(cctv.kind).toBe('flag')
    expect(cctv.value).toBe('설치됨')
    const bell = g.rows!.find(r => r.label === '비상벨')!
    expect(bell.value).toContain('남자화장실+여자화장실')
  })

  it('운영·관리는 value 행(빈 값도 행 유지: 개보수 시기)', () => {
    const g = groups.find(g => g.heading === '운영 · 관리')!
    const remodel = g.rows!.find(r => r.label === '개보수 시기')!
    expect(remodel.kind).toBe('value')
    expect(remodel.value === '' || remodel.value == null).toBe(true)
  })
})

describe('buildSpecGroups — clothes (thin, 있는 만큼만)', () => {
  it('값 있는 행만 포함, 강제 정보없음 없음', () => {
    const groups = buildSpecGroups('clothes', {
      detailLocation: '가로등 옆', managementAgency: '서울특별시 서초구청',
      phoneNumber: '02-2155-6742', providerName: '서울특별시 서초구', dataDate: '2025-02-18',
    })
    const rows = groups.flatMap(g => g.rows ?? [])
    expect(rows.find(r => r.label === '설치 위치')!.value).toBe('가로등 옆')
    expect(rows.every(r => r.value !== null && r.value !== undefined && r.value !== '')).toBe(true)
  })

  it('필드 없으면 해당 행 자체가 없다', () => {
    const groups = buildSpecGroups('clothes', { detailLocation: '도로변' })
    const labels = groups.flatMap(g => g.rows ?? []).map(r => r.label)
    expect(labels).toContain('설치 위치')
    expect(labels).not.toContain('연락처')
  })
})
