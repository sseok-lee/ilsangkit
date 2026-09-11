import { rmSync } from 'node:fs'

// Prerendered HTML and hashed assets must always come from the same build.
for (const directory of ['.nuxt/seo-fixture', '.output/seo-fixture']) {
  rmSync(new URL(`../../../${directory}/`, import.meta.url), { recursive: true, force: true })
}
