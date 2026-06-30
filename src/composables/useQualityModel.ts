import type { QualityTicket } from '@/types/quality'
import type { PhaseBucket } from '@/composables/useTimingPhase'
import { bucketBounds, bucketIndexOf } from '@/utils/bucketIndex'

// Quality Trend Modelling data layer — model v2 (v10.199, user-approved
// redesign; supersedes the v10.191 plain-mean + raw-OLS model, which the
// production data showed whipsawing on thin buckets and fanning out absurd
// straight-line forecasts). Every piece stays one-line explainable:
//
//  score   "a bucket's score is its ticket average, steadied by 5 'memory
//          tickets' at the team's own baseline."
//  trend   "buckets with more tickets count more in the trend."
//  forecast"the forecast follows the trend but eases off (×0.7 per step)."
//  band    "the shaded band is the range the recent scatter supports."

/**
 * Severity weights (v2): D drops to 10 — "D nearly fails" — realizing the
 * intent of the rejected dimensionally-broken Model 2 within a plain weighted
 * average. 格式异常 is a hard failure below D; statuses absent from this table
 * (未知) carry no quality signal and are excluded from scoring entirely.
 */
export const STATUS_SCORE: Record<string, number> = {
  A: 100,
  B: 80,
  C: 60,
  D: 10,
  格式异常: 0,
}

/** Shrinkage strength: pseudo-tickets pinned at the team baseline. */
export const SHRINK_K = 5

/** Forecast damping per step ahead (geometric — total advance is bounded). */
export const DAMPING = 0.7

/** Number of buckets projected beyond the observed window. */
export const FORECAST_HORIZON = 3

export interface ForecastBand {
  lower: number[]
  upper: number[]
}

export interface ModelSeries {
  team_key: string
  team: string
  /** Shrunk quality score per history bucket; null = no scored tickets there. */
  history: (number | null)[]
  /** Scorable tickets per bucket — drives fit weights and tooltips. */
  counts: number[]
  /** FORECAST_HORIZON damped scores; empty when history is too thin. */
  forecast: number[]
  /** Fitted trend value at the window's last slot ("now") — the point the
   *  dashed forecast projects from. null when history is too thin to fit. */
  forecastAnchor: number | null
  /** ±1.96·se envelope around the forecast; null under 3 fitted points. */
  band: ForecastBand | null
}

function clamp(v: number): number {
  return Math.min(100, Math.max(0, v))
}

interface WeightedFit {
  slope: number
  intercept: number
  /** Weighted RMS of the residuals. */
  se: number
  /** Number of fitted points. */
  n: number
  /** x of the last fitted point. */
  lastX: number
}

/** Count-weighted least squares over the non-null history points (at their
 *  original x positions). Null when fewer than two points exist. */
function weightedFit(history: (number | null)[], counts?: number[]): WeightedFit | null {
  const pts: Array<[number, number, number]> = []
  history.forEach((v, i) => {
    if (v !== null) pts.push([i, v, Math.max(1, counts?.[i] ?? 1)])
  })
  if (pts.length < 2) return null

  let W = 0, sx = 0, sy = 0
  for (const [x, y, w] of pts) { W += w; sx += w * x; sy += w * y }
  const mx = sx / W
  const my = sy / W
  let num = 0, den = 0
  for (const [x, y, w] of pts) { num += w * (x - mx) * (y - my); den += w * (x - mx) * (x - mx) }
  const slope = den === 0 ? 0 : num / den
  const intercept = my - slope * mx

  let rss = 0
  for (const [x, y, w] of pts) { const r = y - (intercept + slope * x); rss += w * r * r }
  return {
    slope,
    intercept,
    se: Math.sqrt(rss / W),
    n: pts.length,
    lastX: pts[pts.length - 1][0],
  }
}

/**
 * The count-weighted regression slope m — the trend signal: m > 0 quality is
 * improving, m < 0 declining. Null when history is too thin to fit. Counts
 * default to uniform weights when omitted.
 */
export function trendSlope(history: (number | null)[], counts?: number[]): number | null {
  return weightedFit(history, counts)?.slope ?? null
}

/**
 * Damped, count-weighted forecast with an uncertainty band.
 * Anchored at the FITTED value of the window's last bucket ("now") — not the
 * noisy raw point, and not the last bucket that happened to have data: when the
 * latest bucket(s) are empty the trend is extrapolated to now so the dashed
 * line projects from where the window ends, keeping the +1/+2/+3 slots a true
 * 1/2/3 steps ahead. Step k ahead adds slope × Σ_{j=1..k} DAMPING^j, so the
 * total advance is bounded (≈ 2.28 slopes at φ=0.7) and can never run away.
 * Band half-width is 1.96·se·√(1 + k/N); no band under 3 fitted points.
 */
export function forecastSeries(
  history: (number | null)[],
  counts: number[] | undefined,
  horizon: number,
): { forecast: number[]; forecastAnchor: number | null; band: ForecastBand | null } {
  const fit = weightedFit(history, counts)
  if (!fit) return { forecast: [], forecastAnchor: null, band: null }

  // Project from the window's last slot ("now"), not fit.lastX — identical when
  // the last bucket has data, correct when trailing buckets are empty.
  const anchor = fit.intercept + fit.slope * (history.length - 1)
  const forecastAnchor = clamp(Math.round(anchor))
  let dampSum = 0
  const raw: number[] = []
  const forecast: number[] = []
  for (let k = 1; k <= horizon; k++) {
    dampSum += DAMPING ** k
    const v = anchor + fit.slope * dampSum
    raw.push(v)
    forecast.push(clamp(Math.round(v)))
  }

  if (fit.n < 3) return { forecast, forecastAnchor, band: null }
  const lower: number[] = []
  const upper: number[] = []
  raw.forEach((v, i) => {
    const half = 1.96 * fit.se * Math.sqrt(1 + (i + 1) / fit.n)
    lower.push(clamp(Math.round(v - half)))
    upper.push(clamp(Math.round(v + half)))
  })
  return { forecast, forecastAnchor, band: { lower, upper } }
}

/**
 * Aggregates tickets into one quality-score series per team plus a leading
 * `*` all-teams series. Bucket score = shrinkage-steadied mean STATUS_SCORE
 * of the scorable tickets whose timestamp falls in the bucket window:
 * (sum + K·baseline) / (n + K), baseline = the series' volume-weighted mean
 * over the whole window.
 */
export function buildSeries(
  tickets: QualityTicket[],
  buckets: PhaseBucket[],
  horizon: number = FORECAST_HORIZON,
): ModelSeries[] {
  interface Agg { team: string; sums: number[]; counts: number[] }
  const mkAgg = (team: string): Agg => ({
    team,
    sums: new Array<number>(buckets.length).fill(0),
    counts: new Array<number>(buckets.length).fill(0),
  })

  const teams = new Map<string, Agg>()
  const all = mkAgg('all')
  const bounds = bucketBounds(buckets)

  for (const tk of tickets) {
    const score = STATUS_SCORE[tk.status]
    if (score === undefined) continue
    const idx = bucketIndexOf(new Date(tk.timestamp).getTime(), bounds)
    if (idx === -1) continue

    let agg = teams.get(tk.team_key)
    if (!agg) { agg = mkAgg(tk.team || tk.team_key); teams.set(tk.team_key, agg) }
    agg.sums[idx] += score
    agg.counts[idx]++
    all.sums[idx] += score
    all.counts[idx]++
  }

  const toSeries = (team_key: string, agg: Agg): ModelSeries => {
    const totalN = agg.counts.reduce((a, b) => a + b, 0)
    const baseline = totalN > 0 ? agg.sums.reduce((a, b) => a + b, 0) / totalN : 0
    const history = agg.sums.map((sum, i) =>
      agg.counts[i] > 0
        ? Math.round((sum + SHRINK_K * baseline) / (agg.counts[i] + SHRINK_K))
        : null)
    const { forecast, forecastAnchor, band } = forecastSeries(history, agg.counts, horizon)
    return { team_key, team: agg.team, history, counts: agg.counts, forecast, forecastAnchor, band }
  }

  return [
    toSeries('*', all),
    ...Array.from(teams.keys()).sort().map(k => toSeries(k, teams.get(k)!)),
  ]
}
