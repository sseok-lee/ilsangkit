import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getBuildingInfo } from '../../src/services/realEstateService.js'
import prisma from '../../src/lib/prisma.js'

describe('getBuildingInfo dongName', () => {
  const fixtureBjd = '99999'
  const fixtureBuilding = '테스트단지A'

  beforeAll(async () => {
    await prisma.aptSaleTransaction.deleteMany({ where: { bjdCode: fixtureBjd } })
    await prisma.aptSaleTransaction.createMany({
      data: [
        {
          bjdCode: fixtureBjd,
          buildingName: fixtureBuilding,
          dongName: '동A',
          city: '테스트시',
          district: '테스트구',
          dealAmount: 10000n,
          dealYear: 2026,
          dealMonth: 5,
          dealDay: 1,
          exclusiveArea: 60,
          floor: 3,
          buildYear: 1996,
          sourceId: 'fx-dong-1',
        },
        {
          bjdCode: fixtureBjd,
          buildingName: fixtureBuilding,
          dongName: '동A',
          city: '테스트시',
          district: '테스트구',
          dealAmount: 10500n,
          dealYear: 2026,
          dealMonth: 5,
          dealDay: 2,
          exclusiveArea: 60,
          floor: 3,
          buildYear: 1996,
          sourceId: 'fx-dong-2',
        },
        {
          bjdCode: fixtureBjd,
          buildingName: fixtureBuilding,
          dongName: '동A',
          city: '테스트시',
          district: '테스트구',
          dealAmount: 11000n,
          dealYear: 2026,
          dealMonth: 5,
          dealDay: 3,
          exclusiveArea: 60,
          floor: 3,
          buildYear: 1996,
          sourceId: 'fx-dong-3',
        },
        {
          bjdCode: fixtureBjd,
          buildingName: fixtureBuilding,
          dongName: '동B',
          city: '테스트시',
          district: '테스트구',
          dealAmount: 9500n,
          dealYear: 2026,
          dealMonth: 5,
          dealDay: 4,
          exclusiveArea: 60,
          floor: 3,
          buildYear: 1996,
          sourceId: 'fx-dong-4',
        },
      ],
    })
  })

  afterAll(async () => {
    await prisma.aptSaleTransaction.deleteMany({ where: { bjdCode: fixtureBjd } })
  })

  it('returns dongName with the highest transaction count for the building', async () => {
    const info = await getBuildingInfo('apt-sale', fixtureBjd, fixtureBuilding)
    expect(info).toBeTruthy()
    expect(info?.dongName).toBe('동A')
  })

  it('returns dongName=null when no transactions exist', async () => {
    const info = await getBuildingInfo('apt-sale', fixtureBjd, '존재하지않는단지')
    expect(info?.dongName ?? null).toBeNull()
  })
})
