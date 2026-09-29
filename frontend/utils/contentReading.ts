import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'

export interface ReadingSection { id: string; depth: 2 | 3; labelHtml: string }

export function buildReadingDocument(markdown: string): { html: string; toc: ReadingSection[]; parts: [string, string?] } {
  // isomorphic-dompurify supplies its own DOM during SSR; no browser globals are needed.
  const body = DOMPurify.sanitize(marked(markdown, { async: false }), { RETURN_DOM: true })
  const idCounts = new Map<string, number>()
  for (const element of body.querySelectorAll('[id]')) {
    const id = element.getAttribute('id')!
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1)
  }
  const reserved = new Set(idCounts.keys())
  const toc: ReadingSection[] = []
  let sequence = 0
  for (const heading of body.querySelectorAll('h2, h3')) {
    let id = heading.getAttribute('id') ?? ''
    if (!id || /\s/.test(id) || idCounts.get(id) !== 1) {
      do { id = `content-section-${++sequence}` } while (reserved.has(id))
      reserved.add(id)
      heading.setAttribute('id', id)
    }
    toc.push({
      id,
      depth: heading.tagName.toLowerCase() === 'h2' ? 2 : 3,
      labelHtml: DOMPurify.sanitize(heading.innerHTML, { ALLOWED_TAGS: ['strong', 'em', 'code'], ALLOWED_ATTR: [] }),
    })
  }
  const html = body.innerHTML
  const headings = [...html.matchAll(/<h2[\s>]/gi)]
  const splitAt = headings[2]?.index
  return { html, toc, parts: splitAt === undefined ? [html] : [html.slice(0, splitAt), html.slice(splitAt)] }
}
