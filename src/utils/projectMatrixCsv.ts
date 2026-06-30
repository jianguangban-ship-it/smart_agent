// CSV serialize / parse for the Project matrix (Config → Project). Columns
// follow the page design: 产品线, 客户代号, 项目号, 年度信息, 公司代号, 产品流水号,
// 产品类型代号, 综合编码, 备注. The composite (综合编码) is derived — emitted on
// export for readers, ignored on import. Pure + unit-tested.

import {
  PRODUCT_LINE_OPTIONS, compositeCode, type ProjectMatrixRow,
} from '@/config/projectMatrix'

/** Value order per row (matches the page column order; composite is derived). */
function rowValues(row: ProjectMatrixRow): string[] {
  return [
    row.productLine, row.customerCode, row.projectNo, row.yearInfo,
    row.companyCode, row.serialNo, row.productTypeCode, compositeCode(row), row.comments,
  ]
}

function csvEscape(s: string): string {
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

/**
 * Serialize rows to CSV. `headerLabels` are the 9 localized column headers (in
 * page order) the caller passes, so the file reads like the page the user sees.
 */
export function projectMatrixToCsv(rows: ProjectMatrixRow[], headerLabels: string[]): string {
  const lines = [headerLabels.map(csvEscape).join(',')]
  for (const r of rows) lines.push(rowValues(r).map(csvEscape).join(','))
  return lines.join('\r\n') + '\r\n'
}

// ── Parsing ──────────────────────────────────────────────────────────────────

/** RFC-4180 parse → string[][]. Handles quoted fields (commas/quotes/newlines),
 *  CRLF or LF, a leading UTF-8 BOM, and a trailing newline. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += c; i++; continue
    }
    if (c === '"') { inQuotes = true; i++; continue }
    if (c === ',') { row.push(field); field = ''; i++; continue }
    if (c === '\r') { i++; continue }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue }
    field += c; i++
  }
  // Flush the final field/row unless the input ended exactly on a newline.
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

// Header → field alias map (normalized trim+lowercase). The composite column
// maps to 'composite' (ignored on import). Covers zh label, en label, field key.
const HEADER_ALIASES: Record<string, keyof ProjectMatrixRow | 'composite'> = {
  '产品线': 'productLine', 'product line': 'productLine', 'productline': 'productLine',
  '客户代号': 'customerCode', 'customer code': 'customerCode', 'customercode': 'customerCode',
  '项目号': 'projectNo', 'project no.': 'projectNo', 'project no': 'projectNo', 'projectno': 'projectNo',
  '年度信息': 'yearInfo', 'year info': 'yearInfo', 'yearinfo': 'yearInfo',
  '公司代号': 'companyCode', 'company code': 'companyCode', 'companycode': 'companyCode',
  '产品流水号': 'serialNo', 'serial no.': 'serialNo', 'serial no': 'serialNo', 'serialno': 'serialNo',
  '产品类型代号': 'productTypeCode', 'product type code': 'productTypeCode', 'producttypecode': 'productTypeCode',
  '备注': 'comments', 'comments': 'comments', 'comment': 'comments',
  '综合编码': 'composite', 'composite code': 'composite', 'compositecode': 'composite',
}

function canonProductLine(v: string): ProjectMatrixRow['productLine'] {
  const hit = PRODUCT_LINE_OPTIONS.find(o => o.toLowerCase() === v.trim().toLowerCase())
  return hit ?? ''
}

export interface ParseResult {
  rows: ProjectMatrixRow[]
  /** false when no header column could be recognized. */
  ok: boolean
}

/** Parse a project-matrix CSV. Maps columns by header alias (zh/en/key), drops
 *  the derived composite column, normalizes product line + trims, skips blank rows. */
export function parseProjectMatrixCsv(text: string): ParseResult {
  const grid = parseCsv(text)
  if (grid.length === 0) return { rows: [], ok: false }

  const header = grid[0].map(h => HEADER_ALIASES[h.trim().toLowerCase()])
  if (!header.some(Boolean)) return { rows: [], ok: false } // unrecognizable header

  const empty = (): ProjectMatrixRow => ({
    productLine: '', customerCode: '', projectNo: '', yearInfo: '',
    companyCode: '', serialNo: '', productTypeCode: '', comments: '',
  })

  const rows: ProjectMatrixRow[] = []
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r]
    const row = empty()
    let nonEmpty = false
    header.forEach((field, c) => {
      if (!field || field === 'composite') return
      const val = (cells[c] ?? '').trim()
      if (val) nonEmpty = true
      if (field === 'productLine') row.productLine = canonProductLine(val)
      else row[field] = val
    })
    if (nonEmpty) rows.push(row)
  }
  return { rows, ok: true }
}
