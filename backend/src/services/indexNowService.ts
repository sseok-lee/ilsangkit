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

/**
 * IndexNow API로 URL 목록을 제출한다.
 * INDEXNOW_KEY 환경 변수가 없으면 조용히 스킵한다 (개발 환경 등).
 */
export async function submitIndexNow(urls: string[]): Promise<void> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    console.info('[IndexNow] INDEXNOW_KEY not set, skipping submission');
    return;
  }

  if (urls.length === 0) {
    return;
  }

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
      } else {
        const body = await response.text().catch(() => '');
        console.error(`[IndexNow] Failed: ${response.status} ${response.statusText} — ${body}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[IndexNow] Request error: ${msg}`);
    }
  }
}

/**
 * 시설 카테고리 URL 목록 생성
 * 시설 상세 페이지: /[category]/[id]
 */
export function buildFacilityUrls(category: string, ids: string[]): string[] {
  return ids.map((id) => `https://${SITE_HOST}/${category}/${id}`);
}

/**
 * 부동산 건물 URL 목록 생성 (레거시 single-propertyType 시그니처).
 *
 * - isValidBuildingName()로 지번/thin buildingName 필터
 * - buildingName은 `.normalize('NFC')` 후 `encodeURIComponent`
 *
 * 현재 URL 포맷: /real-estate/{propertyType}/{buildingName}?bjdCode={bjdCode}
 * US-008 에서 새 URL 포맷용 시그니처 추가 예정.
 */
export function buildRealEstateUrls(
  propertyType: string,
  buildings: Array<{ buildingName: string; bjdCode: string }>
): string[] {
  return buildings
    .filter((b) => isValidBuildingName(b.buildingName))
    .map((b) => {
      const nfcName = b.buildingName.normalize('NFC');
      return `https://${SITE_HOST}/real-estate/${propertyType}/${encodeURIComponent(nfcName)}?bjdCode=${b.bjdCode}`;
    });
}

/**
 * 신규 URL 포맷 기반 IndexNow URL 빌더 (US-008).
 *
 * 신규 URL:  `/real-estate/{realEstateType}/{citySlug}/{districtSlug}/{buildingName}`
 *
 * - `isValidBuildingName` 으로 지번/thin 입력 필터.
 * - city/district는 DB 원본 한글 그대로 받아 `toRealEstateUrl` 내부에서 slug 변환 + NFC 정규화.
 * - 빈 입력은 빈 배열을 반환한다.
 */
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
