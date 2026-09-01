// IndexNow API 서비스
// 네이버/Bing 등 IndexNow 지원 검색엔진에 URL 변경을 즉시 알림

import { isValidBuildingName } from '../lib/realEstateBuildingName.js';
import {
  toAbsoluteRealEstateUrl,
  type RealEstateUrlType,
} from '../lib/realEstateUrl.js';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const SITE_HOST = 'ilsangkit.co.kr';
const KEY_LOCATION = `https://${SITE_HOST}/a874a0a13ad86694a40ca8e2dd9a5698.txt`;
const MAX_URLS_PER_REQUEST = 10_000;

export interface IndexNowResult {
  submitted: number;
  failed: number;
}

/**
 * IndexNow API로 URL 목록을 제출한다.
 * INDEXNOW_KEY 환경 변수가 없으면 조용히 스킵한다 (개발 환경 등).
 * 반환값으로 배치 단위 성공/실패 URL 수를 알려준다 — 백필처럼 커서를
 * 전진시켜야 하는 호출자가 실패 시 중단 판단에 쓴다.
 */
export async function submitIndexNow(urls: string[]): Promise<IndexNowResult> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    console.info('[IndexNow] INDEXNOW_KEY not set, skipping submission');
    return { submitted: 0, failed: 0 };
  }

  if (urls.length === 0) {
    return { submitted: 0, failed: 0 };
  }

  let submitted = 0;
  let failed = 0;

  // 10,000개 단위로 분할
  for (let i = 0; i < urls.length; i += MAX_URLS_PER_REQUEST) {
    const batch = urls.slice(i, i + MAX_URLS_PER_REQUEST);

    try {
      const response = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host: SITE_HOST,
          key,
          keyLocation: KEY_LOCATION,
          urlList: batch,
        }),
      });

      // 200 = 성공, 202 = 수신됨 (둘 다 정상)
      if (response.ok || response.status === 202) {
        console.info(`[IndexNow] Submitted ${batch.length} URLs (status: ${response.status})`);
        submitted += batch.length;
      } else {
        const body = await response.text().catch(() => '');
        console.error(`[IndexNow] Failed: ${response.status} ${response.statusText} — ${body}`);
        failed += batch.length;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[IndexNow] Request error: ${msg}`);
      failed += batch.length;
    }
  }

  return { submitted, failed };
}

/**
 * 시설 카테고리 URL 목록 생성
 * 시설 상세 페이지: /[category]/[id]
 */
export function buildFacilityUrls(category: string, ids: string[]): string[] {
  return ids.map((id) => `https://${SITE_HOST}/${category}/${id}`);
}

/**
 * 지하철역 SEO URL 목록: /subway/{nameSlug}.
 * Phase 1에서는 noindex 정책으로 IndexNow 제출 자체가 비활성화되어 있다 (SUBWAY_INDEX_NOW_ENABLED).
 */
export function buildSubwayUrls(slugs: string[]): string[] {
  return slugs.map((slug) => `https://${SITE_HOST}/subway/${slug}`);
}

/**
 * 신규 URL 포맷 빌더: `/real-estate/{realEstateType}/{citySlug}/{districtSlug}/{buildingName}`.
 *
 * city/district는 DB 원본 한글 그대로 받는다 — slug 변환은 `toAbsoluteRealEstateUrl` 내부에서 일어난다.
 * 이로 인해 sitemap/IndexNow/OG 모든 경로가 같은 유틸을 거쳐 NFC-인코딩 URL 동등성을 유지한다 (AC16).
 */
/**
 * 부동산 거래 모델의 findMany 최소 형태. 6개 거래 모델(apt/villa/offitel × sale/rent)이
 * 이 시그니처를 공유하므로 델리게이트로 받아 한 곳에서 처리한다.
 */
export interface TransactionBuildingDelegate {
  findMany(args: {
    where: { createdAt: { gte: Date }; syncedAt: { gte: Date } };
    select: { buildingName: true; city: true; district: true };
    distinct: ['buildingName', 'city', 'district'];
  }): Promise<Array<{ buildingName: string; city: string; district: string }>>;
}

/**
 * 신규 거래가 생긴 건물의 상세페이지 URL 을 IndexNow 로 제출한다.
 *
 * ## where 조건에 createdAt 과 syncedAt 을 함께 거는 이유
 *
 * 부동산 sync 는 매일 최근 2개월 거래내역을 재수집한다(sync-real-estate.yml 이
 * `--from PREV_YM --to CURRENT_YM` 을 넘긴다). 거래는 append-only 인데 upsert 가
 * 같은 행을 다시 쓰면서 syncedAt 을 갱신하므로, syncedAt 만으로 대상을 뽑으면
 * "내용이 어제와 같은 건물"까지 전부 제출된다.
 *
 * 2026-08-27 프로덕션 실측:
 *   제출(syncedAt) 76,832/일  vs  실제 신규(createdAt) 7,564/일 → 10.2배 과잉
 *   네이버 Yeti 수집 능력은 8,789/일 이므로 과잉 제출은 신호를 소음으로 만든다.
 *
 * - createdAt: 신규 거래행만 고른다. 건물 페이지는 거래가 추가될 때 내용이 바뀐다.
 * - syncedAt: 인덱스가 이 컬럼에만 있다(createdAt 인덱스는 6개 테이블 전부 없음).
 *   신규 행은 createdAt(@default(now()))과 syncedAt(명시 대입)이 같은 시점에 박히므로
 *   createdAt>=X ⟹ syncedAt>=X 이고, AND 는 결과를 바꾸지 않으면서 range scan 을 얻는다.
 *   EXPLAIN 확인: key=<Model>_syncedAt_idx, type=range, Using index condition.
 *
 * 한계: 거래 취소·정정처럼 기존 행을 UPDATE 하는 변경은 잡지 못한다. 드문 이벤트이고
 * Prisma `@updatedAt` 은 값이 같아도 갱신되어 실변경과 재작성을 구분할 수 없다.
 *
 * ## 2026-09-01 호출부 비활성화 (6개 sync 스크립트 전부 주석 처리)
 *
 * 이 함수는 살아 있지만 부동산 sync 에서 호출하지 않는다. 위 8/27 수정으로 제출량이
 * 76,832/일 → 평일 5,000~8,000/일이 됐는데, 그 잔여량이 네이버 Yeti 의 하루 총
 * 크롤량과 같은 자릿수라 여전히 크롤 큐를 부동산이 독점한다.
 *
 * 2026-09-01 실측:
 *   제출(수정 후, KST 요일별)  금 6,999 · 토 4,971 · 일 100 · 월 93 · 화 8,105
 *     → 일·월이 낮은 것은 월말 효과가 아니라 주말이다(국토부 신고가 평일에만 처리된다).
 *       평일 정상 수준은 5,000~8,000/일. 단 수정 후 평일 표본이 3일뿐이라 잠정치다.
 *   Yeti 총 크롤            6,274/일 (8/31 nginx) — 제출이 크롤 능력의 약 107%
 *   Yeti 경로 배분(8/29~31)  /real-estate 요청 47.9% (고유 2,491 URL/일, 1.27회/URL)
 *   시설 상세 크롤           1,541/일 → 28.8만 개 1회전에 185일
 *
 * 제출은 크롤 예산을 소비하지 않는다(POST 1회). 그러나 크롤 큐의 우선순위를 가져간다.
 * 시설 상세는 네이버 색인 안에서 title 이 화석('일상킷')이라 시설명 쿼리에 아예
 * retrieval 되지 않는데(라이브 title 로 웹문서 검색 시 미노출 실증), 그 복구는
 * 재크롤로만 가능하다. 부동산 상세는 이미 색인이 정상이라 재크롤 가치가 낮다.
 *
 * 복구 조건: Yeti 경로 배분에서 /real-estate 비중이 내려가고 시설 상세 크롤이 오르면,
 * 거래건수 게이트(사이트맵 게이트와 같은 임계값)를 걸어 재활성화한다. 전량 복구는 하지 않는다.
 * 관측: `gh run view <id> --log | grep 'Submitted .* URLs'` / nginx Yeti 경로 집계.
 */
export async function submitNewlyTransactedBuildings(
  delegate: TransactionBuildingDelegate,
  realEstateType: RealEstateUrlType,
  label: string,
  since: Date,
): Promise<IndexNowResult> {
  const buildings = await delegate.findMany({
    where: {
      createdAt: { gte: since },
      syncedAt: { gte: since },
    },
    select: { buildingName: true, city: true, district: true },
    distinct: ['buildingName', 'city', 'district'],
  });

  // 지번/thin buildingName 은 buildRealEstateUrlsV2 가 걸러낸다 — SEO 저품질 URL 제출 방지
  const urls = buildRealEstateUrlsV2(
    buildings.map((b) => ({
      realEstateType,
      city: b.city,
      district: b.district,
      buildingName: b.buildingName,
    })),
  );

  console.info(
    `[${label}] IndexNow: ${buildings.length} candidates → ${urls.length} valid (filtered ${buildings.length - urls.length})`,
  );

  if (urls.length === 0) {
    return { submitted: 0, failed: 0 };
  }

  return submitIndexNow(urls);
}

export function buildRealEstateUrlsV2(
  items: Array<{
    realEstateType: RealEstateUrlType;
    city: string;
    district: string;
    buildingName: string;
  }>
): string[] {
  const origin = `https://${SITE_HOST}`;
  return items
    .filter((it) => isValidBuildingName(it.buildingName))
    .map((it) =>
      toAbsoluteRealEstateUrl(origin, {
        type: it.realEstateType,
        city: it.city,
        district: it.district,
        buildingName: it.buildingName,
      }),
    );
}
