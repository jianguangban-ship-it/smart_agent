// Product-coding matrix (Config → Project). A row encodes a product's identity
// fields; 综合编码 (composite code) is DERIVED from them, never stored, so it can
// never drift. Served as runtime config (project-matrix.json) and edited in-app
// behind the same code gate as the Team editor.

/** Allowed 产品线 (product line) values — English only, per spec. */
export const PRODUCT_LINE_OPTIONS = ['X-line', 'Y-Line', 'Z-Line'] as const
export type ProductLine = typeof PRODUCT_LINE_OPTIONS[number]

export interface ProjectMatrixRow {
  /** 产品线 — one of PRODUCT_LINE_OPTIONS (or '' before the user picks). */
  productLine: ProductLine | ''
  /** 客户代号 e.g. GWM */
  customerCode: string
  /** 项目号 e.g. DE06 */
  projectNo: string
  /** 年度信息 e.g. MY2026 */
  yearInfo: string
  /** 公司代号 e.g. J500 */
  companyCode: string
  /** 产品流水号 e.g. 0009 */
  serialNo: string
  /** 产品类型代号 e.g. EDC */
  productTypeCode: string
  /** 备注 — free-text comments (not part of 综合编码). */
  comments: string
}

/** The 6 code fields that make up 综合编码, in order. 产品线 is excluded. */
export const COMPOSITE_FIELDS: Array<keyof ProjectMatrixRow> = [
  'customerCode', 'projectNo', 'yearInfo', 'companyCode', 'serialNo', 'productTypeCode',
]

/** 综合编码 — the 6 code fields joined by "-". e.g. GWM-DE06-MY2026-J500-0009-EDC. */
export function compositeCode(row: ProjectMatrixRow): string {
  return COMPOSITE_FIELDS.map(f => row[f]).join('-')
}

/**
 * Quick-filter predicate — case-insensitive substring match across the product
 * line, the 6 code fields, the derived composite code, and comments. An empty
 * query matches every row.
 */
export function rowMatchesQuery(row: ProjectMatrixRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [
    row.productLine, row.customerCode, row.projectNo, row.yearInfo,
    row.companyCode, row.serialNo, row.productTypeCode, compositeCode(row), row.comments,
  ].join(' ').toLowerCase()
  return hay.includes(q)
}

/** True when all 6 composite fields are empty — a blank row, excluded from the
 *  duplicate-composite check (trailing blanks the user is still filling in). */
export function isBlankComposite(row: ProjectMatrixRow): boolean {
  return COMPOSITE_FIELDS.every(f => row[f].trim() === '')
}

export interface DuplicateResult {
  /** Indices (into the input array) of every row sharing a duplicated composite. */
  indices: Set<number>
  /** The duplicated composite codes (each listed once). */
  codes: string[]
}

/**
 * Find rows whose 综合编码 collides with another row's. Blank rows are ignored.
 * Because the composite excludes 产品线, two rows with identical code fields but
 * different product lines still collide. Used to mark cells red + block Save.
 */
export function duplicateCompositeRows(rows: ProjectMatrixRow[]): DuplicateResult {
  const byCode = new Map<string, number[]>()
  rows.forEach((row, i) => {
    if (isBlankComposite(row)) return
    const code = compositeCode(row)
    const list = byCode.get(code) ?? []
    list.push(i)
    byCode.set(code, list)
  })
  const indices = new Set<number>()
  const codes: string[] = []
  for (const [code, list] of byCode) {
    if (list.length > 1) {
      codes.push(code)
      for (const i of list) indices.add(i)
    }
  }
  return { indices, codes }
}

/** A blank row (产品线 unset; user picks from the dropdown). */
export function emptyRow(): ProjectMatrixRow {
  return {
    productLine: '', customerCode: '', projectNo: '', yearInfo: '',
    companyCode: '', serialNo: '', productTypeCode: '', comments: '',
  }
}

// Seed rows (from project-format.jpg). 产品线 defaults to 'X-line' — the image's
// 悬架 isn't one of the English options, so the line is set to the first option
// and can be re-picked per row in the editor.
export const PROJECT_MATRIX_FALLBACK: ProjectMatrixRow[] = [
  { productLine: 'X-line', customerCode: 'GWM', projectNo: 'DE06',      yearInfo: 'MY2026', companyCode: 'J500', serialNo: '0009', productTypeCode: 'EDC', comments: '' },
  { productLine: 'X-line', customerCode: 'GWM', projectNo: 'DE07',      yearInfo: 'MY2026', companyCode: 'J500', serialNo: '0010', productTypeCode: 'EDC', comments: '' },
  { productLine: 'X-line', customerCode: 'GWM', projectNo: 'DE08',      yearInfo: 'MY2026', companyCode: 'J500', serialNo: '0011', productTypeCode: 'EDC', comments: '' },
  { productLine: 'X-line', customerCode: 'GWM', projectNo: 'DE09G',     yearInfo: 'MY2026', companyCode: 'J500', serialNo: '0012', productTypeCode: 'EDC', comments: '' },
  { productLine: 'X-line', customerCode: 'GWM', projectNo: 'DE09HEV',   yearInfo: 'MY2026', companyCode: 'J500', serialNo: '0013', productTypeCode: 'EDC', comments: '' },
  { productLine: 'X-line', customerCode: 'GWM', projectNo: 'DE08HEV',   yearInfo: 'MY2026', companyCode: 'J500', serialNo: '0014', productTypeCode: 'EDC', comments: '' },
  { productLine: 'X-line', customerCode: 'GWM', projectNo: 'DE07HEV',   yearInfo: 'MY2026', companyCode: 'J500', serialNo: '0015', productTypeCode: 'EDC', comments: '' },
  { productLine: 'X-line', customerCode: 'GWM', projectNo: 'DE06HEV',   yearInfo: 'MY2026', companyCode: 'J500', serialNo: '0016', productTypeCode: 'EDC', comments: '' },
  { productLine: 'X-line', customerCode: 'GWM', projectNo: 'DE06GHEV',  yearInfo: 'MY2027', companyCode: 'J500', serialNo: '0017', productTypeCode: 'EDC', comments: '' },
  { productLine: 'X-line', customerCode: 'GWM', projectNo: 'DE06GHEV',  yearInfo: 'MY2027', companyCode: 'J500', serialNo: '0018', productTypeCode: 'EDC', comments: '' },
  { productLine: 'X-line', customerCode: 'GWM', projectNo: 'DE06GPHEV', yearInfo: 'MY2027', companyCode: 'J500', serialNo: '0019', productTypeCode: 'EDC', comments: '' },
  { productLine: 'X-line', customerCode: 'GWM', projectNo: 'DE06GPHEV', yearInfo: 'MY2027', companyCode: 'J500', serialNo: '0020', productTypeCode: 'EDC', comments: '' },
  { productLine: 'X-line', customerCode: 'GWM', projectNo: 'DE06GEV',   yearInfo: 'MY2027', companyCode: 'J500', serialNo: '0021', productTypeCode: 'EDC', comments: '' },
]
