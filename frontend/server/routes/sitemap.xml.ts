// @TASK T5.2 - 동적 사이트맵 생성
import { defineEventHandler, setHeader } from 'h3'

const SITE_URL = 'https://ilsangkit.co.kr'

// 카테고리 목록
const CATEGORIES = ['toilet', 'trash', 'wifi', 'clothes', 'kiosk']

// 시/도별 slug 매핑
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

// 한글 -> 로마자 변환 맵 (구/군/시 이름)
const KOREAN_TO_ROMANIZATION: Record<string, string> = {
  // 서울
  종로구: 'jongno-gu',
  중구: 'jung-gu',
  용산구: 'yongsan-gu',
  성동구: 'seongdong-gu',
  광진구: 'gwangjin-gu',
  동대문구: 'dongdaemun-gu',
  중랑구: 'jungnang-gu',
  성북구: 'seongbuk-gu',
  강북구: 'gangbuk-gu',
  도봉구: 'dobong-gu',
  노원구: 'nowon-gu',
  은평구: 'eunpyeong-gu',
  서대문구: 'seodaemun-gu',
  마포구: 'mapo-gu',
  양천구: 'yangcheon-gu',
  강서구: 'gangseo-gu',
  구로구: 'guro-gu',
  금천구: 'geumcheon-gu',
  영등포구: 'yeongdeungpo-gu',
  동작구: 'dongjak-gu',
  관악구: 'gwanak-gu',
  서초구: 'seocho-gu',
  강남구: 'gangnam-gu',
  송파구: 'songpa-gu',
  강동구: 'gangdong-gu',

  // 부산
  영도구: 'yeongdo-gu',
  부산진구: 'busanjin-gu',
  동래구: 'dongnae-gu',
  남구: 'nam-gu',
  북구: 'buk-gu',
  해운대구: 'haeundae-gu',
  사하구: 'saha-gu',
  금정구: 'geumjeong-gu',
  연제구: 'yeonje-gu',
  수영구: 'suyeong-gu',
  사상구: 'sasang-gu',
  기장군: 'gijang-gun',

  // 대구
  동구: 'dong-gu',
  서구: 'seo-gu',
  수성구: 'suseong-gu',
  달서구: 'dalseo-gu',
  달성군: 'dalseong-gun',
  군위군: 'gunwi-gun',

  // 인천
  미추홀구: 'michuhol-gu',
  연수구: 'yeonsu-gu',
  남동구: 'namdong-gu',
  부평구: 'bupyeong-gu',
  계양구: 'gyeyang-gu',
  강화군: 'ganghwa-gun',
  옹진군: 'ongjin-gun',

  // 광주
  광산구: 'gwangsan-gu',

  // 대전
  대덕구: 'daedeok-gu',
  유성구: 'yuseong-gu',

  // 울산
  울주군: 'ulju-gun',

  // 세종
  세종시: 'sejong-si',

  // 경기
  수원시: 'suwon-si',
  '수원시 장안구': 'suwon-si-jangan-gu',
  '수원시 권선구': 'suwon-si-gwonseon-gu',
  '수원시 팔달구': 'suwon-si-paldal-gu',
  '수원시 영통구': 'suwon-si-yeongtong-gu',
  성남시: 'seongnam-si',
  '성남시 수정구': 'seongnam-si-sujeong-gu',
  '성남시 중원구': 'seongnam-si-jungwon-gu',
  '성남시 분당구': 'seongnam-si-bundang-gu',
  의정부시: 'uijeongbu-si',
  안양시: 'anyang-si',
  '안양시 만안구': 'anyang-si-manan-gu',
  '안양시 동안구': 'anyang-si-dongan-gu',
  부천시: 'bucheon-si',
  광명시: 'gwangmyeong-si',
  평택시: 'pyeongtaek-si',
  동두천시: 'dongducheon-si',
  안산시: 'ansan-si',
  '안산시 상록구': 'ansan-si-sangnok-gu',
  '안산시 단원구': 'ansan-si-danwon-gu',
  고양시: 'goyang-si',
  '고양시 덕양구': 'goyang-si-deogyang-gu',
  '고양시 일산동구': 'goyang-si-ilsandong-gu',
  '고양시 일산서구': 'goyang-si-ilsanseo-gu',
  과천시: 'gwacheon-si',
  구리시: 'guri-si',
  남양주시: 'namyangju-si',
  오산시: 'osan-si',
  시흥시: 'siheung-si',
  군포시: 'gunpo-si',
  의왕시: 'uiwang-si',
  하남시: 'hanam-si',
  용인시: 'yongin-si',
  '용인시 처인구': 'yongin-si-cheoin-gu',
  '용인시 기흥구': 'yongin-si-giheung-gu',
  '용인시 수지구': 'yongin-si-suji-gu',
  파주시: 'paju-si',
  이천시: 'icheon-si',
  안성시: 'anseong-si',
  김포시: 'gimpo-si',
  화성시: 'hwaseong-si',
  광주시: 'gwangju-si',
  양주시: 'yangju-si',
  포천시: 'pocheon-si',
  여주시: 'yeoju-si',
  연천군: 'yeoncheon-gun',
  가평군: 'gapyeong-gun',
  양평군: 'yangpyeong-gun',

  // 강원
  춘천시: 'chuncheon-si',
  원주시: 'wonju-si',
  강릉시: 'gangneung-si',
  동해시: 'donghae-si',
  태백시: 'taebaek-si',
  속초시: 'sokcho-si',
  삼척시: 'samcheok-si',
  홍천군: 'hongcheon-gun',
  횡성군: 'hoengseong-gun',
  영월군: 'yeongwol-gun',
  평창군: 'pyeongchang-gun',
  정선군: 'jeongseon-gun',
  철원군: 'cheorwon-gun',
  화천군: 'hwacheon-gun',
  양구군: 'yanggu-gun',
  인제군: 'inje-gun',
  고성군: 'goseong-gun',
  양양군: 'yangyang-gun',

  // 충북
  청주시: 'cheongju-si',
  '청주시 상당구': 'cheongju-si-sangdang-gu',
  '청주시 서원구': 'cheongju-si-seowon-gu',
  '청주시 흥덕구': 'cheongju-si-heungdeok-gu',
  '청주시 청원구': 'cheongju-si-cheongwon-gu',
  충주시: 'chungju-si',
  제천시: 'jecheon-si',
  보은군: 'boeun-gun',
  옥천군: 'okcheon-gun',
  영동군: 'yeongdong-gun',
  증평군: 'jeungpyeong-gun',
  진천군: 'jincheon-gun',
  괴산군: 'goesan-gun',
  음성군: 'eumseong-gun',
  단양군: 'danyang-gun',

  // 충남
  천안시: 'cheonan-si',
  '천안시 동남구': 'cheonan-si-dongnam-gu',
  '천안시 서북구': 'cheonan-si-seobuk-gu',
  공주시: 'gongju-si',
  보령시: 'boryeong-si',
  아산시: 'asan-si',
  서산시: 'seosan-si',
  논산시: 'nonsan-si',
  계룡시: 'gyeryong-si',
  당진시: 'dangjin-si',
  금산군: 'geumsan-gun',
  부여군: 'buyeo-gun',
  서천군: 'seocheon-gun',
  청양군: 'cheongyang-gun',
  홍성군: 'hongseong-gun',
  예산군: 'yesan-gun',
  태안군: 'taean-gun',

  // 전북
  전주시: 'jeonju-si',
  '전주시 완산구': 'jeonju-si-wansan-gu',
  '전주시 덕진구': 'jeonju-si-deokjin-gu',
  군산시: 'gunsan-si',
  익산시: 'iksan-si',
  정읍시: 'jeongeup-si',
  남원시: 'namwon-si',
  김제시: 'gimje-si',
  완주군: 'wanju-gun',
  진안군: 'jinan-gun',
  무주군: 'muju-gun',
  장수군: 'jangsu-gun',
  임실군: 'imsil-gun',
  순창군: 'sunchang-gun',
  고창군: 'gochang-gun',
  부안군: 'buan-gun',

  // 전남
  목포시: 'mokpo-si',
  여수시: 'yeosu-si',
  순천시: 'suncheon-si',
  나주시: 'naju-si',
  광양시: 'gwangyang-si',
  담양군: 'damyang-gun',
  곡성군: 'gokseong-gun',
  구례군: 'gurye-gun',
  고흥군: 'goheung-gun',
  보성군: 'boseong-gun',
  화순군: 'hwasun-gun',
  장흥군: 'jangheung-gun',
  강진군: 'gangjin-gun',
  해남군: 'haenam-gun',
  영암군: 'yeongam-gun',
  무안군: 'muan-gun',
  함평군: 'hampyeong-gun',
  영광군: 'yeonggwang-gun',
  장성군: 'jangseong-gun',
  완도군: 'wando-gun',
  진도군: 'jindo-gun',
  신안군: 'sinan-gun',

  // 경북
  포항시: 'pohang-si',
  '포항시 남구': 'pohang-si-nam-gu',
  '포항시 북구': 'pohang-si-buk-gu',
  경주시: 'gyeongju-si',
  김천시: 'gimcheon-si',
  안동시: 'andong-si',
  구미시: 'gumi-si',
  영주시: 'yeongju-si',
  영천시: 'yeongcheon-si',
  상주시: 'sangju-si',
  문경시: 'mungyeong-si',
  경산시: 'gyeongsan-si',
  의성군: 'uiseong-gun',
  청송군: 'cheongsong-gun',
  영양군: 'yeongyang-gun',
  영덕군: 'yeongdeok-gun',
  청도군: 'cheongdo-gun',
  고령군: 'goryeong-gun',
  성주군: 'seongju-gun',
  칠곡군: 'chilgok-gun',
  예천군: 'yecheon-gun',
  봉화군: 'bonghwa-gun',
  울진군: 'uljin-gun',
  울릉군: 'ulleung-gun',

  // 경남
  창원시: 'changwon-si',
  '창원시 의창구': 'changwon-si-uichang-gu',
  '창원시 성산구': 'changwon-si-seongsan-gu',
  '창원시 마산합포구': 'changwon-si-masanhappo-gu',
  '창원시 마산회원구': 'changwon-si-masanhoewon-gu',
  '창원시 진해구': 'changwon-si-jinhae-gu',
  진주시: 'jinju-si',
  통영시: 'tongyeong-si',
  사천시: 'sacheon-si',
  김해시: 'gimhae-si',
  밀양시: 'miryang-si',
  거제시: 'geoje-si',
  양산시: 'yangsan-si',
  의령군: 'uiryeong-gun',
  함안군: 'haman-gun',
  창녕군: 'changnyeong-gun',
  남해군: 'namhae-gun',
  하동군: 'hadong-gun',
  산청군: 'sancheong-gun',
  함양군: 'hamyang-gun',
  거창군: 'geochang-gun',
  합천군: 'hapcheon-gun',

  // 제주
  제주시: 'jeju-si',
  서귀포시: 'seogwipo-si',
}

// 전국 시/도별 구/군 데이터 (syncRegion.ts에서 동기화)
const REGIONS: Record<string, string[]> = {
  서울: [
    '종로구',
    '중구',
    '용산구',
    '성동구',
    '광진구',
    '동대문구',
    '중랑구',
    '성북구',
    '강북구',
    '도봉구',
    '노원구',
    '은평구',
    '서대문구',
    '마포구',
    '양천구',
    '강서구',
    '구로구',
    '금천구',
    '영등포구',
    '동작구',
    '관악구',
    '서초구',
    '강남구',
    '송파구',
    '강동구',
  ],
  부산: [
    '중구',
    '서구',
    '동구',
    '영도구',
    '부산진구',
    '동래구',
    '남구',
    '북구',
    '해운대구',
    '사하구',
    '금정구',
    '강서구',
    '연제구',
    '수영구',
    '사상구',
    '기장군',
  ],
  대구: ['중구', '동구', '서구', '남구', '북구', '수성구', '달서구', '달성군', '군위군'],
  인천: [
    '중구',
    '동구',
    '미추홀구',
    '연수구',
    '남동구',
    '부평구',
    '계양구',
    '서구',
    '강화군',
    '옹진군',
  ],
  광주: ['동구', '서구', '남구', '북구', '광산구'],
  대전: ['동구', '중구', '서구', '유성구', '대덕구'],
  울산: ['중구', '남구', '동구', '북구', '울주군'],
  세종: ['세종시'],
  경기: [
    '수원시',
    '수원시 장안구',
    '수원시 권선구',
    '수원시 팔달구',
    '수원시 영통구',
    '성남시',
    '성남시 수정구',
    '성남시 중원구',
    '성남시 분당구',
    '의정부시',
    '안양시',
    '안양시 만안구',
    '안양시 동안구',
    '부천시',
    '광명시',
    '평택시',
    '동두천시',
    '안산시',
    '안산시 상록구',
    '안산시 단원구',
    '고양시',
    '고양시 덕양구',
    '고양시 일산동구',
    '고양시 일산서구',
    '과천시',
    '구리시',
    '남양주시',
    '오산시',
    '시흥시',
    '군포시',
    '의왕시',
    '하남시',
    '용인시',
    '용인시 처인구',
    '용인시 기흥구',
    '용인시 수지구',
    '파주시',
    '이천시',
    '안성시',
    '김포시',
    '화성시',
    '광주시',
    '양주시',
    '포천시',
    '여주시',
    '연천군',
    '가평군',
    '양평군',
  ],
  강원: [
    '춘천시',
    '원주시',
    '강릉시',
    '동해시',
    '태백시',
    '속초시',
    '삼척시',
    '홍천군',
    '횡성군',
    '영월군',
    '평창군',
    '정선군',
    '철원군',
    '화천군',
    '양구군',
    '인제군',
    '고성군',
    '양양군',
  ],
  충북: [
    '청주시',
    '청주시 상당구',
    '청주시 서원구',
    '청주시 흥덕구',
    '청주시 청원구',
    '충주시',
    '제천시',
    '보은군',
    '옥천군',
    '영동군',
    '증평군',
    '진천군',
    '괴산군',
    '음성군',
    '단양군',
  ],
  충남: [
    '천안시',
    '천안시 동남구',
    '천안시 서북구',
    '공주시',
    '보령시',
    '아산시',
    '서산시',
    '논산시',
    '계룡시',
    '당진시',
    '금산군',
    '부여군',
    '서천군',
    '청양군',
    '홍성군',
    '예산군',
    '태안군',
  ],
  전북: [
    '전주시',
    '전주시 완산구',
    '전주시 덕진구',
    '군산시',
    '익산시',
    '정읍시',
    '남원시',
    '김제시',
    '완주군',
    '진안군',
    '무주군',
    '장수군',
    '임실군',
    '순창군',
    '고창군',
    '부안군',
  ],
  전남: [
    '목포시',
    '여수시',
    '순천시',
    '나주시',
    '광양시',
    '담양군',
    '곡성군',
    '구례군',
    '고흥군',
    '보성군',
    '화순군',
    '장흥군',
    '강진군',
    '해남군',
    '영암군',
    '무안군',
    '함평군',
    '영광군',
    '장성군',
    '완도군',
    '진도군',
    '신안군',
  ],
  경북: [
    '포항시',
    '포항시 남구',
    '포항시 북구',
    '경주시',
    '김천시',
    '안동시',
    '구미시',
    '영주시',
    '영천시',
    '상주시',
    '문경시',
    '경산시',
    '의성군',
    '청송군',
    '영양군',
    '영덕군',
    '청도군',
    '고령군',
    '성주군',
    '칠곡군',
    '예천군',
    '봉화군',
    '울진군',
    '울릉군',
  ],
  경남: [
    '창원시',
    '창원시 의창구',
    '창원시 성산구',
    '창원시 마산합포구',
    '창원시 마산회원구',
    '창원시 진해구',
    '진주시',
    '통영시',
    '사천시',
    '김해시',
    '밀양시',
    '거제시',
    '양산시',
    '의령군',
    '함안군',
    '창녕군',
    '고성군',
    '남해군',
    '하동군',
    '산청군',
    '함양군',
    '거창군',
    '합천군',
  ],
  제주: ['제주시', '서귀포시'],
}

interface SitemapUrl {
  loc: string
  lastmod?: string
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
}

/**
 * 한글 구/군/시 이름을 로마자 slug로 변환
 */
function getDistrictSlug(koreanName: string): string {
  return KOREAN_TO_ROMANIZATION[koreanName] || koreanName.toLowerCase().replace(/\s+/g, '-')
}

function generateSitemapXml(urls: SitemapUrl[]): string {
  const urlElements = urls
    .map((url) => {
      const parts = [`    <loc>${url.loc}</loc>`]
      if (url.lastmod) parts.push(`    <lastmod>${url.lastmod}</lastmod>`)
      if (url.changefreq) parts.push(`    <changefreq>${url.changefreq}</changefreq>`)
      if (url.priority !== undefined) parts.push(`    <priority>${url.priority.toFixed(1)}</priority>`)
      return `  <url>\n${parts.join('\n')}\n  </url>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements}
</urlset>`
}

export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'application/xml')

  const today = new Date().toISOString().split('T')[0]
  const urls: SitemapUrl[] = []

  // 홈페이지
  urls.push({
    loc: SITE_URL,
    lastmod: today,
    changefreq: 'daily',
    priority: 1.0,
  })

  // 정적 페이지
  urls.push({
    loc: `${SITE_URL}/about`,
    lastmod: today,
    changefreq: 'monthly',
    priority: 0.5,
  })
  urls.push({
    loc: `${SITE_URL}/privacy`,
    lastmod: today,
    changefreq: 'monthly',
    priority: 0.3,
  })
  urls.push({
    loc: `${SITE_URL}/terms`,
    lastmod: today,
    changefreq: 'monthly',
    priority: 0.3,
  })

  // 검색 페이지
  urls.push({
    loc: `${SITE_URL}/search`,
    lastmod: today,
    changefreq: 'daily',
    priority: 0.9,
  })

  // 카테고리별 검색 페이지
  for (const category of CATEGORIES) {
    urls.push({
      loc: `${SITE_URL}/search?category=${category}`,
      lastmod: today,
      changefreq: 'weekly',
      priority: 0.8,
    })
  }

  // 전국 지역별 페이지 (시/도 + 구/군 + 카테고리)
  for (const [cityName, districts] of Object.entries(REGIONS)) {
    const citySlug = CITY_SLUGS[cityName]
    if (!citySlug) continue

    for (const district of districts) {
      const districtSlug = getDistrictSlug(district)

      for (const category of CATEGORIES) {
        urls.push({
          loc: `${SITE_URL}/${citySlug}/${districtSlug}/${category}`,
          lastmod: today,
          changefreq: 'weekly',
          priority: 0.7,
        })
      }
    }
  }

  return generateSitemapXml(urls)
})
