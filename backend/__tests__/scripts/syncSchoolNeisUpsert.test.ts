import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * syncSchoolsNeis 의 실제 쓰기 경로 회귀 방지.
 *
 * 기존 코드는 (1) neisSchoolCode 로 findFirst 해 찾은 행에 신원 필드까지 덮어썼고,
 * (2) 못 찾으면 무조건 새 행을 만들었다. 2026-03-20 실행이 표준데이터 12,014행 위에
 * 12,563행을 새로 만들어 전면 중복이 됐고, 이후 9회 실행이 오연결된 표준행 1,234건의
 * 지역·주소·전화를 남의 학교 값으로 계속 덮었다.
 */

const {
  mockFindMany,
  mockFindUnique,
  mockUpdate,
  mockCreate,
  mockFetchAllPages,
  mockUpdateSyncHistory,
} = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockCreate: vi.fn(),
  mockFetchAllPages: vi.fn(),
  mockUpdateSyncHistory: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    school: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
      create: mockCreate,
    },
    $disconnect: vi.fn(),
  },
}));

vi.mock('../../src/services/neisApiClient.js', () => ({
  NeisApiClient: class {
    fetchAllPages = mockFetchAllPages;
  },
}));

vi.mock('../../src/services/baseSyncService.js', () => ({
  createSyncHistory: vi.fn().mockResolvedValue({ id: 1 }),
  updateSyncHistory: mockUpdateSyncHistory,
  createSyncStats: () => ({
    totalRecords: 0,
    newRecords: 0,
    updatedRecords: 0,
    skippedRecords: 0,
    errors: [],
  }),
}));

import { syncSchoolsNeis, type NeisSchoolRow } from '../../src/scripts/syncSchoolNeis.js';

function neisRow(overrides: Partial<NeisSchoolRow> = {}): NeisSchoolRow {
  return {
    ATPT_OFCDC_SC_CODE: 'D10',
    ATPT_OFCDC_SC_NM: '대구광역시교육청',
    SD_SCHUL_CODE: '7240097',
    SCHUL_NM: '영신고등학교',
    ENG_SCHUL_NM: 'Yeongsin High School',
    SCHUL_KND_SC_NM: '고등학교',
    LCTN_SC_NM: '대구광역시',
    JU_ORG_NM: '대구광역시동부교육지원청',
    FOND_SC_NM: '사립',
    ORG_RDNZC: '41068',
    ORG_RDNMA: '대구광역시 동구 팔공로50길 32',
    ORG_RDNDA: '(봉무동)',
    ORG_TELNO: '053-235-4700',
    HMPG_ADRES: 'http://www.yeongsin.hs.kr',
    COEDU_SC_NM: '남',
    ORG_FAXNO: '053-235-4701',
    HS_SC_NM: '일반고',
    INDST_SPECL_CCCCL_EXST_YN: 'N',
    HS_GNRL_BUSNS_SC_NM: '일반',
    SPCLY_PURPS_HS_ORD_NM: '',
    ENE_BFE_SEHF_SC_NM: '전기',
    DGHT_SC_NM: '주간',
    FOND_YMD: '1966-01-20',
    FOAS_MEMRD: '1966-03-01',
    LOAD_DTM: '2026-08-26',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEIS_API_KEY = 'test-key';
  mockFindMany.mockResolvedValue([]);
  mockFindUnique.mockResolvedValue(null);
  mockUpdate.mockResolvedValue({});
  mockCreate.mockResolvedValue({});
  mockUpdateSyncHistory.mockResolvedValue(undefined);
});

describe('syncSchoolsNeis - 단일 소스이므로 sourceId 형태와 무관하게 신원까지 쓴다', () => {
  it('표준 형태 sourceId 행에도 신원과 syncedAt 을 update 한다', async () => {
    // #783 은 이 행에 보강 필드만 썼다. 표준데이터가 신원의 권위였을 때는 맞았지만,
    // 그 전제가 깨져(2026 인천 개편 미반영) NEIS 단일 소스로 재구성했다.
    // 링크는 reconcileSchoolNeisRows 가 정확 매핑으로 다시 맺었으므로 따라 써도 안전하고,
    // 쓰지 않으면 오염된 지역·주소 932건이 영구히 남는다.
    mockFindMany.mockResolvedValue([{ id: 'school-B000012035', sourceId: 'B000012035' }]);
    mockFetchAllPages.mockResolvedValue([neisRow()]);

    await syncSchoolsNeis();

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const data = mockUpdate.mock.calls[0][0].data;
    expect(data.name).toBe('영신고등학교');
    expect(data.city).toBe('대구');
    expect(data.district).toBe('동구');
    expect(data.roadAddress).toBe('대구광역시 동구 팔공로50길 32 (봉무동)');
    expect(data.phoneNumber).toBe('053-235-4700');
    expect(data.syncedAt).toBeInstanceOf(Date);
  });

  it('NEIS 형태 sourceId 행에도 같은 필드를 update 한다', async () => {
    mockFindMany.mockResolvedValue([{ id: 'school-7240097', sourceId: '7240097' }]);
    mockFetchAllPages.mockResolvedValue([neisRow()]);

    await syncSchoolsNeis();

    const data = mockUpdate.mock.calls[0][0].data;
    expect(data.name).toBe('영신고등학교');
    expect(data.city).toBe('대구');
    expect(data.syncedAt).toBeInstanceOf(Date);
  });
});

describe('syncSchoolsNeis - 신규 행 생성', () => {
  it('초·중·고도 매칭 행이 없으면 새로 만든다', async () => {
    // #783 은 표준 sync 가 초·중·고를 만든다는 전제로 생성을 막았다. 단일 소스에서는
    // 그 sync 가 없으므로 막으면 NEIS 에만 있는 학교(운영 실측 32건)가 영구히 누락된다.
    mockFindMany.mockResolvedValue([]);
    mockFindUnique.mockResolvedValue(null);
    mockFetchAllPages.mockResolvedValue([neisRow({ SCHUL_KND_SC_NM: '고등학교' })]);

    const stats = await syncSchoolsNeis();

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.id).toBe('school-7240097');
    expect(data.sourceId).toBe('7240097');
    expect(data.neisSchoolCode).toBe('7240097');
    expect(stats.newRecords).toBe(1);
    expect(stats.skippedRecords).toBe(0);
  });

  it('표준데이터에 없는 학교급도 새로 만든다', async () => {
    mockFindMany.mockResolvedValue([]);
    mockFindUnique.mockResolvedValue(null);
    mockFetchAllPages.mockResolvedValue([
      neisRow({ SD_SCHUL_CODE: '7010999', SCHUL_KND_SC_NM: '특수학교', SCHUL_NM: '서울정민학교' }),
    ]);

    const stats = await syncSchoolsNeis();

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.id).toBe('school-7010999');
    expect(data.sourceId).toBe('7010999');
    expect(data.neisSchoolCode).toBe('7010999');
    expect(data.name).toBe('서울정민학교');
    expect(stats.newRecords).toBe(1);
  });

  it('sourceId 로 찾은 NEIS 전용 행은 자기 코드로 링크하며 update 한다', async () => {
    mockFindMany.mockResolvedValue([]);
    mockFindUnique.mockResolvedValue({ id: 'school-7240097', sourceId: '7240097' });
    mockFetchAllPages.mockResolvedValue([neisRow()]);

    const stats = await syncSchoolsNeis();

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0].data.neisSchoolCode).toBe('7240097');
    expect(stats.updatedRecords).toBe(1);
  });
});

describe('syncSchoolsNeis - 링크 비결정성 차단', () => {
  it('같은 neisSchoolCode 가 여러 행에 걸리면 아무 행도 쓰지 않는다', async () => {
    // neisSchoolCode 에 unique 제약이 없다. findFirst 는 임의의 한 행만 골라
    // 어느 행이 갱신될지 실행마다 달라질 수 있으므로 모호하면 건너뛴다.
    mockFindMany.mockResolvedValue([
      { id: 'school-B000012035', sourceId: 'B000012035' },
      { id: 'school-B000099999', sourceId: 'B000099999' },
    ]);
    mockFetchAllPages.mockResolvedValue([neisRow()]);

    const stats = await syncSchoolsNeis();

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(stats.skippedRecords).toBe(1);
  });

  it('링크 조회는 결정적으로 최대 2건만 가져온다', async () => {
    mockFindMany.mockResolvedValue([{ id: 'school-7240097', sourceId: '7240097' }]);
    mockFetchAllPages.mockResolvedValue([neisRow()]);

    await syncSchoolsNeis();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { neisSchoolCode: '7240097' },
        take: 2,
      })
    );
  });
});

describe('syncSchoolsNeis - 학교로 볼 수 없는 레코드', () => {
  it('검정고시/학교급 없음/도로명 없음은 DB를 건드리지 않고 스킵한다', async () => {
    mockFetchAllPages.mockResolvedValue([
      neisRow({ SCHUL_NM: '서울시교육청 검정고시' }),
      neisRow({ SCHUL_KND_SC_NM: '' }),
      neisRow({ ORG_RDNMA: '', ORG_RDNDA: '' }),
    ]);

    const stats = await syncSchoolsNeis();

    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(stats.skippedRecords).toBe(3);
  });
});
