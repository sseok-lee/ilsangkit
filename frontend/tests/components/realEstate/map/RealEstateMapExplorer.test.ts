import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import RealEstateMapExplorer from '~/components/realEstate/map/RealEstateMapExplorer.vue'
import type { MapItem } from '~/types/realEstateMap'

const ITEMS: MapItem[] = [
  { name: '서울', district: null, dong: null, lat: 37.55, lng: 126.98, avgPricePerPyeong: 7732, transactionCount: 100 },
]

// MapSidebar 의 rows computed 는 granularity 에 맞는 아이템 모양을 요구한다(building
// granularity 인데 지역 아이템을 주면 toRealEstateUrl 이 city/district 를 못 읽어 깨진다).
// onSelect 의 level 배선만 검증하는 아래 describe 는 각 granularity 에 맞는 아이템으로 마운트한다.
const BUILDING_ITEMS: MapItem[] = [
  {
    buildingName: '래미안블레스티지', city: '서울', district: '강남구', dongName: '개포동',
    lat: 37.48, lng: 127.06, latestPrice: 168340, monthlyRent: null,
    latestDealYear: 2026, latestDealMonth: 8, latestDealDay: 1, transactionCount: 812,
    jeonseDeposit: null, jeonseDealKey: null, wolseDeposit: null, wolseMonthlyRent: null, wolseDealKey: null,
  },
]

const DONG_ITEMS: MapItem[] = [
  { name: '서울', district: '강북구', dong: '미아동', lat: 37.63, lng: 127.02,
    avgPricePerPyeong: 3225, transactionCount: 42 },
]

function mountExplorer() {
  return mount(RealEstateMapExplorer, {
    props: { initialType: 'apt-sale', initialItems: ITEMS, initialGranularity: 'city' },
    global: { stubs: { RealEstateMapCanvas: { template: '<div data-testid="canvas" />' } } },
  })
}

// AdBanner 는 tests/setup.ts 의 config.global.stubs 로 전역 스텁된다 (`.stub-ad-banner`).
// MapSidebar 가 로컬 import 하지만 VTU 스텁 매칭은 등록 방식과 무관하게 걸린다(실측 확인).
// 광고 슬롯 자체는 MapSidebar 가 심는 `[data-testid="map-sidebar-ad"]` 래퍼로 센다 —
// 이게 실제로 "인피드 광고 자리가 몇 개 렌더됐는가"를 세는 마커다.
const AD_SLOT_SELECTOR = '[data-testid="map-sidebar-ad"]'

function stubDesktopViewport(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

describe('RealEstateMapExplorer', () => {
  it('사이드바를 SSR 가능한 형태로 렌더한다 — 지도 없이도 목록이 나온다', () => {
    const w = mountExplorer()
    expect(w.text()).toContain('서울')
  })

  it('필터바를 렌더한다', () => {
    expect(mountExplorer().text()).toContain('아파트 매매')
  })

  it('거래 축이 2종이라 전세/월세 버튼이 없다', () => {
    const t = mountExplorer().text()
    expect(t).toContain('아파트 전월세')
    expect(t).not.toContain('아파트 전세')
    expect(t).not.toContain('아파트 월세')
  })

  it('지도 캔버스는 ClientOnly 안에 있다 — SSR 에서 kakao SDK 를 건드리지 않는다', () => {
    const w = mountExplorer()
    expect(w.html()).not.toContain('window.kakao')
  })

  // 루프 회귀 가드: RealEstateMapCanvas 가 idle 의 3번째 인자로 올려보내는 "실제 중심"을
  // onIdle 이 그대로 반영해야 한다. bounds.sw/ne 산술중점으로 되돌아가면(과거 버그) Kakao
  // Mercator 투영 오차 때문에 panTo → idle 재발화가 무한 반복되는 드리프트가 재발한다.
  // center 는 로컬 ref 라 직접 관측할 수 없으므로, syncHash() 가 그 값을 그대로 실어보내는
  // location.hash 를 관측 지점으로 삼는다(라이브 검증 때 실제로 이 해시를 읽어 확인한 방식과 동일).
  it('idle 의 3번째 인자(getCenter() 실제 중심)를 center 에 그대로 반영한다 — bounds 산술중점이 아니다 (루프 회귀 가드)', async () => {
    const CanvasStub = {
      template: '<div data-testid="canvas" />',
      emits: ['idle', 'select', 'hover'],
    }
    const w = mount(RealEstateMapExplorer, {
      props: { initialType: 'apt-sale', initialItems: ITEMS, initialGranularity: 'city' },
      global: { stubs: { RealEstateMapCanvas: CanvasStub } },
    })

    // sw/ne 산술중점 = lat (33+41)/2=37, lng (124+132)/2=128 — getCenter() 실제값과
    // 의도적으로 다르게 둔다(Mercator 왜곡 재현).
    const bounds = { swLat: 33, swLng: 124, neLat: 41, neLng: 132 }
    const realCenter = { lat: 36.5, lng: 127.8 }

    await w.findComponent(CanvasStub).vm.$emit('idle', bounds, 9, realCenter)

    expect(window.location.hash).toContain(`lat=${realCenter.lat}`)
    expect(window.location.hash).toContain(`lng=${realCenter.lng}`)
    expect(window.location.hash).not.toContain('lat=37')
    expect(window.location.hash).not.toContain('lng=128')
  })

  // 공유 링크 복원 회귀 가드: buildMapHash 는 type/level/lat/lng 네 필드 전부를 담는데, 과거엔
  // onMounted 가 lat/lng 만 반영하고 type/level 은 파싱만 하고 버렸다 — "빌라 전월세, 강남
  // 건물 단위" 링크를 받은 사람이 "아파트 매매, 전국 단위" 화면을 Gangnam 근처 중심으로만
  // 보게 되는, 겉보기엔 맞지만 실제로는 절반만 동작하는 상태였다.
  describe('마운트 시 해시(#type/level/lat/lng) 전체를 반영한다 (공유 링크 복원)', () => {
    afterEach(() => {
      window.location.hash = ''
    })

    function mountWithCanvasStub() {
      const CanvasStub = {
        template: '<div data-testid="canvas" />',
        props: ['items', 'center', 'level'],
        emits: ['idle', 'select', 'hover'],
      }
      const w = mount(RealEstateMapExplorer, {
        props: { initialType: 'apt-sale', initialItems: ITEMS, initialGranularity: 'city' },
        global: {
          stubs: {
            RealEstateMapCanvas: CanvasStub,
            // hash 의 type 이 setType() 을 통해 실제 fetch 를 트리거한다(기존 필터 전환 경로와
            // 동일). 전역 $fetch 목(tests/setup.ts)이 빈 data:{} 를 반환하므로 total/exact 가
            // undefined 로 바뀌는데, 실제 MapSidebar 는 이 조합(exact=undefined)에서
            // total.toLocaleString() 을 호출해 깨진다 — 이 테스트는 필터바 활성 상태/캔버스
            // props 만 검증하므로 그 무관한 크래시를 피하려고 MapSidebar 를 스텁한다.
            MapSidebar: true,
          },
        },
      })
      return { w, canvas: w.findComponent(CanvasStub) }
    }

    it('type/level 이 있는 해시는 필터바 활성 타입과 캔버스 level prop 에 그대로 반영된다', async () => {
      window.location.hash = '#type=villa-rent&level=5&lat=37.5&lng=127.05'
      const { w, canvas } = mountWithCanvasStub()
      // onMounted 안의 setLevel/setType 은 반응형 값만 동기로 바꾼다 — 그 값이 자식 prop 으로
      // 실제 반영되는 건 Vue 의 스케줄러가 비동기로 플러시하므로 한 틱 기다려야 한다.
      // setType 이 트리거한 fetch(mock $fetch) 도 여기서 완전히 정리한다 — 안 그러면 다음
      // 테스트로 새는 미해결 프라미스가 남는다.
      await nextTick()
      await flushPromises()

      expect(canvas.props('level')).toBe(5)
      expect(canvas.props('center')).toEqual({ lat: 37.5, lng: 127.05 })

      const activeBtn = w.findAll('a').find((a) => a.text() === '빌라 전월세')
      expect(activeBtn?.attributes('aria-current')).toBe('true')
      const defaultBtn = w.findAll('a').find((a) => a.text() === '아파트 매매')
      expect(defaultBtn?.attributes('aria-current')).toBeUndefined()
    })

    it('lat/lng 만 있는 해시는(과거와 동일) 중심만 옮기고 type/level 은 기본값을 유지한다', async () => {
      window.location.hash = '#lat=35.1&lng=129.0'
      const { w, canvas } = mountWithCanvasStub()
      await nextTick()
      await flushPromises()

      expect(canvas.props('center')).toEqual({ lat: 35.1, lng: 129.0 })
      expect(canvas.props('level')).toBe(13) // useRealEstateMap 기본 레벨 — 해시에 없으니 그대로

      const defaultBtn = w.findAll('a').find((a) => a.text() === '아파트 매매')
      expect(defaultBtn?.attributes('aria-current')).toBe('true')
    })
  })

  // MapSidebar 가 데스크톱 aside 와 모바일 바텀시트에 동시에 마운트된다(하나는 CSS 로만
  // 숨김, DOM 에서 사라지지 않음). showAd 게이팅이 없으면 두 사본이 동시에 AdBanner 를
  // 마운트해 adsbygoogle.push() 를 중복 호출한다(라이브에서 관측된 버그, availableWidth=0
  // 에러 + <ins class="adsbygoogle"> 3개). 뷰포트별로 정확히 1개만 남아야 한다.
  describe('인피드 광고 중복 방지 (RealEstateMapExplorer 이슈)', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('데스크톱 뷰포트에서는 두 MapSidebar 사본 중 정확히 1개만 인피드 광고를 렌더한다', async () => {
      stubDesktopViewport(true)
      const w = mountExplorer()
      await nextTick()
      await nextTick()

      const adSlots = w.findAll(AD_SLOT_SELECTOR)
      expect(adSlots).toHaveLength(1)
      // 보이는 쪽(데스크톱 aside)에 있어야 한다 — hidden lg:block 조상 안.
      expect(w.find('aside').findAll(AD_SLOT_SELECTOR)).toHaveLength(1)
    })

    it('모바일 뷰포트에서는 두 MapSidebar 사본 중 정확히 1개만 인피드 광고를 렌더한다', async () => {
      stubDesktopViewport(false)
      const w = mountExplorer()
      await nextTick()
      await nextTick()

      const adSlots = w.findAll(AD_SLOT_SELECTOR)
      expect(adSlots).toHaveLength(1)
      // aside(데스크톱) 쪽엔 없어야 한다 — 바텀시트 사본에만 있어야 한다.
      expect(w.find('aside').findAll(AD_SLOT_SELECTOR)).toHaveLength(0)
    })

    it('마운트 직후(뷰포트 판정 전)에는 광고 슬롯이 최대 1개를 넘지 않는다 (합계 상한 가드)', () => {
      stubDesktopViewport(true)
      const w = mountExplorer()
      // await 없이 — onMounted 의 matchMedia 갱신이 아직 patch 로 반영되기 전 시점도
      // 두 사본 합쳐 광고가 2개 이상 뜨는 순간이 없어야 한다는 회귀 가드.
      expect(w.findAll(AD_SLOT_SELECTOR).length).toBeLessThanOrEqual(1)
    })
  })
})

// select 를 직접 emit 해 onSelect 자체의 배선(level/center)만 검증하는 공용 헬퍼.
// RealEstateMapCanvas 를 center/level prop 을 받는 스텁으로 교체해 관측한다.
function mountWithGranularity(granularity: 'city' | 'district' | 'dong' | 'building', items: MapItem[]) {
  const CanvasStub = {
    template: '<div data-testid="canvas" />',
    props: ['items', 'center', 'level'],
    emits: ['idle', 'select', 'hover'],
  }
  const w = mount(RealEstateMapExplorer, {
    props: { initialType: 'apt-sale', initialItems: items, initialGranularity: granularity },
    global: { stubs: { RealEstateMapCanvas: CanvasStub } },
  })
  return { w, canvas: w.findComponent(CanvasStub) }
}

// 사이드바 city/district 행 클릭(select emit)이 허브로 이탈하는 대신 지도를 드릴다운해야
// 한다. onSelect 는 MapSidebar 행 클릭과 지도 마커 클릭 둘 다에서 재사용되므로, 여기서는
// select 를 직접 emit 해 onSelect 자체의 level 배선만 검증한다(행 클릭 인터셉트 자체는
// MapSidebar.test.ts 담당).
//
// 9/7/5 는 backend resolveGranularity(backend/src/schemas/realEstateMap.ts)의 히스테리시스를
// 피해 실제로 다음 단위로 전환되는 값이다 — CITY_MIN_LEVEL=11, DISTRICT_MIN_LEVEL=9,
// DONG_MIN_LEVEL=7 이며 city→10, district→8, dong→6 은 각각 되돌림 특례에 걸려
// 드릴다운되지 않는다(클릭해도 아무 일이 없는 것처럼 보인다).
describe('RealEstateMapExplorer onSelect 드릴다운 zoom level', () => {
  it('granularity=city 에서 select 시 level 9 를 세팅한다 (district 로 드릴다운)', async () => {
    const { canvas } = mountWithGranularity('city', ITEMS)
    canvas.vm.$emit('select', ITEMS[0])
    await nextTick()
    expect(canvas.props('level')).toBe(9)
  })

  it('granularity=district 에서 select 시 level 7 을 세팅한다 (dong 으로 드릴다운)', async () => {
    const { canvas } = mountWithGranularity('district', ITEMS)
    canvas.vm.$emit('select', ITEMS[0])
    await nextTick()
    expect(canvas.props('level')).toBe(7)
  })

  it('granularity=dong 에서 select 시 level 5 를 세팅한다 (building 으로 드릴다운)', async () => {
    const { canvas } = mountWithGranularity('dong', DONG_ITEMS)
    canvas.vm.$emit('select', DONG_ITEMS[0])
    await nextTick()
    expect(canvas.props('level')).toBe(5)
  })

  it('granularity=building 에서 select 해도 level 을 바꾸지 않는다 — 상세 페이지 이동만 한다', async () => {
    const { canvas } = mountWithGranularity('building', BUILDING_ITEMS)
    const before = canvas.props('level')
    canvas.vm.$emit('select', BUILDING_ITEMS[0])
    await nextTick()
    expect(canvas.props('level')).toBe(before)
  })
})

// 회귀 가드: MapSidebar 의 SIDO_CHIPS 폴백 항목이 과거 `lat:0, lng:0`(기니만 앞바다 —
// null 이 아니라 유효한 좌표)을 들고 있어, 데이터 없는 시/도를 클릭하면 지도가 실제로
// 그리로 튀어(해시 lat=-11363.89… 로 발산) 사이드바가 비고 콘솔 에러가 폭주했다(라이브 실측).
// onSelect 는 이제 좌표가 null 이거나 KOREA_BOUNDS(위도 33~39, 경도 124~132) 밖이면
// center 를 건드리지 않고 level 만 적용한다.
describe('RealEstateMapExplorer onSelect 좌표 가드 — 유효하지 않은 좌표는 center 를 바꾸지 않는다', () => {
  const DEFAULT_CENTER = { lat: 36.5, lng: 127.8 } // RealEstateMapExplorer 의 center 초기값

  it('(0,0) 좌표(집계 폴백 사고 재현)를 select 해도 center 는 그대로다', async () => {
    const { canvas } = mountWithGranularity('city', ITEMS)
    const zeroCoordItem = {
      name: '세종', district: null, lat: 0, lng: 0, avgPricePerPyeong: null, transactionCount: 0,
    }
    canvas.vm.$emit('select', zeroCoordItem)
    await nextTick()
    expect(canvas.props('center')).toEqual(DEFAULT_CENTER)
  })

  it('한국 영역 밖 좌표(lat 51, lng 0)를 select 해도 center 는 그대로다', async () => {
    const { canvas } = mountWithGranularity('city', ITEMS)
    const outsideKorea = {
      name: '해외', district: null, lat: 51, lng: 0, avgPricePerPyeong: null, transactionCount: 0,
    }
    canvas.vm.$emit('select', outsideKorea)
    await nextTick()
    expect(canvas.props('center')).toEqual(DEFAULT_CENTER)
  })

  it('한국 영역 밖 좌표를 select 해도 level 은 여전히 적용된다 (center 만 막고 줌은 막지 않는다)', async () => {
    const { canvas } = mountWithGranularity('city', ITEMS)
    const outsideKorea = {
      name: '해외', district: null, lat: 51, lng: 0, avgPricePerPyeong: null, transactionCount: 0,
    }
    canvas.vm.$emit('select', outsideKorea)
    await nextTick()
    expect(canvas.props('level')).toBe(9)
  })

  it('정상 좌표(서울 37.55/126.98)를 select 하면 center 가 바뀐다', async () => {
    const { canvas } = mountWithGranularity('city', ITEMS)
    const seoul = {
      name: '서울', district: null, lat: 37.55, lng: 126.98, avgPricePerPyeong: null, transactionCount: 0,
    }
    canvas.vm.$emit('select', seoul)
    await nextTick()
    expect(canvas.props('center')).toEqual({ lat: 37.55, lng: 126.98 })
  })
})

describe('RealEstateMapExplorer 레이아웃', () => {
  // MapSidebar 의 props 를 읽기 위한 전용 헬퍼. stub 에 name 을 반드시 준다 —
  // name 이 없으면 findAllComponents({ name }) 가 아무것도 찾지 못해 검증이 조용히 무력해진다.
  function mountForLayout() {
    return mount(RealEstateMapExplorer, {
      props: { initialType: 'apt-sale', initialItems: ITEMS, initialGranularity: 'city' },
      global: {
        stubs: {
          MapSidebar: {
            name: 'MapSidebar',
            template: '<div />',
            props: ['items', 'granularity', 'total', 'exact', 'pending', 'type', 'showAd', 'showFooter'],
          },
          MapFilterBar: { name: 'MapFilterBar', template: '<div />', props: ['type'] },
          RealEstateMapCanvas: { name: 'RealEstateMapCanvas', template: '<div />', props: ['items', 'center', 'level'] },
          MapBottomSheet: { name: 'MapBottomSheet', template: '<div><slot /></div>' },
          ClientOnly: { template: '<div><slot /></div>' },
        },
      },
    })
  }

  it('section 을 헤더 아래 뷰포트에 fixed 로 고정한다 (브레이크포인트별 top)', () => {
    // AdSense 스크립트가 layouts/map.vue 루트에 인라인 height:auto!important 를
    // 주입해도(라이브 실측, 데스크톱 1440x900 에서 611px 스크롤 발생) section 자체가
    // 뷰포트 좌표로 고정돼 있으면 그 주입과 무관하게 스크롤 0 이 유지된다.
    // 헤더는 h-14 lg:h-16(56px/64px)이라 top 값도 브레이크포인트별로 필요하다.
    const cls = mountForLayout().find('section').classes()
    expect(cls).toContain('fixed')
    expect(cls).toContain('inset-x-0')
    expect(cls).toContain('top-14')
    expect(cls).toContain('lg:top-16')
    expect(cls).toContain('bottom-0')
  })

  it('내부 컨테이너는 fixed section 에 inset 고정된다 — height 프로퍼티(h-full 포함)를 쓰지 않는다', () => {
    // AdSense 가 광고 슬롯의 모든 조상에 인라인 height:auto!important 를 찍는다(라이브
    // 실측, 1280x600). h-full(=height:100%) 은 그 주입에 곧바로 무너져 사이드바가
    // 1448px 로 늘어나고 스크롤이 죽었다 — absolute inset-0 은 height 프로퍼티 자체를
    // 쓰지 않으므로(section 이 이미 fixed=positioned 라 containing block) 그 주입과
    // 무관하다.
    // `section > div` 는 MapBottomSheet 스텁의 루트(`<div><slot /></div>`)도 매칭해
    // find() 의 "첫 매치"가 템플릿 순서에 우연히 기댄다 — lg:flex 클래스를 가진 쪽을
    // 명시적으로 골라 그 우연에 기대지 않게 한다.
    const cls = mountForLayout()
      .findAll('section > div')
      .find((d) => d.classes().includes('lg:flex'))
      ?.classes()
    expect(cls).toContain('absolute')
    expect(cls).toContain('inset-0')
    expect(cls).not.toContain('h-full')
    expect(cls?.some((c) => /^(h|lg:h)-/.test(c) || c.includes('vh'))).toBe(false)
  })

  it('사이드바를 고정폭으로 잡고, flex 컨테이너로 두어 내부 MapSidebar 가 cross-axis stretch 로 높이를 채운다', () => {
    // aside 자신도 광고의 조상이라 height:auto!important 주입을 받는다. lg:block 이면
    // 그 밑의 MapSidebar 루트(h-full)가 무너져 스크롤이 죽는다 — lg:flex 로 두면
    // align-items:stretch(기본값)가 height 가 auto 일 때 작동하므로 그 주입 위에서도
    // 살아남는다(라이브 검증). row 방향 flex 의 메인축(가로)은 자동으로 안 늘어나므로
    // MapSidebar 쪽에 w-full 을 내려 320px 폭을 유지한다.
    const w = mountForLayout()
    const asideCls = w.find('aside').classes()
    expect(asideCls).toContain('lg:w-[320px]')
    expect(asideCls).toContain('lg:shrink-0')
    expect(asideCls).toContain('lg:flex')
    expect(asideCls).not.toContain('lg:block')

    const sidebar = w.find('aside').findComponent({ name: 'MapSidebar' })
    expect(sidebar.classes()).toContain('w-full')
  })

  it('지도 영역은 h-full 이다 — 모바일 60vh 폐지 회귀 가드', () => {
    // relative+flex-1 조합은 지도 영역 div 에만 존재한다(컨테이너 div·aside·필터바
    // absolute 래퍼 어디에도 이 조합이 없다) — find('div') 의 순서가 아니라 클래스
    // 조합으로 정밀하게 골라낸다.
    const mapArea = mountForLayout()
      .findAll('div')
      .find((d) => d.classes().includes('relative') && d.classes().includes('flex-1'))
    expect(mapArea).toBeTruthy()
    const cls = mapArea!.classes()
    expect(cls).toContain('h-full')
    expect(cls).toContain('lg:h-auto')
    expect(cls.some((c) => c.includes('vh'))).toBe(false)
  })

  describe('showFooter 반대조건 배선 — 데스크톱/모바일 상호배타', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('데스크톱 뷰포트에서는 데스크톱 사본만 showFooter=true 다', async () => {
      stubDesktopViewport(true)
      const w = mountForLayout()
      // isDesktop 은 onMounted 안에서 matchMedia 결과로 동기 갱신되지만, 그 값이
      // 자식 스텁의 props 로 실제 반영되는 건 Vue 스케줄러가 비동기로 플러시한다.
      // await 없이 읽으면 isDesktop 이 아직 null 이던 프리플러시 상태([false,false])만
      // 관측하게 되어, 반대조건이 아니라 같은 조건(`isDesktop === true` 를 양쪽에)을
      // 넣어도 이 테스트가 똑같이 통과한다 — 그래서 반드시 한 틱을 기다린다.
      await nextTick()

      const desktopSidebar = w.find('aside').findComponent({ name: 'MapSidebar' })
      const mobileSidebar = w.findComponent({ name: 'MapBottomSheet' }).findComponent({ name: 'MapSidebar' })

      expect(desktopSidebar.props('showFooter')).toBe(true)
      expect(mobileSidebar.props('showFooter')).toBe(false)
      // showAd 와 showFooter 는 각 사본 내에서 항상 같은 값이어야 한다 — 어긋나면
      // 한쪽엔 광고만, 다른 쪽엔 푸터만 뜨는 불일치가 생긴다.
      expect(desktopSidebar.props('showAd')).toBe(desktopSidebar.props('showFooter'))
      expect(mobileSidebar.props('showAd')).toBe(mobileSidebar.props('showFooter'))
    })

    it('모바일 뷰포트에서는 모바일 사본만 showFooter=true 다', async () => {
      stubDesktopViewport(false)
      const w = mountForLayout()
      await nextTick()

      const desktopSidebar = w.find('aside').findComponent({ name: 'MapSidebar' })
      const mobileSidebar = w.findComponent({ name: 'MapBottomSheet' }).findComponent({ name: 'MapSidebar' })

      expect(desktopSidebar.props('showFooter')).toBe(false)
      expect(mobileSidebar.props('showFooter')).toBe(true)
      expect(desktopSidebar.props('showAd')).toBe(desktopSidebar.props('showFooter'))
      expect(mobileSidebar.props('showAd')).toBe(mobileSidebar.props('showFooter'))
    })
  })
})
