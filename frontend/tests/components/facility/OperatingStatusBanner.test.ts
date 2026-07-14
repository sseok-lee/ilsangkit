import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import OperatingStatusBanner from '~/components/facility/OperatingStatusBanner.vue'
import type { HospitalDetails, LibraryDetails } from '~/types/facility'

// 2026-07-15T10:00:00 (local) = Wednesday, 10:00 — pinned "today" is Wed
const PINNED_NOW = new Date('2026-07-15T10:00:00')

// 2026-07-12T10:00:00 (local) = Sunday, 10:00 — pinned "today" is Sun
const PINNED_SUNDAY = new Date('2026-07-12T10:00:00')

const allNullHours: HospitalDetails = {
  trmtMonStart: null,
  trmtMonEnd: null,
  trmtTueStart: null,
  trmtTueEnd: null,
  trmtWedStart: null,
  trmtWedEnd: null,
  trmtThuStart: null,
  trmtThuEnd: null,
  trmtFriStart: null,
  trmtFriEnd: null,
  trmtSatStart: null,
  trmtSatEnd: null,
  trmtSunStart: null,
  trmtSunEnd: null,
}

const fullWeekHoursOpenNow: HospitalDetails = {
  trmtMonStart: '0900',
  trmtMonEnd: '1800',
  trmtTueStart: '0900',
  trmtTueEnd: '1800',
  trmtWedStart: '0900',
  trmtWedEnd: '1800',
  trmtThuStart: '0900',
  trmtThuEnd: '1800',
  trmtFriStart: '0900',
  trmtFriEnd: '1800',
  trmtSatStart: '0900',
  trmtSatEnd: '1300',
  trmtSunStart: null,
  trmtSunEnd: null,
}

// Has hours on other days, but NOT on the pinned day (Wed) — hasAnyHours true, today closed
const otherDaysOnlyHours: HospitalDetails = {
  trmtMonStart: '0900',
  trmtMonEnd: '1800',
  trmtTueStart: '0900',
  trmtTueEnd: '1800',
  trmtWedStart: null,
  trmtWedEnd: null,
  trmtThuStart: '0900',
  trmtThuEnd: '1800',
  trmtFriStart: '0900',
  trmtFriEnd: '1800',
  trmtSatStart: null,
  trmtSatEnd: null,
  trmtSunStart: null,
  trmtSunEnd: null,
}

async function mountAndFlush(details: HospitalDetails) {
  const wrapper = mount(OperatingStatusBanner, {
    props: { category: 'hospital', details },
  })
  await nextTick()
  await nextTick()
  return wrapper
}

describe('OperatingStatusBanner — hospital', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(PINNED_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('모든 진료시간이 null이면 "운영시간 정보 없음"을 표시하고 "운영종료"는 표시하지 않는다', async () => {
    const wrapper = await mountAndFlush(allNullHours)
    expect(wrapper.text()).toContain('운영시간 정보 없음')
    expect(wrapper.text()).not.toContain('운영종료')
  })

  it('일주일 진료시간이 모두 있고 현재 시각이 오늘 진료시간 안이면 "운영중"을 표시한다', async () => {
    const wrapper = await mountAndFlush(fullWeekHoursOpenNow)
    expect(wrapper.text()).toContain('운영중')
    expect(wrapper.text()).not.toContain('운영시간 정보 없음')
  })

  it('다른 요일엔 진료시간이 있지만 오늘(수) 진료시간이 없으면 "운영종료"와 "오늘 휴진"을 표시한다 (정보 없음 아님)', async () => {
    const wrapper = await mountAndFlush(otherDaysOnlyHours)
    expect(wrapper.text()).toContain('운영종료')
    expect(wrapper.text()).toContain('오늘 휴진')
    expect(wrapper.text()).not.toContain('운영시간 정보 없음')
  })
})

const libraryAllNullHours: LibraryDetails = {
  weekdayOpenTime: null,
  weekdayCloseTime: null,
  saturdayOpenTime: null,
  saturdayCloseTime: null,
  holidayOpenTime: null,
  holidayCloseTime: null,
}

const libraryWeekdayHoursOpenNow: LibraryDetails = {
  weekdayOpenTime: '0900',
  weekdayCloseTime: '1800',
  saturdayOpenTime: null,
  saturdayCloseTime: null,
  holidayOpenTime: null,
  holidayCloseTime: null,
}

async function mountLibraryAndFlush(details: LibraryDetails) {
  const wrapper = mount(OperatingStatusBanner, {
    props: { category: 'library', details },
  })
  await nextTick()
  await nextTick()
  return wrapper
}

describe('OperatingStatusBanner — library', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('평일/토요일/휴관일 시간이 전부 null이면 "운영시간 정보 없음"을 표시하고 "운영종료"는 표시하지 않는다', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(PINNED_NOW)
    const wrapper = await mountLibraryAndFlush(libraryAllNullHours)
    expect(wrapper.text()).toContain('운영시간 정보 없음')
    expect(wrapper.text()).not.toContain('운영종료')
  })

  it('평일 운영시간이 있고 현재 시각이 그 안이면 "운영중"을 표시한다 (정보 없음 아님)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(PINNED_NOW)
    const wrapper = await mountLibraryAndFlush(libraryWeekdayHoursOpenNow)
    expect(wrapper.text()).toContain('운영중')
    expect(wrapper.text()).not.toContain('운영시간 정보 없음')
  })

  it('평일 운영시간은 있지만 오늘(일)이 휴관일(휴관일 시간 없음)이면 "운영종료"와 "오늘 휴관"을 표시한다 (정보 없음 아님)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(PINNED_SUNDAY)
    const wrapper = await mountLibraryAndFlush(libraryWeekdayHoursOpenNow)
    expect(wrapper.text()).toContain('운영종료')
    expect(wrapper.text()).toContain('오늘 휴관')
    expect(wrapper.text()).not.toContain('운영시간 정보 없음')
  })
})
