import type { GuideCategory } from '../services/articleGenerationCore.js';

export interface GuideTopicSeed {
  category: GuideCategory;
  topic: string;
  articleType: 'howto' | 'guide';
}

export const FACILITY_GUIDE_TOPICS: GuideTopicSeed[] = [
  { category: 'toilet', topic: '급할 때 근처 공중화장실 빨리 찾는 법', articleType: 'howto' },
  { category: 'toilet', topic: '개방화장실과 공공화장실 차이 및 이용 팁', articleType: 'guide' },
  { category: 'wifi', topic: '무료 공공와이파이 찾고 연결하는 법', articleType: 'howto' },
  { category: 'wifi', topic: '공공와이파이 안전하게 사용하는 법', articleType: 'guide' },
  { category: 'parking', topic: '공영주차장 무료·할인 요금 받는 법', articleType: 'howto' },
  { category: 'parking', topic: '거주자 우선주차 신청 방법과 절차', articleType: 'howto' },
  { category: 'parking', topic: '근처 저렴한 공영주차장 찾는 법', articleType: 'guide' },
  { category: 'aed', topic: '주변 AED(자동심장충격기) 위치 찾고 사용하는 법', articleType: 'howto' },
  { category: 'aed', topic: '심정지 응급상황 대처와 AED 사용법', articleType: 'howto' },
  { category: 'library', topic: '공공도서관 회원가입과 도서 대출 방법', articleType: 'howto' },
  { category: 'library', topic: '도서관 좌석·스터디룸 예약하는 법', articleType: 'howto' },
  { category: 'library', topic: '상호대차와 희망도서 신청 이용법', articleType: 'guide' },
  { category: 'park', topic: '가까운 공원과 산책로 찾는 법', articleType: 'guide' },
  { category: 'park', topic: '반려견과 함께 갈 수 있는 공원 이용 가이드', articleType: 'guide' },
  { category: 'school', topic: '우리 동네 학군과 학교 정보 찾는 법', articleType: 'guide' },
  { category: 'school', topic: '초등학교 배정과 전학 절차 안내', articleType: 'howto' },
  { category: 'childcare', topic: '어린이집 입소 신청과 대기 방법', articleType: 'howto' },
  { category: 'childcare', topic: '국공립 어린이집 찾고 신청하는 법', articleType: 'howto' },
  { category: 'childcare', topic: '어린이집 정보공시로 우리 동네 시설 비교하기', articleType: 'guide' },
  { category: 'ev-charger', topic: '가까운 전기차 충전소 찾고 이용하는 법', articleType: 'howto' },
  { category: 'ev-charger', topic: '전기차 완속·급속 충전 요금과 결제 방법', articleType: 'guide' },
  { category: 'ev-charger', topic: '아파트 전기차 충전기 설치 신청 방법', articleType: 'howto' },
  { category: 'sports', topic: '공공체육시설 온라인 예약하는 법', articleType: 'howto' },
  { category: 'sports', topic: '저렴한 생활체육 프로그램 신청 방법', articleType: 'guide' },
];
