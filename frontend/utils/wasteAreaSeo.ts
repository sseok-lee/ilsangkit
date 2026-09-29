import { SITE_URL } from './seoConstants'

interface WasteAreaHeadInput {
  areaId: number
  title: string
  description: string
  indexEligible: boolean
  hasSchedules: boolean
  hasQuery: boolean
  sourceState?: 'ok' | 'unresolved' | 'empty' | 'error'
}

export function buildWasteAreaHead(input: WasteAreaHeadInput) {
  const indexable = input.indexEligible &&
    input.hasSchedules &&
    !input.hasQuery &&
    (!input.sourceState || input.sourceState === 'ok')

  return {
    title: `${input.title} 쓰레기 배출 안내 | 일상킷`,
    meta: [
      { name: 'description', content: input.description },
      { name: 'robots', content: indexable ? 'index, follow' : 'noindex, follow' },
    ],
    link: indexable
      ? [{ rel: 'canonical', href: `${SITE_URL}/trash/areas/${input.areaId}` }]
      : [],
  }
}
