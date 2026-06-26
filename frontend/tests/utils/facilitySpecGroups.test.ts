import { describe, it, expect } from 'vitest'
import { buildSpecGroups } from '~/utils/facilitySpecGroups'

// ─────────────────────────────────────────
// Task 2: wifi, park, parking, library, sports
// ─────────────────────────────────────────

describe('buildSpecGroups — wifi (full fixture)', () => {
  const details = {
    ssid: 'Free-WiFi-Seoul',
    installLocation: '구청 1층 로비',
    installLocationDetail: '구청 1층 로비 북쪽 입구',
    serviceProvider: '(주)케이티',
    managementAgency: '서울특별시 강남구청',
    installDate: '202203',
    phoneNumber: '0221555000',
    dataDate: '2024-01-01',
  }

  it('그룹 헤딩 2개 [접속 정보, 운영 · 관리]', () => {
    const groups = buildSpecGroups('wifi', details)
    expect(groups.map(g => g.heading)).toEqual(['접속 정보', '운영 · 관리'])
  })

  it('모든 그룹이 kv render', () => {
    const groups = buildSpecGroups('wifi', details)
    expect(groups.every(g => g.render === 'kv')).toBe(true)
  })

  it('SSID 값이 그대로 노출', () => {
    const groups = buildSpecGroups('wifi', details)
    const ssidRow = groups[0].rows!.find(r => r.label === '네트워크 이름(SSID)')!
    expect(ssidRow.value).toBe('Free-WiFi-Seoul')
  })

  it('installDate formatYm 변환 202203 → "2022년 3월"', () => {
    const groups = buildSpecGroups('wifi', details)
    const row = groups[1].rows!.find(r => r.label === '설치 시기')!
    expect(row.value).toBe('2022년 3월')
  })

  it('전화번호 formatPhone 변환', () => {
    const groups = buildSpecGroups('wifi', details)
    const row = groups[1].rows!.find(r => r.label === '연락처')!
    expect(row.value).toMatch(/02-/)
  })

  it('locDetail이 loc과 같으면 숨김', () => {
    const groups = buildSpecGroups('wifi', { ...details, installLocationDetail: '구청 1층 로비' })
    const row = groups[0].rows!.find(r => r.label === '설치 장소 상세')
    expect(row?.value == null).toBe(true)
  })
})

describe('buildSpecGroups — wifi (빈 {})', () => {
  it('throw 없이 그룹 반환, 강제 정보없음 행 없음', () => {
    expect(() => buildSpecGroups('wifi', {})).not.toThrow()
    const groups = buildSpecGroups('wifi', {})
    // 모든 kv 행의 value는 null/undefined (optional) — kind:'value' 행도 값 없이 생성되지만 강제 '정보없음' 문자열은 없음
    const allValues = groups.flatMap(g => g.rows ?? []).map(r => r.value)
    expect(allValues.every(v => v !== '정보없음')).toBe(true)
  })
})

// ─────────────────────────────────────────

describe('buildSpecGroups — park (full fixture)', () => {
  const details = {
    parkType: '근린공원',
    area: 12345.67,
    designatedDate: '19990301',
    managingOrg: '서울특별시 강남구청',
    phoneNumber: '0221553500',
    dataDate: '2024-01-01',
    exerciseFacilities: '농구장+배드민턴장',
    playFacilities: '미끄럼틀+그네',
    convenienceFacilities: null,
    cultureFacilities: null,
    otherFacilities: null,
  }

  it('그룹 헤딩에 공원 개요, 보유 시설 포함', () => {
    const groups = buildSpecGroups('park', details)
    const headings = groups.map(g => g.heading)
    expect(headings).toContain('공원 개요')
    expect(headings).toContain('보유 시설')
  })

  it('formatArea 변환: 12345.67㎡ → 포함 숫자+평 단위', () => {
    const groups = buildSpecGroups('park', details)
    const row = groups[0].rows!.find(r => r.label === '면적')!
    expect(row.value).toContain('㎡')
    expect(row.value).toContain('평')
    expect(row.value).toContain('12,345')
  })

  it('formatYmd 변환: 19990301 → "1999년 3월 1일"', () => {
    const groups = buildSpecGroups('park', details)
    const row = groups[0].rows!.find(r => r.label === '지정일')!
    expect(row.value).toBe('1999년 3월 1일')
  })

  it('joinList: exerciseFacilities "농구장+배드민턴장" → "농구장, 배드민턴장"', () => {
    const groups = buildSpecGroups('park', details)
    const facilGroup = groups.find(g => g.heading === '보유 시설')!
    const row = facilGroup.rows!.find(r => r.label === '운동시설')!
    expect(row.value).toBe('농구장, 배드민턴장')
  })
})

describe('buildSpecGroups — park (빈 {})', () => {
  it('throw 없음, 보유 시설 그룹은 모두 null이면 생략', () => {
    expect(() => buildSpecGroups('park', {})).not.toThrow()
    const groups = buildSpecGroups('park', {})
    expect(groups.find(g => g.heading === '보유 시설')).toBeUndefined()
  })
})

// ─────────────────────────────────────────

describe('buildSpecGroups — parking (full fixture)', () => {
  const details = {
    feeType: '유료',
    baseFee: 1000,
    baseTime: 30,
    additionalFee: 500,
    additionalTime: 10,
    dailyMaxFee: 10000,
    dailyMaxFeeHours: '08:00~22:00',
    monthlyFee: 50000,
    operatingHours: '06:00~23:00',
    operatingDays: '월~일',
    paymentMethod: '신용카드, 현금',
    alternateParking: '없음',
    phone: '0221556700',
    managingOrg: '강남구시설관리공단',
    parkingType: '노외주차장',
    lotType: '지하식',
    capacity: 250,
    zoneClass: '일반',
    hasDisabledParking: true,
    remarks: '2층 이상 차량 진입 불가',
  }

  it('그룹 헤딩 4개 [요금 정보, 운영 정보, 시설 정보, 비고]', () => {
    const groups = buildSpecGroups('parking', details)
    const headings = groups.map(g => g.heading)
    expect(headings).toContain('요금 정보')
    expect(headings).toContain('운영 정보')
    expect(headings).toContain('시설 정보')
    expect(headings).toContain('비고')
  })

  it('feePair: baseFee=1000, baseTime=30 → "1,000원 / 30분"', () => {
    const groups = buildSpecGroups('parking', details)
    const row = groups[0].rows!.find(r => r.label === '기본 요금')!
    expect(row.value).toBe('1,000원 / 30분')
  })

  it('localeNum: capacity=250, unit=면', () => {
    const groups = buildSpecGroups('parking', details)
    const facilGroup = groups.find(g => g.heading === '시설 정보')!
    const row = facilGroup.rows!.find(r => r.label === '주차면수')!
    expect(row.value).toBe('250')
    expect(row.unit).toBe('면')
  })

  it('yesNo: hasDisabledParking=true → "있음"', () => {
    const groups = buildSpecGroups('parking', details)
    const facilGroup = groups.find(g => g.heading === '시설 정보')!
    const row = facilGroup.rows!.find(r => r.label === '장애인 주차구역')!
    expect(row.value).toBe('있음')
  })
})

describe('buildSpecGroups — parking (빈 {})', () => {
  it('throw 없음, 비고 그룹은 remarks 없으면 생략', () => {
    expect(() => buildSpecGroups('parking', {})).not.toThrow()
    const groups = buildSpecGroups('parking', {})
    expect(groups.find(g => g.heading === '비고')).toBeUndefined()
  })
})

// ─────────────────────────────────────────

describe('buildSpecGroups — library (full fixture)', () => {
  const details = {
    libraryType: '공공도서관',
    operatingOrg: '서울특별시 강남구청',
    closedDays: '매주 월요일, 법정공휴일',
    phoneNumber: '0225115000',
    homepageUrl: 'lib.gangnam.go.kr',
    weekdayOpenTime: '09:00',
    weekdayCloseTime: '21:00',
    saturdayOpenTime: '09:00',
    saturdayCloseTime: '17:00',
    holidayOpenTime: '00:00',
    holidayCloseTime: '00:00',
    bookCount: 120000,
    serialCount: 500,
    nonBookCount: 3000,
    loanableBooks: 5,
    loanableDays: 14,
    seatCount: 300,
    lotArea: '1500',
    buildingArea: '3000',
  }

  it('그룹 헤딩에 운영 정보, 운영시간, 장서 현황, 좌석 · 규모 포함', () => {
    const groups = buildSpecGroups('library', details)
    const headings = groups.map(g => g.heading)
    expect(headings).toContain('운영 정보')
    expect(headings).toContain('운영시간')
    expect(headings).toContain('장서 현황')
    expect(headings).toContain('좌석 · 규모')
  })

  it('homepageUrl에 http:// prefix 추가 및 href 설정', () => {
    const groups = buildSpecGroups('library', details)
    const opGroup = groups.find(g => g.heading === '운영 정보')!
    const row = opGroup.rows!.find(r => r.label === '홈페이지')!
    expect(row.value).toBe('http://lib.gangnam.go.kr')
    expect(row.href).toBe('http://lib.gangnam.go.kr')
  })

  it('운영시간 table render — 평일/토요일 행 있음', () => {
    const groups = buildSpecGroups('library', details)
    const hourGroup = groups.find(g => g.heading === '운영시간')!
    expect(hourGroup.render).toBe('table')
    const labels = hourGroup.table!.rows.map(r => r.label)
    expect(labels).toContain('평일')
    expect(labels).toContain('토요일')
  })

  it('공휴일 00:00~00:00 → 휴관으로 변환 (formatLibraryHours)', () => {
    const groups = buildSpecGroups('library', details)
    const hourGroup = groups.find(g => g.heading === '운영시간')!
    const holRow = hourGroup.table!.rows.find(r => r.label === '공휴일')
    expect(holRow?.cells[0]).toBe('휴관')
  })

  it('bookCount localeNum: 120000 → "120,000", unit=권', () => {
    const groups = buildSpecGroups('library', details)
    const collGroup = groups.find(g => g.heading === '장서 현황')!
    const row = collGroup.rows!.find(r => r.label === '장서')!
    expect(row.value).toBe('120,000')
    expect(row.unit).toBe('권')
  })
})

describe('buildSpecGroups — library (빈 {})', () => {
  it('throw 없음, 운영시간 table은 시간 없으면 생략', () => {
    expect(() => buildSpecGroups('library', {})).not.toThrow()
    const groups = buildSpecGroups('library', {})
    expect(groups.find(g => g.heading === '운영시간')).toBeUndefined()
  })
})

// ─────────────────────────────────────────

describe('buildSpecGroups — sports (full fixture)', () => {
  const details = {
    ftypeNm: '육상경기장',
    faciGbNm: '경기시설',
    fcobNm: '육상',
    nationYn: 'Y',
    faciGfa: '45000',
    standCptPsnCnt: 30000,
    fmngCpNm: '서울특별시',
    fmngCpbNm: '강남구',
    fmngTypeGbNm: '공단위탁',
    faciHomepage: 'https://sports.example.com',
  }

  it('그룹 헤딩 3개 [시설 개요, 규모, 운영 · 소유]', () => {
    const groups = buildSpecGroups('sports', details)
    expect(groups.map(g => g.heading)).toEqual(['시설 개요', '규모', '운영 · 소유'])
  })

  it('nationYn="Y" → "해당", kind="flag"', () => {
    const groups = buildSpecGroups('sports', details)
    const overviewGroup = groups[0]
    const row = overviewGroup.rows!.find(r => r.label === '국가대표 시설')!
    expect(row.value).toBe('해당')
    expect(row.kind).toBe('flag')
  })

  it('standCptPsnCnt localeNum: 30000 → "30,000", unit=석', () => {
    const groups = buildSpecGroups('sports', details)
    const sizeGroup = groups.find(g => g.heading === '규모')!
    const row = sizeGroup.rows!.find(r => r.label === '관람석 수용')!
    expect(row.value).toBe('30,000')
    expect(row.unit).toBe('석')
  })

  it('faciHomepage https:// 그대로 유지 + href 설정', () => {
    const groups = buildSpecGroups('sports', details)
    const opGroup = groups.find(g => g.heading === '운영 · 소유')!
    const row = opGroup.rows!.find(r => r.label === '홈페이지')!
    expect(row.value).toBe('https://sports.example.com')
    expect(row.href).toBe('https://sports.example.com')
  })

  it('nationYn != "Y" → flag 행 value가 null (행 숨김 대상)', () => {
    const groups = buildSpecGroups('sports', { ...details, nationYn: 'N' })
    const row = groups[0].rows!.find(r => r.label === '국가대표 시설')!
    expect(row.value).toBeNull()
  })
})

describe('buildSpecGroups — sports (빈 {})', () => {
  it('throw 없음, 강제 정보없음 없음', () => {
    expect(() => buildSpecGroups('sports', {})).not.toThrow()
    const groups = buildSpecGroups('sports', {})
    const allValues = groups.flatMap(g => g.rows ?? []).map(r => r.value)
    expect(allValues.every(v => v !== '정보없음')).toBe(true)
  })
})

// ─────────────────────────────────────────
// 기존 toilet / clothes 테스트 (변경 없음)
// ─────────────────────────────────────────

describe('buildSpecGroups — toilet (rich)', () => {
  const details = {
    maleToilets: 25, maleUrinals: 47, femaleToilets: 128,
    maleDisabledToilets: 2, femaleDisabledToilets: 1,
    maleChildToilets: 2, maleChildUrinals: 2, femaleChildToilets: 4,
    hasCCTV: true, hasEmergencyBell: true, emergencyBellLocation: '남자화장실+여자화장실',
    hasDiaperChangingTable: true, diaperChangingLocation: '여자화장실', hasDisabledToilet: true,
    facilityType: '개방화장실', ownershipType: '민간', sewageTreatment: '수세식',
    installDate: '199701', remodelingDate: '', managingOrg: '현대백화점 천호지점',
    phoneNumber: '0222258761', operatingHours: '10:30~20:00',
  }
  const groups = buildSpecGroups('toilet', details)

  it('변기 현황 표 group을 만든다', () => {
    const table = groups.find(g => g.render === 'table')
    expect(table).toBeTruthy()
    expect(table!.table!.columns).toEqual(['구분', '남성', '여성'])
    const daebyeon = table!.table!.rows.find(r => r.label === '대변기')
    expect(daebyeon!.cells).toEqual([25, 128])
  })

  it('안전·편의 flag 행을 만든다 (있는 것만 value 채움)', () => {
    const g = groups.find(g => g.heading === '안전 · 편의')!
    const cctv = g.rows!.find(r => r.label === 'CCTV')!
    expect(cctv.kind).toBe('flag')
    expect(cctv.value).toBe('설치됨')
    const bell = g.rows!.find(r => r.label === '비상벨')!
    expect(bell.value).toContain('남자화장실+여자화장실')
  })

  it('운영·관리는 value 행(빈 값도 행 유지: 개보수 시기)', () => {
    const g = groups.find(g => g.heading === '운영 · 관리')!
    const remodel = g.rows!.find(r => r.label === '개보수 시기')!
    expect(remodel.kind).toBe('value')
    expect(remodel.value === '' || remodel.value == null).toBe(true)
  })
})

describe('buildSpecGroups — clothes (thin, 있는 만큼만)', () => {
  it('값 있는 행만 포함, 강제 정보없음 없음', () => {
    const groups = buildSpecGroups('clothes', {
      detailLocation: '가로등 옆', managementAgency: '서울특별시 서초구청',
      phoneNumber: '02-2155-6742', providerName: '서울특별시 서초구', dataDate: '2025-02-18',
    })
    const rows = groups.flatMap(g => g.rows ?? [])
    expect(rows.find(r => r.label === '설치 위치')!.value).toBe('가로등 옆')
    expect(rows.every(r => r.value !== null && r.value !== undefined && r.value !== '')).toBe(true)
  })

  it('필드 없으면 해당 행 자체가 없다', () => {
    const groups = buildSpecGroups('clothes', { detailLocation: '도로변' })
    const labels = groups.flatMap(g => g.rows ?? []).map(r => r.label)
    expect(labels).toContain('설치 위치')
    expect(labels).not.toContain('연락처')
  })
})
