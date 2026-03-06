// 정적 + 지역 조합 페이지 사이트맵
import { defineEventHandler, setHeader } from 'h3'
import { SITE_URL, generateSitemapXml } from '../../utils/sitemap'
import type { SitemapUrl } from '../../utils/sitemap'

const CATEGORIES = ['toilet', 'trash', 'wifi', 'clothes', 'kiosk', 'parking', 'aed', 'library', 'hospital', 'pharmacy']

const CITY_SLUGS: Record<string, string> = {
  서울: 'seoul',
  부산: 'busan',
  대구: 'daegu',
  인천: 'incheon',
  광주: 'gwangju',
  대전: 'daejeon',
  울산: 'ulsan',
  세종: 'sejong',
  경기: 'gyeonggi',
  강원: 'gangwon',
  충북: 'chungbuk',
  충남: 'chungnam',
  전북: 'jeonbuk',
  전남: 'jeonnam',
  경북: 'gyeongbuk',
  경남: 'gyeongnam',
  제주: 'jeju',
}

const KOREAN_TO_ROMANIZATION: Record<string, string> = {
  // 서울
  종로구: 'jongno',
  중구: 'jung',
  용산구: 'yongsan',
  성동구: 'seongdong',
  광진구: 'gwangjin',
  동대문구: 'dongdaemun',
  중랑구: 'jungnang',
  성북구: 'seongbuk',
  강북구: 'gangbuk',
  도봉구: 'dobong',
  노원구: 'nowon',
  은평구: 'eunpyeong',
  서대문구: 'seodaemun',
  마포구: 'mapo',
  양천구: 'yangcheon',
  강서구: 'gangseo',
  구로구: 'guro',
  금천구: 'geumcheon',
  영등포구: 'yeongdeungpo',
  동작구: 'dongjak',
  관악구: 'gwanak',
  서초구: 'seocho',
  강남구: 'gangnam',
  송파구: 'songpa',
  강동구: 'gangdong',
  // 부산
  영도구: 'yeongdo',
  부산진구: 'busanjin',
  동래구: 'dongnae',
  남구: 'nam',
  북구: 'buk',
  해운대구: 'haeundae',
  사하구: 'saha',
  금정구: 'geumjeong',
  연제구: 'yeonje',
  수영구: 'suyeong',
  사상구: 'sasang',
  기장군: 'gijang',
  // 대구
  동구: 'dong',
  서구: 'seo',
  수성구: 'suseong',
  달서구: 'dalseo',
  달성군: 'dalseong',
  군위군: 'gunwi',
  // 인천
  미추홀구: 'michuhol',
  연수구: 'yeonsu',
  남동구: 'namdong',
  부평구: 'bupyeong',
  계양구: 'gyeyang',
  강화군: 'ganghwa',
  옹진군: 'ongjin',
  // 광주
  광산구: 'gwangsan',
  // 대전
  대덕구: 'daedeok',
  유성구: 'yuseong',
  // 울산
  울주군: 'ulju',
  // 세종
  세종시: 'sejong',
  // 경기
  수원시: 'suwon',
  '수원시 장안구': 'suwon-jangan',
  '수원시 권선구': 'suwon-gwonseon',
  '수원시 팔달구': 'suwon-paldal',
  '수원시 영통구': 'suwon-yeongtong',
  성남시: 'seongnam',
  '성남시 수정구': 'seongnam-sujeong',
  '성남시 중원구': 'seongnam-jungwon',
  '성남시 분당구': 'seongnam-bundang',
  의정부시: 'uijeongbu',
  안양시: 'anyang',
  '안양시 만안구': 'anyang-manan',
  '안양시 동안구': 'anyang-dongan',
  부천시: 'bucheon',
  광명시: 'gwangmyeong',
  평택시: 'pyeongtaek',
  동두천시: 'dongducheon',
  안산시: 'ansan',
  '안산시 상록구': 'ansan-sangnok',
  '안산시 단원구': 'ansan-danwon',
  고양시: 'goyang',
  '고양시 덕양구': 'goyang-deogyang',
  '고양시 일산동구': 'goyang-ilsandong',
  '고양시 일산서구': 'goyang-ilsanseo',
  과천시: 'gwacheon',
  구리시: 'guri',
  남양주시: 'namyangju',
  오산시: 'osan',
  시흥시: 'siheung',
  군포시: 'gunpo',
  의왕시: 'uiwang',
  하남시: 'hanam',
  용인시: 'yongin',
  '용인시 처인구': 'yongin-cheoin',
  '용인시 기흥구': 'yongin-giheung',
  '용인시 수지구': 'yongin-suji',
  파주시: 'paju',
  이천시: 'icheon',
  안성시: 'anseong',
  김포시: 'gimpo',
  화성시: 'hwaseong',
  광주시: 'gwangju',
  양주시: 'yangju',
  포천시: 'pocheon',
  여주시: 'yeoju',
  연천군: 'yeoncheon',
  가평군: 'gapyeong',
  양평군: 'yangpyeong',
  // 강원
  춘천시: 'chuncheon',
  원주시: 'wonju',
  강릉시: 'gangneung',
  동해시: 'donghae',
  태백시: 'taebaek',
  속초시: 'sokcho',
  삼척시: 'samcheok',
  홍천군: 'hongcheon',
  횡성군: 'hoengseong',
  영월군: 'yeongwol',
  평창군: 'pyeongchang',
  정선군: 'jeongseon',
  철원군: 'cheorwon',
  화천군: 'hwacheon',
  양구군: 'yanggu',
  인제군: 'inje',
  고성군: 'goseong',
  양양군: 'yangyang',
  // 충북
  청주시: 'cheongju',
  '청주시 상당구': 'cheongju-sangdang',
  '청주시 서원구': 'cheongju-seowon',
  '청주시 흥덕구': 'cheongju-heungdeok',
  '청주시 청원구': 'cheongju-cheongwon',
  충주시: 'chungju',
  제천시: 'jecheon',
  보은군: 'boeun',
  옥천군: 'okcheon',
  영동군: 'yeongdong',
  증평군: 'jeungpyeong',
  진천군: 'jincheon',
  괴산군: 'goesan',
  음성군: 'eumseong',
  단양군: 'danyang',
  // 충남
  천안시: 'cheonan',
  '천안시 동남구': 'cheonan-dongnam',
  '천안시 서북구': 'cheonan-seobuk',
  공주시: 'gongju',
  보령시: 'boryeong',
  아산시: 'asan',
  서산시: 'seosan',
  논산시: 'nonsan',
  계룡시: 'gyeryong',
  당진시: 'dangjin',
  금산군: 'geumsan',
  부여군: 'buyeo',
  서천군: 'seocheon',
  청양군: 'cheongyang',
  홍성군: 'hongseong',
  예산군: 'yesan',
  태안군: 'taean',
  // 전북
  전주시: 'jeonju',
  '전주시 완산구': 'jeonju-wansan',
  '전주시 덕진구': 'jeonju-deokjin',
  군산시: 'gunsan',
  익산시: 'iksan',
  정읍시: 'jeongeup',
  남원시: 'namwon',
  김제시: 'gimje',
  완주군: 'wanju',
  진안군: 'jinan',
  무주군: 'muju',
  장수군: 'jangsu',
  임실군: 'imsil',
  순창군: 'sunchang',
  고창군: 'gochang',
  부안군: 'buan',
  // 전남
  목포시: 'mokpo',
  여수시: 'yeosu',
  순천시: 'suncheon',
  나주시: 'naju',
  광양시: 'gwangyang',
  담양군: 'damyang',
  곡성군: 'gokseong',
  구례군: 'gurye',
  고흥군: 'goheung',
  보성군: 'boseong',
  화순군: 'hwasun',
  장흥군: 'jangheung',
  강진군: 'gangjin',
  해남군: 'haenam',
  영암군: 'yeongam',
  무안군: 'muan',
  함평군: 'hampyeong',
  영광군: 'yeonggwang',
  장성군: 'jangseong',
  완도군: 'wando',
  진도군: 'jindo',
  신안군: 'sinan',
  // 경북
  포항시: 'pohang',
  '포항시 남구': 'pohang-nam',
  '포항시 북구': 'pohang-buk',
  경주시: 'gyeongju',
  김천시: 'gimcheon',
  안동시: 'andong',
  구미시: 'gumi',
  영주시: 'yeongju',
  영천시: 'yeongcheon',
  상주시: 'sangju',
  문경시: 'mungyeong',
  경산시: 'gyeongsan',
  의성군: 'uiseong',
  청송군: 'cheongsong',
  영양군: 'yeongyang',
  영덕군: 'yeongdeok',
  청도군: 'cheongdo',
  고령군: 'goryeong',
  성주군: 'seongju',
  칠곡군: 'chilgok',
  예천군: 'yecheon',
  봉화군: 'bonghwa',
  울진군: 'uljin',
  울릉군: 'ulleung',
  // 경남
  창원시: 'changwon',
  '창원시 의창구': 'changwon-uichang',
  '창원시 성산구': 'changwon-seongsan',
  '창원시 마산합포구': 'changwon-masanhappo',
  '창원시 마산회원구': 'changwon-masanhoewon',
  '창원시 진해구': 'changwon-jinhae',
  진주시: 'jinju',
  통영시: 'tongyeong',
  사천시: 'sacheon',
  김해시: 'gimhae',
  밀양시: 'miryang',
  거제시: 'geoje',
  양산시: 'yangsan',
  의령군: 'uiryeong',
  함안군: 'haman',
  창녕군: 'changnyeong',
  남해군: 'namhae',
  하동군: 'hadong',
  산청군: 'sancheong',
  함양군: 'hamyang',
  거창군: 'geochang',
  합천군: 'hapcheon',
  // 제주
  제주시: 'jeju',
  서귀포시: 'seogwipo',
}

const REGIONS: Record<string, string[]> = {
  서울: [
    '종로구', '중구', '용산구', '성동구', '광진구', '동대문구', '중랑구', '성북구',
    '강북구', '도봉구', '노원구', '은평구', '서대문구', '마포구', '양천구', '강서구',
    '구로구', '금천구', '영등포구', '동작구', '관악구', '서초구', '강남구', '송파구', '강동구',
  ],
  부산: [
    '중구', '서구', '동구', '영도구', '부산진구', '동래구', '남구', '북구',
    '해운대구', '사하구', '금정구', '강서구', '연제구', '수영구', '사상구', '기장군',
  ],
  대구: ['중구', '동구', '서구', '남구', '북구', '수성구', '달서구', '달성군', '군위군'],
  인천: ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군'],
  광주: ['동구', '서구', '남구', '북구', '광산구'],
  대전: ['동구', '중구', '서구', '유성구', '대덕구'],
  울산: ['중구', '남구', '동구', '북구', '울주군'],
  세종: ['세종시'],
  경기: [
    '수원시', '수원시 장안구', '수원시 권선구', '수원시 팔달구', '수원시 영통구',
    '성남시', '성남시 수정구', '성남시 중원구', '성남시 분당구',
    '의정부시', '안양시', '안양시 만안구', '안양시 동안구',
    '부천시', '광명시', '평택시', '동두천시',
    '안산시', '안산시 상록구', '안산시 단원구',
    '고양시', '고양시 덕양구', '고양시 일산동구', '고양시 일산서구',
    '과천시', '구리시', '남양주시', '오산시', '시흥시', '군포시', '의왕시', '하남시',
    '용인시', '용인시 처인구', '용인시 기흥구', '용인시 수지구',
    '파주시', '이천시', '안성시', '김포시', '화성시', '광주시', '양주시', '포천시', '여주시',
    '연천군', '가평군', '양평군',
  ],
  강원: [
    '춘천시', '원주시', '강릉시', '동해시', '태백시', '속초시', '삼척시',
    '홍천군', '횡성군', '영월군', '평창군', '정선군', '철원군', '화천군', '양구군', '인제군', '고성군', '양양군',
  ],
  충북: [
    '청주시', '청주시 상당구', '청주시 서원구', '청주시 흥덕구', '청주시 청원구',
    '충주시', '제천시', '보은군', '옥천군', '영동군', '증평군', '진천군', '괴산군', '음성군', '단양군',
  ],
  충남: [
    '천안시', '천안시 동남구', '천안시 서북구',
    '공주시', '보령시', '아산시', '서산시', '논산시', '계룡시', '당진시',
    '금산군', '부여군', '서천군', '청양군', '홍성군', '예산군', '태안군',
  ],
  전북: [
    '전주시', '전주시 완산구', '전주시 덕진구',
    '군산시', '익산시', '정읍시', '남원시', '김제시',
    '완주군', '진안군', '무주군', '장수군', '임실군', '순창군', '고창군', '부안군',
  ],
  전남: [
    '목포시', '여수시', '순천시', '나주시', '광양시',
    '담양군', '곡성군', '구례군', '고흥군', '보성군', '화순군', '장흥군', '강진군',
    '해남군', '영암군', '무안군', '함평군', '영광군', '장성군', '완도군', '진도군', '신안군',
  ],
  경북: [
    '포항시', '포항시 남구', '포항시 북구',
    '경주시', '김천시', '안동시', '구미시', '영주시', '영천시', '상주시', '문경시', '경산시',
    '의성군', '청송군', '영양군', '영덕군', '청도군', '고령군', '성주군', '칠곡군', '예천군', '봉화군', '울진군', '울릉군',
  ],
  경남: [
    '창원시', '창원시 의창구', '창원시 성산구', '창원시 마산합포구', '창원시 마산회원구', '창원시 진해구',
    '진주시', '통영시', '사천시', '김해시', '밀양시', '거제시', '양산시',
    '의령군', '함안군', '창녕군', '고성군', '남해군', '하동군', '산청군', '함양군', '거창군', '합천군',
  ],
  제주: ['제주시', '서귀포시'],
}

function getDistrictSlug(koreanName: string): string {
  return KOREAN_TO_ROMANIZATION[koreanName] || koreanName.toLowerCase().replace(/\s+/g, '-')
}

// Fallback: API 실패 시 도시/구군 허브 페이지만 추가 (빈 카테고리 조합은 제외)
function addFallbackHubPages(urls: SitemapUrl[], today: string): void {
  for (const [cityName, districts] of Object.entries(REGIONS)) {
    const citySlug = CITY_SLUGS[cityName]
    if (!citySlug) continue

    urls.push({
      loc: `${SITE_URL}/${citySlug}`,
      lastmod: today,
      changefreq: 'weekly',
      priority: 0.8,
    })

    for (const district of districts) {
      const districtSlug = getDistrictSlug(district)
      urls.push({
        loc: `${SITE_URL}/${citySlug}/${districtSlug}`,
        lastmod: today,
        changefreq: 'weekly',
        priority: 0.7,
      })
    }
  }
}

export default defineEventHandler(async (event) => {
  setHeader(event, 'Content-Type', 'application/xml')

  const today = new Date().toISOString().split('T')[0]
  const urls: SitemapUrl[] = []

  // 홈페이지
  urls.push({ loc: SITE_URL, lastmod: today, changefreq: 'daily', priority: 1.0 })

  // 정적 페이지
  urls.push({ loc: `${SITE_URL}/about`, lastmod: today, changefreq: 'monthly', priority: 0.5 })
  urls.push({ loc: `${SITE_URL}/faq`, lastmod: today, changefreq: 'monthly', priority: 0.5 })
  urls.push({ loc: `${SITE_URL}/privacy`, lastmod: today, changefreq: 'monthly', priority: 0.3 })
  urls.push({ loc: `${SITE_URL}/terms`, lastmod: today, changefreq: 'monthly', priority: 0.3 })

  // /search는 noindex 페이지이므로 사이트맵에서 제외 (신호 충돌 방지)

  // 카테고리 랜딩 페이지
  for (const category of CATEGORIES) {
    urls.push({ loc: `${SITE_URL}/${category}`, lastmod: today, changefreq: 'daily', priority: 0.9 })
  }

  // 가이드 목록 페이지
  urls.push({ loc: `${SITE_URL}/guide`, lastmod: today, changefreq: 'daily', priority: 0.8 })

  // 가이드 개별 글
  try {
    const guidesRes = await fetch(`${apiBase}/api/guides?limit=100`)
    if (guidesRes.ok) {
      const guidesJson = await guidesRes.json()
      const guides: Array<{ slug: string; createdAt: string }> = guidesJson.data?.items || []
      for (const guide of guides) {
        const lastmod = guide.createdAt ? new Date(guide.createdAt).toISOString().split('T')[0] : today
        urls.push({ loc: `${SITE_URL}/guide/${guide.slug}`, lastmod, changefreq: 'weekly', priority: 0.7 })
      }
    }
  } catch (err) {
    console.error('[sitemap] Failed to fetch guides:', err)
  }

  // API에서 실제 데이터가 있는 지역-카테고리 조합만 가져오기
  const apiBase = process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000'
  try {
    const res = await fetch(`${apiBase}/api/sitemap/region-categories`)
    if (res.ok) {
      const json = await res.json()
      const combinations: Array<{ city: string; district: string; citySlug: string; districtSlug: string; category: string }> = json.data || []

      // 고유 도시, 도시+구군 조합 추출
      const citySet = new Set<string>()
      const districtSet = new Set<string>()
      const urlSet = new Set<string>()

      for (const combo of combinations) {
        if (!combo.citySlug || !combo.districtSlug) continue

        citySet.add(combo.citySlug)
        districtSet.add(`${combo.citySlug}/${combo.districtSlug}`)

        const loc = `${SITE_URL}/${combo.citySlug}/${combo.districtSlug}/${combo.category}`
        if (!urlSet.has(loc)) {
          urlSet.add(loc)
          urls.push({ loc, lastmod: today, changefreq: 'weekly', priority: 0.8 })
        }
      }

      // 도시 허브 페이지 (예: /seoul)
      Array.from(citySet).forEach((citySlug) => {
        urls.push({
          loc: `${SITE_URL}/${citySlug}`,
          lastmod: today,
          changefreq: 'weekly',
          priority: 0.8,
        })
      })

      // 구/군 허브 페이지 (예: /seoul/gangnam)
      Array.from(districtSet).forEach((path) => {
        urls.push({
          loc: `${SITE_URL}/${path}`,
          lastmod: today,
          changefreq: 'weekly',
          priority: 0.7,
        })
      })
    } else {
      console.error(`[sitemap] Failed to fetch region-categories: HTTP ${res.status}`)
      addFallbackHubPages(urls, today)
    }
  } catch (err) {
    console.error('[sitemap] Failed to fetch region-categories:', err)
    addFallbackHubPages(urls, today)
  }

  return generateSitemapXml(urls)
})
