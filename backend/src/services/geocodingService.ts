// @TASK T2.3.3 - Kakao 지오코딩 서비스
// @SPEC docs/planning/02-trd.md#데이터-동기화

/**
 * 좌표 타입
 */
export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Kakao 지오코딩 API 응답
 */
interface KakaoGeocodingResponse {
  documents: Array<{
    x: string; // 경도 (longitude)
    y: string; // 위도 (latitude)
    address_name?: string;
  }>;
}

/**
 * 배치 지오코딩 옵션
 */
export interface BatchGeocodeOptions {
  /** 배치 크기 (기본값: 10) */
  batchSize?: number;
  /** 배치 간 딜레이 (ms, 기본값: 200) */
  delayMs?: number;
}

/**
 * 지정된 시간만큼 대기
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 배열을 지정된 크기의 청크로 분할
 */
export function chunks<T>(arr: T[], size: number): T[][] {
  if (arr.length === 0) return [];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/**
 * 주소를 좌표로 변환 (Kakao 지오코딩 API)
 *
 * @param address - 변환할 주소
 * @returns 좌표 또는 null (실패 시)
 */
export async function geocode(address: string): Promise<Coordinates | null> {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    console.error('KAKAO_REST_API_KEY environment variable is not set');
    return null;
  }

  try {
    const url = `https://dapi.kakao.com/v2/local/search/address?query=${encodeURIComponent(address)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `KakaoAK ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.error(`Geocoding API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = (await response.json()) as KakaoGeocodingResponse;

    if (data.documents.length === 0) {
      return null;
    }

    const doc = data.documents[0];
    return {
      lat: parseFloat(doc.y),
      lng: parseFloat(doc.x),
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * 여러 주소를 배치로 지오코딩
 * Rate limit을 고려하여 배치 처리
 *
 * @param addresses - 변환할 주소 배열
 * @param options - 배치 옵션
 * @returns 좌표 배열 (실패한 경우 null)
 */
export async function batchGeocode(
  addresses: string[],
  options: BatchGeocodeOptions = {}
): Promise<(Coordinates | null)[]> {
  if (addresses.length === 0) return [];

  const { batchSize = 10, delayMs = 200 } = options;
  const results: (Coordinates | null)[] = [];
  const batches = chunks(addresses, batchSize);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    // 배치 내 병렬 처리
    const batchResults = await Promise.all(
      batch.map((address) => geocode(address))
    );

    results.push(...batchResults);

    // 마지막 배치가 아니면 딜레이
    if (i < batches.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return results;
}
