/**
 * Pinia SSR hydration bug patch
 *
 * Pinia 2.3.x의 shouldHydrate 함수가 Object.create(null)로 생성된 객체에서
 * obj.hasOwnProperty()를 직접 호출하여 SSR 에러 페이지 렌더링 시 크래시 발생.
 * Object.prototype.hasOwnProperty.call()로 패치하여 해결.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'node_modules', 'pinia', 'dist')

if (!existsSync(distDir)) {
  console.log('[patch-pinia] pinia not installed yet, skipping')
  process.exit(0)
}

const files = [
  'pinia.prod.cjs',
  'pinia.cjs',
  'pinia.mjs',
  'pinia.iife.js',
  'pinia.esm-browser.js',
]

const oldPattern = '!obj.hasOwnProperty(skipHydrateSymbol)'
const newPattern = '!Object.prototype.hasOwnProperty.call(obj, skipHydrateSymbol)'

let patched = 0
for (const file of files) {
  const filePath = join(distDir, file)
  if (!existsSync(filePath)) continue

  const content = readFileSync(filePath, 'utf-8')
  if (content.includes(oldPattern)) {
    writeFileSync(filePath, content.replaceAll(oldPattern, newPattern))
    patched++
  }
}

if (patched > 0) {
  console.log(`[patch-pinia] Patched ${patched} file(s)`)
} else {
  console.log('[patch-pinia] Already patched or not needed')
}
