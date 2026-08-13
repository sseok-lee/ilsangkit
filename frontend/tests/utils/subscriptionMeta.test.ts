import { describe, it, expect } from 'vitest'
import { RENT_TYPES, RENT_GROUP_META, subscriptionTypeBadge, PUBLIC_RENT_TYPES, buildSubscriptionSeoTitle } from '~/utils/subscriptionMeta'

describe('subscriptionMeta descriptions', () => {
  it('RENT_TYPES 공공임대·민간임대 description이 50자 이상이다', () => {
    expect(RENT_TYPES.public.description.length).toBeGreaterThanOrEqual(50)
    expect(RENT_TYPES.private.description.length).toBeGreaterThanOrEqual(50)
  })

  it('RENT_GROUP_META description이 50자 이상이다', () => {
    Object.values(RENT_GROUP_META).forEach(meta => {
      expect(meta.description.length).toBeGreaterThanOrEqual(50)
    })
  })
})

describe('subscriptionTypeBadge', () => {
  it('APT 분양(rentType null)은 아파트(인디고)', () => {
    const b = subscriptionTypeBadge('APT', null)
    expect(b.label).toBe('아파트')
    expect(b.kind).toBe('sale')
    expect(b.classes).toContain('indigo')
  })

  it('OFFITEL은 오피스텔(틸)', () => {
    const b = subscriptionTypeBadge('OFFITEL', null)
    expect(b.label).toBe('오피스텔')
    expect(b.classes).toContain('teal')
  })

  it('REMAINING은 무순위·잔여(오렌지)', () => {
    const b = subscriptionTypeBadge('REMAINING', null)
    expect(b.label).toBe('무순위·잔여')
    expect(b.classes).toContain('orange')
  })

  it('OPTIONAL은 임의공급(퍼플)', () => {
    const b = subscriptionTypeBadge('OPTIONAL', null)
    expect(b.label).toBe('임의공급')
    expect(b.classes).toContain('fuchsia')
  })

  it('APT + 공공임대 rentType은 공공임대(회색, rent)', () => {
    const b = subscriptionTypeBadge('APT', PUBLIC_RENT_TYPES[0])
    expect(b.label).toBe('공공임대')
    expect(b.kind).toBe('rent')
    expect(b.classes).toContain('slate')
  })

  it('PRIVATE_RENT는 민간임대(회색, rent)', () => {
    const b = subscriptionTypeBadge('PRIVATE_RENT', null)
    expect(b.label).toBe('민간임대')
    expect(b.kind).toBe('rent')
    expect(b.classes).toContain('slate')
  })
})

describe('buildSubscriptionSeoTitle — 회차별 공고 구분', () => {
  // 같은 단지가 회차별로 여러 번 공고를 낸다. title 이 단지명뿐이면 겹친다 —
  // 프로덕션 5,671건 중 1,405건(24.8%)이 그랬다.
  // 예: 성산 삼정그린코아 웰레스트 16회, 서울은평뉴타운 디에트르 더 퍼스트 29회.
  it('접수 연월을 넣어 같은 단지의 다른 회차를 구분한다', () => {
    const a = buildSubscriptionSeoTitle({ houseName: '성산 삼정그린코아 웰레스트', receptionStartDate: '2023-06-19T00:00:00.000Z' })
    const b = buildSubscriptionSeoTitle({ houseName: '성산 삼정그린코아 웰레스트', receptionStartDate: '2023-08-21T00:00:00.000Z' })
    expect(a).toBe('성산 삼정그린코아 웰레스트 2023년 6월 접수 청약 일정·경쟁률')
    expect(b).toBe('성산 삼정그린코아 웰레스트 2023년 8월 접수 청약 일정·경쟁률')
    expect(a).not.toBe(b)
  })

  it('UTC 자정 값이 한국시간으로 하루 밀려 다른 달이 되지 않는다', () => {
    // 접수일은 날짜(시각 없음)로 들어오는데 UTC 자정으로 직렬화된다.
    // toLocaleString('ko-KR') 류로 KST 변환하면 2023-07-01 → 2023년 7월이 아니라
    // 6월 30일 09:00 로 밀릴 수 있다. 월 경계에서 회차가 어긋나면 안 된다.
    expect(buildSubscriptionSeoTitle({ houseName: 'X', receptionStartDate: '2023-07-01T00:00:00.000Z' }))
      .toContain('2023년 7월')
    expect(buildSubscriptionSeoTitle({ houseName: 'X', receptionStartDate: '2023-12-31T00:00:00.000Z' }))
      .toContain('2023년 12월')
  })

  it('한 자리 월은 0 을 붙이지 않는다', () => {
    expect(buildSubscriptionSeoTitle({ houseName: 'X', receptionStartDate: '2024-03-05T00:00:00.000Z' }))
      .toContain('2024년 3월')
  })

  it('접수일이 없으면 종전 제목을 그대로 쓴다 — 없는 날짜를 지어내지 않는다', () => {
    expect(buildSubscriptionSeoTitle({ houseName: '어느 단지', receptionStartDate: null }))
      .toBe('어느 단지 청약 일정·경쟁률')
    expect(buildSubscriptionSeoTitle({ houseName: '어느 단지', receptionStartDate: undefined }))
      .toBe('어느 단지 청약 일정·경쟁률')
    expect(buildSubscriptionSeoTitle({ houseName: '어느 단지', receptionStartDate: '' }))
      .toBe('어느 단지 청약 일정·경쟁률')
  })

  it('날짜가 깨져 있으면 접수 문구를 붙이지 않는다', () => {
    expect(buildSubscriptionSeoTitle({ houseName: '어느 단지', receptionStartDate: 'not-a-date' }))
      .toBe('어느 단지 청약 일정·경쟁률')
  })

  it('단지명이 없으면 사이트 기본 제목으로 떨어지지 않게 빈 문자열을 반환한다', () => {
    // 빈 title 은 setMeta 가 사이트 기본값으로 대체한다. 여기서 "청약 일정" 같은
    // 공용 문구를 만들어내면 5,000건이 같은 제목으로 나갔던 그 상황이 재현된다.
    expect(buildSubscriptionSeoTitle({ houseName: '', receptionStartDate: '2024-01-01T00:00:00.000Z' })).toBe('')
  })

  it('Date 객체로 들어와도 동작한다', () => {
    expect(buildSubscriptionSeoTitle({ houseName: 'X', receptionStartDate: new Date('2025-11-03T00:00:00.000Z') }))
      .toContain('2025년 11월')
  })
})
