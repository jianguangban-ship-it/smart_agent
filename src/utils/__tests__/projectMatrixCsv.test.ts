import { describe, it, expect } from 'vitest'
import { projectMatrixToCsv, parseProjectMatrixCsv, parseCsv } from '../projectMatrixCsv'
import type { ProjectMatrixRow } from '@/config/projectMatrix'

const EN_HEADERS = [
  'Product Line', 'Customer Code', 'Project No.', 'Year Info', 'Company Code',
  'Serial No.', 'Product Type Code', 'Composite Code', 'Comments',
]
const ZH_HEADERS = [
  '产品线', '客户代号', '项目号', '年度信息', '公司代号', '产品流水号', '产品类型代号', '综合编码', '备注',
]

function row(p: Partial<ProjectMatrixRow> = {}): ProjectMatrixRow {
  return {
    productLine: 'X-line', customerCode: 'GWM', projectNo: 'DE06', yearInfo: 'MY2026',
    companyCode: 'J500', serialNo: '0009', productTypeCode: 'EDC', comments: '', ...p,
  }
}

describe('projectMatrixToCsv', () => {
  it('emits a header row + the derived composite per row', () => {
    const csv = projectMatrixToCsv([row()], EN_HEADERS)
    const [head, line] = csv.trimEnd().split('\r\n')
    expect(head).toBe(EN_HEADERS.join(','))
    expect(line).toBe('X-line,GWM,DE06,MY2026,J500,0009,EDC,GWM-DE06-MY2026-J500-0009-EDC,')
  })

  it('quotes fields containing comma / quote / newline', () => {
    const csv = projectMatrixToCsv([row({ comments: 'a,b "c"\nd' })], EN_HEADERS)
    expect(csv).toContain('"a,b ""c""\nd"')
  })
})

describe('parseProjectMatrixCsv', () => {
  it('round-trips export → parse (composite ignored, recomputed)', () => {
    const rows = [row({ comments: 'note' }), row({ projectNo: 'DE07', serialNo: '0010' })]
    const csv = projectMatrixToCsv(rows, EN_HEADERS)
    const { rows: back, ok } = parseProjectMatrixCsv(csv)
    expect(ok).toBe(true)
    expect(back).toEqual(rows)
  })

  it('matches headers in Chinese too, and tolerates a leading BOM', () => {
    const csv = '﻿' + projectMatrixToCsv([row({ comments: 'x' })], ZH_HEADERS)
    const { rows, ok } = parseProjectMatrixCsv(csv)
    expect(ok).toBe(true)
    expect(rows[0].customerCode).toBe('GWM')
    expect(rows[0].comments).toBe('x')
  })

  it('imports a CSV that omits the composite column', () => {
    const csv = 'Product Line,Customer Code,Project No.,Year Info,Company Code,Serial No.,Product Type Code,Comments\n' +
      'Y-Line,GWM,DE08,MY2026,J500,0011,EDC,hi'
    const { rows, ok } = parseProjectMatrixCsv(csv)
    expect(ok).toBe(true)
    expect(rows[0]).toEqual(row({ productLine: 'Y-Line', projectNo: 'DE08', serialNo: '0011', comments: 'hi' }))
  })

  it('normalizes an unknown product line to empty and preserves a known one case-insensitively', () => {
    const csv = 'Product Line,Customer Code,Project No.,Year Info,Company Code,Serial No.,Product Type Code\n' +
      'Suspension,GWM,DE06,MY2026,J500,0009,EDC\n' +
      'z-line,GWM,DE06,MY2026,J500,0009,EDC'
    const { rows } = parseProjectMatrixCsv(csv)
    expect(rows[0].productLine).toBe('')
    expect(rows[1].productLine).toBe('Z-Line')
  })

  it('skips fully-empty rows', () => {
    const csv = projectMatrixToCsv([row(), row()], EN_HEADERS) + ',,,,,,,,\r\n'
    const { rows } = parseProjectMatrixCsv(csv)
    expect(rows).toHaveLength(2)
  })

  it('returns ok=false when no header column is recognizable', () => {
    const { rows, ok } = parseProjectMatrixCsv('a,b,c\n1,2,3')
    expect(ok).toBe(false)
    expect(rows).toEqual([])
  })
})

describe('parseCsv (RFC-4180 basics)', () => {
  it('handles quoted commas, escaped quotes, and CRLF', () => {
    expect(parseCsv('a,"b,c","d""e"\r\n1,2,3')).toEqual([['a', 'b,c', 'd"e'], ['1', '2', '3']])
  })
  it('handles a newline inside a quoted field', () => {
    expect(parseCsv('"line1\nline2",x')).toEqual([['line1\nline2', 'x']])
  })
})
