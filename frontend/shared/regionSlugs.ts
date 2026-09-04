/**
 * 지역 slug 매핑 - 단일 소스 (Single Source of Truth)
 *
 * static.xml.ts, useRegions.ts 등에서 공유하여 사용.
 * 새 지역 추가 시 이 파일만 수정하면 됨.
 */

/** 시/도 한글 → slug */
export const CITY_SLUGS: Record<string, string> = {
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
  // 2026-07-01 전남광주통합특별시 출범. flat 27 시군구(광주5구+전남22시군), 서브그룹핑 없음.
  // gwangju/jeonnam 엔트리는 유지(제거는 정규화 Phase C1 담당).
  전남광주통합특별시: 'jeonnamgwangju',
}

/** slug → 시/도 한글 (역매핑) */
export const CITY_SLUG_MAP: Record<string, string> = Object.entries(CITY_SLUGS).reduce(
  (acc, [name, slug]) => ({ ...acc, [slug]: name }),
  {} as Record<string, string>,
)

/** DB 풀네임 → slug */
export const CITY_FULL_NAME_TO_SLUG: Record<string, string> = {
  서울특별시: 'seoul',
  부산광역시: 'busan',
  대구광역시: 'daegu',
  인천광역시: 'incheon',
  광주광역시: 'gwangju',
  대전광역시: 'daejeon',
  울산광역시: 'ulsan',
  세종특별자치시: 'sejong',
  경기도: 'gyeonggi',
  강원특별자치도: 'gangwon',
  충청북도: 'chungbuk',
  충청남도: 'chungnam',
  전북특별자치도: 'jeonbuk',
  전라남도: 'jeonnam',
  경상북도: 'gyeongbuk',
  경상남도: 'gyeongnam',
  제주특별자치도: 'jeju',
  // 2026-07-01 전남광주통합특별시 출범. backend/src/lib/regionSlugs.ts CITY_FULL_NAME_TO_SLUG와 동기.
  전남광주통합특별시: 'jeonnamgwangju',
}

/** 구/군/시 한글 → 로마자 slug (전체 매핑) */
export const DISTRICT_SLUG_MAP: Record<string, string> = {
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
  // 인천 2026-07-01 신설(2군9구). 중구/동구/서구는 generic 재활용.
  제물포구: 'jemulpo',
  영종구: 'yeongjong',
  서해구: 'seohae',
  검단구: 'geomdan',
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
  '부천시 소사구': 'bucheon-sosa',
  '부천시 오정구': 'bucheon-ojeong',
  '부천시 원미구': 'bucheon-wonmi',
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
  '화성시 동탄구': 'hwaseong-dongtan',
  '화성시 만세구': 'hwaseong-manse',
  '화성시 병점구': 'hwaseong-byeongjeom',
  '화성시 효행구': 'hwaseong-hyohaeng',
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

/** 시/도별 구/군 목록 */
export const REGIONS: Record<string, string[]> = {
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
  // 2026-07-01 개편: 소멸구(중구·동구·서구) 제거, 신설구(제물포·영종·서해·검단) 추가. bjdCode 순.
  인천: ['제물포구', '영종구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서해구', '검단구', '강화군', '옹진군'],
  광주: ['동구', '서구', '남구', '북구', '광산구'],
  대전: ['동구', '중구', '서구', '유성구', '대덕구'],
  울산: ['중구', '남구', '동구', '북구', '울주군'],
  세종: ['세종시'],
  경기: [
    '수원시 장안구', '수원시 권선구', '수원시 팔달구', '수원시 영통구',
    '성남시 수정구', '성남시 중원구', '성남시 분당구',
    '의정부시', '안양시 만안구', '안양시 동안구',
    '부천시', '광명시', '평택시', '동두천시',
    '안산시 상록구', '안산시 단원구',
    '고양시 덕양구', '고양시 일산동구', '고양시 일산서구',
    '과천시', '구리시', '남양주시', '오산시', '시흥시', '군포시', '의왕시', '하남시',
    '용인시 처인구', '용인시 기흥구', '용인시 수지구',
    '파주시', '이천시', '안성시', '김포시', '화성시', '광주시', '양주시', '포천시', '여주시',
    '연천군', '가평군', '양평군',
  ],
  강원: [
    '춘천시', '원주시', '강릉시', '동해시', '태백시', '속초시', '삼척시',
    '홍천군', '횡성군', '영월군', '평창군', '정선군', '철원군', '화천군', '양구군', '인제군', '고성군', '양양군',
  ],
  충북: [
    '청주시 상당구', '청주시 서원구', '청주시 흥덕구', '청주시 청원구',
    '충주시', '제천시', '보은군', '옥천군', '영동군', '증평군', '진천군', '괴산군', '음성군', '단양군',
  ],
  충남: [
    '천안시 동남구', '천안시 서북구',
    '공주시', '보령시', '아산시', '서산시', '논산시', '계룡시', '당진시',
    '금산군', '부여군', '서천군', '청양군', '홍성군', '예산군', '태안군',
  ],
  전북: [
    '전주시 완산구', '전주시 덕진구',
    '군산시', '익산시', '정읍시', '남원시', '김제시',
    '완주군', '진안군', '무주군', '장수군', '임실군', '순창군', '고창군', '부안군',
  ],
  전남: [
    '목포시', '여수시', '순천시', '나주시', '광양시',
    '담양군', '곡성군', '구례군', '고흥군', '보성군', '화순군', '장흥군', '강진군',
    '해남군', '영암군', '무안군', '함평군', '영광군', '장성군', '완도군', '진도군', '신안군',
  ],
  경북: [
    '포항시 남구', '포항시 북구',
    '경주시', '김천시', '안동시', '구미시', '영주시', '영천시', '상주시', '문경시', '경산시',
    '의성군', '청송군', '영양군', '영덕군', '청도군', '고령군', '성주군', '칠곡군', '예천군', '봉화군', '울진군', '울릉군',
  ],
  경남: [
    '창원시 의창구', '창원시 성산구', '창원시 마산합포구', '창원시 마산회원구', '창원시 진해구',
    '진주시', '통영시', '사천시', '김해시', '밀양시', '거제시', '양산시',
    '의령군', '함안군', '창녕군', '고성군', '남해군', '하동군', '산청군', '함양군', '거창군', '합천군',
  ],
  제주: ['제주시', '서귀포시'],
  // 2026-07-01 전남광주통합특별시 출범. flat 27 시군구(광주5구+전남22시군), 서브그룹핑 없음.
  // gwangju/jeonnam 엔트리는 유지(제거는 정규화 Phase C1 담당).
  전남광주통합특별시: [
    '동구', '서구', '남구', '북구', '광산구',
    '목포시', '여수시', '순천시', '나주시', '광양시',
    '담양군', '곡성군', '구례군', '고흥군', '보성군', '화순군', '장흥군', '강진군',
    '해남군', '영암군', '무안군', '함평군', '영광군', '장성군', '완도군', '진도군', '신안군',
  ],
}

/**
 * 한글 구/군/시 이름 → slug 변환
 * DISTRICT_SLUG_MAP에 있으면 해당 값, 없으면 빈 문자열 방지용 fallback
 */
export function getDistrictSlug(koreanName: string): string {
  return DISTRICT_SLUG_MAP[koreanName] || koreanName.toLowerCase().replace(/\s+/g, '-')
}

/**
 * useRegions.generateSlug와 동일한 district 슬러그 규칙 (순수·서버안전).
 * 301 리다이렉트 타겟과 byte-match 보장용.
 */
export function trashDistrictSlug(district: string): string {
  const direct = DISTRICT_SLUG_MAP[district]
  if (direct) return direct

  // 배출 일정 원본은 구·군을 접미사 없이 적는 경우가 있다('남양주', '동두천'). 지도에는
  // '남양주시'·'동두천시' 로 들어 있어 직접 조회가 빗나가고, 아래 폴백이 한글을 전부 지워
  // 빈 문자열을 낸다 → `/gyeonggi//trash` 같은 404 경로가 됐다. 접미사를 붙여 한 번 더 본다.
  for (const suffix of ['시', '군', '구']) {
    const withSuffix = DISTRICT_SLUG_MAP[`${district}${suffix}`]
    if (withSuffix) return withSuffix
  }

  return district.replace(/[시군구]/g, '').replace(/[가-힣]/g, '').toLowerCase().replace(/\s+/g, '-')
}

/**
 * 쓰레기 배출 구·군 집계 경로를 생성한다. 301 타겟·canonical과 byte-match.
 * citySlug 미해결 시 null 반환. Vue import 없는 순수 함수 (Nitro 서버안전).
 */
export function buildTrashRegionPath(city: string, district: string): string | null {
  const shortCity = city.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')
  const citySlug = CITY_FULL_NAME_TO_SLUG[city] || CITY_SLUGS[city] || CITY_SLUGS[shortCity]
  if (!citySlug) return null
  // trashDistrictSlug 의 폴백은 시/군/구를 떼고 한글을 전부 지운다. DISTRICT_SLUG_MAP 에 없는
  // 순한글 이름이면 결과가 '' 이라 `/gyeonggi//trash` 같은 빈 세그먼트 경로가 나온다 — 그건
  // 404 다. 여기서 null 을 주면 호출부(301 · canonical)가 아예 손을 떼고 200 을 그대로 낸다.
  // 404 로 301 하느니 원래 문서를 유지하는 편이 언제나 낫다.
  const districtSlug = trashDistrictSlug(district)
  if (!districtSlug) return null
  return `/${citySlug}/${districtSlug}/trash`
}
