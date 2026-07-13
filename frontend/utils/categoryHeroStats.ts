import type { FacilityCategory } from '~/types/facility'

export interface HeroStat { label: string; value: string }
type StatBuilder = (d: any, phone: string) => HeroStat[]

const REGISTRY: Partial<Record<FacilityCategory, StatBuilder>> = {
  hospital: (d) => {
    const items: HeroStat[] = []
    if (d?.clCdNm) items.push({ label: '종별', value: d.clCdNm })
    if (d?.drTotCnt) items.push({ label: '의사', value: `${d.drTotCnt}명` })
    if (d?.parkQty != null) items.push({ label: '주차', value: d.parkQty > 0 ? `${d.parkQty}대` : '불가' })
    return items
  },

  pharmacy: (d, phone) => {
    const items: HeroStat[] = []
    // _todayHours: 호출측([id].vue)에서 pharmacyWeeklyHours 기반 오늘 영업시간 결과를 주입
    if (d?.pharmacistCnt) items.push({ label: '약사', value: `${d.pharmacistCnt}명` })
    if (d?._todayHours) items.push({ label: '오늘', value: d._todayHours })
    if (phone) items.push({ label: '전화', value: phone })
    return items
  },

  parking: (d) => {
    const items: HeroStat[] = []
    if (d?.capacity) items.push({ label: '주차면수', value: `${d.capacity}면` })
    if (d?.feeType) items.push({ label: '요금', value: d.feeType })
    if (d?.lotType) items.push({ label: '구분', value: d.lotType })
    return items
  },

  library: (d) => {
    const items: HeroStat[] = []
    if (d?.seatCount) items.push({ label: '좌석', value: `${d.seatCount.toLocaleString()}석` })
    if (d?.bookCount) items.push({ label: '장서', value: `${d.bookCount.toLocaleString()}권` })
    return items
  },

  aed: (d) => {
    const trim = (s: string) => s.replace(/^[-\s]+|[-\s]+$/g, '').trim()
    const items: HeroStat[] = []
    if (d?.buildPlace) {
      const v = trim(d.buildPlace)
      if (v) items.push({ label: '설치위치', value: v })
    }
    if (d?.org) {
      const v = trim(d.org)
      if (v) items.push({ label: '관리기관', value: v })
    }
    return items
  },

  childcare: (d) => {
    const items: HeroStat[] = []
    if (d?.crcapat) items.push({ label: '정원', value: `${d.crcapat}명` })
    if (d?.crchcnt != null) items.push({ label: '현원', value: `${d.crchcnt}명` })
    return items
  },

  park: (d) => {
    const items: HeroStat[] = []
    if (d?.parkType) items.push({ label: '공원유형', value: d.parkType })
    if (d?.area != null) items.push({ label: '면적', value: `${d.area.toLocaleString()}㎡` })
    return items
  },

  market: (d) => {
    const items: HeroStat[] = []
    if (d?.marketType) items.push({ label: '시장유형', value: d.marketType })
    if (d?.storeCount != null) items.push({ label: '점포수', value: `${d.storeCount}개` })
    return items
  },

  school: (d) => {
    const items: HeroStat[] = []
    if (d?.schoolLevel) items.push({ label: '학교급', value: d.schoolLevel })
    if (d?.foundationType) items.push({ label: '설립형태', value: d.foundationType })
    if (d?.coeducationType) items.push({ label: '남녀공학', value: d.coeducationType })
    return items
  },

  sports: (d, phone) => {
    const items: HeroStat[] = []
    if (d?.faciGbNm) items.push({ label: '시설구분', value: d.faciGbNm })
    if (d?.ftypeNm) items.push({ label: '유형', value: d.ftypeNm })
    if (d?.faciGfa > 0) items.push({ label: '면적', value: `${Number(d.faciGfa).toLocaleString()}㎡` })
    if (items.length === 0 && phone) items.push({ label: '전화', value: phone })
    return items
  },

  toilet: (d, phone) => {
    const items: HeroStat[] = []
    // 24시간/상시 개방 + 안전·접근성 배지
    const openTimeRaw = (d?.openTime || '').toString().trim()
    // _isOpen24Hours: 호출측([id].vue)에서 isOpen24Hours computed 결과를 주입
    if (openTimeRaw === '상시' || d?._isOpen24Hours) {
      items.push({ label: '개방', value: '상시' })
    }
    if (d?.hasCCTV) items.push({ label: 'CCTV', value: '있음' })
    if (d?.hasDisabledToilet) items.push({ label: '장애인', value: '가능' })
    if (d?.hasDiaperChangingTable) items.push({ label: '기저귀대', value: '있음' })
    if (items.length === 0 && phone) items.push({ label: '전화', value: phone })
    return items
  },

  wifi: (d) => {
    const items: HeroStat[] = []
    if (d?.ssid) items.push({ label: 'SSID', value: d.ssid })
    if (d?.installLocation) items.push({ label: '설치장소', value: d.installLocation })
    return items
  },

  'ev-charger': (d) => {
    const items: HeroStat[] = []
    // 완속/급속 분포: chgerType '01' 급속, '02','03','04','05','06','07' 완속/AC3상 등
    const chargers = (d?.chargers || []) as Array<{ chgerType?: string }>
    if (chargers.length > 0) {
      const fast = chargers.filter(c => c.chgerType === '01' || c.chgerType === '03').length
      const slow = chargers.length - fast
      items.push({ label: '충전기', value: `${chargers.length}대` })
      if (fast > 0 || slow > 0) items.push({ label: '구성', value: `급속 ${fast} · 완속 ${slow}` })
    }
    return items
  },

  // clothes: 상세위치 우선, 없으면 전화 fallback
  clothes: (d, phone) => {
    if (d?.detailLocation) return [{ label: '위치', value: d.detailLocation }]
    return phone ? [{ label: '전화', value: phone }] : []
  },

  // trash: 별도 WasteSchedule 모델 — heroStat 해당 없음
  trash: () => [],
}

export function buildHeroStats(category: FacilityCategory, details: any, phone: string): HeroStat[] {
  const builder = REGISTRY[category]
  if (!builder) {
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[heroStats] 미등록 카테고리 '${category}' — 전화 default로 폴백. categoryHeroStats.ts에 등록 필요.`)
    }
    return phone ? [{ label: '전화', value: phone }] : []
  }
  return builder(details, phone)
}
