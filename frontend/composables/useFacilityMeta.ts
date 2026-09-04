import type { FacilityCategory, FacilityDetail, ToiletDetails, WifiDetails, ParkingDetails, HospitalDetails, PharmacyDetails, AedDetails, LibraryDetails, ClothesDetails, ParkDetails, SchoolDetails, MarketDetails, ChildcareDetails, EvChargerDetails, SportsDetails } from '~/types/facility'
import { CATEGORY_META } from '~/types/facility'
import { SITE_NAME, SITE_TAGLINE, SITE_URL, SITE_DESCRIPTION, CATEGORY_SEO_INTENT, CATEGORY_SEO_TITLE, CATEGORY_SEO_DESCRIPTION, compactCityName } from '~/utils/seoConstants'
import { OG_MAP_WIDTH, OG_MAP_HEIGHT } from '~/utils/ogMapSpec'
import { buildOgMapImageUrl, staticOgImageUrl } from '~/utils/ogImageUrl'

/** 받침 유무에 따라 조사 선택 (은/는, 이/가, 을/를 등) */
function getJosa(word: string, josaWithBatchim: string, josaWithout: string): string {
  if (!word) return josaWithBatchim
  const lastChar = word.charCodeAt(word.length - 1)
  if (lastChar < 0xAC00 || lastChar > 0xD7A3) {
    const lastDigitMap: Record<string, boolean> = { '0': true, '1': true, '3': true, '6': true, '7': true, '8': true }
    const lastStr = word[word.length - 1]
    if (lastStr in lastDigitMap) return josaWithBatchim
    return josaWithout
  }
  const hasBatchim = (lastChar - 0xAC00) % 28 !== 0
  return hasBatchim ? josaWithBatchim : josaWithout
}

/** "0900" → "09:00" */
function formatTimeStr(t: string): string {
  const s = String(t).padStart(4, '0')
  return `${s.slice(0, 2)}:${s.slice(2)}`
}

function normalizeSeoTitle(title: string): string {
  return title.replace(/\s*[|-]\s*일상킷$/, '').trim()
}

/** 시설 이름에서 선후행 "-"·공백 제거 후 의미 있는 값이면 반환, 아니면 null */
function cleanFacilityName(raw: string | null | undefined): string | null {
  if (!raw) return null
  const cleaned = String(raw).replace(/^[\s-]+|[\s-]+$/g, '').trim()
  if (!cleaned || cleaned === '-') return null
  return cleaned
}

/** 관리·운영 기관명 (여러 소스 필드 중 첫 유효값) */
function orgOf(facility: FacilityDetail): string | null {
  const d = (facility.details ?? {}) as Record<string, unknown>
  return cleanFacilityName((d.managingOrg || d.org || d.operatingOrg || d.providerName) as string | null | undefined)
}

/**
 * 도로명/지번 주소에서 시·도·구·군 토큰(제목 loc 에 이미 존재)을 제거한 granular 꼬리(동·로·번지 등)
 * 마지막 2토큰. 지역 내 동일·유사 이름 시설을 구분하는 데 쓴다.
 */
function granularAddressTail(facility: FacilityDetail): string {
  const addr = cleanFacilityName(facility.roadAddress) ?? cleanFacilityName(facility.address)
  if (!addr) return ''
  const cityShort = compactCityName(facility.city)
  const tokens = addr.split(/\s+/).filter(Boolean)
  const granular = tokens.filter((t) => {
    if (t === facility.city || t === cityShort) return false
    if (/(특별자치시|특별자치도|특별시|광역시|자치도|자치시)$/.test(t)) return false
    if (facility.district && (t === facility.district || facility.district.includes(t) || t.includes(facility.district))) return false
    return true
  })
  return granular.slice(-2).join(' ').trim()
}

/**
 * 보조어에서 이름과 겹치는 부분을 걷어내고 남는 정보만 돌려준다.
 *
 * 종전에는 `raw.includes(name)` 이면 통째로 버렸다. 그런데 공공데이터의 설치장소는
 * "{시설명} {세부위치}" 로 적히는 관행이 있어서, 정작 device 를 구분해 주는 유일한 값이
 * 그 규칙에 걸려 전부 폐기됐다.
 *
 * 실측(2026-09-04, 로컬 DB 26,277행 = 같은 이름·주소를 공유하는 AED 전량):
 * '해양경찰교육원' 23대는 설치장소가 전부 다른데("숙영관", "본관1층", "생활관 3동" …)
 * 그중 8대가 "해양경찰교육원 …" 접두사를 달고 있어 보조어가 버려졌고, 폴백인 granular
 * 주소는 23대가 동일해서 8대의 title 이 완전히 같아졌다.
 * 이름 접두/접미를 떼면 "숙영관"·"본관1층" 이 남아 여덟 문서가 서로 달라진다.
 *
 * name 이 raw 를 포함하는 반대 방향(raw="1층", name="…1층")은 여전히 버린다 — 그건 정말로
 * 새 정보가 없다.
 */
function usableDisambiguator(raw: string, name: string): string {
  if (!raw) return ''
  if (name.includes(raw)) return ''
  if (!raw.includes(name)) return raw
  // 이름을 걷어내고 남은 조각. 구분자로 쓰이는 공백·괄호·쉼표·하이픈을 양끝에서 정리한다.
  const stripped = raw.split(name).join(' ').replace(/\s+/g, ' ').replace(/^[\s,\-–—/·()]+|[\s,\-–—/·()]+$/g, '').trim()
  // 한 글자짜리 잔여물("동", "1")은 구분 정보로 보기 어렵다.
  return stripped.length >= 2 ? stripped : ''
}

// 동일·유사 이름이 지역 내 다수 레코드에 공유되는(→ 중복 제목) 카테고리. granular 주소로 구분한다.
const ADDRESS_DISAMBIGUATE_CATEGORIES = new Set<FacilityCategory>(['parking', 'aed', 'clothes'])

/**
 * 제목 보조어 후보를 우선순위대로 모은다 (데이터에 값이 있는 것만. 이름과의 중복 판정은 안 함).
 * - aed: 설치 상세위치(buildPlace) → 설치기관(org) → granular 주소.
 * - parking/clothes: granular 주소.
 *
 * 옛 구현은 aed 에서 buildPlace 하나만 보고, 그게 이름과 겹치면 곧장 포기했다.
 * 실측(2026-09-04): AED 26,277행(41.9%)이 같은 건물의 별개 URL 이고 그중 614행은
 * title·description 이 byte 단위로 동일했다 — 대개 buildPlace 가 이름을 그대로 되풀이한
 * 레코드다. 후보를 이어 붙여, 데이터에 구분자가 하나라도 있으면 반드시 찾아내게 한다.
 */
function disambiguatorCandidates(facility: FacilityDetail): string[] {
  const d = (facility.details ?? {}) as Record<string, unknown>
  const candidates: string[] = []
  if (facility.category === 'aed') {
    const buildPlace = cleanFacilityName(d.buildPlace as string | null | undefined)
    if (buildPlace) candidates.push(buildPlace)
    const org = cleanFacilityName(d.org as string | null | undefined)
    if (org) candidates.push(org)
  }
  if (ADDRESS_DISAMBIGUATE_CATEGORIES.has(facility.category)) {
    const tail = granularAddressTail(facility)
    if (tail) candidates.push(tail)
  }
  return candidates
}

/**
 * 동일·유사 시설명이 지역 내 다수 레코드에 공유될 때(예: 한 건물의 AED 다수, "{동} 공영주차장"
 * 동명 주차장 다수) 제목을 구분하는 보조어.
 * 그 외 카테고리는 고유 이름 비중이 높아 보조어를 붙이지 않는다(''). 후보가 전부 이름과
 * 중복이면 '' — 그때는 isUndifferentiatedFacility 가 noindex 로 받는다(가짜 구분자 금지).
 */
function getTitleDisambiguator(facility: FacilityDetail, name: string): string {
  for (const candidate of disambiguatorCandidates(facility)) {
    const usable = usableDisambiguator(candidate, name)
    if (usable) return usable
  }
  return ''
}

/**
 * 사용자에게 노출할 시설 이름.
 * 원본 name이 비었거나 "-" 인 경우 카테고리·관리기관·도로명 기반 fallback 생성.
 */
export function getFacilityDisplayName(facility: FacilityDetail): string {
  const cleaned = cleanFacilityName(facility.name)
  if (cleaned) return cleaned

  const categoryLabel = CATEGORY_META[facility.category]?.label || facility.category
  const region = facility.district || facility.city || ''
  const cleanOrg = orgOf(facility)
  if (cleanOrg) return `${cleanOrg} ${categoryLabel}`
  const addr = facility.roadAddress || facility.address
  if (addr) {
    const lastSegment = addr.split(/\s+/).slice(-2).join(' ')
    return `${region} ${lastSegment} ${categoryLabel}`.trim()
  }
  return `${region} ${categoryLabel}`.trim()
}

/**
 * 지역 내 중복이 불가피한 시설. 색인해도 중복 제목/설명으로 분류되므로 noindex 대상이다.
 *
 * 두 경우를 잡는다.
 * (a) 이름·관리기관·granular 주소가 모두 없어 제목이 `{지역} {카테고리}` 형태로만 생성되는 경우.
 * (b) parking/aed/clothes 에서 구분자 후보가 데이터에 분명히 있는데도 전부 이름을 되풀이해서
 *     제목에 붙일 게 남지 않는 경우. 같은 건물의 형제 레코드와 title·description 이 byte 단위로
 *     같아진다(실측 AED 614행). ID·URL 조각 같은 가짜 구분자를 지어내 중복 경고만 피하는 대신
 *     색인에서 뺀다. 단 이름 자체가 granular 주소를 품고 있으면(주소를 이름으로 쓰는
 *     의류수거함 등) 제목은 여전히 고유하므로 예외다.
 */
export function isUndifferentiatedFacility(facility: FacilityDetail): boolean {
  if (ADDRESS_DISAMBIGUATE_CATEGORIES.has(facility.category)) {
    const name = getFacilityDisplayName(facility)
    if (disambiguatorCandidates(facility).length > 0 && !getTitleDisambiguator(facility, name)) {
      const tail = granularAddressTail(facility)
      if (!tail || !name.includes(tail)) return true
    }
  }
  if (cleanFacilityName(facility.name)) return false
  if (orgOf(facility)) return false
  if (granularAddressTail(facility)) return false
  return true
}

/**
 * 메타태그 옵션
 */
interface MetaOptions {
  title: string
  description: string
  path?: string
  image?: string
  imageWidth?: number
  imageHeight?: number
  imageAlt?: string
  type?: 'website' | 'article'
  /** false → canonical 태그 미삽입 (noindex 페이지용). string → 해당 URL을 canonical로 사용 */
  canonical?: string | false
}

/**
 * 카테고리별 시설 description 생성
 */
/**
 * 상세 페이지 h1 아래 자연어 설명문 생성
 */
export function buildFacilityIntro(facility: FacilityDetail): string {
  const categoryName = CATEGORY_META[facility.category]?.label || facility.category
  const cityShort = compactCityName(facility.city)
  const location = facility.district
    ? (facility.district.startsWith(cityShort) ? facility.district : `${cityShort} ${facility.district}`)
    : cityShort
  const name = getFacilityDisplayName(facility)
  const josa = getJosa(name, '은', '는')
  return `${name}${josa} ${location}에 위치한 ${categoryName}입니다.`
}

export function buildFacilityDescription(facility: FacilityDetail): string {
  const categoryName = CATEGORY_META[facility.category]?.label || facility.category
  const cityShort = compactCityName(facility.city)
  const location = facility.district
    ? (facility.district.startsWith(cityShort) ? facility.district : `${cityShort} ${facility.district}`)
    : cityShort
  const address = facility.roadAddress || facility.address || location
  const intent = CATEGORY_SEO_INTENT[facility.category] || '정보'

  // 시설명 + 지역 + 카테고리 개요 문장.
  // parking/aed/clothes 는 동일·유사 이름이 지역 내 다수 레코드에 공유돼, 시·구까지만 쓰면
  // 제목뿐 아니라 설명문까지 형제 레코드와 겹친다(실측: AED 614행이 title·description 모두
  // byte 동일). 제목 보조어와 같은 granular 주소 꼬리를 개요 문장에 넣어 155자 절단 전에
  // 살아남게 한다 — 주소는 facts 맨 뒤에도 들어가지만 거기서 먼저 잘려나간다.
  const name = getFacilityDisplayName(facility)
  const josa = getJosa(name, '은', '는')
  const addressTail = ADDRESS_DISAMBIGUATE_CATEGORIES.has(facility.category) ? granularAddressTail(facility) : ''
  const locationDetail = addressTail && !location.includes(addressTail) ? `${location} ${addressTail}` : location
  const openingSentence = `${name}${josa} ${locationDetail}에 위치한 ${categoryName}입니다.`

  // 카테고리별 facts 수집
  const facts: string[] = []
  const d = facility.details as Record<string, unknown>

  switch (facility.category) {
    case 'toilet': {
      const det = d as ToiletDetails
      if (det.operatingHours === '24시간') facts.push('상시 개방')
      else if (det.operatingHours) facts.push(det.operatingHours)
      if (det.maleToilets || det.femaleToilets) facts.push('남녀 분리')
      if (det.hasCCTV) facts.push('CCTV 설치')
      if (det.hasDisabledToilet) facts.push('장애인 화장실')
      break
    }
    case 'wifi': {
      const det = d as WifiDetails
      if (det.ssid) facts.push(`SSID: ${det.ssid}`)
      if (det.serviceProvider) facts.push(det.serviceProvider)
      break
    }
    case 'parking': {
      const det = d as ParkingDetails
      if (det.capacity) facts.push(`주차면수 ${det.capacity}면`)
      if (det.baseFee != null && det.baseTime) facts.push(`기본 ${det.baseTime}분 ${det.baseFee.toLocaleString()}원`)
      if (det.operatingHours) facts.push(det.operatingHours)
      break
    }
    case 'hospital': {
      const det = d as HospitalDetails
      if (det.clCdNm) facts.push(det.clCdNm)
      if (det.drTotCnt) facts.push(`의사 ${det.drTotCnt}명`)
      break
    }
    case 'pharmacy': {
      const det = d as PharmacyDetails
      if (det.dutyTime1s && det.dutyTime1c) facts.push(`월 ${formatTimeStr(det.dutyTime1s)}~${formatTimeStr(det.dutyTime1c)}`)
      break
    }
    case 'aed': {
      const det = d as AedDetails
      if (det.buildPlace) facts.push(`설치장소: ${det.buildPlace}`)
      if (det.org) facts.push(det.org)
      break
    }
    case 'library': {
      const det = d as LibraryDetails
      if (det.seatCount) facts.push(`좌석 ${det.seatCount}석`)
      if (det.bookCount) facts.push(`장서 ${det.bookCount.toLocaleString()}권`)
      if (det.weekdayOpenTime && det.weekdayCloseTime) facts.push(`평일 ${det.weekdayOpenTime}~${det.weekdayCloseTime}`)
      break
    }
    case 'clothes': {
      const det = d as ClothesDetails
      if (det.managementAgency) facts.push(`관리: ${det.managementAgency}`)
      if (det.detailLocation) facts.push(det.detailLocation)
      break
    }
    case 'park': {
      const det = d as ParkDetails
      if (det.parkType) facts.push(det.parkType)
      if (det.area) facts.push(`면적 ${det.area.toLocaleString()}㎡`)
      if (det.managingOrg) facts.push(`관리: ${det.managingOrg}`)
      break
    }
    case 'school': {
      const det = d as SchoolDetails
      if (det.schoolLevel) facts.push(det.schoolLevel)
      if (det.foundationType) facts.push(det.foundationType)
      if (det.operationStatus) facts.push(det.operationStatus)
      break
    }
    case 'market': {
      const det = d as MarketDetails
      if (det.marketType) facts.push(det.marketType)
      if (det.openingCycle) facts.push(`개장: ${det.openingCycle}`)
      if (det.storeCount) facts.push(`점포 ${det.storeCount.toLocaleString()}개`)
      break
    }
    case 'childcare': {
      const det = d as ChildcareDetails
      if (det.crtypename) facts.push(det.crtypename)
      if (det.crcapat) facts.push(`정원 ${det.crcapat}명`)
      if (det.crchcnt) facts.push(`현원 ${det.crchcnt}명`)
      break
    }
    case 'ev-charger': {
      const det = d as EvChargerDetails
      const charger = det.chargers?.[0]
      if (charger?.chgerType) facts.push(`충전기 타입: ${charger.chgerType}`)
      if (charger?.output) facts.push(`출력 ${charger.output}kW`)
      if (det.useTime) facts.push(det.useTime)
      break
    }
    case 'sports': {
      const det = d as SportsDetails
      if (det.ftypeNm) facts.push(det.ftypeNm)
      if (det.faciGbNm) facts.push(det.faciGbNm)
      if (det.faciGfa) facts.push(`연면적 ${det.faciGfa}`)
      break
    }
  }

  // 주소를 facts 마지막에 포함
  if (address) facts.push(address)

  // 산문 구조: 개요 문장. facts 쉼표 결합. CTA 문장.
  const ctaSentence = `${intent} 등 정보를 지도에서 확인하세요.`
  const factClause = facts.length ? ` ${facts.join(', ')}.` : ''
  let desc = `${openingSentence}${factClause} ${ctaSentence}`

  // 155자 이내로 자르기
  if (desc.length > 155) {
    desc = desc.slice(0, 152) + '...'
  }
  return desc
}

/**
 * 공통 메타태그 설정
 */
export function useFacilityMeta() {
  /**
   * 기본 메타태그 설정
   */
  function setMeta(options: MetaOptions) {
    const normalizedTitle = normalizeSeoTitle(options.title)
    const fullTitle = normalizedTitle === SITE_NAME
      ? `${SITE_NAME} - ${SITE_TAGLINE}`
      : `${normalizedTitle} | ${SITE_NAME}`

    const defaultUrl = options.path ? `${SITE_URL}${options.path}` : SITE_URL
    const resolvedCanonical = options.canonical === false
      ? null
      : (typeof options.canonical === 'string' ? options.canonical : defaultUrl)

    // og:image 로 `/og?...` 를 절대 만들지 않는다. 그 라우트는 SVG→PNG 변환에 sharp 를 쓰는데
    // Cafe24 에 네이티브 바인딩이 없어 프로덕션에서 100% /og-image.png 로 302 한다 —
    // 페이지마다 고유한 영구 리다이렉트 URL 을 하나씩 발행해 온 셈이고, 네이버 진단의
    // 리디렉션 3,193건이 여기서 나왔다. 최종 도착지를 그대로 쓴다(utils/ogImageUrl.ts 주석).
    const dynamicOgImage = options.image || staticOgImageUrl()

    useSeoMeta({
      title: fullTitle,
      description: options.description,

      // Open Graph
      ogTitle: fullTitle,
      ogDescription: options.description,
      ogImage: dynamicOgImage,
      ogUrl: resolvedCanonical || defaultUrl,
      ogSiteName: SITE_NAME,
      ogType: options.type || 'website',
      ogLocale: 'ko_KR',

      // OG Image dimensions & alt
      ogImageWidth: options.imageWidth ?? 1200,
      ogImageHeight: options.imageHeight ?? 630,
      ogImageAlt: options.imageAlt ?? fullTitle,

      // Twitter Card
      twitterCard: 'summary_large_image',
      twitterTitle: fullTitle,
      twitterDescription: options.description,
      twitterImage: dynamicOgImage,
    })

    // noindex 페이지(예: /search)에서는 canonical 신호 충돌 방지 위해 스킵
    if (resolvedCanonical) {
      useHead({
        link: [
          { rel: 'canonical', href: resolvedCanonical, key: 'canonical' },
        ],
      })
    }
  }

  /**
   * 홈페이지 메타태그
   */
  function setHomeMeta() {
    // 브랜드("일상킷") 검색 시 /about(소개) 대신 홈이 대표결과가 되도록 브랜드명을 제목 앞으로 뺀다.
    // title 을 SITE_NAME 으로 넘기면 setMeta 가 브랜드 선두형(`일상킷 - {SITE_TAGLINE}`)으로 조립한다.
    // 설명문은 출처(국토교통부·공공데이터)와 '회원가입 없이 무료'로 신뢰·차별 신호를 전면에 둔다.
    setMeta({
      title: SITE_NAME,
      description: '일상킷은 국토교통부 실거래가와 공공데이터를 매일 갱신해 아파트·빌라·오피스텔·토지 시세와 청약 일정, 병원·약국·주차장 등 전국 생활정보를 회원가입 없이 무료로 제공합니다.',
      path: '/',
    })
  }

  /**
   * 카테고리 페이지 메타태그 (head 전용).
   * 위치 없으면 CATEGORY_SEO_TITLE 완성형, 위치 있으면 {지역} {카테고리} 찾기 앞배치형.
   * 화면 h1/hero는 페이지의 SEO_TITLES(Set C)가 별도로 담당한다.
   * options.canonical=false 로 호출하면 rel=canonical 태그를 생략한다 (noindex 페이지 정책).
   */
  function setCategoryMeta(category: FacilityCategory, location?: { cityName?: string; districtName?: string }, options?: { canonical?: string | false }) {
    const categoryName = CATEGORY_META[category]?.label || category
    const loc = [location?.cityName, location?.districtName].filter(Boolean).join(' ')

    if (loc) {
      setMeta({
        title: `${loc} ${categoryName} 찾기`,
        description: `${loc} ${categoryName} 위치와 운영시간을 지도에서 확인하세요. 가까운 ${categoryName}을(를) 빠르게 찾을 수 있습니다.`,
        path: `/${category}`,
        canonical: options?.canonical,
      })
      return
    }

    const intent = CATEGORY_SEO_INTENT[category] || '정보'
    setMeta({
      title: CATEGORY_SEO_TITLE[category] ?? `${categoryName} 찾기`,
      description: CATEGORY_SEO_DESCRIPTION[category] ?? `전국 ${categoryName}의 ${intent} 정보를 한눈에 확인하세요.`,
      path: `/${category}`,
      canonical: options?.canonical,
    })
  }

  /**
   * 검색 결과 페이지 메타태그
   */
  function setSearchMeta(params: {
    keyword?: string
    category?: FacilityCategory
    city?: string
    district?: string
  }) {
    const parts: string[] = []

    if (params.keyword) {
      parts.push(`'${params.keyword}' 검색 결과`)
    }

    if (params.category) {
      const categoryName = CATEGORY_META[params.category]?.label || params.category
      parts.push(categoryName)
    }

    if (params.city && params.district) {
      parts.push(`${params.city} ${params.district}`)
    }

    const title = parts.length > 0
      ? parts.join(' - ')
      : '부동산·생활시설 검색'

    const description = params.keyword
      ? `${params.keyword} 관련 시설 검색 결과입니다.`
      : params.category
        ? `${CATEGORY_META[params.category]?.label || params.category} 검색 결과입니다.`
        : '내 주변 생활 편의 시설을 검색하세요.'

    setMeta({
      title,
      description,
      path: '/search',
      // /search는 noindex이므로 canonical 신호 충돌 방지
      canonical: false,
    })
  }

  /**
   * 카테고리별 상세 타이틀 — {name} {categoryName} {intent} | {loc}
   * 이름 바로 뒤에 카테고리+인텐트(검색 키워드)를 묶어 앞으로 배치하고 지역은 뒤 칸으로.
   * 인텐트가 맨 끝(지역 뒤)에 트레일링하면 모바일 SERP에서 잘리고 가중치가 낮아지는데,
   * 카테고리가 이름과 인텐트를 이어줘 이름≠카테고리(예: 정비공업사의 EV충전소) 경우에도
   * 토픽이 명확하다. 지역은 타이틀 2번째 칸 + URL·breadcrumb·h1·og 에 강하게 남는다.
   * 길이 제한 없음: 지역·카테고리를 항상 유지(긴 타이틀은 SERP에서 시각적으로만 잘릴 뿐
   * 페널티 없음 — 다른 긴 타이틀과 동일한 정책).
   */
  function buildDetailTitle(facility: FacilityDetail): string {
    const cityShort = compactCityName(facility.city)
    const loc = facility.district
      ? (facility.district.startsWith(cityShort) ? facility.district : `${cityShort} ${facility.district}`)
      : cityShort
    const name = getFacilityDisplayName(facility)
    const disamb = getTitleDisambiguator(facility, name)
    const displayName = disamb ? `${name} ${disamb}` : name
    const meta = CATEGORY_META[facility.category]
    const categoryName = meta?.label || facility.category
    const intent = CATEGORY_SEO_INTENT[facility.category]
    // 이름이 이미 카테고리명을 포함하면(예: "삼성서울병원") 중복 표기를 피한다. 정식 label 과
    // shortLabel 둘 다로 검사한다 — label='공공화장실'이어도 실제 이름은 '공중화장실'이라
    // shortLabel='화장실'로 잡아야 "공중화장실 공공화장실" 스터터가 안 난다. 포함하지 않으면
    // (예: 정비공업사의 EV충전소) 카테고리를 이름 뒤에 붙여 토픽을 명확히 한다.
    const inName = displayName.includes(categoryName) || (!!meta?.shortLabel && displayName.includes(meta.shortLabel))
    const head = inName ? displayName : `${displayName} ${categoryName}`
    return intent ? `${head} ${intent} | ${loc}` : `${head} | ${loc}`
  }

  /**
   * 시설 상세 페이지 메타태그.
   * canonical=false 로 호출하면 rel=canonical 태그가 생략된다 — robots=noindex 를 내보내는
   * 상세(wifi·thin content·구분 불가 시설)는 canonical 을 동시에 내보내면 안 된다
   * (정책: .omc/notes/noindex-canonical-policy.md).
   */
  function setFacilityDetailMeta(facility: FacilityDetail, options?: { canonical?: string | false }) {
    const title = buildDetailTitle(facility)
    const description = buildFacilityDescription(facility)
    const name = getFacilityDisplayName(facility)

    // 좌표가 있으면 네이버 Static Map 썸네일(/og-map), 없으면 정적 대표 PNG.
    // 조립은 공용 빌더 한곳에서만 한다 — 예전엔 같은 시설명을 label 과 title 에 두 번 싣고
    // 자르지도 않아 실측 2,004자짜리 og:image URL 이 나왔다(라우트는 title 을 읽지도 않는다).
    const ogImage = buildOgMapImageUrl({
      lat: facility.lat,
      lng: facility.lng,
      label: name,
      category: facility.category,
    })
    const isStaticOgImage = ogImage === staticOgImageUrl()

    setMeta({
      title,
      description,
      path: `/${facility.category}/${facility.id}`,
      image: ogImage,
      // 규격은 og-map 라우트와 같은 상수를 쓴다 — 두 곳이 각자 숫자를 들면 갈라진다(ogMapSpec 주석 참고).
      // 정적 PNG 로 떨어진 경우엔 setMeta 기본값(1200x630)이 실제 파일 규격이다.
      imageWidth: isStaticOgImage ? undefined : OG_MAP_WIDTH,
      imageHeight: isStaticOgImage ? undefined : OG_MAP_HEIGHT,
      canonical: options?.canonical,
    })
  }

  /**
   * 지역별 페이지 메타태그.
   * canonical=false 로 호출하면 rel=canonical 태그가 생략된다 (noindex 페이지 정책과 일치).
   */
  function setRegionMeta(params: {
    city: string
    cityName: string
    district: string
    districtName: string
    category: FacilityCategory
    count?: number
    canonical?: string | false
  }) {
    const categoryName = CATEGORY_META[params.category]?.label || params.category
    const intent = CATEGORY_SEO_INTENT[params.category] || '정보'

    const title = `${params.cityName} ${params.districtName} ${categoryName} | ${intent}`
    // 실제 시설 개수를 설명에 넣어 구·동×카테고리 페이지(롱테일 지역 검색)의 description을 차별화한다.
    let description: string
    if (params.count && params.count > 0) {
      // trash 는 '건' 단위 + 배출 문맥(위치·운영시간 아님)으로 별도 문안.
      description = params.category === 'trash'
        ? `${params.cityName} ${params.districtName}의 쓰레기 배출 일정 ${params.count.toLocaleString('ko-KR')}건 — 배출 요일·분리수거·시간 정보를 확인하세요.`
        : `${params.cityName} ${params.districtName}의 ${categoryName} ${params.count.toLocaleString('ko-KR')}곳 — 위치·운영시간·${intent} 정보를 확인하세요.`
    } else {
      description = `${params.cityName} ${params.districtName}의 ${categoryName} ${intent} 정보를 확인하세요.`
    }

    setMeta({
      title,
      description,
      path: `/${params.city}/${params.district}/${params.category}`,
      canonical: params.canonical,
    })
  }

  /**
   * 쓰레기 배출 상세 페이지 메타태그
   */
  function setWasteScheduleDetailMeta(schedule: {
    id: number
    city: string
    district: string
    targetRegion?: string | null
  }) {
    const location = `${schedule.city} ${schedule.district}`
    // targetRegion이 수십 개 세부지역을 '+'로 연결하면 제목/설명이 과도하게 길어진다(네이버 SERP 잘림·키워드 스터핑).
    // 4개 이상이면 '{첫지역} 외 N곳'으로 축약한다 (전체 목록은 본문에 그대로 노출).
    const regionParts = schedule.targetRegion ? schedule.targetRegion.split('+').filter(Boolean) : []
    const region = regionParts.length === 0
      ? undefined
      : regionParts.length <= 3
        ? regionParts.join(', ')
        : `${regionParts[0]} 외 ${regionParts.length - 1}곳`
    const title = region
      ? `${location} ${region} 쓰레기 배출일 | 재활용·음식물·대형폐기물`
      : `${location} 쓰레기 배출일 | 재활용·음식물·대형폐기물`
    const description = region
      ? `${location} ${region}의 일반쓰레기, 음식물쓰레기, 재활용, 대형폐기물 배출 요일·시간·방법을 확인하세요.`
      : `${location}의 일반쓰레기, 음식물쓰레기, 재활용, 대형폐기물 배출 요일·시간·방법을 확인하세요.`

    setMeta({
      title,
      description,
      path: `/trash/${schedule.id}`,
      type: 'article',
    })
  }

  /**
   * 에러 페이지 메타태그
   */
  function setErrorMeta(statusCode: number) {
    const title = statusCode === 404
      ? '페이지를 찾을 수 없습니다'
      : '오류가 발생했습니다'

    const description = statusCode === 404
      ? '요청하신 페이지를 찾을 수 없습니다.'
      : '서비스 이용 중 오류가 발생했습니다.'

    setMeta({
      title,
      description,
    })
  }

  return {
    setMeta,
    setHomeMeta,
    setCategoryMeta,
    setSearchMeta,
    setFacilityDetailMeta,
    setWasteScheduleDetailMeta,
    setRegionMeta,
    setErrorMeta,
    SITE_NAME,
    SITE_URL,
    SITE_DESCRIPTION,
  }
}
