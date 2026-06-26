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

// ─────────────────────────────────────────
// Task 3: market, school, childcare
// ─────────────────────────────────────────

describe('buildSpecGroups — market (full fixture)', () => {
  const details = {
    marketType: '전통시장',
    openingCycle: '3+8',
    storeCount: 250,
    products: '채소+과일+생선',
    giftCertificates: '온누리상품권',
    homepageUrl: 'https://market.example.com',
    hasPublicToilet: true,
    hasParking: false,
    foundedYear: 1972,
    phoneNumber: '0312345678',
    dataDate: '2024-01-01',
  }

  it('그룹 헤딩에 시장 개요, 주요 판매품목, 편의시설, 연락 · 안내 포함', () => {
    const groups = buildSpecGroups('market', details)
    const headings = groups.map(g => g.heading)
    expect(headings).toContain('시장 개요')
    expect(headings).toContain('주요 판매품목')
    expect(headings).toContain('편의시설')
    expect(headings).toContain('연락 · 안내')
  })

  it('주요 판매품목 tags render, tagVariant gray', () => {
    const groups = buildSpecGroups('market', details)
    const tagGroup = groups.find(g => g.heading === '주요 판매품목')!
    expect(tagGroup.render).toBe('tags')
    expect(tagGroup.tagVariant).toBe('gray')
    expect(tagGroup.tags!.map(t => t.label)).toEqual(['채소', '과일', '생선'])
  })

  it('openingCycle "3+8" → "매월 3, 8" (formatOpeningCycle)', () => {
    const groups = buildSpecGroups('market', details)
    const row = groups[0].rows!.find(r => r.label === '개설 주기')!
    expect(row.value).toBe('매월 3, 8')
  })

  it('hasPublicToilet=true → 있음, hasParking=false → 없음 (yesNo)', () => {
    const groups = buildSpecGroups('market', details)
    const convGroup = groups.find(g => g.heading === '편의시설')!
    expect(convGroup.rows!.find(r => r.label === '공중화장실')!.value).toBe('있음')
    expect(convGroup.rows!.find(r => r.label === '주차시설')!.value).toBe('없음')
  })
})

describe('buildSpecGroups — market (빈 {})', () => {
  it('throw 없음, 주요 판매품목 태그 그룹은 products 없으면 생략', () => {
    expect(() => buildSpecGroups('market', {})).not.toThrow()
    const groups = buildSpecGroups('market', {})
    expect(groups.find(g => g.heading === '주요 판매품목')).toBeUndefined()
  })
})

// ─────────────────────────────────────────

describe('buildSpecGroups — school (full fixture)', () => {
  const details = {
    schoolLevel: '중학교',
    foundationType: '공립',
    operationStatus: '운영',
    coeducationType: '남녀공학',
    highSchoolType: null,
    dayNightType: null,
    branchType: '본교',
    foundedDate: '19820301',
    faxNumber: '02-555-1234',
    homepageUrl: 'https://school.example.com',
    sidoEduName: '서울특별시교육청',
    localEduName: '강남교육지원청',
    enrollments: [
      { grade: 1, classCount: 8 },
      { grade: 2, classCount: 7 },
      { grade: 3, classCount: 6 },
    ],
    departments: [
      { departmentName: '인문계열' },
      { departmentName: '자연계열' },
    ],
  }

  it('그룹 헤딩에 학교 개요, 연락 · 관할, 학급 현황, 계열 정보 포함', () => {
    const groups = buildSpecGroups('school', details)
    const headings = groups.map(g => g.heading)
    expect(headings).toContain('학교 개요')
    expect(headings).toContain('연락 · 관할')
    expect(headings).toContain('학급 현황')
    expect(headings).toContain('계열 정보')
  })

  it('학급 현황 table render — 학년별 행 + 합계 행', () => {
    const groups = buildSpecGroups('school', details)
    const tableGroup = groups.find(g => g.heading === '학급 현황')!
    expect(tableGroup.render).toBe('table')
    const rows = tableGroup.table!.rows
    expect(rows.find(r => r.label === '1학년')!.cells[0]).toBe(8)
    expect(rows.find(r => r.label === '합계')!.cells[0]).toBe(21) // 8+7+6
  })

  it('계열 정보 tags render, tagVariant sky', () => {
    const groups = buildSpecGroups('school', details)
    const tagGroup = groups.find(g => g.heading === '계열 정보')!
    expect(tagGroup.render).toBe('tags')
    expect(tagGroup.tagVariant).toBe('sky')
    expect(tagGroup.tags!.map(t => t.label)).toEqual(['인문계열', '자연계열'])
  })

  it('foundedDate formatYmd: 19820301 → "1982년 3월 1일"', () => {
    const groups = buildSpecGroups('school', details)
    const ovGroup = groups.find(g => g.heading === '학교 개요')!
    const row = ovGroup.rows!.find(r => r.label === '설립일')!
    expect(row.value).toBe('1982년 3월 1일')
  })
})

describe('buildSpecGroups — school (빈 {})', () => {
  it('throw 없음, 학급현황/계열정보 배열 없으면 생략', () => {
    expect(() => buildSpecGroups('school', {})).not.toThrow()
    const groups = buildSpecGroups('school', {})
    expect(groups.find(g => g.heading === '학급 현황')).toBeUndefined()
    expect(groups.find(g => g.heading === '계열 정보')).toBeUndefined()
  })
})

// ─────────────────────────────────────────

describe('buildSpecGroups — childcare (full fixture)', () => {
  const details = {
    crtypename: '국공립',
    crstatusname: '정상',
    crpausebegindt: null,
    crpauseenddt: null,
    crcnfmdt: '20100315',
    crrepname: '홍길동',
    crcargbname: '있음',
    crfaxno: '02-111-2222',
    crhome: 'https://care.example.com',
    datastdrdt: '2024-01-01',
    crcapat: 80,
    crchcnt: 60,
    nrtrroomcnt: 5,
    nrtrroomsize: '120',
    plgrdco: 1,
    cctvinstlcnt: 4,
    chcrtescnt: 10,
    classCnt00: 1, childCnt00: 5,
    classCnt01: 1, childCnt01: 6,
    classCnt02: 2, childCnt02: 14,
    classCnt03: 2, childCnt03: 16,
    classCnt04: 0, childCnt04: 0,
    classCnt05: 0, childCnt05: 0,
    classCntM2: 0, childCntM2: 0,
    classCntM5: 0, childCntM5: 0,
    classCntSp: 0, childCntSp: 0,
    classCntTot: 6, childCntTot: 41,
    emCntA1: 1, emCntA2: 5, emCntA3: 0, emCntA4: 0,
    emCntA5: 1, emCntA6: 0, emCntA7: 1, emCntA8: 0, emCntA10: 1,
    emCntTot: 9,
    emCnt0y: 1, emCnt1y: 2, emCnt2y: 1, emCnt4y: 0, emCnt6y: 1,
    crspec: null,
  }

  it('그룹 헤딩에 운영 현황, 정원·시설 현황, 연령별 반·아동 현황, 직원 현황, 교사 경력 분포 포함', () => {
    const groups = buildSpecGroups('childcare', details)
    const headings = groups.map(g => g.heading ?? '')
    expect(headings.some(h => h.includes('운영 현황'))).toBe(true)
    expect(headings.some(h => h.includes('정원·시설 현황'))).toBe(true)
    expect(headings.some(h => h.includes('연령별 반·아동 현황'))).toBe(true)
    expect(headings.some(h => h.includes('직원 현황'))).toBe(true)
    expect(headings.some(h => h.includes('교사 경력 분포'))).toBe(true)
  })

  it('가용률 계산: crcapat=80, crchcnt=60 → 25% (여석 20명)', () => {
    const groups = buildSpecGroups('childcare', details)
    const capGroup = groups.find(g => g.heading === '정원·시설 현황')!
    const row = capGroup.rows!.find(r => r.label === '가용률')!
    expect(row.value).toContain('25%')
    expect(row.value).toContain('여석 20명')
  })

  it('연령별 현황 table render — 비어있지 않은 연령 행 + 합계 행', () => {
    const groups = buildSpecGroups('childcare', details)
    const tableGroup = groups.find(g => g.heading === '연령별 반·아동 현황')!
    expect(tableGroup.render).toBe('table')
    const rows = tableGroup.table!.rows
    expect(rows.find(r => r.label === '0세')).toBeTruthy()
    expect(rows.find(r => r.label === '합계')).toBeTruthy()
  })

  it('교사 경력 분포 tags render, tagVariant custom, suffix에 인원수 포함', () => {
    const groups = buildSpecGroups('childcare', details)
    const tagGroup = groups.find(g => g.heading === '교사 경력 분포')!
    expect(tagGroup.render).toBe('tags')
    expect(tagGroup.tagVariant).toBe('custom')
    const tag = tagGroup.tags!.find(t => t.label === '1년 미만')!
    expect(tag.suffix).toBe('1명')
  })

  it('직원 현황 — emCntTot 있으면 헤딩에 총원 포함', () => {
    const groups = buildSpecGroups('childcare', details)
    const staffGroup = groups.find(g => g.heading?.includes('직원 현황'))!
    expect(staffGroup.heading).toContain('9명')
  })
})

describe('buildSpecGroups — childcare (빈 {})', () => {
  it('throw 없음, 연령표/경력태그/특이사항 없으면 생략', () => {
    expect(() => buildSpecGroups('childcare', {})).not.toThrow()
    const groups = buildSpecGroups('childcare', {})
    expect(groups.find(g => g.heading?.includes('연령별'))).toBeUndefined()
    expect(groups.find(g => g.heading?.includes('경력'))).toBeUndefined()
    expect(groups.find(g => g.heading?.includes('특이'))).toBeUndefined()
  })
})

// ─────────────────────────────────────────
// Task 4: aed, pharmacy, hospital
// ─────────────────────────────────────────

describe('buildSpecGroups — aed (full fixture)', () => {
  const details = {
    monSttTme: '0900', monEndTme: '1800',
    tueSttTme: '0900', tueEndTme: '1800',
    wedSttTme: '0900', wedEndTme: '1800',
    thuSttTme: '0900', thuEndTme: '1800',
    friSttTme: '0900', friEndTme: '1800',
    satSttTme: null,   satEndTme: null,
    sunSttTme: null,   sunEndTme: null,
    holSttTme: null,   holEndTme: null,
    buildPlace: '1층 로비',
    org: '서울특별시 강남구청',
    clerkTel: '0221556700',
    mfg: '(주)필립스메디컬',
    model: 'HeartStart HS1',
    dataDate: '2024-01-01',
  }

  it('요일별 이용시간 weekly 그룹이 있다 (≥1 non-closed day)', () => {
    const groups = buildSpecGroups('aed', details)
    const weeklyGroup = groups.find(g => g.render === 'weekly')
    expect(weeklyGroup).toBeTruthy()
    expect(weeklyGroup!.heading).toBe('요일별 이용시간')
  })

  it('fmtHm: "0900" → "09:00", "1800" → "18:00"', () => {
    const groups = buildSpecGroups('aed', details)
    const weeklyGroup = groups.find(g => g.render === 'weekly')!
    const monRow = weeklyGroup.weekly!.rows.find(r => r.day === '월')!
    expect(monRow.time).toBe('09:00 ~ 18:00')
  })

  it('todayIdx: 월=1, 일=0, 공휴일=-1', () => {
    const groups = buildSpecGroups('aed', details)
    const weeklyGroup = groups.find(g => g.render === 'weekly')!
    const rows = weeklyGroup.weekly!.rows
    expect(rows.find(r => r.day === '월')!.todayIdx).toBe(1)
    expect(rows.find(r => r.day === '일')!.todayIdx).toBe(0)
    expect(rows.find(r => r.day === '공휴일')!.todayIdx).toBe(-1)
  })

  it('토/일/공휴일 시간 없으면 closed=true, time="이용불가"', () => {
    const groups = buildSpecGroups('aed', details)
    const weeklyGroup = groups.find(g => g.render === 'weekly')!
    const satRow = weeklyGroup.weekly!.rows.find(r => r.day === '토')!
    expect(satRow.closed).toBe(true)
    expect(satRow.time).toBe('이용불가')
  })

  it('24시간: 00:00~24:00 → allDay=true, time="24시간"', () => {
    const groups = buildSpecGroups('aed', { ...details, monSttTme: '0000', monEndTme: '2400' })
    const weeklyGroup = groups.find(g => g.render === 'weekly')!
    const monRow = weeklyGroup.weekly!.rows.find(r => r.day === '월')!
    expect(monRow.allDay).toBe(true)
    expect(monRow.time).toBe('24시간')
  })

  it('설치·장비 kv 그룹 있다', () => {
    const groups = buildSpecGroups('aed', details)
    expect(groups.find(g => g.heading === '설치 · 장비')).toBeTruthy()
  })

  it('org trimDashes 적용', () => {
    const groups = buildSpecGroups('aed', { ...details, org: '-- 강남구청 --' })
    const kvGroup = groups.find(g => g.heading === '설치 · 장비')!
    const row = kvGroup.rows!.find(r => r.label === '설치 기관')!
    expect(row.value).toBe('강남구청')
  })
})

describe('buildSpecGroups — aed (모든 요일 closed → weekly 그룹 생략)', () => {
  it('모두 null이면 weekly 그룹 없음', () => {
    expect(() => buildSpecGroups('aed', {})).not.toThrow()
    const groups = buildSpecGroups('aed', {})
    expect(groups.find(g => g.render === 'weekly')).toBeUndefined()
  })
})

// ─────────────────────────────────────────

describe('buildSpecGroups — pharmacy (full fixture)', () => {
  const details = {
    dutyTime1s: '0900', dutyTime1c: '1800', // 월
    dutyTime2s: '0900', dutyTime2c: '1800', // 화
    dutyTime3s: '0900', dutyTime3c: '1800', // 수
    dutyTime4s: '0900', dutyTime4c: '1800', // 목
    dutyTime5s: '0900', dutyTime5c: '1800', // 금
    dutyTime6s: '1000', dutyTime6c: '1400', // 토
    dutyTime7s: null,   dutyTime7c: null,   // 일 휴무
    dutyTime8s: null,   dutyTime8c: null,   // 공휴일 휴무
    lunchWeek: '13:00~14:00',
    lunchSat: null,
    noTrmtSun: '일요일 휴무',
    noTrmtHoli: '공휴일 휴무',
    recpWeek: '18:00 접수마감',
    recpSat: null,
    pharmacistCnt: 2,
    dutyTel3: '0221556700',
    dutyInf: '주차가능',
    dataDate: '2024-01-01',
  }

  it('요일별 운영시간 weekly 그룹 있다 (≥1 non-closed day)', () => {
    const groups = buildSpecGroups('pharmacy', details)
    const weeklyGroup = groups.find(g => g.render === 'weekly')
    expect(weeklyGroup).toBeTruthy()
    expect(weeklyGroup!.heading).toBe('요일별 운영시간')
  })

  it('fmtHm: 월요일 "0900"~"1800" → "09:00 ~ 18:00"', () => {
    const groups = buildSpecGroups('pharmacy', details)
    const weeklyGroup = groups.find(g => g.render === 'weekly')!
    const monRow = weeklyGroup.weekly!.rows.find(r => r.day === '월')!
    expect(monRow.time).toBe('09:00 ~ 18:00')
  })

  it('일요일 시간 없으면 closed=true, time="휴무"', () => {
    const groups = buildSpecGroups('pharmacy', details)
    const weeklyGroup = groups.find(g => g.render === 'weekly')!
    const sunRow = weeklyGroup.weekly!.rows.find(r => r.day === '일')!
    expect(sunRow.closed).toBe(true)
    expect(sunRow.time).toBe('휴무')
  })

  it('notes에 접수/안내 문자열 포함', () => {
    const groups = buildSpecGroups('pharmacy', details)
    const weeklyGroup = groups.find(g => g.render === 'weekly')!
    expect(weeklyGroup.weekly!.notes).toBeDefined()
    expect(weeklyGroup.weekly!.notes!.some(n => n.includes('접수'))).toBe(true)
  })

  it('점심시간 kv 그룹 있다', () => {
    const groups = buildSpecGroups('pharmacy', details)
    expect(groups.find(g => g.heading === '점심시간')).toBeTruthy()
  })

  it('약국 정보 — pharmacistCnt 있다', () => {
    const groups = buildSpecGroups('pharmacy', details)
    const infoGroup = groups.find(g => g.heading === '약국 정보')!
    const row = infoGroup.rows!.find(r => r.label === '약사 수')!
    expect(row.value).toBe(2)
    expect(row.unit).toBe('명')
  })

  it('이용 안내 그룹 — dutyInf 있으면 포함', () => {
    const groups = buildSpecGroups('pharmacy', details)
    expect(groups.find(g => g.heading === '이용 안내')).toBeTruthy()
  })
})

describe('buildSpecGroups — pharmacy (빈 {})', () => {
  it('throw 없음, weekly 그룹 없음(모두 closed)', () => {
    expect(() => buildSpecGroups('pharmacy', {})).not.toThrow()
    const groups = buildSpecGroups('pharmacy', {})
    expect(groups.find(g => g.render === 'weekly')).toBeUndefined()
  })
})

// ─────────────────────────────────────────

describe('buildSpecGroups — hospital (full fixture)', () => {
  const details = {
    clCdNm: '종합병원',
    foundationCdNm: '법인',
    nurseGrade: '1',
    estbDd: '19850315',
    homepage: 'https://hospital.example.com',
    trmtMonStart: '0900', trmtMonEnd: '1700',
    trmtTueStart: '0900', trmtTueEnd: '1700',
    trmtWedStart: '0900', trmtWedEnd: '1700',
    trmtThuStart: '0900', trmtThuEnd: '1700',
    trmtFriStart: '0900', trmtFriEnd: '1700',
    trmtSatStart: '0900', trmtSatEnd: '1300',
    trmtSunStart: null,   trmtSunEnd: null,
    lunchWeek: '12:30~13:30',
    lunchSat: null,
    noTrmtSun: '일요일 휴진',
    noTrmtHoli: '공휴일 휴진',
    drTotCnt: 120,
    pnursCnt: 200,
    mdeptSdrCnt: 80, mdeptGdrCnt: 20, mdeptIntnCnt: 10, mdeptResdntCnt: 10,
    detySdrCnt: null, detyGdrCnt: null, detyIntnCnt: null, detyResdntCnt: null,
    cmdcSdrCnt: null, cmdcGdrCnt: null, cmdcIntnCnt: null, cmdcResdntCnt: null,
    departments: [
      { dgsbjtCdNm: '내과', dgsbjtPrSdrCnt: 15 },
      { dgsbjtCdNm: '외과', dgsbjtPrSdrCnt: 8 },
      { dgsbjtCdNm: '소아과', dgsbjtPrSdrCnt: null },
    ],
    generalUpperBeds: 100,
    generalNormalBeds: 200,
    adultIcuBeds: 20,
    childIcuBeds: 0,
    emergencyBeds: 10,
    parkQty: 50,
    parkEtc: '지하 주차장',
  }

  it('병원 정보 kv 그룹 있다', () => {
    const groups = buildSpecGroups('hospital', details)
    expect(groups.find(g => g.heading === '병원 정보')).toBeTruthy()
  })

  it('요일별 진료시간 weekly 그룹 있다 (≥1 non-closed day)', () => {
    const groups = buildSpecGroups('hospital', details)
    const weeklyGroup = groups.find(g => g.render === 'weekly')
    expect(weeklyGroup).toBeTruthy()
    expect(weeklyGroup!.heading).toBe('요일별 진료시간')
  })

  it('fmtHm: 월요일 "0900"~"1700" → time 포함', () => {
    const groups = buildSpecGroups('hospital', details)
    const weeklyGroup = groups.find(g => g.render === 'weekly')!
    const monRow = weeklyGroup.weekly!.rows.find(r => r.day === '월')!
    expect(monRow.time).toBe('09:00 ~ 17:00')
    expect(monRow.closed).toBeFalsy()
  })

  it('일요일 휴진 → closed=true', () => {
    const groups = buildSpecGroups('hospital', details)
    const weeklyGroup = groups.find(g => g.render === 'weekly')!
    const sunRow = weeklyGroup.weekly!.rows.find(r => r.day === '일')!
    expect(sunRow.closed).toBe(true)
  })

  it('estbDd formatYmd: 19850315 → "1985년 3월 15일"', () => {
    const groups = buildSpecGroups('hospital', details)
    const infoGroup = groups.find(g => g.heading === '병원 정보')!
    const row = infoGroup.rows!.find(r => r.label === '개설일자')!
    expect(row.value).toBe('1985년 3월 15일')
  })

  it('진료과목 tags render, tagVariant teal, dgsbjtCdNm key 사용', () => {
    const groups = buildSpecGroups('hospital', details)
    const tagGroup = groups.find(g => g.heading === '진료과목')!
    expect(tagGroup.render).toBe('tags')
    expect(tagGroup.tagVariant).toBe('teal')
    const labels = tagGroup.tags!.map(t => t.label)
    expect(labels).toContain('내과')
    expect(labels).toContain('외과')
    expect(labels).toContain('소아과')
  })

  it('진료과목 tags suffix — dgsbjtPrSdrCnt 있으면 "N명"', () => {
    const groups = buildSpecGroups('hospital', details)
    const tagGroup = groups.find(g => g.heading === '진료과목')!
    const naeTag = tagGroup.tags!.find(t => t.label === '내과')!
    expect(naeTag.suffix).toBe('15명')
    const soTag = tagGroup.tags!.find(t => t.label === '소아과')!
    expect(soTag.suffix).toBeUndefined()
  })

  it('진료영역별 의사 table — 의과 행 있음', () => {
    const groups = buildSpecGroups('hospital', details)
    const tableGroup = groups.find(g => g.heading === '진료영역별 의사')!
    expect(tableGroup.render).toBe('table')
    const rows = tableGroup.table!.rows
    expect(rows.find(r => r.label === '의과')).toBeTruthy()
    // 치과/한방은 모두 null이므로 생략
    expect(rows.find(r => r.label === '치과')).toBeUndefined()
  })

  it('병상 정보 — 총 병상수 헤딩에 포함, childIcuBeds=0은 제외', () => {
    const groups = buildSpecGroups('hospital', details)
    const bedGroup = groups.find(g => g.heading?.includes('병상 정보'))!
    expect(bedGroup.heading).toContain('330병상') // 100+200+20+10
    expect(bedGroup.rows!.find(r => r.label === '소아 중환자')).toBeUndefined()
  })

  it('주차정보 kv 그룹 — parkQty=50', () => {
    const groups = buildSpecGroups('hospital', details)
    const parkGroup = groups.find(g => g.heading === '주차정보')!
    const row = parkGroup.rows!.find(r => r.label === '주차가능대수')!
    expect(row.value).toBe(50)
    expect(row.unit).toBe('대')
  })
})

describe('buildSpecGroups — hospital (빈 {})', () => {
  it('throw 없음, weekly/tags/table/beds/parking 없으면 생략', () => {
    expect(() => buildSpecGroups('hospital', {})).not.toThrow()
    const groups = buildSpecGroups('hospital', {})
    expect(groups.find(g => g.render === 'weekly')).toBeUndefined()
    expect(groups.find(g => g.heading === '진료과목')).toBeUndefined()
    expect(groups.find(g => g.heading === '진료영역별 의사')).toBeUndefined()
    expect(groups.find(g => g.heading?.includes('병상'))).toBeUndefined()
  })
})
