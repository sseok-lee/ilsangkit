// IndexNow API 서비스
// 네이버/Bing 등 IndexNow 지원 검색엔진에 URL 변경을 즉시 알림

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
 * 부동산 건물 URL 목록 생성
 * 부동산 상세 페이지: /real-estate/[propertyType]/[buildingName]?bjdCode=[bjdCode]
 */
export function buildRealEstateUrls(
  propertyType: string,
  buildings: Array<{ buildingName: string; bjdCode: string }>
): string[] {
  return buildings.map(
    (b) =>
      `https://${SITE_HOST}/real-estate/${propertyType}/${encodeURIComponent(b.buildingName)}?bjdCode=${b.bjdCode}`
  );
}
