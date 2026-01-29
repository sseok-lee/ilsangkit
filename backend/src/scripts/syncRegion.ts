// @TASK Region 동기화 스크립트
// @SPEC docs/planning/04-database-design.md#region-table

import prisma from '../lib/prisma.js';

/**
 * 동기화 결과 인터페이스
 */
interface SyncResult {
  status: 'success' | 'failed';
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
  errorMessage?: string;
}

/**
 * 동기화 옵션 인터페이스
 */
interface SyncOptions {
  testMode?: boolean;
  testData?: RegionData[];
}

/**
 * Region 데이터 인터페이스
 */
interface RegionData {
  bjdCode: string;
  city: string;
  district: string;
  lat: number;
  lng: number;
}

/**
 * CSV 파싱 결과 인터페이스
 */
interface ParsedRegion {
  bjdCode: string;
  city: string;
  district: string;
}

/**
 * 시도명 변환 맵 (긴 이름 -> 짧은 이름)
 */
const CITY_NAME_MAP: Record<string, string> = {
  서울특별시: '서울',
  부산광역시: '부산',
  대구광역시: '대구',
  인천광역시: '인천',
  광주광역시: '광주',
  대전광역시: '대전',
  울산광역시: '울산',
  세종특별자치시: '세종',
  경기도: '경기',
  강원도: '강원',
  강원특별자치도: '강원',
  충청북도: '충북',
  충청남도: '충남',
  전라북도: '전북',
  전북특별자치도: '전북',
  전라남도: '전남',
  경상북도: '경북',
  경상남도: '경남',
  제주특별자치도: '제주',
};

/**
 * 한글 -> 로마자 변환 맵 (구/군/시 이름)
 */
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
  옹진군: 'ongjin-gun',

  // 광주
  광산구: 'gwangsan-gu',

  // 대전
  대덕구: 'daedeok-gu',
  유성구: 'yuseong-gu',

  // 울산
  울주군: 'ulju-gun',

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
};

/**
 * 전국 시/군/구 중심 좌표 데이터
 */
const REGION_COORDINATES: Record<string, Record<string, { lat: number; lng: number }>> = {
  서울: {
    종로구: { lat: 37.5735, lng: 126.979 },
    중구: { lat: 37.5585, lng: 126.9979 },
    용산구: { lat: 37.5326, lng: 126.9907 },
    성동구: { lat: 37.5467, lng: 127.0372 },
    광진구: { lat: 37.5392, lng: 127.0866 },
    동대문구: { lat: 37.5788, lng: 127.0079 },
    중랑구: { lat: 37.607, lng: 127.0922 },
    성북구: { lat: 37.5894, lng: 127.0173 },
    강북구: { lat: 37.6394, lng: 127.0264 },
    도봉구: { lat: 37.6663, lng: 127.0476 },
    노원구: { lat: 37.6548, lng: 127.0752 },
    은평구: { lat: 37.6024, lng: 126.921 },
    서대문구: { lat: 37.5787, lng: 126.9368 },
    마포구: { lat: 37.5638, lng: 126.9011 },
    양천구: { lat: 37.5173, lng: 126.8668 },
    강서구: { lat: 37.5505, lng: 126.8247 },
    구로구: { lat: 37.4954, lng: 126.8874 },
    금천구: { lat: 37.4536, lng: 126.9035 },
    영등포구: { lat: 37.5268, lng: 126.898 },
    동작구: { lat: 37.4954, lng: 126.9627 },
    관악구: { lat: 37.4879, lng: 126.9555 },
    서초구: { lat: 37.4831, lng: 127.0325 },
    강남구: { lat: 37.4979, lng: 127.0276 },
    송파구: { lat: 37.5148, lng: 127.1071 },
    강동구: { lat: 37.5297, lng: 127.1437 },
  },
  부산: {
    중구: { lat: 35.1063, lng: 129.0324 },
    서구: { lat: 35.0963, lng: 129.0182 },
    동구: { lat: 35.1297, lng: 129.0457 },
    영도구: { lat: 35.0912, lng: 129.0679 },
    부산진구: { lat: 35.1629, lng: 129.0531 },
    동래구: { lat: 35.1962, lng: 129.0858 },
    남구: { lat: 35.1366, lng: 129.0843 },
    북구: { lat: 35.197, lng: 128.9903 },
    해운대구: { lat: 35.1631, lng: 129.1635 },
    사하구: { lat: 35.1046, lng: 128.9747 },
    금정구: { lat: 35.2428, lng: 129.0922 },
    강서구: { lat: 35.1121, lng: 128.8728 },
    연제구: { lat: 35.1762, lng: 129.0799 },
    수영구: { lat: 35.1458, lng: 129.1134 },
    사상구: { lat: 35.1526, lng: 128.9908 },
    기장군: { lat: 35.2445, lng: 129.2223 },
  },
  대구: {
    중구: { lat: 35.8694, lng: 128.6062 },
    동구: { lat: 35.8864, lng: 128.6354 },
    서구: { lat: 35.8718, lng: 128.5591 },
    남구: { lat: 35.846, lng: 128.5974 },
    북구: { lat: 35.8858, lng: 128.5829 },
    수성구: { lat: 35.8584, lng: 128.6359 },
    달서구: { lat: 35.8299, lng: 128.5327 },
    달성군: { lat: 35.7746, lng: 128.4314 },
    군위군: { lat: 36.2428, lng: 128.5728 },
  },
  인천: {
    중구: { lat: 37.4736, lng: 126.6215 },
    동구: { lat: 37.4737, lng: 126.6432 },
    미추홀구: { lat: 37.4637, lng: 126.6504 },
    연수구: { lat: 37.4105, lng: 126.6782 },
    남동구: { lat: 37.4482, lng: 126.7315 },
    부평구: { lat: 37.5074, lng: 126.7219 },
    계양구: { lat: 37.5373, lng: 126.7377 },
    서구: { lat: 37.5457, lng: 126.676 },
    강화군: { lat: 37.7469, lng: 126.4881 },
    옹진군: { lat: 37.4465, lng: 126.6369 },
  },
  광주: {
    동구: { lat: 35.1461, lng: 126.9234 },
    서구: { lat: 35.1526, lng: 126.8895 },
    남구: { lat: 35.1328, lng: 126.9024 },
    북구: { lat: 35.1743, lng: 126.9121 },
    광산구: { lat: 35.1396, lng: 126.7936 },
  },
  대전: {
    동구: { lat: 36.3119, lng: 127.4549 },
    중구: { lat: 36.3253, lng: 127.4216 },
    서구: { lat: 36.3549, lng: 127.3837 },
    유성구: { lat: 36.3623, lng: 127.3563 },
    대덕구: { lat: 36.3467, lng: 127.4154 },
  },
  울산: {
    중구: { lat: 35.5684, lng: 129.3324 },
    남구: { lat: 35.5445, lng: 129.3304 },
    동구: { lat: 35.5049, lng: 129.4163 },
    북구: { lat: 35.5826, lng: 129.3611 },
    울주군: { lat: 35.5213, lng: 129.0995 },
  },
  세종: {
    세종시: { lat: 36.4803, lng: 127.2892 },
  },
  경기: {
    수원시: { lat: 37.2636, lng: 127.0286 },
    '수원시 장안구': { lat: 37.3032, lng: 127.0097 },
    '수원시 권선구': { lat: 37.2576, lng: 126.9715 },
    '수원시 팔달구': { lat: 37.2859, lng: 127.0384 },
    '수원시 영통구': { lat: 37.2591, lng: 127.0466 },
    성남시: { lat: 37.4201, lng: 127.1265 },
    '성남시 수정구': { lat: 37.4505, lng: 127.1457 },
    '성남시 중원구': { lat: 37.4307, lng: 127.1371 },
    '성남시 분당구': { lat: 37.3823, lng: 127.1192 },
    의정부시: { lat: 37.7381, lng: 127.0337 },
    안양시: { lat: 37.3943, lng: 126.9568 },
    '안양시 만안구': { lat: 37.3863, lng: 126.9322 },
    '안양시 동안구': { lat: 37.3925, lng: 126.9515 },
    부천시: { lat: 37.5034, lng: 126.766 },
    광명시: { lat: 37.4785, lng: 126.8644 },
    평택시: { lat: 36.9921, lng: 127.1127 },
    동두천시: { lat: 37.9035, lng: 127.0605 },
    안산시: { lat: 37.3219, lng: 126.8309 },
    '안산시 상록구': { lat: 37.3017, lng: 126.8462 },
    '안산시 단원구': { lat: 37.3182, lng: 126.7917 },
    고양시: { lat: 37.6583, lng: 126.832 },
    '고양시 덕양구': { lat: 37.6373, lng: 126.8325 },
    '고양시 일산동구': { lat: 37.6586, lng: 126.7743 },
    '고양시 일산서구': { lat: 37.6753, lng: 126.7503 },
    과천시: { lat: 37.4292, lng: 126.9877 },
    구리시: { lat: 37.5943, lng: 127.1295 },
    남양주시: { lat: 37.636, lng: 127.2165 },
    오산시: { lat: 37.1497, lng: 127.0775 },
    시흥시: { lat: 37.38, lng: 126.8029 },
    군포시: { lat: 37.3617, lng: 126.9354 },
    의왕시: { lat: 37.3449, lng: 126.9683 },
    하남시: { lat: 37.5393, lng: 127.2147 },
    용인시: { lat: 37.2411, lng: 127.1776 },
    '용인시 처인구': { lat: 37.2342, lng: 127.2007 },
    '용인시 기흥구': { lat: 37.2803, lng: 127.1151 },
    '용인시 수지구': { lat: 37.3219, lng: 127.0981 },
    파주시: { lat: 37.7599, lng: 126.7802 },
    이천시: { lat: 37.2719, lng: 127.4348 },
    안성시: { lat: 37.0079, lng: 127.2798 },
    김포시: { lat: 37.6152, lng: 126.7156 },
    화성시: { lat: 37.1995, lng: 126.8315 },
    광주시: { lat: 37.4293, lng: 127.2553 },
    양주시: { lat: 37.7852, lng: 127.0456 },
    포천시: { lat: 37.8949, lng: 127.2003 },
    여주시: { lat: 37.2983, lng: 127.6376 },
    연천군: { lat: 38.0964, lng: 127.0747 },
    가평군: { lat: 37.8315, lng: 127.5095 },
    양평군: { lat: 37.4917, lng: 127.4877 },
  },
  강원: {
    춘천시: { lat: 37.8813, lng: 127.7299 },
    원주시: { lat: 37.3422, lng: 127.9202 },
    강릉시: { lat: 37.7519, lng: 128.8761 },
    동해시: { lat: 37.5246, lng: 129.1143 },
    태백시: { lat: 37.1641, lng: 128.9855 },
    속초시: { lat: 38.2071, lng: 128.5919 },
    삼척시: { lat: 37.4499, lng: 129.1649 },
    홍천군: { lat: 37.6972, lng: 127.8886 },
    횡성군: { lat: 37.4914, lng: 127.9849 },
    영월군: { lat: 37.1838, lng: 128.4615 },
    평창군: { lat: 37.3707, lng: 128.3904 },
    정선군: { lat: 37.3808, lng: 128.6607 },
    철원군: { lat: 38.1466, lng: 127.3133 },
    화천군: { lat: 38.1062, lng: 127.7081 },
    양구군: { lat: 38.1097, lng: 127.9898 },
    인제군: { lat: 38.0695, lng: 128.1706 },
    고성군: { lat: 38.3801, lng: 128.4678 },
    양양군: { lat: 38.0753, lng: 128.6189 },
  },
  충북: {
    청주시: { lat: 36.6424, lng: 127.489 },
    '청주시 상당구': { lat: 36.6358, lng: 127.4883 },
    '청주시 서원구': { lat: 36.6381, lng: 127.4707 },
    '청주시 흥덕구': { lat: 36.6435, lng: 127.4345 },
    '청주시 청원구': { lat: 36.6967, lng: 127.4898 },
    충주시: { lat: 36.9911, lng: 127.9259 },
    제천시: { lat: 37.1326, lng: 128.1911 },
    보은군: { lat: 36.4894, lng: 127.7294 },
    옥천군: { lat: 36.3063, lng: 127.5713 },
    영동군: { lat: 36.1749, lng: 127.7832 },
    증평군: { lat: 36.7852, lng: 127.5815 },
    진천군: { lat: 36.8553, lng: 127.4357 },
    괴산군: { lat: 36.8154, lng: 127.7867 },
    음성군: { lat: 36.9406, lng: 127.6909 },
    단양군: { lat: 36.9846, lng: 128.3655 },
  },
  충남: {
    천안시: { lat: 36.8151, lng: 127.1139 },
    '천안시 동남구': { lat: 36.7822, lng: 127.1701 },
    '천안시 서북구': { lat: 36.8804, lng: 127.1523 },
    공주시: { lat: 36.4465, lng: 127.1189 },
    보령시: { lat: 36.3336, lng: 126.6127 },
    아산시: { lat: 36.7898, lng: 127.0018 },
    서산시: { lat: 36.7849, lng: 126.4503 },
    논산시: { lat: 36.187, lng: 127.0987 },
    계룡시: { lat: 36.2745, lng: 127.2485 },
    당진시: { lat: 36.8896, lng: 126.6458 },
    금산군: { lat: 36.1089, lng: 127.488 },
    부여군: { lat: 36.2758, lng: 126.9097 },
    서천군: { lat: 36.0804, lng: 126.6916 },
    청양군: { lat: 36.4592, lng: 126.8022 },
    홍성군: { lat: 36.6012, lng: 126.6603 },
    예산군: { lat: 36.6827, lng: 126.8488 },
    태안군: { lat: 36.7456, lng: 126.2977 },
  },
  전북: {
    전주시: { lat: 35.8242, lng: 127.148 },
    '전주시 완산구': { lat: 35.8119, lng: 127.1363 },
    '전주시 덕진구': { lat: 35.8443, lng: 127.1205 },
    군산시: { lat: 35.9676, lng: 126.7369 },
    익산시: { lat: 35.9483, lng: 126.9577 },
    정읍시: { lat: 35.5699, lng: 126.8558 },
    남원시: { lat: 35.4164, lng: 127.3903 },
    김제시: { lat: 35.8037, lng: 126.8808 },
    완주군: { lat: 35.9045, lng: 127.1617 },
    진안군: { lat: 35.7917, lng: 127.4249 },
    무주군: { lat: 35.9223, lng: 127.6606 },
    장수군: { lat: 35.6474, lng: 127.5212 },
    임실군: { lat: 35.6177, lng: 127.289 },
    순창군: { lat: 35.3744, lng: 127.1374 },
    고창군: { lat: 35.4358, lng: 126.702 },
    부안군: { lat: 35.7315, lng: 126.7332 },
  },
  전남: {
    목포시: { lat: 34.8118, lng: 126.3922 },
    여수시: { lat: 34.7604, lng: 127.6622 },
    순천시: { lat: 34.9506, lng: 127.4873 },
    나주시: { lat: 35.0161, lng: 126.7108 },
    광양시: { lat: 34.9407, lng: 127.6958 },
    담양군: { lat: 35.3212, lng: 126.9881 },
    곡성군: { lat: 35.2819, lng: 127.2919 },
    구례군: { lat: 35.2026, lng: 127.4624 },
    고흥군: { lat: 34.6112, lng: 127.2752 },
    보성군: { lat: 34.7718, lng: 127.0797 },
    화순군: { lat: 35.0644, lng: 126.9867 },
    장흥군: { lat: 34.6815, lng: 126.9069 },
    강진군: { lat: 34.6421, lng: 126.7673 },
    해남군: { lat: 34.5713, lng: 126.5992 },
    영암군: { lat: 34.8001, lng: 126.6968 },
    무안군: { lat: 34.9905, lng: 126.4817 },
    함평군: { lat: 35.0657, lng: 126.5166 },
    영광군: { lat: 35.2773, lng: 126.512 },
    장성군: { lat: 35.3016, lng: 126.7848 },
    완도군: { lat: 34.3109, lng: 126.755 },
    진도군: { lat: 34.4861, lng: 126.2635 },
    신안군: { lat: 34.8275, lng: 126.1076 },
  },
  경북: {
    포항시: { lat: 36.0191, lng: 129.3434 },
    '포항시 남구': { lat: 35.9876, lng: 129.3596 },
    '포항시 북구': { lat: 36.0413, lng: 129.3574 },
    경주시: { lat: 35.8562, lng: 129.2247 },
    김천시: { lat: 36.1398, lng: 128.1136 },
    안동시: { lat: 36.5684, lng: 128.7294 },
    구미시: { lat: 36.1197, lng: 128.3445 },
    영주시: { lat: 36.8057, lng: 128.624 },
    영천시: { lat: 35.9733, lng: 128.9385 },
    상주시: { lat: 36.4109, lng: 128.1591 },
    문경시: { lat: 36.5867, lng: 128.1867 },
    경산시: { lat: 35.8251, lng: 128.7415 },
    의성군: { lat: 36.3527, lng: 128.697 },
    청송군: { lat: 36.4363, lng: 129.0571 },
    영양군: { lat: 36.6667, lng: 129.1124 },
    영덕군: { lat: 36.4152, lng: 129.3654 },
    청도군: { lat: 35.6474, lng: 128.7339 },
    고령군: { lat: 35.7264, lng: 128.263 },
    성주군: { lat: 35.919, lng: 128.2831 },
    칠곡군: { lat: 35.9954, lng: 128.4018 },
    예천군: { lat: 36.6576, lng: 128.4526 },
    봉화군: { lat: 36.8932, lng: 128.7325 },
    울진군: { lat: 36.993, lng: 129.4004 },
    울릉군: { lat: 37.4846, lng: 130.9057 },
  },
  경남: {
    창원시: { lat: 35.2285, lng: 128.6811 },
    '창원시 의창구': { lat: 35.2538, lng: 128.6409 },
    '창원시 성산구': { lat: 35.1981, lng: 128.7001 },
    '창원시 마산합포구': { lat: 35.1913, lng: 128.5518 },
    '창원시 마산회원구': { lat: 35.2206, lng: 128.5819 },
    '창원시 진해구': { lat: 35.1337, lng: 128.7112 },
    진주시: { lat: 35.1802, lng: 128.1076 },
    통영시: { lat: 34.8545, lng: 128.4331 },
    사천시: { lat: 35.0035, lng: 128.0642 },
    김해시: { lat: 35.2286, lng: 128.8892 },
    밀양시: { lat: 35.5037, lng: 128.7467 },
    거제시: { lat: 34.8806, lng: 128.6217 },
    양산시: { lat: 35.335, lng: 129.0373 },
    의령군: { lat: 35.3224, lng: 128.2618 },
    함안군: { lat: 35.2726, lng: 128.4065 },
    창녕군: { lat: 35.5443, lng: 128.4921 },
    고성군: { lat: 35.0297, lng: 128.3224 },
    남해군: { lat: 34.8376, lng: 127.8926 },
    하동군: { lat: 35.0671, lng: 127.7513 },
    산청군: { lat: 35.4156, lng: 127.8735 },
    함양군: { lat: 35.5205, lng: 127.7251 },
    거창군: { lat: 35.6869, lng: 127.9095 },
    합천군: { lat: 35.5665, lng: 128.1657 },
  },
  제주: {
    제주시: { lat: 33.4996, lng: 126.5312 },
    서귀포시: { lat: 33.2541, lng: 126.5604 },
  },
};

/**
 * 시도명을 짧은 형태로 변환
 */
export function normalizeCityName(cityName: string): string {
  return CITY_NAME_MAP[cityName] || cityName;
}

/**
 * 한글 구/군/시 이름을 로마자 slug로 변환
 */
export function normalizeKoreanToSlug(koreanName: string): string {
  // 먼저 매핑 테이블에서 찾기
  if (KOREAN_TO_ROMANIZATION[koreanName]) {
    return KOREAN_TO_ROMANIZATION[koreanName];
  }

  // 복합 구 처리 (예: "성남시 분당구")
  const parts = koreanName.split(' ');
  if (parts.length > 1) {
    const slugParts = parts.map((part) => KOREAN_TO_ROMANIZATION[part] || part);
    return slugParts.join('-').toLowerCase();
  }

  // 매핑이 없으면 원래 이름 반환 (소문자, 공백을 하이픈으로)
  return koreanName.toLowerCase().replace(/\s+/g, '-');
}

/**
 * 시/군/구명으로 중심 좌표 반환
 */
export function getRegionCoordinates(
  city: string,
  district: string
): { lat: number; lng: number } | null {
  const cityCoords = REGION_COORDINATES[city];
  if (cityCoords && cityCoords[district]) {
    return cityCoords[district];
  }

  // 기본 좌표 (서울시청)
  return { lat: 37.5665, lng: 126.978 };
}

/**
 * CSV 데이터에서 시/군/구 레벨 추출
 * 법정동코드 형식: 10자리 (시도 2자리 + 시군구 3자리 + 읍면동 3자리 + 리 2자리)
 * 시/군/구 레벨: 앞 5자리가 유효하고 나머지가 00000인 경우
 */
export function parseRegionCsv(csvContent: string): ParsedRegion[] {
  const lines = csvContent.trim().split('\n');
  const regions: ParsedRegion[] = [];

  // 첫 줄은 헤더
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(',');

    if (parts.length < 3) continue;

    const code = parts[0].trim();
    const name = parts[1].trim();
    const status = parts[2].trim();

    // 폐지된 지역 제외
    if (status === '폐지') continue;

    // 10자리 코드에서 시/군/구 레벨 확인
    // 시/군/구: XX XXX 00000 형태 (뒤 5자리가 00000)
    if (code.length === 10 && code.endsWith('00000') && !code.endsWith('0000000000')) {
      const nameParts = name.split(' ');

      if (nameParts.length >= 2) {
        const city = normalizeCityName(nameParts[0]);
        const district = nameParts.slice(1).join(' ');

        regions.push({
          bjdCode: code.substring(0, 5),
          city,
          district,
        });
      }
    }
  }

  return regions;
}

/**
 * Region 데이터 동기화 실행
 */
export async function syncRegionData(options: SyncOptions = {}): Promise<SyncResult> {
  const { testMode = false, testData = [] } = options;

  const result: SyncResult = {
    status: 'success',
    totalRecords: 0,
    newRecords: 0,
    updatedRecords: 0,
  };

  try {
    let regionsToSync: RegionData[];

    if (testMode && testData.length > 0) {
      // 테스트 모드: 전달받은 데이터 사용
      regionsToSync = testData.map((r) => ({
        ...r,
        slug: normalizeKoreanToSlug(r.district),
      }));
    } else {
      // 실제 동기화: 정적 좌표 데이터 사용
      regionsToSync = [];

      for (const [city, districts] of Object.entries(REGION_COORDINATES)) {
        for (const [district, coords] of Object.entries(districts)) {
          // bjdCode는 좌표 데이터에 없으므로, city+district 조합으로 생성
          const bjdCode = generateBjdCode(city, district);

          regionsToSync.push({
            bjdCode,
            city,
            district,
            lat: coords.lat,
            lng: coords.lng,
          });
        }
      }
    }

    result.totalRecords = regionsToSync.length;

    // DB 저장 (upsert)
    for (const region of regionsToSync) {
      const slug = normalizeKoreanToSlug(region.district);

      // 기존 데이터 확인
      const existing = await prisma.region.findFirst({
        where: {
          OR: [{ bjdCode: region.bjdCode }, { city: region.city, district: region.district }],
        },
      });

      if (existing) {
        await prisma.region.update({
          where: { id: existing.id },
          data: {
            bjdCode: region.bjdCode,
            city: region.city,
            district: region.district,
            slug,
            lat: region.lat,
            lng: region.lng,
          },
        });
        result.updatedRecords++;
      } else {
        await prisma.region.create({
          data: {
            bjdCode: region.bjdCode,
            city: region.city,
            district: region.district,
            slug,
            lat: region.lat,
            lng: region.lng,
          },
        });
        result.newRecords++;
      }
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    result.status = 'failed';
    result.errorMessage = errorMessage;

    return result;
  }
}

/**
 * city+district로 가상의 bjdCode 생성 (해시 기반)
 */
function generateBjdCode(city: string, district: string): string {
  const cityCodeMap: Record<string, string> = {
    서울: '11',
    부산: '26',
    대구: '27',
    인천: '28',
    광주: '29',
    대전: '30',
    울산: '31',
    세종: '36',
    경기: '41',
    강원: '42',
    충북: '43',
    충남: '44',
    전북: '45',
    전남: '46',
    경북: '47',
    경남: '48',
    제주: '50',
  };

  const cityCode = cityCodeMap[city] || '99';

  // district를 기반으로 3자리 코드 생성 (간단한 해시)
  let districtHash = 0;
  for (let i = 0; i < district.length; i++) {
    districtHash = (districtHash * 31 + district.charCodeAt(i)) % 1000;
  }

  return `${cityCode}${String(districtHash).padStart(3, '0')}`;
}

// CLI 실행용
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Region 데이터 동기화 시작...');

  syncRegionData()
    .then((result) => {
      console.log('동기화 완료:', result);
      console.log(`- 총 ${result.totalRecords}개 지역`);
      console.log(`- 신규: ${result.newRecords}개`);
      console.log(`- 업데이트: ${result.updatedRecords}개`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('동기화 실패:', error);
      process.exit(1);
    });
}
