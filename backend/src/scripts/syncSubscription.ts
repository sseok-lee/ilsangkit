#!/usr/bin/env tsx
// 청약 분양정보 동기화 스크립트
// Usage: tsx src/scripts/syncSubscription.ts [--dry-run]

import 'dotenv/config';
import prisma from '../lib/prisma.js';

const API_BASE = 'https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1';
const API_BASE_CMPET = 'https://api.odcloud.kr/api/ApplyhomeInfoCmpetRtSvc/v1';
const PER_PAGE = 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubscriptionApiItem {
  HOUSE_MANAGE_NO: string;
  PBLANC_NO: string;
  HOUSE_NM: string;
  HOUSE_SECD_NM: string;        // APT, 오피스텔
  HOUSE_DTL_SECD_NM: string;    // 민영, 국민
  RENT_SECD_NM: string;         // 분양주택, 임대주택
  SUBSCRPT_AREA_CODE_NM: string; // 공급지역명
  HSSPLY_ADRES: string;         // 공급위치
  HSSPLY_ZIP: string;
  TOT_SUPLY_HSHLDCO: number;
  RCRIT_PBLANC_DE: string | null;  // 모집공고일
  RCEPT_BGNDE: string | null;     // 접수시작
  RCEPT_ENDDE: string | null;     // 접수종료
  SPSPLY_RCEPT_BGNDE: string | null; // 특별공급시작
  SPSPLY_RCEPT_ENDDE: string | null; // 특별공급종료
  GNRL_RNK1_CRSPAREA_RCPTDE: string | null;
  GNRL_RNK1_CRSPAREA_ENDDE: string | null;
  GNRL_RNK1_ETC_AREA_RCPTDE: string | null;
  GNRL_RNK1_ETC_AREA_ENDDE: string | null;
  GNRL_RNK2_CRSPAREA_RCPTDE: string | null;
  GNRL_RNK2_CRSPAREA_ENDDE: string | null;
  GNRL_RNK2_ETC_AREA_RCPTDE: string | null;
  GNRL_RNK2_ETC_AREA_ENDDE: string | null;
  PRZWNER_PRESNATN_DE: string | null; // 당첨자발표일
  CNTRCT_CNCLS_BGNDE: string | null;  // 계약시작
  CNTRCT_CNCLS_ENDDE: string | null;  // 계약종료
  MVN_PREARNGE_YM: string | null;     // 입주예정월
  CNSTRCT_ENTRPS_NM: string | null;   // 시공사
  BSNS_MBY_NM: string | null;         // 시행사
  HMPG_ADRES: string | null;
  PBLANC_URL: string | null;
  MDHS_TELNO: string | null;
}

interface UnitTypeApiItem {
  HOUSE_MANAGE_NO: string;
  PBLANC_NO: string;
  MODEL_NO: string;
  HOUSE_TY: string;
  SUPLY_AR: string;
  SUPLY_HSHLDCO: number;
  SPSPLY_HSHLDCO: number;
  LTTOT_TOP_AMOUNT: string;
  NWWDS_HSHLDCO: number;
  MNYCH_HSHLDCO: number;
  LFE_FRST_HSHLDCO: number;
  OLD_PARNTS_SUPORT_HSHLDCO: number;
  INSTT_RECOMEND_HSHLDCO: number;
  YGMN_HSHLDCO: number;
  NWBB_HSHLDCO: number;
  TRANSR_INSTT_ENFSN_HSHLDCO: number;
  ETC_HSHLDCO: number;
}

interface CompetitionApiItem {
  HOUSE_MANAGE_NO: string;
  PBLANC_NO: string;
  MODEL_NO: string;
  HOUSE_TY: string;
  SUBSCRPT_RANK_CODE: number;
  RESIDE_SECD: string;
  RESIDE_SENM: string;
  SUPLY_HSHLDCO: number;
  REQ_CNT: string;
  CMPET_RATE: string;
}

interface ScoreApiItem {
  HOUSE_MANAGE_NO: string;
  PBLANC_NO: string;
  MODEL_NO: string;
  HOUSE_TY: string;
  RESIDE_SECD: string;
  RESIDE_SENM: string;
  LWET_SCORE: string;
  TOP_SCORE: string;
  AVRG_SCORE: string;
}

interface SpecialStatusApiItem {
  HOUSE_MANAGE_NO: string;
  PBLANC_NO: string;
  HOUSE_TY: string;
  SUBSCRPT_RESULT_NM: string;
  SPSPLY_HSHLDCO: number;
  NWWDS_NMTW_HSHLDCO: number;
  MNYCH_HSHLDCO: number;
  LFE_FRST_HSHLDCO: number;
  OLD_PARNTS_SUPORT_HSHLDCO: number;
  INSTT_RECOMEND_HSHLDCO: number;
  YGMN_HSHLDCO: number;
  NWBB_NWBBSHR_HSHLDCO: number;
  TRANSR_INSTT_ENFSN_HSHLDCO: number;
  CRSPAREA_NWWDS_NMTW_CNT: number;
  CRSPAREA_MNYCH_CNT: number;
  CRSPAREA_LFE_FRST_CNT: number;
  CRSPAREA_OPS_CNT: number;
  CRSPAREA_YGMN_CNT: number;
  CRSPAREA_NWBB_NWBBSHR_CNT: number;
  ETC_AREA_NWWDS_NMTW_CNT: number;
  ETC_AREA_MNYCH_CNT: number;
  ETC_AREA_LFE_FRST_CNT: number;
  ETC_AREA_OPS_CNT: number;
  ETC_AREA_YGMN_CNT: number;
  ETC_AREA_NWBB_NWBBSHR_CNT: number;
  INSTT_RECOMEND_DCSN_CNT: number;
  INSTT_RECOMEND_PREPAR_CNT: number;
  TRANSR_INSTT_ENFSN_CNT: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDate(s: string | null | undefined): Date | null {
  if (!s || s.trim() === '') return null;
  const d = new Date(s.trim());
  return isNaN(d.getTime()) ? null : d;
}

function computeStatus(startDate: Date | null, endDate: Date | null): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!startDate) return 'closed';
  if (today < startDate) return 'upcoming';
  if (endDate && today > endDate) return 'closed';
  return 'ongoing';
}

function parseAmount(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = parseInt(s.replace(/,/g, '').trim(), 10);
  return isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// API fetch
// ---------------------------------------------------------------------------

async function fetchPage<T>(endpoint: string, page: number, params?: Record<string, string>, baseUrl = API_BASE): Promise<{ data: T[]; totalCount: number }> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY;
  if (!serviceKey) throw new Error('OPENAPI_SERVICE_KEY not set');

  const url = new URL(`${baseUrl}/${endpoint}`);
  // serviceKey는 직접 append — URLSearchParams가 +/= 등을 이중 인코딩하면 400 발생
  url.searchParams.set('page', String(page));
  url.searchParams.set('perPage', String(PER_PAGE));
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  const urlStr = `${url.toString()}&serviceKey=${serviceKey}`;

  const res = await fetch(urlStr);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error: ${res.status} ${res.statusText}\n${body}`);
  }
  const json = await res.json() as { data: T[]; totalCount: number };
  return { data: json.data ?? [], totalCount: json.totalCount ?? 0 };
}

async function fetchAll<T>(endpoint: string, params?: Record<string, string>, baseUrl = API_BASE): Promise<T[]> {
  const first = await fetchPage<T>(endpoint, 1, params, baseUrl);
  const totalPages = Math.ceil(first.totalCount / PER_PAGE);
  console.log(`  총 ${first.totalCount}건, ${totalPages}페이지`);

  const items = [...first.data];
  for (let page = 2; page <= totalPages; page++) {
    const { data } = await fetchPage<T>(endpoint, page, params, baseUrl);
    items.push(...data);
    if (page % 5 === 0) console.log(`  ${page}/${totalPages} 페이지 완료`);
  }
  return items;
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

function transformSubscription(item: SubscriptionApiItem) {
  const receptionStart = parseDate(item.RCEPT_BGNDE);
  const receptionEnd = parseDate(item.RCEPT_ENDDE);

  return {
    houseManageNo: item.HOUSE_MANAGE_NO,
    pblancNo: item.PBLANC_NO,
    houseName: item.HOUSE_NM,
    houseType: item.HOUSE_SECD_NM || 'APT',
    houseDetailType: item.HOUSE_DTL_SECD_NM || null,
    rentType: item.RENT_SECD_NM || null,
    regionName: item.SUBSCRPT_AREA_CODE_NM || '',
    supplyLocation: item.HSSPLY_ADRES || null,
    supplyZipCode: item.HSSPLY_ZIP || null,
    totalSupplyCount: item.TOT_SUPLY_HSHLDCO || null,
    announcementDate: parseDate(item.RCRIT_PBLANC_DE),
    receptionStartDate: receptionStart,
    receptionEndDate: receptionEnd,
    specialStartDate: parseDate(item.SPSPLY_RCEPT_BGNDE),
    specialEndDate: parseDate(item.SPSPLY_RCEPT_ENDDE),
    rank1AreaStartDate: parseDate(item.GNRL_RNK1_CRSPAREA_RCPTDE),
    rank1AreaEndDate: parseDate(item.GNRL_RNK1_CRSPAREA_ENDDE),
    rank1OtherStartDate: parseDate(item.GNRL_RNK1_ETC_AREA_RCPTDE),
    rank1OtherEndDate: parseDate(item.GNRL_RNK1_ETC_AREA_ENDDE),
    rank2AreaStartDate: parseDate(item.GNRL_RNK2_CRSPAREA_RCPTDE),
    rank2AreaEndDate: parseDate(item.GNRL_RNK2_CRSPAREA_ENDDE),
    rank2OtherStartDate: parseDate(item.GNRL_RNK2_ETC_AREA_RCPTDE),
    rank2OtherEndDate: parseDate(item.GNRL_RNK2_ETC_AREA_ENDDE),
    winnerDate: parseDate(item.PRZWNER_PRESNATN_DE),
    contractStartDate: parseDate(item.CNTRCT_CNCLS_BGNDE),
    contractEndDate: parseDate(item.CNTRCT_CNCLS_ENDDE),
    moveInMonth: item.MVN_PREARNGE_YM || null,
    constructorName: item.CNSTRCT_ENTRPS_NM || null,
    developerName: item.BSNS_MBY_NM || null,
    homepage: item.HMPG_ADRES || null,
    pblancUrl: item.PBLANC_URL || null,
    inquiryTel: item.MDHS_TELNO || null,
    status: computeStatus(receptionStart, receptionEnd),
  };
}

function transformUnitType(item: UnitTypeApiItem, subscriptionId: number) {
  return {
    subscriptionId,
    modelNo: item.MODEL_NO,
    houseType: item.HOUSE_TY || null,
    supplyArea: item.SUPLY_AR || null,
    generalCount: item.SUPLY_HSHLDCO ?? null,
    specialCount: item.SPSPLY_HSHLDCO ?? null,
    topAmount: parseAmount(item.LTTOT_TOP_AMOUNT),
    newlywedsCount: item.NWWDS_HSHLDCO ?? null,
    multiChildCount: item.MNYCH_HSHLDCO ?? null,
    firstLifeCount: item.LFE_FRST_HSHLDCO ?? null,
    elderlyCount: item.OLD_PARNTS_SUPORT_HSHLDCO ?? null,
    institutionCount: item.INSTT_RECOMEND_HSHLDCO ?? null,
    youthCount: item.YGMN_HSHLDCO ?? null,
    newbornCount: item.NWBB_HSHLDCO ?? null,
    transferCount: item.TRANSR_INSTT_ENFSN_HSHLDCO ?? null,
    etcCount: item.ETC_HSHLDCO ?? null,
  };
}

// ---------------------------------------------------------------------------
// Main sync
// ---------------------------------------------------------------------------

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`청약 분양정보 동기화 시작${isDryRun ? ' (dry-run)' : ''}`);

  // 1. 분양정보 전체 조회
  console.log('분양정보 API 조회 중...');
  const items = await fetchAll<SubscriptionApiItem>('getAPTLttotPblancDetail');
  console.log(`조회 완료: ${items.length}건`);

  if (isDryRun) {
    console.log('--- dry-run: 첫 2건 샘플 ---');
    console.log(JSON.stringify(items.slice(0, 2), null, 2));
    await prisma.$disconnect();
    return;
  }

  // 2. 분양정보 upsert
  let newCount = 0;
  let updateCount = 0;

  for (let i = 0; i < items.length; i++) {
    const data = transformSubscription(items[i]);
    const existing = await prisma.subscription.findUnique({
      where: { houseManageNo_pblancNo: { houseManageNo: data.houseManageNo, pblancNo: data.pblancNo } },
    });

    if (existing) {
      await prisma.subscription.update({ where: { id: existing.id }, data });
      updateCount++;
    } else {
      await prisma.subscription.create({ data });
      newCount++;
    }

    if ((i + 1) % 100 === 0) console.log(`  분양정보 ${i + 1}/${items.length} 처리`);
  }
  console.log(`분양정보 완료: 신규 ${newCount}, 업데이트 ${updateCount}`);

  // 3. 주택형별 상세 동기화 (최근 1년 공고만)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const recentSubscriptions = await prisma.subscription.findMany({
    where: { announcementDate: { gte: oneYearAgo } },
    select: { id: true, houseManageNo: true, pblancNo: true },
  });
  console.log(`주택형 동기화 대상: ${recentSubscriptions.length}건`);

  let unitCount = 0;
  for (let i = 0; i < recentSubscriptions.length; i++) {
    const sub = recentSubscriptions[i];
    try {
      const unitItems = await fetchAll<UnitTypeApiItem>('getAPTLttotPblancMdl', {
        'cond[HOUSE_MANAGE_NO::EQ]': sub.houseManageNo,
        'cond[PBLANC_NO::EQ]': sub.pblancNo,
      });

      // 기존 데이터 삭제 후 재삽입
      await prisma.subscriptionUnitType.deleteMany({ where: { subscriptionId: sub.id } });
      if (unitItems.length > 0) {
        await prisma.subscriptionUnitType.createMany({
          data: unitItems.map(item => transformUnitType(item, sub.id)),
        });
        unitCount += unitItems.length;
      }
    } catch (err) {
      console.warn(`  주택형 조회 실패 (${sub.houseManageNo}): ${err instanceof Error ? err.message : err}`);
    }

    if ((i + 1) % 50 === 0) console.log(`  주택형 ${i + 1}/${recentSubscriptions.length} 처리`);
  }
  console.log(`주택형 동기화 완료: ${unitCount}건`);

  // 4. 경쟁률 동기화
  console.log('경쟁률 API 조회 중...');
  const competitionItems = await fetchAll<CompetitionApiItem>('getAPTLttotPblancCmpet', undefined, API_BASE_CMPET);
  console.log(`경쟁률 조회 완료: ${competitionItems.length}건`);

  let competitionCount = 0;
  for (let i = 0; i < competitionItems.length; i++) {
    const item = competitionItems[i];
    const sub = await prisma.subscription.findUnique({
      where: { houseManageNo_pblancNo: { houseManageNo: item.HOUSE_MANAGE_NO, pblancNo: item.PBLANC_NO } },
      select: { id: true },
    });
    if (!sub) continue;

    await prisma.subscriptionCompetition.upsert({
      where: {
        subscriptionId_modelNo_rank_regionCode: {
          subscriptionId: sub.id,
          modelNo: item.MODEL_NO,
          rank: item.SUBSCRPT_RANK_CODE,
          regionCode: item.RESIDE_SECD,
        },
      },
      update: {
        houseType: item.HOUSE_TY || null,
        regionName: item.RESIDE_SENM || null,
        supplyCount: item.SUPLY_HSHLDCO ?? null,
        applicantCount: parseInt(item.REQ_CNT) || null,
        competitionRate: item.CMPET_RATE || null,
      },
      create: {
        subscriptionId: sub.id,
        modelNo: item.MODEL_NO,
        houseType: item.HOUSE_TY || null,
        rank: item.SUBSCRPT_RANK_CODE,
        regionCode: item.RESIDE_SECD,
        regionName: item.RESIDE_SENM || null,
        supplyCount: item.SUPLY_HSHLDCO ?? null,
        applicantCount: parseInt(item.REQ_CNT) || null,
        competitionRate: item.CMPET_RATE || null,
      },
    });
    competitionCount++;
    if ((i + 1) % 500 === 0) console.log(`  경쟁률 ${i + 1}/${competitionItems.length} 처리`);
  }
  console.log(`경쟁률 동기화 완료: ${competitionCount}건`);

  // 5. 당첨 가점 동기화
  console.log('당첨 가점 API 조회 중...');
  const scoreItems = await fetchAll<ScoreApiItem>('getAptLttotPblancScore', undefined, API_BASE_CMPET);
  console.log(`당첨 가점 조회 완료: ${scoreItems.length}건`);

  let scoreCount = 0;
  for (let i = 0; i < scoreItems.length; i++) {
    const item = scoreItems[i];
    const sub = await prisma.subscription.findUnique({
      where: { houseManageNo_pblancNo: { houseManageNo: item.HOUSE_MANAGE_NO, pblancNo: item.PBLANC_NO } },
      select: { id: true },
    });
    if (!sub) continue;

    await prisma.subscriptionScore.upsert({
      where: {
        subscriptionId_modelNo_regionCode: {
          subscriptionId: sub.id,
          modelNo: item.MODEL_NO,
          regionCode: item.RESIDE_SECD,
        },
      },
      update: {
        houseType: item.HOUSE_TY || null,
        regionName: item.RESIDE_SENM || null,
        minScore: item.LWET_SCORE || null,
        maxScore: item.TOP_SCORE || null,
        avgScore: item.AVRG_SCORE || null,
      },
      create: {
        subscriptionId: sub.id,
        modelNo: item.MODEL_NO,
        houseType: item.HOUSE_TY || null,
        regionCode: item.RESIDE_SECD,
        regionName: item.RESIDE_SENM || null,
        minScore: item.LWET_SCORE || null,
        maxScore: item.TOP_SCORE || null,
        avgScore: item.AVRG_SCORE || null,
      },
    });
    scoreCount++;
    if ((i + 1) % 500 === 0) console.log(`  당첨 가점 ${i + 1}/${scoreItems.length} 처리`);
  }
  console.log(`당첨 가점 동기화 완료: ${scoreCount}건`);

  // 6. 특별공급 신청현황 동기화
  console.log('특별공급 신청현황 API 조회 중...');
  const specialItems = await fetchAll<SpecialStatusApiItem>('getAPTSpsplyReqstStus', undefined, API_BASE_CMPET);
  console.log(`특별공급 신청현황 조회 완료: ${specialItems.length}건`);

  let specialCount = 0;
  for (let i = 0; i < specialItems.length; i++) {
    const item = specialItems[i];
    const sub = await prisma.subscription.findUnique({
      where: { houseManageNo_pblancNo: { houseManageNo: item.HOUSE_MANAGE_NO, pblancNo: item.PBLANC_NO } },
      select: { id: true },
    });
    if (!sub) continue;

    const houseType = item.HOUSE_TY || '';
    await prisma.subscriptionSpecialStatus.upsert({
      where: {
        subscriptionId_houseType: {
          subscriptionId: sub.id,
          houseType,
        },
      },
      update: {
        resultName: item.SUBSCRPT_RESULT_NM || null,
        specialSupplyCount: item.SPSPLY_HSHLDCO ?? null,
        newlywedsSupply: item.NWWDS_NMTW_HSHLDCO ?? null,
        multiChildSupply: item.MNYCH_HSHLDCO ?? null,
        firstLifeSupply: item.LFE_FRST_HSHLDCO ?? null,
        elderlySupply: item.OLD_PARNTS_SUPORT_HSHLDCO ?? null,
        institutionSupply: item.INSTT_RECOMEND_HSHLDCO ?? null,
        youthSupply: item.YGMN_HSHLDCO ?? null,
        newbornSupply: item.NWBB_NWBBSHR_HSHLDCO ?? null,
        transferSupply: item.TRANSR_INSTT_ENFSN_HSHLDCO ?? null,
        newlywedsAreaCount: item.CRSPAREA_NWWDS_NMTW_CNT ?? null,
        multiChildAreaCount: item.CRSPAREA_MNYCH_CNT ?? null,
        firstLifeAreaCount: item.CRSPAREA_LFE_FRST_CNT ?? null,
        elderlyAreaCount: item.CRSPAREA_OPS_CNT ?? null,
        youthAreaCount: item.CRSPAREA_YGMN_CNT ?? null,
        newbornAreaCount: item.CRSPAREA_NWBB_NWBBSHR_CNT ?? null,
        newlywedsOtherCount: item.ETC_AREA_NWWDS_NMTW_CNT ?? null,
        multiChildOtherCount: item.ETC_AREA_MNYCH_CNT ?? null,
        firstLifeOtherCount: item.ETC_AREA_LFE_FRST_CNT ?? null,
        elderlyOtherCount: item.ETC_AREA_OPS_CNT ?? null,
        youthOtherCount: item.ETC_AREA_YGMN_CNT ?? null,
        newbornOtherCount: item.ETC_AREA_NWBB_NWBBSHR_CNT ?? null,
        institutionDecisionCount: item.INSTT_RECOMEND_DCSN_CNT ?? null,
        institutionPrepareCount: item.INSTT_RECOMEND_PREPAR_CNT ?? null,
        transferCount: item.TRANSR_INSTT_ENFSN_CNT ?? null,
      },
      create: {
        subscriptionId: sub.id,
        houseType,
        resultName: item.SUBSCRPT_RESULT_NM || null,
        specialSupplyCount: item.SPSPLY_HSHLDCO ?? null,
        newlywedsSupply: item.NWWDS_NMTW_HSHLDCO ?? null,
        multiChildSupply: item.MNYCH_HSHLDCO ?? null,
        firstLifeSupply: item.LFE_FRST_HSHLDCO ?? null,
        elderlySupply: item.OLD_PARNTS_SUPORT_HSHLDCO ?? null,
        institutionSupply: item.INSTT_RECOMEND_HSHLDCO ?? null,
        youthSupply: item.YGMN_HSHLDCO ?? null,
        newbornSupply: item.NWBB_NWBBSHR_HSHLDCO ?? null,
        transferSupply: item.TRANSR_INSTT_ENFSN_HSHLDCO ?? null,
        newlywedsAreaCount: item.CRSPAREA_NWWDS_NMTW_CNT ?? null,
        multiChildAreaCount: item.CRSPAREA_MNYCH_CNT ?? null,
        firstLifeAreaCount: item.CRSPAREA_LFE_FRST_CNT ?? null,
        elderlyAreaCount: item.CRSPAREA_OPS_CNT ?? null,
        youthAreaCount: item.CRSPAREA_YGMN_CNT ?? null,
        newbornAreaCount: item.CRSPAREA_NWBB_NWBBSHR_CNT ?? null,
        newlywedsOtherCount: item.ETC_AREA_NWWDS_NMTW_CNT ?? null,
        multiChildOtherCount: item.ETC_AREA_MNYCH_CNT ?? null,
        firstLifeOtherCount: item.ETC_AREA_LFE_FRST_CNT ?? null,
        elderlyOtherCount: item.ETC_AREA_OPS_CNT ?? null,
        youthOtherCount: item.ETC_AREA_YGMN_CNT ?? null,
        newbornOtherCount: item.ETC_AREA_NWBB_NWBBSHR_CNT ?? null,
        institutionDecisionCount: item.INSTT_RECOMEND_DCSN_CNT ?? null,
        institutionPrepareCount: item.INSTT_RECOMEND_PREPAR_CNT ?? null,
        transferCount: item.TRANSR_INSTT_ENFSN_CNT ?? null,
      },
    });
    specialCount++;
    if ((i + 1) % 500 === 0) console.log(`  특별공급 ${i + 1}/${specialItems.length} 처리`);
  }
  console.log(`특별공급 신청현황 동기화 완료: ${specialCount}건`);

  // 7. SyncHistory 기록
  await prisma.syncHistory.create({
    data: {
      category: 'subscription',
      status: 'success',
      totalRecords: items.length,
      newRecords: newCount,
      updatedRecords: updateCount,
      completedAt: new Date(),
    },
  });

  console.log('청약 동기화 완료');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('청약 동기화 실패:', err);
  await prisma.syncHistory.create({
    data: {
      category: 'subscription',
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
      completedAt: new Date(),
    },
  }).catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
