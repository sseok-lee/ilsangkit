import { describe, it, expect } from 'vitest'
import { generateRssXml } from '../../server/utils/rss'

describe('generateRssXml', () => {
  const channelInfo = {
    title: '일상킷 - 생활 가이드',
    link: 'https://ilsangkit.co.kr/guide',
    description: '부동산 실거래가와 생활시설 정보를 제공하는 일상킷의 생활 가이드',
  }

  it('유효한 RSS 2.0 구조를 반환해야 한다', () => {
    const xml = generateRssXml([], channelInfo)
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
  })

  it('<rss version="2.0"> 태그를 포함해야 한다', () => {
    const xml = generateRssXml([], channelInfo)
    expect(xml).toContain('<rss version="2.0"')
  })

  it('atom:link self 참조를 포함해야 한다', () => {
    const xml = generateRssXml([], channelInfo)
    expect(xml).toContain('xmlns:atom=')
    expect(xml).toContain('rel="self"')
  })

  it('lastBuildDate를 포함해야 한다', () => {
    const xml = generateRssXml([], channelInfo)
    expect(xml).toContain('<lastBuildDate>')
  })

  it('item에 guid를 포함해야 한다', () => {
    const items = [{
      title: '테스트', link: 'https://ilsangkit.co.kr/guide/test',
      description: '설명', pubDate: '2024-01-01T00:00:00Z',
    }]
    const xml = generateRssXml(items, channelInfo)
    expect(xml).toContain('<guid isPermaLink="true">')
  })

  it('<channel> 태그를 포함해야 한다', () => {
    const xml = generateRssXml([], channelInfo)
    expect(xml).toContain('<channel>')
    expect(xml).toContain('</channel>')
  })

  it('<title> 태그를 포함해야 한다', () => {
    const xml = generateRssXml([], channelInfo)
    expect(xml).toContain('<title>일상킷 - 생활 가이드</title>')
  })

  it('<link> 태그를 포함해야 한다', () => {
    const xml = generateRssXml([], channelInfo)
    expect(xml).toContain('<link>https://ilsangkit.co.kr/guide</link>')
  })

  it('items가 있을 때 <item> 에 <title>, <link>, <pubDate>가 포함되어야 한다', () => {
    const items = [
      {
        title: '아파트 실거래가 조회 방법',
        link: 'https://ilsangkit.co.kr/guide/apt-real-price',
        description: '아파트 실거래가를 쉽게 조회하는 방법을 알아보세요.',
        pubDate: '2024-01-15T00:00:00.000Z',
      },
    ]
    const xml = generateRssXml(items, channelInfo)
    expect(xml).toContain('<item>')
    expect(xml).toContain('아파트 실거래가 조회 방법')
    expect(xml).toContain('<link>https://ilsangkit.co.kr/guide/apt-real-price</link>')
    expect(xml).toContain('<pubDate>')
  })

  it('items가 비어있어도 유효한 XML을 반환해야 한다', () => {
    const xml = generateRssXml([], channelInfo)
    expect(xml).toContain('<rss version="2.0"')
    expect(xml).toContain('</rss>')
    expect(xml).not.toContain('<item>')
  })

  it('<language>ko</language> 태그를 포함해야 한다', () => {
    const xml = generateRssXml([], channelInfo)
    expect(xml).toContain('<language>ko</language>')
  })
})
