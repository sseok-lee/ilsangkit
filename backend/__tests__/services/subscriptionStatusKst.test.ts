import { describe, it, expect } from 'vitest';
import { computeSubscriptionStatus, dateBasedStatusFilter } from '../../src/services/subscriptionService.js';

/**
 * 접수일은 "시각 없는 날짜"다. syncSubscription.parseDate 가 'YYYY-MM-DD' 를
 * new Date() 에 넘기고, 명세상 date-only ISO 는 UTC 로 파싱되므로
 * KST 달력 날짜가 UTC 자정으로 저장된다(프로덕션 5,671건 전부 시각부 00:00:00).
 *
 * 그 값을 "시각"으로 비교하면 KST 하루와 어긋난다. 2026-08-13 접수 마감인 공고가
 * 같은 날 오전 9시(KST)=00:00Z 부터 closed 로 뒤집혔다 — 프로덕션 표본 100건 중
 * 5건이 실제로 그 상태였다.
 */
const D = (iso: string) => new Date(iso);

describe('computeSubscriptionStatus — KST 달력 하루 기준', () => {
  it('접수 마지막 날 오후(KST)에도 ongoing 이다', () => {
    // 2026-08-13 18:00 KST = 09:00Z. 마감일이 오늘이므로 아직 접수 중이다.
    expect(computeSubscriptionStatus(
      D('2026-08-13T00:00:00.000Z'), D('2026-08-13T00:00:00.000Z'), D('2026-08-13T09:00:00.000Z'),
    )).toBe('ongoing');
  });

  it('접수 마지막 날 밤 23:59(KST)에도 ongoing 이다', () => {
    // 2026-08-13 23:59 KST = 14:59Z
    expect(computeSubscriptionStatus(
      D('2026-08-12T00:00:00.000Z'), D('2026-08-13T00:00:00.000Z'), D('2026-08-13T14:59:00.000Z'),
    )).toBe('ongoing');
  });

  it('접수 종료 다음 날(KST)에는 closed 다', () => {
    // 2026-08-14 00:30 KST = 2026-08-13T15:30Z
    expect(computeSubscriptionStatus(
      D('2026-08-12T00:00:00.000Z'), D('2026-08-13T00:00:00.000Z'), D('2026-08-13T15:30:00.000Z'),
    )).toBe('closed');
  });

  it('접수 첫날 오전(KST)에 upcoming 이 아니라 ongoing 이다', () => {
    // 2026-08-13 08:00 KST = 2026-08-12T23:00Z — KST 로는 이미 접수 시작일이다.
    expect(computeSubscriptionStatus(
      D('2026-08-13T00:00:00.000Z'), D('2026-08-15T00:00:00.000Z'), D('2026-08-12T23:00:00.000Z'),
    )).toBe('ongoing');
  });

  it('접수 시작 전날(KST)에는 upcoming 이다', () => {
    // 2026-08-12 23:00 KST = 2026-08-12T14:00Z
    expect(computeSubscriptionStatus(
      D('2026-08-13T00:00:00.000Z'), D('2026-08-15T00:00:00.000Z'), D('2026-08-12T14:00:00.000Z'),
    )).toBe('upcoming');
  });

  it('종료일이 없으면 시작만 지났으면 ongoing 이다', () => {
    expect(computeSubscriptionStatus(
      D('2026-08-13T00:00:00.000Z'), null, D('2026-08-13T09:00:00.000Z'),
    )).toBe('ongoing');
  });

  it('시작일이 없으면 closed 다', () => {
    expect(computeSubscriptionStatus(null, D('2026-08-13T00:00:00.000Z'), D('2026-08-13T09:00:00.000Z')))
      .toBe('closed');
  });
});

describe('dateBasedStatusFilter — 목록 필터도 같은 경계를 쓴다', () => {
  // 상세는 재계산하고 목록은 SQL 로 거른다. 둘이 다른 경계를 쓰면
  // "목록에선 마감인데 상세는 접수중" 같은 어긋남이 난다.
  const now = D('2026-08-13T09:00:00.000Z'); // 2026-08-13 18:00 KST
  const KST_TODAY = D('2026-08-13T00:00:00.000Z');

  it('ongoing 은 KST 오늘 자정 기준으로 경계를 잡는다', () => {
    const f = dateBasedStatusFilter('ongoing', now) as {
      AND: [{ receptionStartDate: { lte: Date } }, { OR: [unknown, { receptionEndDate: { gte: Date } }] }]
    };
    expect(f.AND[0].receptionStartDate.lte).toEqual(KST_TODAY);
    expect((f.AND[1].OR[1] as { receptionEndDate: { gte: Date } }).receptionEndDate.gte).toEqual(KST_TODAY);
  });

  it('upcoming 은 KST 오늘보다 뒤인 것만 잡는다', () => {
    const f = dateBasedStatusFilter('upcoming', now) as { receptionStartDate: { gt: Date } };
    expect(f.receptionStartDate.gt).toEqual(KST_TODAY);
  });

  it('closed 는 KST 오늘보다 앞선 종료만 잡는다', () => {
    const f = dateBasedStatusFilter('closed', now) as { OR: [unknown, { receptionEndDate: { lt: Date } }] };
    expect((f.OR[1] as { receptionEndDate: { lt: Date } }).receptionEndDate.lt).toEqual(KST_TODAY);
  });

  it('KST 자정 직후(전날 15:00Z 직후)에도 그날 날짜를 쓴다', () => {
    // 2026-08-14 00:10 KST = 2026-08-13T15:10Z → KST 로는 8/14
    const f = dateBasedStatusFilter('upcoming', D('2026-08-13T15:10:00.000Z')) as {
      receptionStartDate: { gt: Date }
    };
    expect(f.receptionStartDate.gt).toEqual(D('2026-08-14T00:00:00.000Z'));
  });
});
