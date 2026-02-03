// @TASK - MSW Waste Schedule Handlers
// Waste schedule 지역 기반 검색용 mock 핸들러

import { http, HttpResponse } from 'msw';

const API_BASE = 'http://localhost:8000';

// Mock 데이터
const mockCities = [
  '서울특별시',
  '부산광역시',
  '대구광역시',
  '인천광역시',
  '광주광역시',
  '대전광역시',
  '울산광역시',
  '세종특별자치시',
  '경기도',
  '강원도',
  '충청북도',
  '충청남도',
  '전라북도',
  '전라남도',
  '경상북도',
  '경상남도',
  '제주특별자치도',
];

const districtMap: Record<string, string[]> = {
  '서울특별시': [
    '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구',
    '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구',
    '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구',
  ],
  '부산광역시': [
    '강서구', '금정구', '기장군', '남구', '동구', '동래구', '부산진구', '북구',
    '사상구', '사하구', '서구', '수영구', '연제구', '영도구', '중구', '해운대구',
  ],
  '경기도': [
    '수원시', '성남시', '고양시', '용인시', '부천시', '안산시', '안양시', '남양주시',
    '화성시', '평택시', '의정부시', '시흥시', '파주시', '광명시', '김포시', '군포시',
  ],
};

function getMockSchedules(district: string) {
  return {
    schedules: [
      {
        id: '1',
        wasteType: '일반쓰레기',
        dayOfWeek: ['월', '수', '금'],
        time: '저녁 7시 ~ 밤 12시',
        note: '종량제 봉투 사용',
      },
      {
        id: '2',
        wasteType: '음식물쓰레기',
        dayOfWeek: ['화', '목', '토'],
        time: '저녁 7시 ~ 밤 12시',
        note: '음식물 전용 봉투 또는 RFID 카드 사용',
      },
      {
        id: '3',
        wasteType: '재활용',
        dayOfWeek: ['수', '토'],
        time: '오전 6시 ~ 저녁 8시',
        note: '플라스틱, 비닐, 캔, 유리, 종이류 분리배출',
      },
      {
        id: '4',
        wasteType: '대형폐기물',
        dayOfWeek: ['예약제'],
        note: '구청 또는 주민센터에 신고 후 스티커 부착',
      },
    ],
    contact: {
      name: `${district} 청소행정과`,
      phone: '02-1234-5678',
    },
  };
}

export const wasteScheduleHandlers = [
  // GET /api/waste-schedules/cities - 시/도 목록
  http.get(`${API_BASE}/api/waste-schedules/cities`, () => {
    return HttpResponse.json({ cities: mockCities });
  }),

  // GET /api/waste-schedules/districts - 구/군 목록
  http.get(`${API_BASE}/api/waste-schedules/districts`, ({ request }) => {
    const url = new URL(request.url);
    const city = url.searchParams.get('city') || '';
    const districts = districtMap[city] || ['중구', '동구', '서구', '남구', '북구'];
    return HttpResponse.json({ districts });
  }),

  // GET /api/waste-schedules - 배출 일정 조회
  http.get(`${API_BASE}/api/waste-schedules`, ({ request }) => {
    const url = new URL(request.url);
    const district = url.searchParams.get('district') || '강남구';
    return HttpResponse.json(getMockSchedules(district));
  }),
];
