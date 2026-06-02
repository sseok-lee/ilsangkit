import { describe, it, expect } from 'vitest'
import { computeAreaNoindex } from '~/utils/areaNoindex'

describe('computeAreaNoindex', () => {
  it('비-trash: summary.count 0이면 noindex', () => {
    expect(computeAreaNoindex({ isTrash: false, summaryCount: 0, wasteEmpty: false, page: 1 })).toBe(true)
  })
  it('비-trash: summary.count>0이면 indexable', () => {
    expect(computeAreaNoindex({ isTrash: false, summaryCount: 12, wasteEmpty: false, page: 1 })).toBe(false)
  })
  it('비-trash: summary 미확보(undefined)면 indexable(보수적)', () => {
    expect(computeAreaNoindex({ isTrash: false, summaryCount: undefined, wasteEmpty: false, page: 1 })).toBe(false)
  })
  it('page>1이면 항상 noindex', () => {
    expect(computeAreaNoindex({ isTrash: false, summaryCount: 12, wasteEmpty: false, page: 2 })).toBe(true)
  })
  it('trash: wasteEmpty true면 noindex', () => {
    expect(computeAreaNoindex({ isTrash: true, summaryCount: undefined, wasteEmpty: true, page: 1 })).toBe(true)
  })
  it('trash: wasteEmpty false면 indexable', () => {
    expect(computeAreaNoindex({ isTrash: true, summaryCount: undefined, wasteEmpty: false, page: 1 })).toBe(false)
  })
})
