// adoptRegionReform 마이그레이션 스크립트 — 순수함수 테스트 (TDD, hermetic).
//
// ⚠️ 이 테스트는 외부 의존(실 DB / 실 API 키)이 0이어야 한다.
//   (Phase A A3 테스트가 CI에서 실DB/실키 의존으로 터진 교훈)
//   - prisma는 vi.mock으로 완전 차단(모듈 최상위 import의 PrismaClient 생성 방지).
//   - planCityNormalization / computeNormalizationPlan / reencodeSourceId 는 순수함수라
//     DB·네트워크·env를 전혀 건드리지 않는다.
//   검증: env -u DATABASE_URL -u KAKAO_REST_API_KEY -u OPENAPI_SERVICE_KEY npx vitest run 통과.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// prisma 모듈을 무력화 — apply 실행부가 import하는 PrismaClient 생성/연결을 차단한다.
// 아래 실행부(processTable/applyCityOnlyWithConflictSkip) 테스트는 이 동일 객체에
// $queryRawUnsafe/$executeRawUnsafe 를 vi.fn 으로 주입해 라우팅한다(실 DB 의존 0).
vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {},
}));

import {
  planCityNormalization,
  computeNormalizationPlan,
  reencodeSourceId,
  splitDedup,
  countDedupDefeatRisk,
  isDuplicateKeyError,
  applyCityOnlyWithConflictSkip,
  processTable,
  REGION12_LOOKUP,
  SOURCEID_BJD_TABLES,
  type ReformRow,
  type ReformPlanItem,
} from '../../src/scripts/adoptRegionReform.js';
import { JNGJ_CITY, JNGJ_DISTRICTS } from '../../src/lib/normalizeRegionName.js';
import { prisma } from '../../src/lib/prisma.js';

// mock prisma 핸들을 라우팅 가능한 형태로 캐스팅.
const mockPrisma = prisma as unknown as {
  $queryRawUnsafe: ReturnType<typeof vi.fn>;
  $executeRawUnsafe: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  // 각 테스트가 자체 라우팅을 주입. 기본은 빈 결과 / no-op.
  mockPrisma.$queryRawUnsafe = vi.fn(async () => []);
  mockPrisma.$executeRawUnsafe = vi.fn(async () => 0);
});

describe('REGION12_LOOKUP (정본 매핑 — 시작 시 27쌍 완비 assert 대상)', () => {
  it('정확히 27쌍이며 JNGJ_DISTRICTS 전부를 12xxx로 커버한다', () => {
    expect(REGION12_LOOKUP.size).toBe(27);
    expect(JNGJ_DISTRICTS.size).toBe(27);
    for (const d of JNGJ_DISTRICTS) {
      const code = REGION12_LOOKUP.get(d);
      expect(code, `district ${d} 매핑 누락`).toBeDefined();
      expect(code!.startsWith('12'), `district ${d} → ${code} (12 접두 아님)`).toBe(true);
      expect(code!).toHaveLength(5);
    }
    // 역방향: lookup의 모든 키가 JNGJ_DISTRICTS에 존재 (오탈자 방지)
    for (const key of REGION12_LOOKUP.keys()) {
      expect(JNGJ_DISTRICTS.has(key), `lookup 키 ${key} 가 JNGJ_DISTRICTS에 없음`).toBe(true);
    }
  });

  it('정본 매핑 표본값 (region12-mapping.md 실측)', () => {
    expect(REGION12_LOOKUP.get('동구')).toBe('12210');
    expect(REGION12_LOOKUP.get('목포시')).toBe('12110');
    expect(REGION12_LOOKUP.get('북구')).toBe('12300');
    expect(REGION12_LOOKUP.get('신안군')).toBe('12870');
    expect(REGION12_LOOKUP.get('광산구')).toBe('12330');
  });
});

describe('reencodeSourceId (옛 bjdCode 토큰 전체 → 신 bjdCode 치환)', () => {
  it('2번째 토큰(bjdCode)만 전체 치환한다 (단순 접두치환 아님)', () => {
    expect(reencodeSourceId('aptSale-29140-2015-2024-3-15-10-84.5-50000', '29140', '12210')).toBe(
      'aptSale-12210-2015-2024-3-15-10-84.5-50000'
    );
  });

  it('전남(46) 코드도 전체 치환', () => {
    expect(reencodeSourceId('offitelRent-46110-2018-2024-5-20-7-59.8-1000-30', '46110', '12110')).toBe(
      'offitelRent-12110-2018-2024-5-20-7-59.8-1000-30'
    );
  });

  it('land sourceId(가변 토큰: dongName 포함)에서도 bjdCode 토큰만 치환', () => {
    expect(reencodeSourceId('landSale-29200-충장동-12-2024-3-15-100-500000000', '29200', '12210')).toBe(
      'landSale-12210-충장동-12-2024-3-15-100-500000000'
    );
  });

  it('oldBjd 토큰이 없으면 원본 그대로 반환 (오검출 방지)', () => {
    expect(reencodeSourceId('aptSale-11110-2015-2024-3-15-10-84.5-50000', '29140', '12210')).toBe(
      'aptSale-11110-2015-2024-3-15-10-84.5-50000'
    );
  });

  it('oldBjd === newBjd 이면 원본 그대로', () => {
    expect(reencodeSourceId('aptSale-12210-2015', '12210', '12210')).toBe('aptSale-12210-2015');
  });
});

describe('planCityNormalization — 브리프 4+ 케이스', () => {
  const lookup = REGION12_LOOKUP;

  it('(a) 거래 재코딩: AptSaleTransaction 29140/광주/동구 → JNGJ + 12210 + sourceId 치환', () => {
    const rows: ReformRow[] = [
      {
        id: 1,
        table: 'AptSaleTransaction',
        city: '광주',
        district: '동구',
        bjdCode: '29140',
        sourceId: 'aptSale-29140-2015-2024-3-15-10-84.5-50000',
      },
    ];
    const planned = planCityNormalization(rows, lookup);
    expect(planned).toHaveLength(1);
    const p = planned[0];
    expect(p.id).toBe(1);
    expect(p.table).toBe('AptSaleTransaction');
    expect(p.fromCity).toBe('광주');
    expect(p.toCity).toBe(JNGJ_CITY);
    expect(p.fromBjd).toBe('29140');
    expect(p.toBjd).toBe('12210');
    expect(p.fromSourceId).toBe('aptSale-29140-2015-2024-3-15-10-84.5-50000');
    expect(p.toSourceId).toBe('aptSale-12210-2015-2024-3-15-10-84.5-50000');
  });

  it('(b) district 매칭 실패 → planned 제외 + skip 리포트', () => {
    const rows: ReformRow[] = [
      { id: 2, table: 'AptSaleTransaction', city: '광주', district: '없는군', bjdCode: '29999', sourceId: 'aptSale-29999-x' },
    ];
    const planned = planCityNormalization(rows, lookup);
    expect(planned).toHaveLength(0); // planned에서 제외

    const plan = computeNormalizationPlan(rows, lookup);
    expect(plan.planned).toHaveLength(0);
    expect(plan.skippedDistrictUnmatched).toHaveLength(1);
    expect(plan.skippedDistrictUnmatched[0].district).toBe('없는군');
    expect(plan.skippedDistrictUnmatched[0].id).toBe(2);
  });

  it('(c) 경기도 광주시(41610) → 절대 제외 (planned 부재, non-target)', () => {
    const rows: ReformRow[] = [
      { id: 3, table: 'AptSaleTransaction', city: '경기도', district: '광주시', bjdCode: '41610', sourceId: 'aptSale-41610-x' },
      { id: 4, table: 'Parking', city: '경기', district: '광주시', bjdCode: '41610' },
    ];
    const planned = planCityNormalization(rows, lookup);
    expect(planned).toHaveLength(0);

    const plan = computeNormalizationPlan(rows, lookup);
    expect(plan.excludedNonTarget).toBe(2);
    expect(plan.skippedDistrictUnmatched).toHaveLength(0);
  });

  it('(d) bjdCode 빈 Auction 스냅샷 → city만 JNGJ, bjdCode/sourceId 불변', () => {
    const rows: ReformRow[] = [
      { id: 5, table: 'AuctionItem', city: '광주광역시', district: '동구', bjdCode: '', sourceId: 'auction-CLTR123' },
    ];
    const planned = planCityNormalization(rows, lookup);
    expect(planned).toHaveLength(1);
    const p = planned[0];
    expect(p.toCity).toBe(JNGJ_CITY);
    expect(p.fromCity).toBe('광주광역시');
    expect(p.toBjd).toBeUndefined(); // bjdCode 유지
    expect(p.fromBjd).toBeUndefined();
    expect(p.toSourceId).toBeUndefined(); // sourceId 불변
  });

  it('(e) Offitel 재코딩: OffitelRentTransaction 46110/전남/목포시 → 12110 + sourceId 치환', () => {
    const rows: ReformRow[] = [
      {
        id: 6,
        table: 'OffitelRentTransaction',
        city: '전남',
        district: '목포시',
        bjdCode: '46110',
        sourceId: 'offitelRent-46110-2018-2024-5-20-7-59.8-1000-30',
      },
    ];
    const planned = planCityNormalization(rows, lookup);
    expect(planned).toHaveLength(1);
    const p = planned[0];
    expect(p.toCity).toBe(JNGJ_CITY);
    expect(p.fromBjd).toBe('46110');
    expect(p.toBjd).toBe('12110');
    expect(p.toSourceId).toBe('offitelRent-12110-2018-2024-5-20-7-59.8-1000-30');
  });
});

describe('planCityNormalization — 테이블 종류별 규칙', () => {
  const lookup = REGION12_LOOKUP;

  it('AuctionItem: bjdCode 있는 행은 재코딩하되 sourceId(auction-CLTR)는 불변 (bjd 미임베드)', () => {
    const rows: ReformRow[] = [
      { id: 10, table: 'AuctionItem', city: '전라남도', district: '여수시', bjdCode: '46130', sourceId: 'auction-CLTR9' },
    ];
    const [p] = planCityNormalization(rows, lookup);
    expect(p.toCity).toBe(JNGJ_CITY);
    expect(p.fromBjd).toBe('46130');
    expect(p.toBjd).toBe('12130');
    expect(p.toSourceId).toBeUndefined(); // AuctionItem sourceId는 bjdCode를 담지 않음 → 재코딩 금지
    expect(SOURCEID_BJD_TABLES.has('AuctionItem')).toBe(false);
  });

  it('시설(Aed): city+bjdCode만 재코딩, sourceId 불변 (facility sourceId는 bjd 미임베드)', () => {
    const rows: ReformRow[] = [
      { id: 11, table: 'Aed', city: '광주광역시', district: '북구', bjdCode: '29170', sourceId: 'somehash' },
    ];
    const [p] = planCityNormalization(rows, lookup);
    expect(p.toCity).toBe(JNGJ_CITY);
    expect(p.fromBjd).toBe('29170');
    expect(p.toBjd).toBe('12300');
    expect(p.toSourceId).toBeUndefined();
    expect(SOURCEID_BJD_TABLES.has('Aed')).toBe(false);
  });

  it('city-only 테이블(SubwayStation, bjdCode 컬럼 없음): city만 변경', () => {
    const rows: ReformRow[] = [
      { id: 'subway-x', table: 'SubwayStation', city: '광주광역시', district: '서구' /* bjdCode 없음 */ },
    ];
    const [p] = planCityNormalization(rows, lookup);
    expect(p.toCity).toBe(JNGJ_CITY);
    expect(p.toBjd).toBeUndefined();
    expect(p.toSourceId).toBeUndefined();
  });

  it('멱등: 이미 신 city + 12xxx bjdCode 인 행은 변경 없음(unchanged)', () => {
    const rows: ReformRow[] = [
      { id: 20, table: 'AptSaleTransaction', city: JNGJ_CITY, district: '동구', bjdCode: '12210', sourceId: 'aptSale-12210-x' },
    ];
    const planned = planCityNormalization(rows, lookup);
    expect(planned).toHaveLength(0);
    const plan = computeNormalizationPlan(rows, lookup);
    expect(plan.unchanged).toBe(1);
  });

  it('무관 지역(서울)은 non-target으로 제외', () => {
    const rows: ReformRow[] = [
      { id: 30, table: 'AptSaleTransaction', city: '서울특별시', district: '강남구', bjdCode: '11680', sourceId: 'aptSale-11680-x' },
    ];
    expect(planCityNormalization(rows, lookup)).toHaveLength(0);
  });

  it('concat 오염 city("광주광역시동구") 도 정규화되어 재코딩된다', () => {
    const rows: ReformRow[] = [
      { id: 40, table: 'Parking', city: '광주광역시동구', district: '동구', bjdCode: '29140' },
    ];
    const [p] = planCityNormalization(rows, lookup);
    expect(p.toCity).toBe(JNGJ_CITY);
    expect(p.toBjd).toBe('12210');
  });
});

// ============================================================================
// I-1: dry-run이 dedup-DELETE 예정 건수를 미리보기 하는지(순수 splitDedup + processTable dry-run)
// ============================================================================

describe('splitDedup (I-1 — update vs dedup-DELETE 분할, 순수)', () => {
  it('기존 sourceId(신 sync 삽입분)와 충돌하는 옛 행은 dedup-DELETE, 나머지는 UPDATE', () => {
    const src: ReformPlanItem[] = [
      { id: 1, table: 'AptSaleTransaction', fromCity: '광주', toCity: JNGJ_CITY, toSourceId: 'aptSale-12210-A' },
      { id: 2, table: 'AptSaleTransaction', fromCity: '광주', toCity: JNGJ_CITY, toSourceId: 'aptSale-12210-B' },
    ];
    const existing = new Set(['aptSale-12210-A']); // 신 sync가 이미 넣음
    const { toUpdate, toDeleteIds } = splitDedup(src, existing);
    expect(toDeleteIds).toEqual([1]);
    expect(toUpdate.map((p) => p.id)).toEqual([2]);
  });

  it('이번 실행 내부 중복(claimed)도 dedup-DELETE로 처리', () => {
    const src: ReformPlanItem[] = [
      { id: 1, table: 'AptSaleTransaction', fromCity: '광주', toCity: JNGJ_CITY, toSourceId: 'dup' },
      { id: 2, table: 'AptSaleTransaction', fromCity: '광주', toCity: JNGJ_CITY, toSourceId: 'dup' },
    ];
    const { toUpdate, toDeleteIds } = splitDedup(src, new Set());
    expect(toUpdate.map((p) => p.id)).toEqual([1]); // 먼저 배정
    expect(toDeleteIds).toEqual([2]); // 나중은 dedup
  });
});

describe('processTable — I-1: dry-run에서도 dedup-DELETE 예정 건수를 리포트(mutation 없음)', () => {
  it('AptSaleTransaction dry-run: plannedDedupDelete=1 / plannedUpdate=1, $executeRawUnsafe 미호출', async () => {
    mockPrisma.$queryRawUnsafe = vi.fn(async (sql: string, ...params: unknown[]) => {
      if (/^SELECT id,/.test(sql)) {
        // selectCandidates — 광주/동구 두 행(29140 → 12210), 서로 다른 sourceId
        return [
          { id: 1, city: '광주', district: '동구', bjdCode: '29140', sourceId: 'aptSale-29140-A' },
          { id: 2, city: '광주', district: '동구', bjdCode: '29140', sourceId: 'aptSale-29140-B' },
        ];
      }
      if (/^SELECT sourceId FROM/.test(sql)) {
        // findExistingSourceIds — params 는 조회할 toSourceId 목록. A만 이미 존재(신 sync 삽입분).
        return (params as string[]).filter((s) => s === 'aptSale-12210-A').map((s) => ({ sourceId: s }));
      }
      return [];
    });

    const result = await processTable('AptSaleTransaction', /* apply */ false);

    expect(result.planned).toBe(2);
    expect(result.plannedDedupDelete).toBe(1); // ← I-1: dry-run이 삭제 예정 규모를 노출
    expect(result.plannedUpdate).toBe(1);
    // dry-run 이므로 실제 mutation(UPDATE/DELETE/백업) 없음
    expect(result.updated).toBe(0);
    expect(result.deletedDedup).toBe(0);
    expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});

// ============================================================================
// I-2: WasteSchedule city 리네임 충돌 — dry-run pre-check + apply conflict-skip(abort 방지)
// ============================================================================

describe('processTable — I-2(a): city-only 충돌 dry-run pre-check', () => {
  it('WasteSchedule dry-run: (JNGJ,district,sourceId) 기존행 충돌 예정 건수를 센다', async () => {
    mockPrisma.$queryRawUnsafe = vi.fn(async (sql: string) => {
      if (/^SELECT id,/.test(sql)) {
        return [
          { id: 100, city: '광주광역시', district: '동구', sourceId: 'w1' },
          { id: 101, city: '전남', district: '목포시', sourceId: 'w2' },
        ];
      }
      if (/^SELECT district, sourceId FROM/.test(sql)) {
        // JNGJ + 동구 + w1 이 이미 존재(sync 선삽입) → 옛 행(100) 리네임은 충돌 예정
        return [{ district: '동구', sourceId: 'w1' }];
      }
      return [];
    });

    const result = await processTable('WasteSchedule', /* apply */ false);
    expect(result.planned).toBe(2);
    expect(result.cityConflictExisting).toBe(1);
    expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});

describe('applyCityOnlyWithConflictSkip — I-2(b): duplicate-key skip + continue(abort 금지)', () => {
  const items: ReformPlanItem[] = [
    { id: 1, table: 'WasteSchedule', fromCity: '광주광역시', toCity: JNGJ_CITY },
    { id: 2, table: 'WasteSchedule', fromCity: '전남', toCity: JNGJ_CITY },
    { id: 3, table: 'WasteSchedule', fromCity: '광주', toCity: JNGJ_CITY },
  ];

  it('중간 행이 duplicate-key로 실패해도 skip+카운트 후 다음 행 계속(전체 abort 없음)', async () => {
    mockPrisma.$executeRawUnsafe = vi.fn(async (_sql: string, _city: string, id: number) => {
      if (id === 2) {
        // Prisma $executeRawUnsafe raw 오류 형태(P2010 래핑 + meta 1062)
        throw { code: 'P2010', meta: { code: '1062', message: "Duplicate entry 'x' for key 'city'" } };
      }
      return 1;
    });

    const r = await applyCityOnlyWithConflictSkip('WasteSchedule', items);
    expect(r.updated).toBe(2); // id=1, id=3
    expect(r.skipped).toBe(1); // id=2
    // 3행 전부 시도됨 = 충돌 후에도 멈추지 않고 계속 진행
    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(3);
  });

  it('duplicate-key가 아닌 오류는 rethrow(삼키지 않음)', async () => {
    mockPrisma.$executeRawUnsafe = vi.fn(async () => {
      throw new Error('connection reset by peer');
    });
    await expect(
      applyCityOnlyWithConflictSkip('WasteSchedule', [items[0]])
    ).rejects.toThrow('connection reset');
  });
});

describe('isDuplicateKeyError (I-2 — dup-key 판정, DB 비의존)', () => {
  it('P2002 / meta 1062 / ER_DUP_ENTRY 메시지를 dup-key로 판정', () => {
    expect(isDuplicateKeyError({ code: 'P2002' })).toBe(true);
    expect(isDuplicateKeyError({ code: 'P2010', meta: { code: '1062', message: 'Duplicate entry' } })).toBe(true);
    expect(isDuplicateKeyError({ code: 'ER_DUP_ENTRY' })).toBe(true);
    expect(isDuplicateKeyError(new Error('ER_DUP_ENTRY: Duplicate entry ...'))).toBe(true);
  });

  it('무관 오류/널은 false', () => {
    expect(isDuplicateKeyError(new Error('connection reset'))).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
    expect(isDuplicateKeyError(undefined)).toBe(false);
    expect(isDuplicateKeyError({ code: 'P2024' })).toBe(false);
  });
});

// ============================================================================
// M-1: dedup 무력화 사전경고 — bjdChanged인데 srcChanged 아님 카운트(경고만, apply 미차단)
// ============================================================================

describe('countDedupDefeatRisk (M-1 — 순수)', () => {
  it('거래테이블: bjdChanged(toBjd 존재)인데 srcChanged 아님(toSourceId 부재) 건수', () => {
    const planned: ReformPlanItem[] = [
      { id: 1, table: 'AptSaleTransaction', fromCity: '광주', toCity: JNGJ_CITY, fromBjd: '29140', toBjd: '12210', fromSourceId: 'a', toSourceId: 'aptSale-12210-a' }, // 정상(srcChanged)
      { id: 2, table: 'AptSaleTransaction', fromCity: '광주', toCity: JNGJ_CITY, fromBjd: '29140', toBjd: '12210' }, // 위반: bjd만 바뀜
    ];
    expect(countDedupDefeatRisk('AptSaleTransaction', planned)).toBe(1);
  });

  it('비-거래테이블(Aed 등)은 항상 0', () => {
    const planned: ReformPlanItem[] = [
      { id: 1, table: 'Aed', fromCity: '광주', toCity: JNGJ_CITY, fromBjd: '29170', toBjd: '12300' },
    ];
    expect(countDedupDefeatRisk('Aed', planned)).toBe(0);
  });

  it('실전: sourceId에 옛 bjd 토큰이 없어 reencode 무효인 거래 행 → M-1 위반으로 검출', () => {
    // bjdCode=29140 이지만 sourceId 에 29140 토큰 부재 → reencode 원본반환 → toSourceId 미설정
    const rows: ReformRow[] = [
      { id: 5, table: 'AptSaleTransaction', city: '광주', district: '동구', bjdCode: '29140', sourceId: 'aptSale-99999-x' },
    ];
    const plan = computeNormalizationPlan(rows, REGION12_LOOKUP);
    expect(plan.planned).toHaveLength(1);
    expect(plan.planned[0].toBjd).toBe('12210'); // bjdChanged
    expect(plan.planned[0].toSourceId).toBeUndefined(); // srcChanged 아님
    expect(countDedupDefeatRisk('AptSaleTransaction', plan.planned)).toBe(1);
  });
});
