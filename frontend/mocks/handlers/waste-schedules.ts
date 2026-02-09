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

function getMockScheduleItem(id: number, district: string) {
  return {
    id,
    city: '서울특별시',
    district,
    targetRegion: `${district} 1동~3동`,
    emissionPlace: '각 세대 앞',
    details: {
      emissionPlaceType: '문전수거',
      managementZone: `${district} 관리구역`,
      livingWaste: {
        dayOfWeek: '월, 수, 금',
        beginTime: '20:00',
        endTime: '05:00',
        method: '규격봉투 배출',
      },
      foodWaste: {
        dayOfWeek: '화, 목, 토',
        beginTime: '20:00',
        endTime: '05:00',
        method: '전용봉투 또는 RFID 카드 사용',
      },
      recyclable: {
        dayOfWeek: '수, 토',
        beginTime: '06:00',
        endTime: '20:00',
        method: '플라스틱, 비닐, 캔, 유리, 종이류 분리배출',
      },
      bulkWaste: {
        beginTime: '09:00',
        endTime: '18:00',
        method: '구청 또는 주민센터에 신고 후 스티커 부착',
        place: '주민센터 앞 지정장소',
      },
      uncollectedDay: '명절(설 및 추석)',
      manageDepartment: `${district} 청소행정과`,
      managePhone: '02-1234-5678',
      dataCreatedDate: '2024-01-01',
      lastModified: '2024-06-15',
    },
  };
}

function getMockSchedules(district: string) {
  const items = [
    getMockScheduleItem(1, district),
    {
      id: 2,
      city: '서울특별시',
      district,
      targetRegion: `${district} 4동~6동`,
      emissionPlace: '거점 수거',
      details: {
        emissionPlaceType: '거점수거',
        livingWaste: {
          dayOfWeek: '월, 수, 금',
          beginTime: '19:00',
          endTime: '04:00',
          method: '규격봉투 배출',
        },
        recyclable: {
          dayOfWeek: '화, 목',
          beginTime: '08:00',
          endTime: '18:00',
          method: '분리배출',
        },
        manageDepartment: `${district} 청소행정과`,
        managePhone: '02-1234-5678',
      },
    },
  ];
  return { items, total: items.length, page: 1, totalPages: 1 };
}

export const wasteScheduleHandlers = [
  // GET /api/waste-schedules/cities - 시/도 목록
  http.get(`${API_BASE}/api/waste-schedules/cities`, () => {
    return HttpResponse.json({ success: true, data: { items: mockCities } });
  }),

  // GET /api/waste-schedules/districts/:city - 구/군 목록
  http.get(`${API_BASE}/api/waste-schedules/districts/:city`, ({ params }) => {
    const city = params.city as string;
    const districts = districtMap[city] || ['중구', '동구', '서구', '남구', '북구'];
    return HttpResponse.json({ success: true, data: { items: districts } });
  }),

  // GET /api/waste-schedules/:id - 단건 조회
  http.get(`${API_BASE}/api/waste-schedules/:id`, ({ params }) => {
    const id = parseInt(params.id as string, 10);
    if (isNaN(id)) {
      return HttpResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
    }
    const item = getMockScheduleItem(id, '강남구');
    return HttpResponse.json({ success: true, data: item });
  }),

  // GET /api/waste-schedules - 배출 일정 조회
  http.get(`${API_BASE}/api/waste-schedules`, ({ request }) => {
    const url = new URL(request.url);
    const district = url.searchParams.get('district') || '강남구';
    const keyword = url.searchParams.get('keyword');
    const data = getMockSchedules(district);
    if (keyword) {
      data.items = data.items.filter(item =>
        item.targetRegion?.includes(keyword)
      );
      data.total = data.items.length;
    }
    return HttpResponse.json({ success: true, data });
  }),
];
