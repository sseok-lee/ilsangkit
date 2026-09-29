import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(
  resolve(__dirname, '../../pages/subscription/index.vue'),
  'utf8',
)

describe('subscription hub page contract', () => {
  it('awaits the hub composable for SSR and reuses Task 5 subscription components', () => {
    expect(page).toContain('await useSubscriptionHub()')
    expect(page).toContain('<SubscriptionNav')
    expect(page).toContain('<SubscriptionNoticeRow')
    expect(page).not.toContain('getUpcomingSubscriptions')
    expect(page).not.toContain('subscription-upcoming')
    expect(page).not.toContain('subscription-ongoing')
  })

  it('renders the required page order with exactly one hub ad slot', () => {
    const order = [
      'hub-hero',
      'SubscriptionNav',
      'ongoing-panels',
      '<AdBanner',
      'upcoming-panel',
      'type-guide',
      'hub-faq',
      'data-source',
    ]
    const positions = order.map(token => page.indexOf(token))
    expect(positions.every(position => position >= 0)).toBe(true)
    expect([...page.matchAll(/<AdBanner/g)]).toHaveLength(1)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('enables explicit category labels for upcoming rows and offers separate sale/rent upcoming links', () => {
    expect(page).toMatch(/<SubscriptionNoticeRow[\s\S]*show-category/)
    expect(page).toContain('분양 예정 더보기')
    expect(page).toContain('분양 예정 보기')
    expect(page).toContain('임대 예정 보기')
    expect(page).toContain('/subscription/sale?status=upcoming')
    expect(page).toContain('/subscription/rent?status=upcoming')
  })

  it('uses the fixed FAQ copy for both visible FAQ and schema', () => {
    expect(page).toContain('청약 신청은 어디에서 하나요?')
    expect(page).toContain('일정 확인 필요는 무슨 뜻인가요?')
    expect(page).toContain('지역을 선택하면 공급수도 달라지나요?')
    expect(page).toMatch(/setFAQSchema\(faqs\.map/)
    expect(page).not.toContain('청약통장 없이도 신청 가능합니다')
  })

  it('keeps the visual spec tokens for the hub title and controls', () => {
    expect(page).toContain('청약·임대, 신청할 공고부터.')
    expect(page).toContain('font-size: 36px')
    expect(page).toContain('font-size: 27px')
    expect(page).toContain('min-height: 44px')
    expect(page).toContain('#2450dc')
    expect(page).toContain('#15213b')
    expect(page).toContain('#e6e9f0')
  })
})
