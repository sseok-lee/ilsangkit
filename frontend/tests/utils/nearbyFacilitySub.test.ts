import { describe, it, expect } from 'vitest'
import { shortAddress, formatDutyTime, nearbyFacilitySub } from '~/utils/nearbyFacilitySub'
import type { Facility, FacilityCategory } from '~/types/facility'

function f(category: FacilityCategory, extras: Record<string, unknown> = {}, addr: Partial<Facility> = {}): Facility {
  return {
    id: 'x', name: '시설', category,
    address: '경기도 화성시 병점동 1-1', roadAddress: '경기도 화성시 병점노을4로 29, 1층 101~102호 (병점동)',
    lat: 37.2, lng: 127.0, city: '경기도', district: '화성시', extras, ...addr,
  }
}

describe('shortAddress', () => {
  it('시/도·시/군/구 접두, 괄호, 첫 쉼표 뒤를 뺀 도로명+번호', () => {
    expect(shortAddress('경기도 화성시 병점노을4로 29, 1층 101~102호 (병점동)')).toBe('병점노을4로 29')
    expect(shortAddress('경기도 화성시 병점구 병점노을4로 5, 304~305,508~509호 (병점동)')).toBe('병점노을4로 5')
    expect(shortAddress('서울특별시 서초구 강남대로 375, 2층 212,213,215호 (서초동, 서초현대타워아파트)')).toBe('강남대로 375')
    expect(shortAddress('서울 강남구 테헤란로 123')).toBe('테헤란로 123')
    expect(shortAddress('세종특별자치시 한누리대로 2130 (보람동)')).toBe('한누리대로 2130')
  })

  it('지번 주소도 같은 규칙', () => {
    expect(shortAddress('경기도 화성시 병점동 1-1')).toBe('병점동 1-1')
  })

  it('비었으면 빈 문자열', () => {
    expect(shortAddress(null)).toBe('')
    expect(shortAddress('  ')).toBe('')
  })
})

describe('formatDutyTime', () => {
  it('HHMM → HH:MM, 세 자리는 앞에 0', () => {
    expect(formatDutyTime('900')).toBe('09:00')
    expect(formatDutyTime(1830)).toBe('18:30')
  })
})

describe('nearbyFacilitySub — 짧은 주소 + 핵심 정보 최대 2개', () => {
  it('roadAddress 우선, 없으면 address', () => {
    expect(nearbyFacilitySub(f('park'))).toBe('병점노을4로 29')
    expect(nearbyFacilitySub(f('park', {}, { roadAddress: null }))).toBe('병점동 1-1')
  })

  it('주소가 없으면 정보만, 둘 다 없으면 빈 문자열', () => {
    expect(nearbyFacilitySub(f('park', { parkType: '근린공원' }, { roadAddress: null, address: null }))).toBe('근린공원')
    expect(nearbyFacilitySub(f('park', {}, { roadAddress: null, address: null }))).toBe('')
  })

  it('toilet: 개방 시간, 장애인화장실', () => {
    expect(nearbyFacilitySub(f('toilet', { operatingHours: '09:00~18:00', hasDisabledToilet: true })))
      .toBe('병점노을4로 29 · 개방 09:00~18:00 · 장애인화장실')
    expect(nearbyFacilitySub(f('toilet', { operatingHours: '', hasDisabledToilet: false }))).toBe('병점노을4로 29')
  })

  it('wifi: 설치 위치', () => {
    expect(nearbyFacilitySub(f('wifi', { installLocation: '1층 로비' }))).toBe('병점노을4로 29 · 1층 로비')
  })

  it('clothes: 상세 위치', () => {
    expect(nearbyFacilitySub(f('clothes', { detailLocation: '아파트 정문 앞' }))).toBe('병점노을4로 29 · 아파트 정문 앞')
  })

  it('parking: 무료 또는 기본요금~, 면수', () => {
    expect(nearbyFacilitySub(f('parking', { feeType: '무료', capacity: 30 }))).toBe('병점노을4로 29 · 무료 · 30면')
    expect(nearbyFacilitySub(f('parking', { feeType: '유료', baseFee: 1000, capacity: 1200 }))).toBe('병점노을4로 29 · 1,000원~ · 1,200면')
    expect(nearbyFacilitySub(f('parking', { feeType: '유료', capacity: 0 }))).toBe('병점노을4로 29')
  })

  it('aed: 주소 대신 설치 위치·설치 기관(설치 위치 우선)', () => {
    expect(nearbyFacilitySub(f('aed', { buildPlace: '1층 로비', org: '화성시청' }))).toBe('1층 로비 · 화성시청')
    expect(nearbyFacilitySub(f('aed', { org: '화성시청' }))).toBe('화성시청')
    expect(nearbyFacilitySub(f('aed', {}))).toBe('병점노을4로 29')
  })

  it('library: 평일 운영 시간, 좌석', () => {
    expect(nearbyFacilitySub(f('library', { weekdayOpenTime: '09:00', weekdayCloseTime: '22:00', seatCount: 224 })))
      .toBe('병점노을4로 29 · 평일 09:00~22:00 · 224석')
  })

  it('hospital: 종별, 의사 수', () => {
    expect(nearbyFacilitySub(f('hospital', { clCdNm: '의원', drTotCnt: 2 }))).toBe('병점노을4로 29 · 의원 · 의사 2명')
  })

  it('pharmacy: 평일 HH:MM~HH:MM', () => {
    expect(nearbyFacilitySub(f('pharmacy', { dutyTime1s: '900', dutyTime1c: '1800' }))).toBe('병점노을4로 29 · 평일 09:00~18:00')
    expect(nearbyFacilitySub(f('pharmacy', { dutyTime1s: '900' }))).toBe('병점노을4로 29')
  })

  it('park: 공원 유형', () => {
    expect(nearbyFacilitySub(f('park', { parkType: '어린이공원' }))).toBe('병점노을4로 29 · 어린이공원')
  })

  it('school: 학교급, 공학 구분', () => {
    expect(nearbyFacilitySub(f('school', { schoolLevel: '초등학교', coeducationType: '남여공학' })))
      .toBe('병점노을4로 29 · 초등학교 · 남여공학')
  })

  it('market: 시장 유형, 점포 수', () => {
    expect(nearbyFacilitySub(f('market', { marketType: '상설장', storeCount: 35 }))).toBe('병점노을4로 29 · 상설장 · 점포 35개')
  })

  it('childcare: 유형, 정원', () => {
    expect(nearbyFacilitySub(f('childcare', { crtypename: '가정', crcapat: 20 }))).toBe('병점노을4로 29 · 가정 · 정원 20명')
  })

  it('ev-charger: 급속·완속 대수(0대는 생략)', () => {
    expect(nearbyFacilitySub(f('ev-charger', { rapidCount: 2, slowCount: 4 }))).toBe('병점노을4로 29 · 급속 2대 · 완속 4대')
    expect(nearbyFacilitySub(f('ev-charger', { rapidCount: 0, slowCount: 5 }))).toBe('병점노을4로 29 · 완속 5대')
  })

  it('sports: 시설 유형', () => {
    expect(nearbyFacilitySub(f('sports', { ftypeNm: '체육관' }))).toBe('병점노을4로 29 · 체육관')
  })
})
