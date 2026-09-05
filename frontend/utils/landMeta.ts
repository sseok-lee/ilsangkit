import { compactCityName } from '~/utils/seoConstants'

export interface LandMeta {
  label: string
  icon: string
  description: string
}

export const LAND_META: LandMeta = {
  label: '토지',
  icon: 'public',
  description:
    '전국 토지(대지·전·답·임야 등) 매매 실거래가를 지역별로 조회하세요. 지목·용도지역별 평당 시세와 최근 거래 내역을 한눈에 확인할 수 있습니다.',
}

interface LandRegionTitleParams {
  city?: string
  district?: string
  dong?: string
}

export function buildLandRegionTitle({ city, district, dong }: LandRegionTitleParams = {}): string {
  if (dong && district && city) {
    // 동 페이지에도 시(축약)+구를 함께 — 기존엔 구만 있어 도시 신호가 누락됐다.
    return `${dong} 토지 시세·실거래가 | ${compactCityName(city)} ${district} | 일상킷`
  }
  if (district && city) {
    // 구 페이지도 compactCityName 을 쓴다. 동 페이지는 축약형, 구 페이지는 원문이라
    // 형제 문서의 지역 표기가 서로 어긋났다('서울 강남구 역삼동' vs '강남구 … | 서울').
    return `${district} 토지 실거래가 | ${compactCityName(city)} | 일상킷`
  }
  if (city) {
    return `${city} 토지 실거래가 | 일상킷`
  }
  return '전국 토지 실거래가 | 일상킷'
}

interface LandRegionDescriptionParams {
  city?: string
  district?: string
  dong?: string
  avgPricePerPyeong?: number | null
  count?: number
}

export function buildLandRegionDescription({
  city,
  district,
  dong,
  avgPricePerPyeong,
  count,
}: LandRegionDescriptionParams = {}): string {
  // 지역 라벨에 시도를 반드시 포함한다.
  // '중구'는 6개 시도에, '동/남/북/서구'도 여러 시도에 동시에 존재한다. 시도를 빼면
  // /land/seoul/jung 과 /land/busan/jung 의 설명문이 평당가 없는 분기에서 바이트 단위로
  // 같아져, 2026-09-04 실측 '중복 설명 225,388건' 에 그대로 합류한다.
  const regionName =
    district && city
      ? [compactCityName(city), district, dong].filter(Boolean).join(' ')
      : (dong ?? district ?? city ?? '전국')

  if (avgPricePerPyeong != null) {
    const priceStr = avgPricePerPyeong.toLocaleString('ko-KR')
    const countPart =
      count != null && count > 0 ? ` 최근 거래 ${count.toLocaleString('ko-KR')}건을 포함한` : ''
    // avgPricePerPyeong 은 '만원/평' 단위(템플릿 formatManwon+만원 표기와 동일). '원'이라 쓰면 1만배 오표기.
    return `${regionName} 토지 매매 실거래가를 확인하세요. 대지 평당 ${priceStr}만원 기준${countPart} 거래 내역과 지목·용도지역 분포를 한눈에 파악할 수 있습니다. 국토교통부 공식 데이터를 기반으로 신뢰할 수 있는 토지 시세 정보를 제공합니다.`
  }

  // 평당가 없는 경우 폴백 — 거래 건수라도 있으면 주입해 지역 간 설명문 중복을 피한다.
  if (count != null && count > 0) {
    return `${regionName} 토지 매매 실거래가를 조회하세요. 최근 거래 ${count.toLocaleString('ko-KR')}건의 내역과 지목·용도지역 분포를 확인할 수 있으며, 국토교통부 공식 데이터 기반으로 신뢰할 수 있는 토지 시세 정보를 제공합니다.`
  }
  return `${regionName} 토지 매매 실거래가를 조회하세요. 거래 내역과 지목·용도지역 분포를 확인하고, 국토교통부 공식 데이터 기반으로 신뢰할 수 있는 토지 시세 정보를 제공합니다.`
}

export const LAND_FAQ: Array<{ q: string; a: string }> = [
  {
    q: '토지 실거래가 데이터는 어디서 제공되나요?',
    a: '일상킷의 토지 실거래가는 국토교통부 실거래가 공개시스템의 공식 데이터를 기반으로 합니다. 계약 체결 후 30일 이내에 신고된 공식 거래 금액만을 반영하므로 신뢰도가 높습니다.',
  },
  {
    q: '지목이란 무엇인가요?',
    a: '지목은 토지의 주된 용도에 따라 구분한 법적 분류입니다. 대표적으로 대(주거·상업용 건물 부지), 전(밭), 답(논), 임야(산지) 등 28개 지목이 있습니다. 지목에 따라 개발 가능 여부와 시세가 크게 달라지므로 매매 전 반드시 확인하세요.',
  },
  {
    q: '용도지역이란 무엇이며 왜 중요한가요?',
    a: '용도지역은 국토의 계획 및 이용에 관한 법률에 따라 토지 이용을 규제하는 구역 지정입니다. 주거지역·상업지역·공업지역·녹지지역 등으로 구분되며, 건폐율·용적률·허용 건축물 종류가 다릅니다. 동일 면적이라도 용도지역에 따라 시세와 개발 가치가 크게 차이 납니다.',
  },
  {
    q: '평당가는 어떻게 계산되나요?',
    a: '일상킷에서 표시하는 평당가는 대지 기준 거래가를 기준으로 계산합니다. 계산식은 거래금액(원) ÷ (면적㎡ ÷ 3.305)이며, 1평 = 3.305㎡로 환산합니다. 전·답·임야 등 다른 지목의 거래는 평당가 산정에서 별도로 분류됩니다.',
  },
  {
    q: '지분 거래나 도로 토지 거래가 일반 시세와 다른 이유는 무엇인가요?',
    a: '지분 거래는 토지 전체가 아닌 일부 지분만 매매한 경우로, 단독 소유 토지와 권리 관계가 다르기 때문에 시세가 낮거나 변동이 큽니다. 도로(도로법상 도로)로 지정된 토지는 개발 행위가 제한되어 인근 대지보다 현저히 낮은 가격에 거래되는 경우가 많습니다. 실거래가 조회 시 지목과 거래 유형을 함께 확인하세요.',
  },
]
