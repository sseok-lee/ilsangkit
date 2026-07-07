import type { FacilityCategory } from '~/types/facility'

/**
 * 카테고리별 공공 데이터 출처 정보 (공공누리 표기 준수)
 *
 * 각 API 제공처의 이용 약관상 출처 표기 요건:
 * - 제공기관명
 * - 데이터셋명 (저작물명)
 * - 공공누리 유형 (1/2/3/4) — 제공처 페이지에서 확인 후 채울 것
 *
 * NOTE: 데이터셋명은 공공데이터포털 등록 제목 기준 추정치이며,
 * 공식 표기와 미세 차이가 있을 수 있음. 검수 후 수정.
 */
export interface DataSourceInfo {
  /** 표시용 데이터셋(저작물) 이름 */
  datasetName: string
  /** 제공기관명 */
  provider: string
  /** 공공데이터포털/제공기관 데이터셋 상세 URL */
  url: string
  /** 공공누리(KOGL) 유형 — 미확인 시 undefined (UI에서 표시 생략) */
  kogl?: 1 | 2 | 3 | 4
}

export const FACILITY_DATA_SOURCE: Record<FacilityCategory, DataSourceInfo> = {
  toilet: {
    datasetName: '전국 공중화장실 표준데이터',
    provider: '행정안전부',
    url: 'https://www.data.go.kr/data/15012892/standard.do',
  },
  trash: {
    datasetName: '생활폐기물 배출일정 정보',
    provider: '환경부',
    url: 'https://www.data.go.kr/data/15155080/openapi.do',
  },
  wifi: {
    datasetName: '전국 무료 와이파이 표준데이터',
    provider: '과학기술정보통신부',
    url: 'https://www.data.go.kr/data/15013116/standard.do',
  },
  clothes: {
    datasetName: '전국 의류수거함 표준데이터',
    provider: '행정안전부',
    url: 'https://www.data.go.kr/data/15139214/standard.do',
  },
  parking: {
    datasetName: '전국 주차장 표준데이터',
    provider: '행정안전부',
    url: 'https://www.data.go.kr/data/15012896/standard.do',
  },
  aed: {
    datasetName: '전국 자동심장충격기(AED) 현황',
    provider: '보건복지부',
    url: 'https://www.data.go.kr/data/15000652/openapi.do',
  },
  library: {
    datasetName: '전국 공공도서관 표준데이터',
    provider: '문화체육관광부',
    url: 'https://www.data.go.kr/data/15013109/standard.do',
  },
  hospital: {
    datasetName: '건강보험심사평가원 병원 정보',
    provider: '건강보험심사평가원',
    url: 'https://www.data.go.kr/data/15001698/openapi.do',
    kogl: 1, // 페이지 "출처표시(제1유형)" 명시 확인 (2026-06)
  },
  pharmacy: {
    datasetName: '건강보험심사평가원 약국 정보',
    provider: '건강보험심사평가원',
    url: 'https://www.data.go.kr/data/15000576/openapi.do',
  },
  park: {
    datasetName: '전국 도시공원 표준데이터',
    provider: '행정안전부',
    url: 'https://www.data.go.kr/data/15012890/standard.do',
  },
  school: {
    datasetName: '전국 초중등학교 표준데이터',
    provider: '교육부',
    url: 'https://www.data.go.kr/data/15021148/standard.do',
  },
  market: {
    datasetName: '전국 전통시장 표준데이터',
    provider: '소상공인시장진흥공단',
    url: 'https://www.data.go.kr/data/15012894/standard.do',
  },
  childcare: {
    datasetName: '어린이집정보공시',
    provider: '보건복지부',
    url: 'https://info.childcare.go.kr/',
  },
  'ev-charger': {
    datasetName: '전기차 충전소 운영정보',
    provider: '한국환경공단',
    url: 'https://www.data.go.kr/data/15076352/openapi.do',
    kogl: 1, // 페이지 "출처표시(제1유형)" 명시 확인 (2026-06)
  },
  sports: {
    datasetName: '전국 공공체육시설 표준데이터',
    provider: '문화체육관광부',
    url: 'https://www.data.go.kr/data/15107764/openapi.do',
  },
  subway: {
    datasetName: '전국도시철도역사정보표준데이터',
    provider: '국토교통부',
    url: 'https://www.data.go.kr/data/15013205/standard.do',
  },
}

export const REAL_ESTATE_DATA_SOURCE: DataSourceInfo = {
  datasetName: '국토교통부 실거래가 공개시스템',
  provider: '국토교통부',
  url: 'https://rt.molit.go.kr',
}

/**
 * 부동산 실거래가 세부 데이터셋 (공공데이터포털 OpenAPI)
 * about 페이지 출처 테이블 등 데이터셋 단위 출처 표기가 필요한 곳에서 사용.
 * 사이트 UI(DataSourceSection)는 요약본 REAL_ESTATE_DATA_SOURCE를 사용.
 */
export const REAL_ESTATE_DATASETS: DataSourceInfo[] = [
  {
    datasetName: '아파트 매매 실거래가 자료',
    provider: '국토교통부',
    url: 'https://www.data.go.kr/data/15057511/openapi.do',
  },
  {
    datasetName: '아파트 전월세 실거래가 자료',
    provider: '국토교통부',
    url: 'https://www.data.go.kr/data/15058017/openapi.do',
  },
  {
    datasetName: '연립다세대 매매·전월세 실거래가 자료',
    provider: '국토교통부',
    url: 'https://www.data.go.kr/data/15058038/openapi.do',
  },
  {
    datasetName: '오피스텔 매매·전월세 실거래가 자료',
    provider: '국토교통부',
    url: 'https://www.data.go.kr/data/15058452/openapi.do',
  },
  {
    datasetName: '토지 매매 실거래가 자료',
    provider: '국토교통부',
    url: 'https://www.data.go.kr/data/15126466/openapi.do',
  },
]

export const SUBSCRIPTION_DATA_SOURCE: DataSourceInfo = {
  datasetName: '한국부동산원_청약Home 청약정보 API',
  provider: '한국부동산원',
  url: 'https://www.applyhome.co.kr',
}

export const AUCTION_DATA_SOURCE: DataSourceInfo = {
  datasetName: '차세대 온비드 부동산 물건목록 조회서비스',
  provider: '한국자산관리공사',
  url: 'https://www.data.go.kr/data/15157207/openapi.do',
}

export type DataSourceDomain = 'facility' | 'real-estate' | 'subscription' | 'auction'

/**
 * Google Dataset structured data 의 description 규격(50~5000자)을 보장한다.
 * 50자 미만이면 데이터셋 컨텍스트 문장을 덧붙이고, 항상 5000자 이하로 자른다.
 */
export function ensureDatasetDescription(base: string, src: DataSourceInfo): string {
  const trimmed = (base ?? '').trim();
  const result = trimmed.length >= 50
    ? trimmed
    : `${trimmed} ${src.datasetName} 기반으로 일상킷이 전국 지역·항목별로 정리해 최신 기준으로 제공하는 공식 공개 데이터입니다.`.trim();
  return result.slice(0, 5000);
}

export function resolveDataSource(input: {
  domain: DataSourceDomain
  category?: FacilityCategory
}): DataSourceInfo | null {
  switch (input.domain) {
    case 'facility':
      return input.category ? (FACILITY_DATA_SOURCE[input.category] ?? null) : null
    case 'real-estate':
      return REAL_ESTATE_DATA_SOURCE
    case 'subscription':
      return SUBSCRIPTION_DATA_SOURCE
    case 'auction':
      return AUCTION_DATA_SOURCE
    default:
      return null
  }
}
