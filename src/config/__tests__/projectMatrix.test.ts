import { describe, it, expect } from 'vitest'
import {
  PRODUCT_LINE_OPTIONS, COMPOSITE_FIELDS, compositeCode, emptyRow, rowMatchesQuery,
  isBlankComposite, duplicateCompositeRows,
  PROJECT_MATRIX_FALLBACK, type ProjectMatrixRow,
} from '../projectMatrix'

const ROW: ProjectMatrixRow = {
  productLine: 'X-line', customerCode: 'GWM', projectNo: 'DE06',
  yearInfo: 'MY2026', companyCode: 'J500', serialNo: '0009', productTypeCode: 'EDC', comments: '',
}

describe('projectMatrix', () => {
  it('offers exactly the three English product lines', () => {
    expect([...PRODUCT_LINE_OPTIONS]).toEqual(['X-line', 'Y-Line', 'Z-Line'])
  })

  it('composite = the six code fields joined by "-", excluding 产品线', () => {
    expect(compositeCode(ROW)).toBe('GWM-DE06-MY2026-J500-0009-EDC')
    // product line is NOT part of the composite
    expect(compositeCode({ ...ROW, productLine: 'Z-Line' })).toBe('GWM-DE06-MY2026-J500-0009-EDC')
    expect(COMPOSITE_FIELDS).not.toContain('productLine')
  })

  it('emptyRow has all string fields blank, including comments', () => {
    const r = emptyRow()
    expect(r.productLine).toBe('')
    expect(r.comments).toBe('')
    expect(Object.values(r).every(v => v === '')).toBe(true)
  })

  it('rowMatchesQuery matches across code fields, composite, and comments', () => {
    const row: ProjectMatrixRow = { ...ROW, comments: 'pilot batch' }
    expect(rowMatchesQuery(row, '')).toBe(true)            // empty matches all
    expect(rowMatchesQuery(row, 'de06')).toBe(true)        // case-insensitive code field
    expect(rowMatchesQuery(row, 'J500-0009')).toBe(true)   // substring of the composite
    expect(rowMatchesQuery(row, 'PILOT')).toBe(true)       // comments
    expect(rowMatchesQuery(row, 'nope')).toBe(false)
  })

  it('seed rows all produce a well-formed composite', () => {
    expect(PROJECT_MATRIX_FALLBACK).toHaveLength(13)
    expect(compositeCode(PROJECT_MATRIX_FALLBACK[0])).toBe('GWM-DE06-MY2026-J500-0009-EDC')
    expect(compositeCode(PROJECT_MATRIX_FALLBACK[12])).toBe('GWM-DE06GEV-MY2027-J500-0021-EDC')
  })
})

describe('duplicate composite codes', () => {
  it('isBlankComposite ignores product line + comments', () => {
    expect(isBlankComposite(emptyRow())).toBe(true)
    expect(isBlankComposite({ ...emptyRow(), productLine: 'X-line', comments: 'note' })).toBe(true)
    expect(isBlankComposite(ROW)).toBe(false)
  })

  it('flags rows sharing a composite and lists the code; unique sets report none', () => {
    const a = ROW
    const b = { ...ROW, projectNo: 'DE07', serialNo: '0010' }
    expect(duplicateCompositeRows([a, b]).indices.size).toBe(0)

    const dup = duplicateCompositeRows([a, b, { ...a }])
    expect(dup.indices).toEqual(new Set([0, 2]))
    expect(dup.codes).toEqual(['GWM-DE06-MY2026-J500-0009-EDC'])
  })

  it('collides even when only 产品线 differs (composite excludes it)', () => {
    const a = { ...ROW, productLine: 'X-line' as const }
    const b = { ...ROW, productLine: 'Y-Line' as const }
    expect(duplicateCompositeRows([a, b]).indices).toEqual(new Set([0, 1]))
  })

  it('ignores blank rows', () => {
    expect(duplicateCompositeRows([emptyRow(), emptyRow(), ROW]).indices.size).toBe(0)
  })
})
