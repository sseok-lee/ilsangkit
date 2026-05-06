import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (path.includes('node_modules') || path.includes('/.nuxt/')) return []
    return statSync(path).isDirectory() ? listFiles(path) : [path]
  })
}

function extractMaterialIconNames(source: string): string[] {
  const iconNames = new Set<string>()
  const spanPattern = /<span\b(?=[^>]*\bmaterial-symbols-outlined\b)[^>]*>([^<{]+)<\/span>/g
  for (const match of source.matchAll(spanPattern)) {
    const iconName = match[1].trim()
    if (/^[a-z0-9_]+$/.test(iconName)) iconNames.add(iconName)
  }
  return [...iconNames]
}

describe('Material Symbols subset', () => {
  it('includes every static material icon name used by Vue templates', () => {
    const frontendRoot = resolve(__dirname, '../..')
    const nuxtConfig = readFileSync(join(frontendRoot, 'nuxt.config.ts'), 'utf-8')
    const iconNamesMatch = nuxtConfig.match(/icon_names=([^'&]+)&display=swap/)
    expect(iconNamesMatch).not.toBeNull()

    const loadedIconNames = new Set((iconNamesMatch?.[1] ?? '').split(','))
    const usedIconNames = listFiles(frontendRoot)
      .filter((path) => path.endsWith('.vue'))
      .flatMap((path) => extractMaterialIconNames(readFileSync(path, 'utf-8')))

    const missingIconNames = [...new Set(usedIconNames)]
      .filter((iconName) => !loadedIconNames.has(iconName))
      .sort()

    expect(missingIconNames).toEqual([])
  })
})
