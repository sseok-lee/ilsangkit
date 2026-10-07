import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@vue/compiler-sfc'
import { parse as parseTemplate, type ElementNode, type TemplateChildNode } from '@vue/compiler-dom'
import { describe, expect, it } from 'vitest'

// These are the approved revenue slots, including conditionally rendered slots.
// Adding affiliate inventory must never remove existing AdSense inventory.
const pages: [string, number][] = [
  ['pages/[category]/[id].vue', 4],
  ['pages/subway/[slug].vue', 2],
  ['pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue', 4],
  ['pages/real-estate/land/[city]/[district]/[dong].vue', 3],
  ['pages/subscription/[id].vue', 4],
  ['pages/auction/item/[cltrMngNo].vue', 4],
  ['pages/index.vue', 2],
  ['pages/search.vue', 1],
  ['pages/[category]/index.vue', 2],
  ['pages/subway/index.vue', 2],
  ['pages/real-estate/[realEstateType]/index.vue', 2],
  ['pages/real-estate/[realEstateType]/[city]/[district]/index.vue', 2],
  ['pages/subscription/index.vue', 1],
  ['components/subscription/SubscriptionListView.vue', 2],
  ['pages/auction/list.vue', 1],
  ['pages/auction/index.vue', 1],
  ['pages/auction/ranking.vue', 1],
  ['pages/real-estate/land/index.vue', 1],
  ['pages/[city]/index.vue', 1],
  ['pages/[city]/[district]/index.vue', 2],
  ['pages/[city]/[district]/[category].vue', 1],
  ['pages/real-estate/[realEstateType]/[city]/index.vue', 1],
  ['pages/real-estate/land/[city]/index.vue', 1],
  ['pages/real-estate/land/[city]/[district]/index.vue', 1],
  ['pages/auction/[city]/index.vue', 1],
  ['pages/auction/[city]/[district]/index.vue', 1],
  ['pages/article/[slug].vue', 2],
  ['pages/guide/[slug].vue', 2],
  ['pages/article/index.vue', 1],
  ['pages/guide/index.vue', 1],
  ['pages/trash/[id].vue', 2],
  ['pages/trash/areas/[areaId].vue', 2],
]

function elements(file: string): ElementNode[] {
  const { descriptor } = parse(readFileSync(resolve(file), 'utf8'))
  const result: ElementNode[] = []
  function visit(nodes: TemplateChildNode[]) {
    for (const node of nodes) {
      if (node.type !== 1) continue
      result.push(node)
      visit(node.children)
    }
  }
  visit(parseTemplate(descriptor.template?.content ?? '').children)
  return result
}

function attribute(node: ElementNode, name: string) {
  const prop = node.props.find(prop => prop.type === 6 && prop.name === name)
  return prop?.type === 6 ? prop.value?.content : undefined
}

describe('approved mobile affiliate placement inventory', () => {
  it.each(pages)('%s adds one affiliate slot and preserves %i AdSense slots', (file, adsenseCount) => {
    const nodes = elements(file)
    expect(nodes.filter(node => node.tag === 'AdBanner')).toHaveLength(adsenseCount)
    expect(nodes.filter(node => node.tag === 'AffiliateBanner')).toHaveLength(1)
  })

  it.each([
    ['pages/real-estate/index.vue', 0],
    ['pages/facilities.vue', 0],
    ['pages/faq.vue', 1],
    ['pages/privacy.vue', 0],
    ['pages/terms.vue', 0],
    ['pages/contact.vue', 0],
  ] as const)('%s keeps its existing inventory without adding affiliate ads', (file, count) => {
    const nodes = elements(file)
    expect(nodes.filter(node => node.tag === 'AdBanner')).toHaveLength(count)
    expect(nodes.filter(node => node.tag === 'AffiliateBanner')).toHaveLength(0)
  })

  it.each([
    ['pages/search.vue', 'hasSuccessfulResults'],
    ['components/subscription/SubscriptionListView.vue', 'showAds'],
    ['pages/[city]/[district]/[category].vue', 'showRegionAd'],
  ])('%s gates its added inventory with the existing content condition', (file, condition) => {
    const affiliate = elements(file).find(node => node.tag === 'AffiliateBanner')
    const guard = affiliate?.props.find(prop => prop.type === 7 && prop.name === 'if')
    expect(guard?.type === 7 ? guard.exp?.loc.source : undefined).toBe(condition)
  })

  it.each([
    ['pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue', 'order-10'],
    ['pages/real-estate/land/[city]/[district]/[dong].vue', 'order-6'],
    ['pages/subscription/[id].vue', 'order-8'],
  ])('%s places the additional slot in the approved mobile flex order', (file, order) => {
    const affiliate = elements(file).find(node => node.tag === 'AffiliateBanner')
    expect(affiliate && attribute(affiliate, 'class')?.split(/\s+/)).toContain(order)
  })
})
