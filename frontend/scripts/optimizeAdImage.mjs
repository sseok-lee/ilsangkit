#!/usr/bin/env node
/* eslint-disable no-console -- CLI 스크립트: 진행 로그를 stdout/stderr로 출력 */
// 외부 광고 이미지(쿠팡 파트너스 배너 등)를 webp로 사전 변환해 /public/ads 에 저장한다.
//
// 배경: Cafe24 운영 서버 CPU가 sharp(0.33+)의 x86-64-v2 prebuilt 바이너리를 지원하지 않아
// 런타임 IPX(NuxtImg)가 500을 낸다. 그래서 광고 이미지는 빌드 타임(로컬)에 미리 webp로 변환해
// sharp 의존 없는 정적 <img>로 서빙한다. 배너가 바뀌면 이 스크립트로 재생성 후 커밋한다.
//
// 사용법:
//   node scripts/optimizeAdImage.mjs <source-url|local-path> <output-name> [--size=1000] [--quality=80]
// 예:
//   node scripts/optimizeAdImage.mjs \
//     https://image1.coupangcdn.com/.../banner.png coupang-samsung-festival
//   → public/ads/coupang-samsung-festival.webp

import sharp from 'sharp'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../public/ads')

function parseArgs(argv) {
  const positional = []
  const opts = { size: 1000, quality: 80 }
  for (const a of argv) {
    const m = a.match(/^--(size|quality)=(\d+)$/)
    if (m) opts[m[1]] = Number(m[2])
    else positional.push(a)
  }
  return { source: positional[0], name: positional[1], ...opts }
}

async function loadSource(source) {
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source)
    if (!res.ok) throw new Error(`fetch failed: ${res.status} ${source}`)
    return Buffer.from(await res.arrayBuffer())
  }
  return readFile(resolve(source))
}

async function main() {
  const { source, name, size, quality } = parseArgs(process.argv.slice(2))
  if (!source || !name) {
    console.error('usage: node scripts/optimizeAdImage.mjs <source-url|path> <output-name> [--size=1000] [--quality=80]')
    process.exit(1)
  }
  const input = await loadSource(source)
  await mkdir(OUT_DIR, { recursive: true })
  const outPath = resolve(OUT_DIR, `${name}.webp`)
  const data = await sharp(input)
    .resize(size, size, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer()
  await writeFile(outPath, data)
  console.info(`✓ ${outPath} (${input.length} → ${data.length} bytes)`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
