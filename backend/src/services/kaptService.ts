const KAPT_BASE_URL = 'https://apis.data.go.kr/B552555/kapt';

interface KaptListItem {
  kaptCode: string;
  kaptName: string;
  sido: string;
  sigungu: string;
  bjdCode?: string;
}

interface KaptDetailItem {
  kaptCode?: string;
  kaptName?: string;
  kaptTotalHo?: string;
  kaptDongCnt?: string;
  kaptdaCnt?: string;
  kaptMgmtChrg?: string;
  kaptElevnCnt?: string;
  kaptHeatKind?: string;
}

export interface KaptComplexInfo {
  kaptCode: string;
  kaptName: string;
  totalHouseholds: number | null;
  totalBuildings: number | null;
  parkingPerHousehold: number | null;
  avgManagementFee: number | null;
  elevatorCount: number | null;
  heatingType: string | null;
}

function toNum(s: string | undefined | null): number | null {
  if (!s || s.trim() === '' || s.trim() === '-') return null;
  const n = parseFloat(s.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function toInt(s: string | undefined | null): number | null {
  const n = toNum(s);
  return n !== null ? Math.round(n) : null;
}

function normalizeItems<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === 'object' && raw !== null && 'item' in raw) {
    const item = (raw as { item: unknown }).item;
    return Array.isArray(item) ? (item as T[]) : [item as T];
  }
  return [];
}

async function fetchKaptJson(url: URL): Promise<unknown> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY;
  if (!serviceKey) throw new Error('OPENAPI_SERVICE_KEY is not set');
  url.searchParams.set('serviceKey', serviceKey);
  url.searchParams.set('type', 'json');
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`K-apt HTTP ${res.status}`);
  return res.json();
}

export async function getKaptInfo(
  buildingName: string,
  city?: string,
  district?: string,
): Promise<KaptComplexInfo | null> {
  try {
    const searchUrl = new URL(`${KAPT_BASE_URL}/kaptbyname`);
    searchUrl.searchParams.set('kaptName', buildingName);
    searchUrl.searchParams.set('pageNo', '1');
    searchUrl.searchParams.set('numOfRows', '10');

    const searchData = await fetchKaptJson(searchUrl) as {
      response?: { header?: { resultCode?: string }; body?: { totalCount?: number; items?: unknown } };
    };

    const searchBody = searchData?.response?.body;
    if (!searchBody || !searchBody.totalCount) return null;

    const items = normalizeItems<KaptListItem>(searchBody.items);
    if (items.length === 0) return null;

    let match: KaptListItem | undefined;
    if (city || district) {
      const cityShort = city?.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '').substring(0, 2) ?? '';
      const districtShort = district?.substring(0, 2) ?? '';
      match = items.find(
        (item) =>
          (!cityShort || item.sido?.includes(cityShort)) &&
          (!districtShort || item.sigungu?.includes(districtShort)),
      );
      if (!match) return null;
    } else {
      match = items[0];
    }
    if (!match) return null;

    const detailUrl = new URL(`${KAPT_BASE_URL}/kaptdetail`);
    detailUrl.searchParams.set('kaptCode', match.kaptCode);

    const detailData = await fetchKaptJson(detailUrl) as {
      response?: { body?: { item?: unknown; items?: unknown } };
    };

    const detailBody = detailData?.response?.body;
    if (!detailBody) return null;

    let detail: KaptDetailItem | null = null;
    if (detailBody.item && typeof detailBody.item === 'object') {
      detail = detailBody.item as KaptDetailItem;
    } else {
      const detailItems = normalizeItems<KaptDetailItem>(detailBody.items);
      detail = detailItems[0] ?? null;
    }
    if (!detail) return null;

    const mgmtFeeWon = toNum(detail.kaptMgmtChrg);

    return {
      kaptCode: match.kaptCode,
      kaptName: detail.kaptName || match.kaptName,
      totalHouseholds: toInt(detail.kaptTotalHo),
      totalBuildings: toInt(detail.kaptDongCnt),
      parkingPerHousehold: toNum(detail.kaptdaCnt),
      avgManagementFee: mgmtFeeWon !== null ? Math.round(mgmtFeeWon / 10000) : null,
      elevatorCount: toInt(detail.kaptElevnCnt),
      heatingType: detail.kaptHeatKind?.trim() || null,
    };
  } catch (err) {
    console.warn('[kaptService] getKaptInfo failed:', err);
    return null;
  }
}
