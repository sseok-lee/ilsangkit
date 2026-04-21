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
 * 레거시 URL 포맷 `/real-estate/{propertyType}/{buildingName}?bjdCode={bjdCode}` 빌더.
 *
 * 기존 6개 sync 스크립트가 아직 호출 중. 신규 URL로의 cutover 는 후속 PR에서 수행하며,
 * 그때까지 레거시 요청은 redirect middleware 가 단일 홉 301 로 새 URL로 보냄.
 * 두 빌더 모두 isValidBuildingName + NFC 정규화를 공유한다.
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
 * 신규 URL 포맷 빌더: `/real-estate/{realEstateType}/{citySlug}/{districtSlug}/{buildingName}`.
 *
 * city/district는 DB 원본 한글 그대로 받는다 — slug 변환은 `toAbsoluteRealEstateUrl` 내부에서 일어난다.
 * 이로 인해 sitemap/IndexNow/OG 모든 경로가 같은 유틸을 거쳐 NFC-인코딩 URL 동등성을 유지한다 (AC16).
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
