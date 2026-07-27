import { describe, it, expect } from 'vitest'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { generateRssXml } from '../../server/utils/rss'

describe('generateRssXml', () => {
  const channelInfo = {
    title: '일상킷 - 생활 가이드',
    link: 'https://ilsangkit.co.kr/guide',
    description: '부동산 실거래가와 생활시설 정보를 제공하는 일상킷의 생활 가이드',
    selfUrl: 'https://ilsangkit.co.kr/rss.xml',
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

  it('selfUrl로 전달한 가이드 피드 URL을 atom:link self href로 사용해야 한다', () => {
    const xml = generateRssXml([], channelInfo)
    expect(xml).toContain('<atom:link href="https://ilsangkit.co.kr/rss.xml" rel="self" type="application/rss+xml" />')
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

// 어드민 PATCH 는 title/summary 에 길이 제한만 걸고(schemas/admin.ts), 전역 sanitize 미들웨어는
// /api/admin 경로를 명시적으로 제외한다(middlewares/security.ts). 즉 특수문자는 직렬화 시점까지
// 걸러지지 않은 채 도달할 수 있으므로, 여기서 well-formedness 와 값 보존을 함께 고정한다.
describe('generateRssXml — XML 하드닝', () => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    processEntities: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
  })

  // XMLValidator 는 문자데이터 안의 `]]>` 를 통과시킨다(엄격한 파서는 거부).
  // 따라서 well-formedness 검사만으로는 부족하고, 파싱 후 원문 복원까지 확인해야 한다.
  function parseFeed(xml: string) {
    const verdict = XMLValidator.validate(xml)
    expect(verdict, `well-formed 하지 않은 XML: ${JSON.stringify(verdict)}`).toBe(true)
    return parser.parse(xml)
  }

  const HOSTILE = [
    ['앰퍼샌드', '주차장 & 화장실'],
    ['꺾쇠', '<script>alert(1)</script>'],
    ['큰따옴표', '그는 "안녕"이라고 말했다'],
    ['작은따옴표', "오늘's 이슈"],
    ['CDATA 종료 시퀀스', 'a]]>b'],
    ['혼합', `<a href="x">A & B</a> ]]> 'q'`],
  ] as const

  const baseChannel = {
    title: '일상킷 - 생활 가이드',
    link: 'https://ilsangkit.co.kr/guide',
    description: '일상킷의 생활 가이드',
    selfUrl: 'https://ilsangkit.co.kr/rss.xml',
  }

  const baseItem = {
    title: '제목',
    link: 'https://ilsangkit.co.kr/guide/test',
    description: '설명',
    pubDate: '2026-07-05T14:55:02.000Z',
  }

  describe.each(HOSTILE)('%s: %j', (_label, payload) => {
    it('item.title 이 원문 그대로 복원되어야 한다', () => {
      const xml = generateRssXml([{ ...baseItem, title: payload }], baseChannel)
      expect(parseFeed(xml).rss.channel.item.title).toBe(payload)
    })

    it('item.description 이 원문 그대로 복원되어야 한다', () => {
      const xml = generateRssXml([{ ...baseItem, description: payload }], baseChannel)
      expect(parseFeed(xml).rss.channel.item.description).toBe(payload)
    })

    it('item.link 와 guid 가 원문 그대로 복원되어야 한다', () => {
      const link = `https://ilsangkit.co.kr/guide/test?q=${payload}`
      const xml = generateRssXml([{ ...baseItem, link }], baseChannel)
      const item = parseFeed(xml).rss.channel.item
      expect(item.link).toBe(link)
      expect(item.guid['#text']).toBe(link)
    })

    it('channel.title / description / link 가 원문 그대로 복원되어야 한다', () => {
      const xml = generateRssXml([], {
        ...baseChannel,
        title: payload,
        description: payload,
        link: `https://ilsangkit.co.kr/guide?q=${payload}`,
      })
      const channel = parseFeed(xml).rss.channel
      expect(channel.title).toBe(payload)
      expect(channel.description).toBe(payload)
      expect(channel.link).toBe(`https://ilsangkit.co.kr/guide?q=${payload}`)
    })

    it('selfUrl 이 atom:link href 속성에서 원문 그대로 복원되어야 한다', () => {
      const selfUrl = `https://ilsangkit.co.kr/rss.xml?q=${payload}`
      const xml = generateRssXml([], { ...baseChannel, selfUrl })
      expect(parseFeed(xml).rss.channel['atom:link']['@_href']).toBe(selfUrl)
    })
  })

  it('XML 1.0 이 금지하는 제어문자는 제거되어야 한다', () => {
    const xml = generateRssXml(
      [{ ...baseItem, title: '수직탭\x0B과 널\x00과 벨\x07' }],
      baseChannel,
    )
    expect(parseFeed(xml).rss.channel.item.title).toBe('수직탭과 널과 벨')
  })

  it('파싱 불가능한 pubDate 는 Invalid Date 를 출력하지 않고 pubDate 를 생략해야 한다', () => {
    const xml = generateRssXml([{ ...baseItem, pubDate: 'not-a-date' }], baseChannel)
    expect(xml).not.toContain('Invalid Date')
    const item = parseFeed(xml).rss.channel.item
    expect(item.pubDate).toBeUndefined()
    expect(item.title).toBe('제목')
  })

  it('빈 문자열 pubDate 도 동일하게 생략해야 한다', () => {
    const xml = generateRssXml([{ ...baseItem, pubDate: '' }], baseChannel)
    expect(xml).not.toContain('Invalid Date')
    expect(parseFeed(xml).rss.channel.item.pubDate).toBeUndefined()
  })

  it('정상 pubDate 는 RFC 822 형식으로 유지되어야 한다', () => {
    const xml = generateRssXml([baseItem], baseChannel)
    expect(parseFeed(xml).rss.channel.item.pubDate).toBe('Sun, 05 Jul 2026 14:55:02 GMT')
  })
})
