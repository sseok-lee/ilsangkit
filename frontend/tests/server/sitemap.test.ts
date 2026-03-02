import { describe, it, expect } from 'vitest'
import { generateSitemapXml } from '../../server/utils/sitemap'

describe('generateSitemapXml with images', () => {
  it('image 필드 없을 때 기존 동작과 동일 (하위 호환)', () => {
    const urls = [
      { loc: 'https://ilsangkit.co.kr/toilet', changefreq: 'daily' as const, priority: 0.8 },
    ]
    const xml = generateSitemapXml(urls)
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/toilet</loc>')
    expect(xml).toContain('<changefreq>daily</changefreq>')
    expect(xml).toContain('<priority>0.8</priority>')
    expect(xml).not.toContain('<image:image>')
  })

  it('xmlns:image 네임스페이스가 urlset에 추가됨', () => {
    const urls = [
      {
        loc: 'https://ilsangkit.co.kr/hospital/1',
        image: {
          loc: 'https://ilsangkit.co.kr/images/hospital.jpg',
          title: '병원 이미지',
        },
      },
    ]
    const xml = generateSitemapXml(urls)
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"')
  })

  it('image.loc이 <image:image> 태그로 직렬화됨', () => {
    const urls = [
      {
        loc: 'https://ilsangkit.co.kr/hospital/1',
        image: {
          loc: 'https://ilsangkit.co.kr/images/hospital.jpg',
        },
      },
    ]
    const xml = generateSitemapXml(urls)
    expect(xml).toContain('<image:image>')
    expect(xml).toContain('<image:loc>https://ilsangkit.co.kr/images/hospital.jpg</image:loc>')
    expect(xml).toContain('</image:image>')
  })

  it('image.title이 선택적으로 포함됨', () => {
    const urls = [
      {
        loc: 'https://ilsangkit.co.kr/hospital/1',
        image: {
          loc: 'https://ilsangkit.co.kr/images/hospital.jpg',
          title: '서울 병원',
        },
      },
    ]
    const xml = generateSitemapXml(urls)
    expect(xml).toContain('<image:title>서울 병원</image:title>')
  })

  it('image.caption이 선택적으로 포함됨', () => {
    const urls = [
      {
        loc: 'https://ilsangkit.co.kr/hospital/1',
        image: {
          loc: 'https://ilsangkit.co.kr/images/hospital.jpg',
          title: '서울 병원',
          caption: '서울시 강남구 병원 외관',
        },
      },
    ]
    const xml = generateSitemapXml(urls)
    expect(xml).toContain('<image:caption>서울시 강남구 병원 외관</image:caption>')
  })

  it('image 없는 URL과 있는 URL 혼합 시 각각 올바르게 처리', () => {
    const urls = [
      { loc: 'https://ilsangkit.co.kr/', priority: 1.0 },
      {
        loc: 'https://ilsangkit.co.kr/hospital/1',
        image: {
          loc: 'https://ilsangkit.co.kr/images/hospital.jpg',
          title: '병원',
        },
      },
    ]
    const xml = generateSitemapXml(urls)
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/</loc>')
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/hospital/1</loc>')
    expect(xml).toContain('<image:image>')
    // 첫 번째 URL 블록에는 image 태그 없어야 함
    const firstUrlBlock = xml.split('<url>')[1].split('</url>')[0]
    expect(firstUrlBlock).not.toContain('<image:image>')
  })

  it('image 필드의 특수문자가 XML 이스케이프됨', () => {
    const urls = [
      {
        loc: 'https://ilsangkit.co.kr/hospital/1',
        image: {
          loc: 'https://ilsangkit.co.kr/images/hospital.jpg',
          title: '병원 & 클리닉 <테스트>',
          caption: '"캡션" & \'설명\'',
        },
      },
    ]
    const xml = generateSitemapXml(urls)
    expect(xml).toContain('병원 &amp; 클리닉 &lt;테스트&gt;')
    expect(xml).toContain('&quot;캡션&quot; &amp; &apos;설명&apos;')
  })
})
