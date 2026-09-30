import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AreaDetail } from '~/types/wasteArea'

const contractPath = resolve(
  process.cwd(),
  '../backend/__tests__/fixtures/waste-area-api-contract.json'
)
const contract = JSON.parse(readFileSync(contractPath, 'utf8')) as {
  areaDetail: { success: boolean; data: AreaDetail }
}

describe('waste area API contract fixture', () => {
  it('tracks predecessor/successor links as backend { name, href } objects', () => {
    const link = contract.areaDetail.data.predecessorOrSuccessorLinks[0]

    expect(link).toEqual({ name: '계약2동', href: '/trash/areas/102' })
    expect(link).not.toHaveProperty('label')
  })
})
