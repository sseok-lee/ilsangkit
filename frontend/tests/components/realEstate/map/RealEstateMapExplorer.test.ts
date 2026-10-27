import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
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
    bjdCode: '1168010300',
    lat: 37.48, lng: 127.06, latestPrice: 168340, monthlyRent: null,
    latestDealYear: 2026, latestDealMonth: 8, latestDealDay: 1, transactionCount: 812,
    jeonseDeposit: null, jeonseDealKey: null, wolseDeposit: null, wolseMonthlyRent: null, wolseDealKey: null,
  },
]

const DONG_ITEMS: MapItem[] = [
  { name: '서울', district: '강북구', dong: '미아동', lat: 37.63, lng: 127.02,
    avgPricePerPyeong: 3225, transactionCount: 42 },
]

// 테스트마다 마운트를 푼다. 남겨 두면 앞 테스트의 디바운스 조회(onMapIdle 250ms)·유형 전환 조회가 뒤 테스트
// 도중에 전역 $fetch 목 응답(data:{})을 받아 items=undefined 로 다시 그리다 깨진다
// (CI: 'props.items is not iterable' Unhandled Rejection 2건).
enableAutoUnmount(afterEach)

// syncHash 가 마지막 위치를 localStorage 에 저장한다 — 앞 테스트의 저장값이 다음 테스트의
// 첫 위치(저장 위치 복원)로 새어 들지 않게 매번 비운다.
beforeEach(() => {
  window.localStorage.clear()
})

function mountExplorer(options: { attachTo?: Element } = {}) {
  return mount(RealEstateMapExplorer, {
    ...options,
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

  it('필터바를 렌더한다 — 매물 유형과 거래 유형 두 축', () => {
    const triggers = mountExplorer().findComponent({ name: 'MapFilterBar' }).findAll('button')
    expect(triggers).toHaveLength(2)
    expect(triggers[0].text()).toContain('아파트')
    expect(triggers[1].text()).toContain('매매')
  })

  // 거래 축은 매매/전월세 2종이다. 전세와 월세를 따로 두지 않는 이유는 설계문서 4장 —
  // summary 가 건물당 최신 1건만 보유해 전세로 필터하면 실제 전세 건물이 대량 누락된다.
  it('거래 축이 2종이라 전세/월세를 따로 고를 수 없다', () => {
    const bar = mountExplorer().findComponent({ name: 'MapFilterBar' })
    const txOptions = bar.findAll('ul')[1].findAll('a').map((a) => a.text())
    expect(txOptions).toEqual(['매매', '전월세'])
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

      // 2축 셀렉트라 활성 상태는 트리거 라벨과 각 메뉴의 aria-current 로 나타난다.
      const bar = w.findComponent({ name: 'MapFilterBar' })
      const triggers = bar.findAll('button')
      expect(triggers[0].text()).toContain('빌라')
      expect(triggers[1].text()).toContain('전월세')
      const current = bar.findAll('a').filter((a) => a.attributes('aria-current') === 'true')
      expect(current.map((a) => a.text())).toEqual(['빌라', '전월세'])
    })

    it('lat/lng 만 있는 해시는(과거와 동일) 중심만 옮기고 type/level 은 기본값을 유지한다', async () => {
      window.location.hash = '#lat=35.1&lng=129.0'
      const { w, canvas } = mountWithCanvasStub()
      await nextTick()
      await flushPromises()

      expect(canvas.props('center')).toEqual({ lat: 35.1, lng: 129.0 })
      expect(canvas.props('level')).toBe(13) // useRealEstateMap 기본 레벨 — 해시에 없으니 그대로

      const current = w.findComponent({ name: 'MapFilterBar' })
        .findAll('a').filter((a) => a.attributes('aria-current') === 'true')
      expect(current.map((a) => a.text())).toEqual(['아파트', '매매'])
    })
  })

  // 이 페이지는 광고를 싣지 않는다(사용자 결정). 두 MapSidebar 사본이 항상 동시에
  // 마운트되므로, 슬롯이 되돌아오면 곧바로 2벌이 된다 — 합계 0 을 가드한다.
  describe('광고 미노출', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('데스크톱·모바일 어느 뷰포트에서도 광고 슬롯이 없다', async () => {
      for (const desktop of [true, false]) {
        stubDesktopViewport(desktop)
        const w = mountExplorer()
        await nextTick()
        await nextTick()
        expect(w.findAll(AD_SLOT_SELECTOR)).toHaveLength(0)
        expect(w.findAllComponents({ name: 'AdBanner' })).toHaveLength(0)
      }
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
            props: ['items', 'granularity', 'total', 'exact', 'pending', 'type', 'showFooter'],
          },
          MapFilterBar: { name: 'MapFilterBar', template: '<div />', props: ['type'] },
          RealEstateMapCanvas: { name: 'RealEstateMapCanvas', template: '<div />', props: ['items', 'center', 'level'] },
          ClientOnly: { template: '<div><slot /></div>' },
        },
      },
    })
  }

  it('section 을 헤더 아래 뷰포트에 fixed 로 고정한다 (브레이크포인트별 top)', () => {
    // AdSense 스크립트가 layouts/map.vue 루트에 인라인 height:auto!important 를
    // 주입해도(라이브 실측, 데스크톱 1440x900 에서 611px 스크롤 발생) section 자체가
    // 뷰포트 좌표로 고정돼 있으면 그 주입과 무관하게 스크롤 0 이 유지된다.
    // 헤더는 h-16 lg:h-20(64px/80px)이라 top 값도 브레이크포인트별로 필요하다.
    const cls = mountForLayout().find('section').classes()
    expect(cls).toContain('fixed')
    expect(cls).toContain('inset-x-0')
    expect(cls).toContain('top-16')
    expect(cls).toContain('lg:top-20')
    expect(cls).toContain('bottom-0')
  })

  it('내부 컨테이너는 fixed section 에 inset 고정된다 — height 프로퍼티(h-full 포함)를 쓰지 않는다', () => {
    // AdSense 가 광고 슬롯의 모든 조상에 인라인 height:auto!important 를 찍는다(라이브
    // 실측, 1280x600). h-full(=height:100%) 은 그 주입에 곧바로 무너져 사이드바가
    // 1448px 로 늘어나고 스크롤이 죽었다 — absolute inset-0 은 height 프로퍼티 자체를
    // 쓰지 않으므로(section 이 이미 fixed=positioned 라 containing block) 그 주입과
    // 무관하다.
    // section 바로 아래 div 가 늘어나도 첫 매치에 기대지 않도록 absolute+flex-col 쪽을 명시적으로 고른다.
    const cls = mountForLayout()
      .findAll('section > div')
      .find((d) => d.classes().includes('absolute') && d.classes().includes('flex-col'))
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
    // MapSidebar 쪽에 w-full 을 내려 360px 폭을 유지한다.
    const w = mountForLayout()
    const asideCls = w.find('aside').classes()
    expect(asideCls).toContain('lg:w-[360px]')
    expect(asideCls).toContain('lg:shrink-0')
    expect(asideCls).toContain('lg:flex')
    expect(asideCls).not.toContain('lg:block')

    const sidebar = w.find('aside').findComponent({ name: 'MapSidebar' })
    expect(sidebar.classes()).toContain('w-full')
  })

  it('지도 영역은 모바일에서도 필터 아래 남은 화면을 꽉 채운다 — 하단 시트 몫을 비워 두지 않는다', () => {
    const w = mountForLayout()
    const mapArea = w.find('.map-canvas-panel')
    expect(mapArea.exists()).toBe(true)
    expect(mapArea.attributes('style') ?? '').not.toContain('--sheet-cover')
    expect(mapArea.classes().some((c) => c.startsWith('h-') || c.includes('60vh'))).toBe(false)
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
      const mobileSidebar = w.find('[data-testid="map-mobile-list"]').findComponent({ name: 'MapSidebar' })

      expect(desktopSidebar.props('showFooter')).toBe(true)
      expect(mobileSidebar.props('showFooter')).toBe(false)
    })

    it('모바일 뷰포트에서는 모바일 사본만 showFooter=true 다', async () => {
      stubDesktopViewport(false)
      const w = mountForLayout()
      await nextTick()

      const desktopSidebar = w.find('aside').findComponent({ name: 'MapSidebar' })
      const mobileSidebar = w.find('[data-testid="map-mobile-list"]').findComponent({ name: 'MapSidebar' })

      expect(desktopSidebar.props('showFooter')).toBe(false)
      expect(mobileSidebar.props('showFooter')).toBe(true)
    })
  })
})

describe('RealEstateMapExplorer — 마커 선택 토글', () => {
  // onTypeChange 는 syncHash() 로 history.replaceState 를 부른다. 정리하지 않으면 남은 해시가
  // 다음 테스트의 onMounted → parseMapHash 에 stale 한 type/level/lat/lng 를 먹여 조용히
  // 오염시킨다. 실제로 아래 granularity 테스트가 그 피해를 입어 자체 리셋을 넣어야 했다.
  // describe 단위로 걷어내 이 블록에 추가되는 테스트가 순서에 의존하지 않게 한다.
  afterEach(() => {
    window.location.hash = ''
  })

  const RENT_ITEM: MapItem = {
    buildingName: '은마', city: '서울', district: '강남구', dongName: '대치동',
    bjdCode: '1168010100',
    lat: 37.5, lng: 127.06, latestPrice: 75000, monthlyRent: 340,
    latestDealYear: 2026, latestDealMonth: 7, latestDealDay: 25, transactionCount: 114,
    jeonseDeposit: 96000, jeonseDealKey: 20260712,
    wolseDeposit: 75000, wolseMonthlyRent: 340, wolseDealKey: 20260725,
  }

  const CANVAS_STUB = { RealEstateMapCanvas: { template: '<div data-testid="canvas" />' } }

  function mountWithBuilding() {
    return mount(RealEstateMapExplorer, {
      props: {
        initialType: 'apt-rent',
        initialItems: [RENT_ITEM],
        initialGranularity: 'building',
      },
      global: { stubs: CANVAS_STUB },
    })
  }

  it('건물 선택 시 selectedKey 가 채워진다', async () => {
    const w = mountWithBuilding()
    await w.findComponent({ name: 'MapSidebar' }).vm.$emit('select', RENT_ITEM)
    await nextTick()
    expect(w.vm.selectedKey).toBe('은마|1168010100')
  })

  it('같은 건물을 다시 고르면 접힌다', async () => {
    const w = mountWithBuilding()
    const sidebar = w.findComponent({ name: 'MapSidebar' })
    await sidebar.vm.$emit('select', RENT_ITEM)
    await nextTick()
    await sidebar.vm.$emit('select', RENT_ITEM)
    await nextTick()
    expect(w.vm.selectedKey).toBeNull()
  })

  it('지역 항목 선택은 selectedKey 를 건드리지 않는다 — 지역은 펼칠 값이 없다', async () => {
    const w = mount(RealEstateMapExplorer, {
      props: {
        initialType: 'apt-rent',
        initialItems: [{ name: '서울', district: null, dong: null, lat: 37.55, lng: 126.98, avgPricePerPyeong: 7732, transactionCount: 100 }],
        initialGranularity: 'city',
      },
      global: { stubs: CANVAS_STUB },
    })
    await w.findComponent({ name: 'MapSidebar' }).vm.$emit('select', w.props('initialItems')[0])
    await nextTick()
    expect(w.vm.selectedKey).toBeNull()
  })

  it('타입을 바꾸면 선택이 풀린다 — 다른 목록의 키가 남아 있으면 안 된다', async () => {
    // onTypeChange 는 실제 setType→fetchNow(mocked $fetch)를 트리거한다. 전역 $fetch 목
    // (tests/setup.ts)이 빈 data:{} 를 반환해 items 가 undefined 로 바뀌는데, 실제 MapSidebar
    // 는 그 조합에서 `for (const i of props.items)` 로 크래시한다(위 "해시 반영" 테스트와 동일한
    // 함정, 그쪽과 같은 이유로 MapSidebar 를 스텁한다) — selectedKey 배선과는 무관한 크래시다.
    const w = mount(RealEstateMapExplorer, {
      props: {
        initialType: 'apt-rent',
        initialItems: [RENT_ITEM],
        initialGranularity: 'building',
      },
      global: { stubs: { ...CANVAS_STUB, MapSidebar: true } },
    })
    await w.findComponent({ name: 'MapSidebar' }).vm.$emit('select', RENT_ITEM)
    await nextTick()
    await w.findComponent({ name: 'MapFilterBar' }).vm.$emit('update:type', 'apt-sale')
    await nextTick()
    expect(w.vm.selectedKey).toBeNull()
  })

  // 줌 왕복 회귀 가드: "은마"를 선택해 카드를 펼친 채 줌아웃하면(building→dong) 목록의
  // 항목 단위 자체가 바뀐다. 이 시점에 선택을 비우지 않으면, 다시 줌인(dong→building)했을
  // 때 새로 받아온 building 목록에 같은 키("은마|1168010100")가 재등장해 클릭 없이 카드가
  // 저절로 다시 펼쳐진다 — granularity 가 실제로 바뀌는 순간(fetch 응답 반영 시점)에
  // 곧바로 선택을 지워야 이 사고를 막는다. idle→디바운스(250ms)→fetch 의 실제 경로를
  // 그대로 태워 검증한다(가짜 타이머는 여기서 async $fetch 체인과 얽혀 신뢰도가 떨어진다).
  it('건물 선택 중 granularity 가 바뀌면(줌아웃) selectedKey 가 초기화된다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      success: true,
      data: { items: [], granularity: 'dong', total: 0, exact: true },
    })
    vi.stubGlobal('$fetch', fetchMock)

    const CanvasStub = {
      template: '<div data-testid="canvas" />',
      emits: ['idle', 'select', 'hover'],
    }
    try {
      const w = mount(RealEstateMapExplorer, {
        props: { initialType: 'apt-rent', initialItems: [RENT_ITEM], initialGranularity: 'building' },
        global: { stubs: { RealEstateMapCanvas: CanvasStub } },
      })

      await w.findComponent({ name: 'MapSidebar' }).vm.$emit('select', RENT_ITEM)
      await nextTick()
      expect(w.vm.selectedKey).toBe('은마|1168010100')

      const bounds = { swLat: 33, swLng: 124, neLat: 39, neLng: 132 }
      await w.findComponent(CanvasStub).vm.$emit('idle', bounds, 7, { lat: 37.5, lng: 127.06 })
      // onMapIdle 은 fetchNow 를 250ms 디바운스한다(useRealEstateMap.ts DEBOUNCE_MS) — 실제
      // 시간을 흘려보내 그 타이머 이후의 $fetch 응답 반영까지 정직하게 기다린다.
      await new Promise((resolve) => setTimeout(resolve, 300))
      await flushPromises()

      expect(w.vm.selectedKey).toBeNull()
    } finally {
      vi.unstubAllGlobals()
      window.location.hash = ''
    }
  })
})

// 운영 실측: 모바일 첫 화면 목록에서 제주가 "—"(데스크톱 1,553만/평). 좁은 지도 뷰포트에
// 제주가 안 들어와 지도 응답에 빠진 걸 목록이 "데이터 없음"으로 그렸다.
describe('RealEstateMapExplorer — 시·도 목록은 뷰포트 밖 지역도 전국 집계 값으로 채운다', () => {
  const SEOUL = { name: '서울', district: null, dong: null, lat: 37.55, lng: 126.98, avgPricePerPyeong: 5117, transactionCount: 900 }
  const JEJU = { name: '제주', district: null, dong: null, lat: 33.38, lng: 126.55, avgPricePerPyeong: 1553, transactionCount: 40 }
  const CanvasStub = { template: '<div data-testid="canvas" />', props: ['items', 'level', 'center'], emits: ['idle', 'select', 'hover'] }

  afterEach(() => {
    vi.unstubAllGlobals()
    window.location.hash = ''
  })

  function sidebarRowText(w: ReturnType<typeof mount>, label: string): string {
    const sidebar = w.findAllComponents({ name: 'MapSidebar' })[0]
    return sidebar.findAll('[data-testid="map-sidebar-item"]').map((r) => r.text()).find((t) => t.startsWith(label)) ?? ''
  }

  it('모바일 뷰포트 응답에 제주가 없어도 목록의 제주는 — 가 아니다', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
      success: true, data: { items: [SEOUL], granularity: 'city', total: 1, exact: true },
    }))
    const w = mount(RealEstateMapExplorer, {
      props: { initialType: 'apt-sale', initialItems: [SEOUL, JEJU], initialGranularity: 'city' },
      global: { stubs: { RealEstateMapCanvas: CanvasStub } },
    })
    // 390px 폭 지도의 전국 뷰 — 제주(33.38)가 남쪽 경계 밖이다.
    await w.findComponent(CanvasStub).vm.$emit('idle', { swLat: 34.2, swLng: 125.9, neLat: 38.6, neLng: 129.7 }, 13, { lat: 36.4, lng: 127.8 })
    await new Promise((resolve) => setTimeout(resolve, 300))
    await flushPromises()

    expect(sidebarRowText(w, '제주')).toContain('1,553만/평')
    expect(sidebarRowText(w, '서울')).toContain('5,117만/평')
    // 지도 핀은 여전히 뷰포트 응답만 쓴다.
    expect(w.findComponent(CanvasStub).props('items')).toEqual([SEOUL])
  })

  it('다른 유형으로 바꾸면 그 유형의 전국 시·도 집계를 한 번 받아 채운다', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, opts: { params: { level: number; swLat: number } }) => {
      const national = opts.params.level === 13 && opts.params.swLat === 33
      return Promise.resolve({
        success: true,
        data: { items: national ? [SEOUL, { ...JEJU, avgPricePerPyeong: 900 }] : [SEOUL], granularity: 'city', total: 1, exact: true },
      })
    })
    vi.stubGlobal('$fetch', fetchMock)
    const w = mount(RealEstateMapExplorer, {
      props: { initialType: 'apt-sale', initialItems: [SEOUL, JEJU], initialGranularity: 'city' },
      global: { stubs: { RealEstateMapCanvas: CanvasStub } },
    })
    await w.findComponent({ name: 'MapFilterBar' }).vm.$emit('update:type', 'villa-sale')
    await flushPromises()

    const nationalCalls = (t: string) => fetchMock.mock.calls.filter(([url, o]) =>
      String(url).includes(`/${t}/map`) && o.params.level === 13 && o.params.swLat === 33 && o.params.neLng === 132 && o.params.prev === undefined)
    // 초기 유형은 SSR initialItems 를 재사용해 전국 호출이 없다.
    expect(nationalCalls('apt-sale')).toHaveLength(0)
    expect(nationalCalls('villa-sale')).toHaveLength(1)
    expect(sidebarRowText(w, '제주')).toContain('900만/평')

    // 같은 유형으로 시·도 단계에 다시 들어와도(지역 이동 후 복귀) 다시 받지 않는다.
    await w.findComponent(CanvasStub).vm.$emit('idle', { swLat: 34.2, swLng: 125.9, neLat: 38.6, neLng: 129.7 }, 13, { lat: 36.4, lng: 127.8 })
    await new Promise((resolve) => setTimeout(resolve, 300))
    await flushPromises()
    expect(nationalCalls('villa-sale')).toHaveLength(1)
  })

  it('첫 화면(초기 유형)은 전국 집계를 다시 요청하지 않는다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ success: true, data: { items: [SEOUL], granularity: 'city', total: 1, exact: true } })
    vi.stubGlobal('$fetch', fetchMock)
    mount(RealEstateMapExplorer, {
      props: { initialType: 'apt-sale', initialItems: [SEOUL, JEJU], initialGranularity: 'city' },
      global: { stubs: { RealEstateMapCanvas: CanvasStub } },
    })
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('전국 집계가 빈 목록(백엔드 일시 실패)이면 저장하지 않고 다음 시·도 단계 진입 때 다시 받는다', async () => {
    let nationalCount = 0
    const fetchMock = vi.fn().mockImplementation((_url: string, opts: { params: { level: number; swLat: number; prev?: string } }) => {
      const national = opts.params.prev === undefined && opts.params.level === 13 && opts.params.swLat === 33
      if (national) nationalCount += 1
      const items = national ? (nationalCount === 1 ? [] : [SEOUL, { ...JEJU, avgPricePerPyeong: 900 }]) : [SEOUL]
      return Promise.resolve({ success: true, data: { items, granularity: 'city', total: items.length, exact: true } })
    })
    vi.stubGlobal('$fetch', fetchMock)
    const w = mount(RealEstateMapExplorer, {
      props: { initialType: 'apt-sale', initialItems: [SEOUL, JEJU], initialGranularity: 'city' },
      global: { stubs: { RealEstateMapCanvas: CanvasStub } },
    })
    await w.findComponent({ name: 'MapFilterBar' }).vm.$emit('update:type', 'villa-sale')
    await flushPromises()
    expect(nationalCount).toBe(1)
    expect(sidebarRowText(w, '제주')).not.toContain('900만/평')

    // 구·군 단계로 들어갔다가 시·도 단계로 돌아오면 다시 받는다.
    fetchMock.mockImplementationOnce(() => Promise.resolve({ success: true, data: { items: [], granularity: 'district', total: 0, exact: true } }))
    await w.findComponent(CanvasStub).vm.$emit('idle', { swLat: 37, swLng: 126.5, neLat: 38, neLng: 127.5 }, 9, { lat: 37.5, lng: 127 })
    await new Promise((resolve) => setTimeout(resolve, 300))
    await flushPromises()
    await w.findComponent(CanvasStub).vm.$emit('idle', { swLat: 33, swLng: 124, neLat: 39, neLng: 132 }, 13, { lat: 36.5, lng: 127.8 })
    await new Promise((resolve) => setTimeout(resolve, 300))
    await flushPromises()
    expect(nationalCount).toBe(2)
    expect(sidebarRowText(w, '제주')).toContain('900만/평')
  })

  it('유형을 바꾼 직후 이전 유형의 값이 목록에 섞이지 않는다', async () => {
    let resolveViewport: (v: unknown) => void = () => {}
    vi.stubGlobal('$fetch', vi.fn().mockImplementation(() => new Promise((r) => { resolveViewport = r })))
    const w = mount(RealEstateMapExplorer, {
      props: { initialType: 'apt-sale', initialItems: [SEOUL, JEJU], initialGranularity: 'city' },
      global: { stubs: { RealEstateMapCanvas: CanvasStub } },
    })
    await w.findComponent({ name: 'MapFilterBar' }).vm.$emit('update:type', 'villa-sale')
    await nextTick()
    // 새 유형 응답 전: 아파트 매매 값(5,117만/평·1,553만/평)이 빌라 목록에 남아 있으면 안 된다.
    expect(sidebarRowText(w, '서울')).not.toContain('5,117만/평')
    expect(sidebarRowText(w, '제주')).not.toContain('1,553만/평')
    resolveViewport({ success: true, data: { items: [], granularity: 'city', total: 0, exact: true } })
  })
})

describe('RealEstateMapExplorer — 범례·위치 경로', () => {
  const GANGNAM: MapItem = {
    buildingName: '래미안블레스티지', city: '서울', district: '강남구', dongName: '개포동',
    bjdCode: '1168010300', lat: 37.48, lng: 127.06, latestPrice: 168340, monthlyRent: null,
    latestDealYear: 2026, latestDealMonth: 8, latestDealDay: 1, transactionCount: 812,
    jeonseDeposit: null, jeonseDealKey: null, wolseDeposit: null, wolseMonthlyRent: null, wolseDealKey: null,
  }
  const CanvasStub = { template: '<div data-testid="canvas" />', props: ['items', 'level', 'center'], emits: ['idle', 'select', 'hover'] }

  it('범례는 단지 단계에서만 보인다', () => {
    const building = mount(RealEstateMapExplorer, {
      props: { initialType: 'apt-sale', initialItems: [GANGNAM], initialGranularity: 'building' },
      global: { stubs: { RealEstateMapCanvas: CanvasStub } },
    })
    const legend = building.find('[data-testid="map-legend"]')
    expect(legend.exists()).toBe(true)
    expect(legend.text()).toContain('최근 1년 거래')
    expect(legend.text()).toContain('1년 넘은 거래·거래 없음')

    const city = mountExplorer()
    expect(city.find('[data-testid="map-legend"]').exists()).toBe(false)
  })

  it('시·도 단계 위치 경로는 "전국"', () => {
    const paths = mountExplorer().findAll('[data-testid="map-location-path"]')
    // 지도 하단 가운데 알약 한 자리 — 모바일·데스크톱 공용
    expect(paths).toHaveLength(1)
    for (const p of paths) expect(p.text()).toBe('전국')
  })

  it('단지 단계 위치 경로는 전국 › 서울 › 강남구 › 개포동, 상위 칸을 누르면 그 단계 level 로 올린다', async () => {
    const w = mount(RealEstateMapExplorer, {
      props: { initialType: 'apt-sale', initialItems: [GANGNAM], initialGranularity: 'building' },
      global: { stubs: { RealEstateMapCanvas: CanvasStub } },
    })
    const path = w.findAll('[data-testid="map-location-path"]')[0]
    expect(path.text().replace(/\s+/g, '')).toBe('전국›서울›강남구›개포동')

    const district = path.findAll('a').find((a) => a.text() === '강남구')!
    expect(district.attributes('href')).toBe('/real-estate/apt-sale/seoul/gangnam')
    await district.trigger('click')
    expect(w.findComponent(CanvasStub).props('level')).toBe(7)

    await path.findAll('a').find((a) => a.text() === '전국')!.trigger('click')
    expect(w.findComponent(CanvasStub).props('level')).toBe(13)
  })
})

// 첫 화면 = 서울 구·군 단위(운영자 결정 2026-10-27). 해시 > 저장 위치 > 서울.
describe('RealEstateMapExplorer — 첫 화면 위치와 시·도 칩', () => {
  const SEOUL_DISTRICTS: MapItem[] = [
    { name: '서울', district: '강남구', dong: null, lat: 37.5172, lng: 127.0473, avgPricePerPyeong: 6820, transactionCount: 140 },
    { name: '서울', district: '서초구', dong: null, lat: 37.4837, lng: 127.0324, avgPricePerPyeong: 6450, transactionCount: 120 },
  ]
  const CanvasStub = { template: '<div data-testid="canvas" />', props: ['items', 'level', 'center', 'type'], emits: ['idle', 'select', 'hover', 'load-error', 'loaded'] }
  const KEY = 'ilsangkit:real-estate-map:last'

  afterEach(() => {
    vi.unstubAllGlobals()
    window.location.hash = ''
  })

  function mountSeoul() {
    return mount(RealEstateMapExplorer, {
      props: { initialType: 'apt-sale', initialItems: SEOUL_DISTRICTS, initialGranularity: 'district' },
      global: { stubs: { RealEstateMapCanvas: CanvasStub } },
    })
  }

  it('해시·저장값이 없으면 서울 구·군 단위에서 시작한다(데스크톱 9, 모바일 10) — 조회는 지도 idle 에 맡긴다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ success: true, data: { items: [], granularity: 'district', total: 0, exact: true } })
    vi.stubGlobal('$fetch', fetchMock)
    stubDesktopViewport(true)
    const desktop = mountSeoul()
    await flushPromises()
    expect(desktop.findComponent(CanvasStub).props('level')).toBe(9)
    expect(desktop.findComponent(CanvasStub).props('center')).toEqual({ lat: 37.5665, lng: 126.978 })
    expect(fetchMock).not.toHaveBeenCalled()

    stubDesktopViewport(false)
    const mobile = mountSeoul()
    await flushPromises()
    expect(mobile.findComponent(CanvasStub).props('level')).toBe(10)
  })

  it('저장된 마지막 위치로 시작한다 — 유형도 바꾸되 전국 bbox 조회를 보내지 않고, 첫 조회 전엔 위치 경로를 숨긴다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ success: true, data: { items: [], granularity: 'district', total: 0, exact: true } })
    vi.stubGlobal('$fetch', fetchMock)
    window.localStorage.setItem(KEY, JSON.stringify({ type: 'villa-rent', level: 5, lat: 35.18, lng: 129.07 }))
    const w = mountSeoul()
    await flushPromises()
    const canvas = w.findComponent(CanvasStub)
    expect(canvas.props('level')).toBe(5)
    expect(canvas.props('center')).toEqual({ lat: 35.18, lng: 129.07 })
    expect(canvas.props('type')).toBe('villa-rent')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(w.find('[data-testid="map-location-path"]').exists()).toBe(false)
  })

  it('깨지거나 한국 밖인 저장값은 무시하고 서울에서 시작한다', async () => {
    stubDesktopViewport(true)
    for (const raw of ['{깨진', JSON.stringify({ type: 'apt-sale', level: 5, lat: 51.5, lng: 0 })]) {
      window.localStorage.setItem(KEY, raw)
      const w = mountSeoul()
      await flushPromises()
      expect(w.findComponent(CanvasStub).props('center')).toEqual({ lat: 37.5665, lng: 126.978 })
      expect(w.findComponent(CanvasStub).props('level')).toBe(9)
    }
  })

  it('해시가 있으면 저장값보다 우선한다', async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ type: 'villa-rent', level: 5, lat: 35.18, lng: 129.07 }))
    window.location.hash = '#level=4&lat=37.5&lng=127.05'
    const w = mountSeoul()
    await flushPromises()
    expect(w.findComponent(CanvasStub).props('center')).toEqual({ lat: 37.5, lng: 127.05 })
    expect(w.findComponent(CanvasStub).props('level')).toBe(4)
    expect(w.findComponent(CanvasStub).props('type')).toBe('apt-sale')
  })

  it('저장 위치가 SSR 과 같은 자리·같은 유형이면 위치 경로를 숨기지 않는다', async () => {
    stubDesktopViewport(true)
    window.localStorage.setItem(KEY, JSON.stringify({ type: 'apt-sale', level: 9, lat: 37.5665, lng: 126.978 }))
    const w = mountSeoul()
    await flushPromises()
    expect(w.find('[data-testid="map-location-path"]').exists()).toBe(true)
  })

  it('해시로 들어오면 유형만 바꾸고 전국 범위 조회를 보내지 않는다 — 조회는 지도 첫 idle 1회', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ success: true, data: { items: [], granularity: 'building', total: 0, exact: true } })
    vi.stubGlobal('$fetch', fetchMock)
    window.location.hash = '#type=villa-rent&level=4&lat=37.5&lng=127.05'
    const w = mountSeoul()
    await flushPromises()
    expect(w.findComponent(CanvasStub).props('type')).toBe('villa-rent')
    expect(fetchMock).not.toHaveBeenCalled()

    await w.findComponent(CanvasStub).vm.$emit('idle', { swLat: 37.49, swLng: 127.04, neLat: 37.51, neLng: 127.06 }, 4, { lat: 37.5, lng: 127.05 })
    await new Promise((resolve) => setTimeout(resolve, 300))
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1].params).toMatchObject({ level: 4, swLat: 37.49, neLng: 127.06 })
  })

  it('복원 위치로 시작했는데 지도가 못 뜨면 그때 한 번 조회한다 — 목록이 서울 것으로 남지 않게', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ success: true, data: { items: [], granularity: 'city', total: 0, exact: true } })
    vi.stubGlobal('$fetch', fetchMock)
    window.location.hash = '#type=apt-rent&level=13&lat=36.5&lng=127.8'
    const w = mountSeoul()
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
    await w.findComponent(CanvasStub).vm.$emit('load-error', 'sdk blocked')
    await flushPromises()
    const viewport = fetchMock.mock.calls.filter(([url]) => String(url).includes('/apt-rent/map'))
    expect(viewport.length).toBeGreaterThanOrEqual(1)
    expect(viewport[0][1].params.level).toBe(13)
  })

  it('시·도 칩: 전국 집계에 없는 시·도는 대표 좌표로 옮긴다 — 목록 지역과 지도가 어긋나지 않게', async () => {
    stubDesktopViewport(true)
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ success: true, data: { items: [{ name: '서울', district: null, dong: null, lat: 37.55, lng: 126.99, avgPricePerPyeong: 1, transactionCount: 1 }], granularity: 'city', total: 1, exact: true } }))
    const w = mountSeoul()
    await flushPromises()
    await w.findAll('[data-testid="map-sido-chips"]')[0].findAll('a').find((a) => a.text() === '세종')!.trigger('click')
    await flushPromises()
    expect(w.findComponent(CanvasStub).props('center')).toEqual({ lat: 36.48, lng: 127.289 })
    expect(w.findComponent(CanvasStub).props('level')).toBe(9)
  })

  it('시·도 칩: 좌표를 기다리는 동안 지도를 움직이면 늦은 응답이 그 위치를 덮어쓰지 않는다', async () => {
    stubDesktopViewport(true)
    let resolveNational: (v: unknown) => void = () => {}
    vi.stubGlobal('$fetch', vi.fn().mockImplementation((_url: string, opts: { params: { level: number; prev?: string } }) =>
      opts.params.prev === undefined
        ? new Promise((r) => { resolveNational = r })
        : Promise.resolve({ success: true, data: { items: [], granularity: 'district', total: 0, exact: true } })))
    const w = mountSeoul()
    await flushPromises()
    await w.findAll('[data-testid="map-sido-chips"]')[0].findAll('a').find((a) => a.text() === '부산')!.trigger('click')
    // 사용자가 지도를 끌어 다른 곳으로 옮긴다
    await w.findComponent(CanvasStub).vm.$emit('idle', { swLat: 37.3, swLng: 126.9, neLat: 37.4, neLng: 127.1 }, 8, { lat: 37.35, lng: 127.0 })
    resolveNational({ success: true, data: { items: [{ name: '부산', district: null, dong: null, lat: 35.15, lng: 129.06, avgPricePerPyeong: 1, transactionCount: 1 }], granularity: 'city', total: 1, exact: true } })
    await flushPromises()
    expect(w.findComponent(CanvasStub).props('center')).toEqual({ lat: 37.35, lng: 127.0 })
    expect(w.findComponent(CanvasStub).props('level')).toBe(8)
  })

  it('지도 idle 마다 마지막 위치를 저장한다', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ success: true, data: { items: [], granularity: 'district', total: 0, exact: true } }))
    const w = mountSeoul()
    await w.findComponent(CanvasStub).vm.$emit('idle', { swLat: 37, swLng: 126.5, neLat: 38, neLng: 127.5 }, 8, { lat: 37.51, lng: 127.02 })
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({ type: 'apt-sale', level: 8, lat: 37.51, lng: 127.02 })
  })

  it('목록 상단 시·도 칩: 전국 + 16개 시·도 링크가 SSR DOM 에 있고, 현재 시·도를 강조한다', () => {
    const w = mountSeoul()
    const chips = w.findAll('[data-testid="map-sido-chips"]')[0]
    const hrefs = chips.findAll('a').map((a) => a.attributes('href'))
    expect(hrefs).toHaveLength(17)
    expect(hrefs[0]).toBe('/real-estate/apt-sale')
    expect(hrefs).toContain('/real-estate/apt-sale/seoul')
    expect(hrefs).toContain('/real-estate/apt-sale/jeju')
    expect(hrefs).toContain('/real-estate/apt-sale/jeonnamgwangju')
    expect(chips.find('[aria-current="true"]').text()).toBe('서울')
    // 구·군 행도 SSR 링크로 남는다
    expect(w.html()).toContain('/real-estate/apt-sale/seoul/gangnam')
  })

  it('시·도 칩을 누르면 전국 시·도 집계의 좌표로 그 시·도의 구·군 단위로 옮긴다', async () => {
    stubDesktopViewport(true)
    const BUSAN = { name: '부산', district: null, dong: null, lat: 35.15, lng: 129.06, avgPricePerPyeong: 1790, transactionCount: 3447 }
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ success: true, data: { items: [BUSAN], granularity: 'city', total: 1, exact: true } }))
    const w = mountSeoul()
    await flushPromises()
    const busan = w.findAll('[data-testid="map-sido-chips"]')[0].findAll('a').find((a) => a.text() === '부산')!
    await busan.trigger('click')
    await flushPromises()
    expect(w.findComponent(CanvasStub).props('center')).toEqual({ lat: 35.15, lng: 129.06 })
    expect(w.findComponent(CanvasStub).props('level')).toBe(9)

    const nation = w.findAll('[data-testid="map-sido-chips"]')[0].findAll('a')[0]
    await nation.trigger('click')
    expect(w.findComponent(CanvasStub).props('level')).toBe(13)
  })
})

// 모바일(lg 미만)은 하단 시트 없이 지도가 화면을 채우고, '목록 보기'로 전체 화면 목록을 덮어 연다.
// 목록은 v-show 로만 숨긴다 — SSR HTML 에 시·도 칩·지역 링크가 그대로 남아야 한다(모바일 우선 색인).
describe('RealEstateMapExplorer — 모바일 지도/목록 전환', () => {
  afterEach(() => {
    window.location.hash = ''
  })

  const isHidden = (el: { attributes: (k: string) => string | undefined }) =>
    /display:\s*none/.test(el.attributes('style') ?? '')

  it('기본은 지도 화면이다 — 목록은 숨겨져 있지만 DOM 에 시·도 링크가 그대로 있다', () => {
    const w = mountExplorer()
    const list = w.get('[data-testid="map-mobile-list"]')
    expect(isHidden(list)).toBe(true)
    expect(list.classes()).toContain('lg:hidden')
    expect(list.html()).toContain('href="/real-estate/apt-sale/seoul"')
    expect(list.html()).toContain('data-testid="map-sido-chips"')
    expect(w.find('[data-testid="canvas"]').exists()).toBe(true)
  })

  it("'목록 보기'로 목록을 열고 '지도 보기'로 돌아온다 — 지도는 숨기지 않고 목록이 위를 덮는다", async () => {
    const w = mountExplorer()
    const open = w.get('[data-testid="map-list-open"]')
    expect(open.text()).toContain('목록 보기')
    expect(open.classes()).toContain('lg:hidden')
    expect(open.classes()).toContain('min-h-[44px]')

    await open.trigger('click')
    expect(isHidden(w.get('[data-testid="map-mobile-list"]'))).toBe(false)
    // 지도 패널은 그대로 보인다(크기 불변 → 카카오 relayout 불필요)
    expect(isHidden(w.get('.map-canvas-panel'))).toBe(false)

    const close = w.get('[data-testid="map-list-close"]')
    expect(close.text()).toContain('지도 보기')
    expect(close.classes()).toContain('min-h-[44px]')
    await close.trigger('click')
    expect(isHidden(w.get('[data-testid="map-mobile-list"]'))).toBe(true)
  })

  it('지도 화면 하단에 출처 한 줄을 항상 보인다(모바일 전용)', () => {
    const line = mountExplorer().get('[data-testid="map-source-line"]')
    expect(line.classes()).toContain('lg:hidden')
    expect(line.classes()).toContain('truncate')
    expect(line.text()).toContain('국토교통부')
    expect(line.text()).toContain('공공누리')
  })

  it('위치 경로 알약은 모바일에서도 지도 위에 보인다', () => {
    const w = mountExplorer()
    const path = w.get('[data-testid="map-location-path"]')
    const wrap = path.element.parentElement!
    expect(wrap.className).not.toMatch(/(^|\s)hidden(\s|$)/)
    expect(w.get('[data-testid="map-mobile-list"]').find('[data-testid="map-location-path"]').exists()).toBe(false)
  })

  // 접근성: 토글 상태 알림·포커스 이동·열린 동안 지도 쪽 inert·Esc 닫기.
  it("'목록 보기'는 aria-expanded·aria-controls 로 목록을 가리키고, 열면 '지도 보기'로·닫으면 '목록 보기'로 포커스가 옮겨 간다", async () => {
    const w = mountExplorer({ attachTo: document.body })
    const open = w.get('[data-testid="map-list-open"]')
    const list = w.get('[data-testid="map-mobile-list"]')
    expect(open.attributes('aria-expanded')).toBe('false')
    expect(open.attributes('aria-controls')).toBe(list.attributes('id'))
    expect(list.attributes('id')).toBeTruthy()

    await open.trigger('click')
    await flushPromises()
    expect(open.attributes('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(w.get('[data-testid="map-list-close"]').element)

    await w.get('[data-testid="map-list-close"]').trigger('click')
    await flushPromises()
    expect(open.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(open.element)
  })

  it('목록이 열린 동안 지도 쪽(필터바 제외)은 inert 이고, 처음(SSR)엔 inert 속성이 없다', async () => {
    const w = mountExplorer()
    const mapLayer = w.get('[data-testid="map-layer"]')
    const isInert = () => mapLayer.attributes('inert') !== undefined || (mapLayer.element as HTMLElement & { inert?: boolean }).inert === true
    expect(mapLayer.attributes('inert')).toBeUndefined()
    expect(mapLayer.find('[data-testid="map-list-open"]').exists()).toBe(true)
    expect(mapLayer.findComponent({ name: 'MapFilterBar' }).exists()).toBe(false)

    await w.get('[data-testid="map-list-open"]').trigger('click')
    expect(isInert()).toBe(true)
    await w.get('[data-testid="map-list-close"]').trigger('click')
    expect(isInert()).toBe(false)
  })

  it('Esc 로 목록을 닫는다', async () => {
    const w = mountExplorer()
    await w.get('[data-testid="map-list-open"]').trigger('click')
    await w.get('[data-testid="map-mobile-list"]').trigger('keydown', { key: 'Escape' })
    expect(isHidden(w.get('[data-testid="map-mobile-list"]'))).toBe(true)
  })

  it('목록 단위(granularity)가 바뀌면 목록 스크롤을 맨 위로 올린다', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
      success: true,
      data: {
        items: [{ name: '서울', district: '양천구', dong: null, lat: 37.52, lng: 126.86, avgPricePerPyeong: 5427, transactionCount: 10 }],
        granularity: 'district', total: 1, exact: true,
      },
    }))
    const CanvasStub = { template: '<div data-testid="canvas" />', emits: ['idle', 'select', 'hover'] }
    try {
      const w = mount(RealEstateMapExplorer, {
        props: { initialType: 'apt-sale', initialItems: ITEMS, initialGranularity: 'city' },
        global: { stubs: { RealEstateMapCanvas: CanvasStub } },
      })
      await w.get('[data-testid="map-list-open"]').trigger('click')
      const scroller = w.get('[data-testid="map-mobile-list"]').findComponent({ name: 'MapSidebar' }).element as HTMLElement
      scroller.scrollTop = 500
      await w.findComponent(CanvasStub).vm.$emit('idle', { swLat: 37.4, swLng: 126.8, neLat: 37.7, neLng: 127.2 }, 9, { lat: 37.55, lng: 126.98 })
      await new Promise((resolve) => setTimeout(resolve, 300))
      await flushPromises()
      expect(scroller.scrollTop).toBe(0)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('단지 행을 처음 눌러 선택해도 목록 스크롤은 그대로다 — 두 번째 탭(상세)을 위해 다시 찾지 않게', async () => {
    const w = mount(RealEstateMapExplorer, {
      props: { initialType: 'apt-sale', initialItems: BUILDING_ITEMS, initialGranularity: 'building' },
      global: { stubs: { RealEstateMapCanvas: { template: '<div data-testid="canvas" />' } } },
    })
    await w.get('[data-testid="map-list-open"]').trigger('click')
    const sidebar = w.get('[data-testid="map-mobile-list"]').findComponent({ name: 'MapSidebar' })
    const scroller = sidebar.element as HTMLElement
    scroller.scrollTop = 500
    await sidebar.vm.$emit('select', BUILDING_ITEMS[0])
    await flushPromises()
    expect(w.vm.selectedKey).not.toBeNull()
    expect(scroller.scrollTop).toBe(500)
  })

  it('시·도 칩으로 지역을 바꾸면 목록 스크롤을 맨 위로 올린다', async () => {
    const w = mountExplorer()
    await w.get('[data-testid="map-list-open"]').trigger('click')
    const sidebar = w.get('[data-testid="map-mobile-list"]').findComponent({ name: 'MapSidebar' })
    const scroller = sidebar.element as HTMLElement
    scroller.scrollTop = 500
    await sidebar.vm.$emit('select-city', null)
    await flushPromises()
    expect(scroller.scrollTop).toBe(0)
  })

  it('데스크톱으로 넓어지면 열린 목록을 닫는다 — 지도 쪽 inert 가 데스크톱에 남지 않게', async () => {
    let listener: (() => void) | null = null
    const mq = { matches: false, addEventListener: vi.fn((_: string, fn: () => void) => { listener = fn }), removeEventListener: vi.fn() }
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mq))
    try {
      const w = mountExplorer()
      await w.get('[data-testid="map-list-open"]').trigger('click')
      mq.matches = true
      listener!()
      await nextTick()
      expect(isHidden(w.get('[data-testid="map-mobile-list"]'))).toBe(true)
      expect(w.get('[data-testid="map-layer"]').attributes('inert')).toBeUndefined()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('데스크톱 사이드바(aside)는 그대로다 — 토글 상태와 무관하게 lg:flex', async () => {
    const w = mountExplorer()
    await w.get('[data-testid="map-list-open"]').trigger('click')
    const aside = w.get('aside')
    expect(aside.classes()).toEqual(expect.arrayContaining(['hidden', 'lg:flex', 'lg:w-[360px]']))
    expect(isHidden(aside)).toBe(false)
  })
})
