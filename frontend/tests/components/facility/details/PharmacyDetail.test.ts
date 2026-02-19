import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PharmacyDetail from '~/components/facility/details/PharmacyDetail.vue'
import DetailRow from '~/components/facility/DetailRow.vue'
import type { PharmacyDetails } from '~/types/facility'

describe('PharmacyDetail', () => {
  it('모든 필드가 있을 때 올바르게 렌더링', () => {
    const details: PharmacyDetails = {
      phone: '02-9876-5432',
      dutyTel3: '02-1111-2222',
      dutyTime1s: '0900',
      dutyTime1c: '1800',
      dutyTime6s: '0900',
      dutyTime6c: '1300',
    }

    const wrapper = mount(PharmacyDetail, {
      props: { details },
      global: {
        components: { DetailRow },
      },
    })

    expect(wrapper.text()).toContain('02-9876-5432')
    expect(wrapper.text()).toContain('02-1111-2222')
    expect(wrapper.text()).toContain('월요일')
    expect(wrapper.text()).toContain('토요일')
  })

  it('null/undefined 필드는 렌더링하지 않음', () => {
    const details: PharmacyDetails = {
      phone: '02-9876-5432',
      dutyTel3: null,
      dutyTime1s: null,
      dutyTime1c: null,
    }

    const wrapper = mount(PharmacyDetail, {
      props: { details },
      global: {
        components: { DetailRow },
      },
    })

    expect(wrapper.text()).toContain('02-9876-5432')
    expect(wrapper.text()).not.toContain('응급전화')
    expect(wrapper.text()).not.toContain('운영시간')
  })

  it('운영시간 포맷팅 확인', () => {
    const details: PharmacyDetails = {
      dutyTime1s: '0900',
      dutyTime1c: '1800',
      dutyTime2s: '0830',
      dutyTime2c: '2000',
    }

    const wrapper = mount(PharmacyDetail, {
      props: { details },
      global: {
        components: { DetailRow },
      },
    })

    expect(wrapper.text()).toContain('09:00 ~ 18:00')
    expect(wrapper.text()).toContain('08:30 ~ 20:00')
  })
})
