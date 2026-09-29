import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchPublicRentalNotices,
  normalizePublicRentalNotices,
  type PublicRentalNotice,
} from '../../src/services/publicRentalSources.js';

const NOW = new Date('2026-09-28T12:00:00.000Z');

function myhome(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    pblancId: '21317',
    houseSn: '1',
    sttusNm: '일반공고',
    pblancNm: '양산시지역 국민임대주택 예비입주자 모집공고',
    suplyInsttNm: '한국토지주택공사',
    houseTyNm: '아파트',
    suplyTyNm: '국민임대',
    beforePblancId: '',
    rcritPblancDe: '20260915',
    przwnerPresnatnDe: '20261223',
    suplyHoCo: '0',
    refrnc: '1600-1004',
    url: 'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=2015122300020817',
    pcUrl: '',
    mobileUrl: '',
    hsmpNm: '양산물금1',
    brtcNm: '경상남도',
    signguNm: '양산시',
    fullAdres: '경상남도 양산시 물금읍 청운로 42',
    sumSuplyCo: '60',
    rentGtn: '12000000',
    mtRntchrg: '180000',
    beginDe: '20260929',
    endDe: '20260929',
    ...overrides,
  };
}

function lh(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    PAN_ID: '2015122300020817',
    UPP_AIS_TP_CD: '06',
    UPP_AIS_TP_NM: '임대주택',
    AIS_TP_CD: '06',
    AIS_TP_CD_NM: '국민임대',
    CNP_CD_NM: '경상남도',
    PAN_NM: '[정정공고][양산시지역] 국민임대주택 예비입주자 모집공고',
    PAN_SS: '공고중',
    PAN_DT: '20260915',
    CLSG_DT: '2026.09.29',
    DTL_URL: 'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=2015122300020817',
    ALL_CNT: '1',
    CCR_CNNT_SYS_DS_CD: '03',
    SPL_INF_TP_CD: '050',
    ...overrides,
  };
}

function expectDate(value: Date | null, iso: string): void {
  expect(value).toBeInstanceOf(Date);
  expect(value?.toISOString()).toBe(iso);
}

describe('normalizePublicRentalNotices', () => {
  it('merges MyHome and LH rows by LH panId while preserving canonical metadata', () => {
    const notices = normalizePublicRentalNotices({
      myhomeRows: [myhome()],
      lhRows: [lh()],
      now: NOW,
    });

    expect(notices).toHaveLength(1);
    const notice = notices[0] as PublicRentalNotice;
    expect(notice.canonicalId).toBe('2015122300020817');
    expect(notice.houseName).toBe('양산시지역 국민임대주택 예비입주자 모집공고');
    expect(notice.publicRentType).toBe('국민임대');
    expect(notice.regionName).toBe('경상남도');
    expect(notice.supplyLocation).toBe('경상남도 양산시 물금읍 청운로 42');
    expect(notice.totalSupplyCount).toBe(60);
    expect(notice.status).toBe('upcoming');
    expectDate(notice.announcementDate, '2026-09-15T00:00:00.000Z');
    expectDate(notice.receptionStartDate, '2026-09-29T00:00:00.000Z');
    expectDate(notice.receptionEndDate, '2026-09-29T00:00:00.000Z');
    expectDate(notice.winnerDate, '2026-12-23T00:00:00.000Z');
    expect(notice.publicRental.sources).toEqual(['MYHOME', 'LH']);
    expect(notice.publicRental.sourceIds).toEqual({
      myhome: ['21317'],
      lh: ['2015122300020817'],
    });
    expect(notice.publicRental.supplies).toEqual([
      expect.objectContaining({
        name: '양산물금1',
        region: '경상남도 양산시',
        address: '경상남도 양산시 물금읍 청운로 42',
        supplyCount: 60,
        deposit: 12000000,
        monthlyRent: 180000,
        receptionStartDate: '2026-09-29',
        receptionEndDate: '2026-09-29',
      }),
    ]);
  });

  it('excludes superseded MyHome supply rows and preserves same houseSn supplies by region and address', () => {
    const notices = normalizePublicRentalNotices({
      myhomeRows: [
        myhome({
          pblancId: '21300',
          pblancNm: '인천광역시 국민임대주택 예비입주자 모집공고',
          sumSuplyCo: '999',
          beforePblancId: '',
        }),
        myhome({
          pblancId: '21312',
          beforePblancId: '21300',
          houseSn: '0',
          sttusNm: '정정공고',
          pblancNm: '인천광역시 국민임대주택 예비입주자 모집 정정공고',
          hsmpNm: '인천검단',
          brtcNm: '인천광역시',
          signguNm: '서구',
          fullAdres: '인천광역시 서구 원당동 1',
          sumSuplyCo: '26',
          rentGtn: '0',
          mtRntchrg: '0',
          beginDe: '20260928',
          endDe: '20260930',
          url: 'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=2015122300020808',
        }),
        myhome({
          pblancId: '21312',
          beforePblancId: '21300',
          houseSn: '0',
          sttusNm: '정정공고',
          pblancNm: '인천광역시 국민임대주택 예비입주자 모집 정정공고',
          hsmpNm: '인천논현',
          brtcNm: '인천광역시',
          signguNm: '남동구',
          fullAdres: '인천광역시 남동구 논현동 2',
          sumSuplyCo: '1',
          rentGtn: '0',
          mtRntchrg: '0',
          beginDe: '20260928',
          endDe: '20260930',
          url: 'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=2015122300020808',
        }),
      ],
      lhRows: [lh({ PAN_ID: '2015122300020808', CNP_CD_NM: '인천광역시 외', PAN_SS: '정정공고중' })],
      now: NOW,
    });

    expect(notices).toHaveLength(1);
    const notice = notices[0] as PublicRentalNotice;
    expect(notice.canonicalId).toBe('2015122300020808');
    expect(notice.totalSupplyCount).toBe(27);
    expect(notice.status).toBe('ongoing');
    expect(notice.publicRental.isCorrection).toBe(true);
    expect(notice.publicRental.sourceIds.myhome).toEqual(['21312', '21300']);
    expect(notice.publicRental.supplies).toHaveLength(2);
    expect(notice.publicRental.supplies.map((s) => s.name)).toEqual(['인천검단', '인천논현']);
    expect(notice.publicRental.supplies[0]).toEqual(
      expect.objectContaining({ deposit: null, monthlyRent: null })
    );
  });

  it('preserves supplies that share identity fields but differ by normalized supply facts', () => {
    const notices = normalizePublicRentalNotices({
      myhomeRows: [
        myhome({
          pblancId: '21268',
          url: '',
          houseSn: '0',
          brtcNm: '경기도',
          signguNm: '',
          fullAdres: '',
          hsmpNm: '',
          sumSuplyCo: '3',
          rentGtn: '0',
          mtRntchrg: '0',
          beginDe: '20260922',
          endDe: '20260924',
        }),
        myhome({
          pblancId: '21268',
          url: '',
          houseSn: '0',
          brtcNm: '경기도',
          signguNm: '',
          fullAdres: '',
          hsmpNm: '',
          sumSuplyCo: '73',
          rentGtn: '0',
          mtRntchrg: '0',
          beginDe: '20260922',
          endDe: '20260924',
        }),
      ],
      lhRows: [],
      now: NOW,
    });

    expect(notices).toHaveLength(1);
    expect(notices[0]?.publicRental.supplies).toHaveLength(2);
    expect(notices[0]?.publicRental.supplies.map((supply) => supply.supplyCount)).toEqual([3, 73]);
    expect(notices[0]?.totalSupplyCount).toBe(76);
  });

  it('retains correction ancestor aliases and MyHome-parsed LH panId even without an LH list row', () => {
    const notices = normalizePublicRentalNotices({
      myhomeRows: [
        myhome({
          pblancId: '21000',
          beforePblancId: '',
          url: 'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=2015122300020700',
        }),
        myhome({
          pblancId: '21100',
          beforePblancId: '21000',
          url: 'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=2015122300020750',
        }),
        myhome({
          pblancId: '21350',
          beforePblancId: '21100',
          pblancNm: '정정 후 LH URL만 있는 공고',
          url: 'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=2015122300020850',
        }),
      ],
      lhRows: [],
      now: NOW,
    });

    expect(notices).toHaveLength(1);
    expect(notices[0]?.canonicalId).toBe('2015122300020850');
    expect(notices[0]?.publicRental.sources).toEqual(['MYHOME']);
    expect(notices[0]?.publicRental.sourceIds.myhome).toEqual(['21350', '21100', '21000']);
    expect(notices[0]?.publicRental.sourceIds.lh).toEqual([
      '2015122300020850',
      '2015122300020750',
      '2015122300020700',
    ]);
    expect(notices[0]?.publicRental.supplies).toHaveLength(1);
  });

  it('collapses correction-connected old LH groups into the newest MyHome canonical notice', () => {
    const notices = normalizePublicRentalNotices({
      myhomeRows: [
        myhome({
          pblancId: '30000',
          beforePblancId: '',
          pblancNm: '옛 공고',
          sumSuplyCo: '999',
          url: 'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=2015122300020999',
        }),
        myhome({
          pblancId: '30001',
          beforePblancId: '30000',
          pblancNm: '최신 정정 공고',
          sumSuplyCo: '7',
          url: 'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=2015122300020100',
        }),
      ],
      lhRows: [
        lh({
          PAN_ID: '2015122300020999',
          PAN_NM: '옛 LH 공고',
          PAN_DT: '20260930',
          PAN_SS: '접수마감',
        }),
        lh({
          PAN_ID: '2015122300020100',
          PAN_NM: '최신 LH 정정 공고',
          PAN_DT: '20260920',
          PAN_SS: '정정공고중',
        }),
      ],
      now: NOW,
    });

    expect(notices).toHaveLength(1);
    expect(notices[0]?.canonicalId).toBe('2015122300020100');
    expect(notices[0]?.houseName).toBe('최신 정정 공고');
    expect(notices[0]?.totalSupplyCount).toBe(7);
    expect(notices[0]?.publicRental.sourceIds.myhome).toEqual(['30001', '30000']);
    expect(notices[0]?.publicRental.sourceIds.lh).toEqual([
      '2015122300020100',
      '2015122300020999',
    ]);
    expect(notices[0]?.publicRental.sourceStatus).toBe('접수마감');
    expect(notices[0]?.publicRental.supplies).toHaveLength(1);
  });

  it('keeps notice-level reception dates null and status unknown when supply rows have different periods', () => {
    const notices = normalizePublicRentalNotices({
      myhomeRows: [
        myhome({ pblancId: '90001', url: '', houseSn: '1', beginDe: '20260928', endDe: '20260929' }),
        myhome({ pblancId: '90001', url: '', houseSn: '2', fullAdres: '다른 주소', beginDe: '20261001', endDe: '20261002' }),
      ],
      lhRows: [],
      now: NOW,
    });

    expect(notices).toHaveLength(1);
    expect(notices[0]?.canonicalId).toBe('90001');
    expect(notices[0]?.receptionStartDate).toBeNull();
    expect(notices[0]?.receptionEndDate).toBeNull();
    expect(notices[0]?.status).toBe('unknown');
  });

  it('requires every supply row to have the same valid reception period before deriving notice dates', () => {
    const notices = normalizePublicRentalNotices({
      myhomeRows: [
        myhome({ pblancId: '90002', url: '', houseSn: '1', beginDe: '20260928', endDe: '20260929' }),
        myhome({
          pblancId: '90002',
          url: '',
          houseSn: '2',
          fullAdres: '접수일 누락 주소',
          beginDe: '',
          endDe: '',
        }),
      ],
      lhRows: [],
      now: NOW,
    });

    expect(notices).toHaveLength(1);
    expect(notices[0]?.receptionStartDate).toBeNull();
    expect(notices[0]?.receptionEndDate).toBeNull();
    expect(notices[0]?.status).toBe('unknown');
  });

  it('uses the KST calendar day when deriving status from date-only reception periods', () => {
    const notices = normalizePublicRentalNotices({
      myhomeRows: [
        myhome({
          pblancId: '90003',
          url: '',
          beginDe: '20260922',
          endDe: '20260922',
        }),
      ],
      lhRows: [],
      now: new Date('2026-09-21T15:00:00.000Z'),
    });

    expect(notices[0]?.status).toBe('ongoing');
  });

  it('treats invalid dates and reversed reception intervals as unknown', () => {
    const [invalidDateNotice, reversedRangeNotice] = normalizePublicRentalNotices({
      myhomeRows: [
        myhome({
          pblancId: '90004',
          url: '',
          beginDe: '20261350',
          endDe: '20261350',
        }),
        myhome({
          pblancId: '90005',
          url: '',
          beginDe: '20261002',
          endDe: '20261001',
        }),
      ],
      lhRows: [],
      now: NOW,
    });

    expect(invalidDateNotice?.canonicalId).toBe('90004');
    expect(invalidDateNotice?.receptionStartDate).toBeNull();
    expect(invalidDateNotice?.receptionEndDate).toBeNull();
    expect(invalidDateNotice?.status).toBe('unknown');
    expect(reversedRangeNotice?.canonicalId).toBe('90005');
    expect(reversedRangeNotice?.receptionStartDate).toBeNull();
    expect(reversedRangeNotice?.receptionEndDate).toBeNull();
    expect(reversedRangeNotice?.status).toBe('unknown');
  });

  it('does not infer LH-only ongoing state from posting dates but keeps source-closed notices closed', () => {
    const [openNotice, closedNotice] = normalizePublicRentalNotices({
      myhomeRows: [],
      lhRows: [
        lh({ PAN_ID: '2015122300020811', PAN_SS: '공고중', PAN_NM: 'LH 단독 공고' }),
        lh({ PAN_ID: '2015122300020812', PAN_SS: '접수마감', PAN_NM: 'LH 마감 공고' }),
      ],
      now: NOW,
    });

    expect(openNotice?.canonicalId).toBe('2015122300020811');
    expect(openNotice?.receptionStartDate).toBeNull();
    expect(openNotice?.receptionEndDate).toBeNull();
    expect(openNotice?.status).toBe('unknown');
    expect(closedNotice?.canonicalId).toBe('2015122300020812');
    expect(closedNotice?.status).toBe('closed');
  });
});

describe('fetchPublicRentalNotices', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches all MyHome pages and both LH categories before normalizing', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/rsdtRcritNtcList')) {
        const pageNo = url.searchParams.get('pageNo');
        return jsonResponse({
          response: {
            header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
            body: {
              totalCount: '2',
              numOfRows: '1',
              pageNo,
              item: [
                pageNo === '1'
                  ? myhome({ pblancId: '88001', url: '', pblancNm: '마이홈 1' })
                  : myhome({ pblancId: '88002', url: '', pblancNm: '마이홈 2' }),
              ],
            },
          },
        });
      }

      if (url.pathname.endsWith('/lhLeaseNoticeInfo1')) {
        const upp = url.searchParams.get('UPP_AIS_TP_CD');
        return jsonResponse([
          { dsSch: [{ ALL_CNT: '1' }] },
          {
            resHeader: [{ RS_DTTM: '20260922100350', SS_CODE: 'Y' }],
            dsList: [
              lh({
                PAN_ID: upp === '06' ? '2015122300020806' : '2015122300020813',
                UPP_AIS_TP_CD: upp,
                PAN_NM: `LH ${upp}`,
                ALL_CNT: '1',
              }),
            ],
          },
        ]);
      }

      throw new Error(`Unexpected URL ${url.toString()}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const notices = await fetchPublicRentalNotices('service-key', NOW);

    expect(notices.map((n) => n.canonicalId).sort()).toEqual([
      '2015122300020806',
      '2015122300020813',
      '88001',
      '88002',
    ].sort());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('pageNo=2'),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    const calledUrls = fetchMock.mock.calls.map(([input]) => new URL(String(input)));
    expect(calledUrls.filter((url) => url.searchParams.get('UPP_AIS_TP_CD') === '06')).toHaveLength(1);
    expect(calledUrls.filter((url) => url.searchParams.get('UPP_AIS_TP_CD') === '13')).toHaveLength(1);
  });

  it('throws sanitized errors for public data auth failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          OpenAPI_ServiceResponse: {
            cmmMsgHeader: {
              returnReasonCode: '30',
              errMsg: 'SERVICE KEY IS NOT REGISTERED: secret-service-key',
              returnAuthMsg: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR',
            },
          },
        })
      )
    );

    await expect(fetchPublicRentalNotices('secret-service-key', NOW)).rejects.toThrow(
      /SERVICE_KEY_IS_NOT_REGISTERED_ERROR/
    );
    await expect(fetchPublicRentalNotices('secret-service-key', NOW)).rejects.not.toThrow(
      /secret-service-key/
    );
  });

  it('decodes percent-encoded service keys once and redacts raw, decoded, and url-encoded forms', async () => {
    const encodedKey = 'abc%2Fsecret%3D';
    const decodedKey = 'abc/secret=';
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.searchParams.get('serviceKey')).toBe(decodedKey);
      return jsonResponse({
        OpenAPI_ServiceResponse: {
          cmmMsgHeader: {
            returnReasonCode: '30',
            errMsg: `bad ${encodedKey} ${decodedKey} ${encodeURIComponent(decodedKey)}`,
            returnAuthMsg: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR',
          },
        },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPublicRentalNotices(encodedKey, NOW)).rejects.toThrow(
      /SERVICE_KEY_IS_NOT_REGISTERED_ERROR/
    );
    await expect(fetchPublicRentalNotices(encodedKey, NOW)).rejects.not.toThrow(/abc%2Fsecret%3D/);
    await expect(fetchPublicRentalNotices(encodedKey, NOW)).rejects.not.toThrow(/abc\/secret=/);
  });

  it('fails closed when LH returns a response without a valid dsList wrapper', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/rsdtRcritNtcList')) {
          return jsonResponse({
            response: {
              header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
              body: { totalCount: '0', numOfRows: '1000', pageNo: '1', item: [] },
            },
          });
        }

        return jsonResponse([
          { dsSch: [{ UPP_AIS_TP_CD: url.searchParams.get('UPP_AIS_TP_CD') }] },
          { resHeader: [{ SS_CODE: 'Y', RS_DTTM: '2026-09-22 00:00:00' }] },
        ]);
      })
    );

    await expect(fetchPublicRentalNotices('service-key', NOW)).rejects.toThrow(
      /LH API returned an unexpected JSON structure/
    );
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}
