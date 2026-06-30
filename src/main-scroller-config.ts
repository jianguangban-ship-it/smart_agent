// vue-virtual-scroller global config — shared by main.ts and tests so the
// exact production setting is what gets exercised.
//
// v10.193: the library's RecycleScroller throws "Rendered items limit
// reached" when the visible range exceeds `itemsLimit` (default 1000). That
// range spans the WHOLE dataset whenever the scroller viewport is momentarily
// unmeasurable (zero height mid-layout, hidden ancestor) — the library then
// "renders all items at once". With production data (1,155+ tickets) that
// throw lands inside Vue's reactive flush and aborts it, freezing the entire
// UI (found 2026-06-12 testing against the real GWM DB; dev datasets under
// 1000 rows could never hit it). Raising the limit turns the degenerate state
// into a slow-but-recoverable render instead of an app-killing throw.
import VueVirtualScroller from 'vue-virtual-scroller'
import type { App } from 'vue'

/** Far above any realistic ticket count (full prod history ≈ 1.2k, 10× ≈ 12k). */
export const SCROLLER_ITEMS_LIMIT = 100_000

export function applyScrollerConfig(): void {
  // v3 keeps itemsLimit in module-level config; the plugin's install() copies
  // every option key into it. With installComponents:false it touches ONLY
  // the config object and never the app instance, so a stub app suffices —
  // letting main.ts and tests share this one code path.
  VueVirtualScroller.install(
    {} as App,
    { installComponents: false, itemsLimit: SCROLLER_ITEMS_LIMIT } as never,
  )
}
