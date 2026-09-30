// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildReadingDocument } from '~/utils/contentReading'

describe('content reading document (SSR)', () => {
  it('builds deterministic unique headings and preserves the complete body across the ad split', () => {
    const markdown = '## 이용 **안내**\n본문A\n### 세부 `안내`\n본문B\n## 이용 **안내**\n본문C\n## 출처\n본문D'
    const result = buildReadingDocument(markdown)
    expect(result.toc).toHaveLength(4)
    expect(new Set(result.toc.map(item => item.id)).size).toBe(4)
    expect(result.toc.map(item => item.depth)).toEqual([2, 3, 2, 2])
    expect(result.toc[0].labelHtml).toBe('이용 <strong>안내</strong>')
    expect(result.parts.join('')).toBe(result.html)
    expect(result.parts[1]).toMatch(/^<h2[^>]*>출처/)
    expect(buildReadingDocument(markdown)).toEqual(result)
  })
  it('preserves unique existing IDs and avoids every existing ID in the document', () => {
    const result = buildReadingDocument('<p id="content-section-1">소개</p><h2 id="original">안내</h2><h2 id="duplicate">둘</h2><h2 id="duplicate">셋</h2><h3>넷</h3>')
    expect(result.toc[0].id).toBe('original')
    expect(result.toc.some(item => item.id === 'content-section-1')).toBe(false)
    expect(new Set(result.toc.map(item => item.id)).size).toBe(4)
    for (const item of result.toc) expect(result.html).toContain(`id="${item.id}"`)
  })
  it('keeps entities and safe inline labels without nested links or active markup', () => {
    const result = buildReadingDocument('## <a href="javascript:alert(1)">링크</a> &amp; <em onclick="alert(1)">강조</em>\n<img src=x onerror=alert(1)>\n<script>alert(1)</script>')
    expect(result.toc[0].labelHtml).toBe('링크 &amp; <em>강조</em>')
    expect(result.html).not.toMatch(/onerror|onclick|javascript:|<script/)
    expect(result.parts.join('')).toBe(result.html)
  })
  it('does not invent a table of contents or extra body part', () => {
    expect(buildReadingDocument('본문만').toc).toEqual([])
    expect(buildReadingDocument('')).toEqual({ html: '', toc: [], parts: [''] })
    for (const body of ['## 하나\n본문', '### 세부만\n본문', '## 하나\n## 둘']) {
      expect(buildReadingDocument(body).parts).toHaveLength(1)
    }
  })
})
