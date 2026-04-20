# ASCII Globe Backdrop — Design Spec

## Context

The AI Chat panel (CoachPanel) in Explore Mode shows a static empty state with an icon, hint text, and two action buttons before any messages are sent. This feels lifeless compared to the rest of the UI. We want to add a rotating ASCII globe animation (based on aemkei's "World in 1024 bytes" demo) as a subtle backdrop that rises from the bottom of the panel, giving Explore Mode a distinct, techy identity.

## Requirements

1. **Explore Mode only** — the globe does NOT appear in Task Mode's empty state
2. **Rising Globe positioning** — globe is anchored to the bottom of the empty-state container, with a gradient mask that fades it out toward the top, creating a "horizon" effect
3. **Subtle opacity** — globe renders at ~20% opacity so it doesn't compete with foreground content
4. **Fade + slide on focus** — when the user focuses the description editor, the globe fades to 0% opacity AND slides downward (~20px) over ~0.6s. On blur (if no message sent), it fades/slides back in.
5. **Clean lifecycle** — animation starts on mount, stops on unmount. No lingering `requestAnimationFrame` loops.
6. **Existing content untouched** — the lightbulb icon, hint text, sub-hint, and Elicitation/Conflict Check buttons remain exactly as they are, layered above the globe.

## Architecture

### New Component: `src/components/effects/AsciiGlobe.vue`

A self-contained Vue component that renders the rotating ASCII globe.

- **Template**: Single `<pre>` element with absolute positioning
- **Props**: `dimmed: boolean` — controls the fade+slide transition
- **Rendering**: Uses `requestAnimationFrame` loop, writes to `<pre>.textContent` each frame
- **Globe logic**: Ported directly from `ascii_globe.html` — continent bitmap, sphere projection, Y-axis rotation, diffuse lighting
- **Sizing**: `W=60, H=30, R=12` (tuned for the panel width)
- **Cleanup**: `onUnmounted` cancels the animation frame via stored ID

**Styles (scoped):**
```css
pre.ascii-globe {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  line-height: 1.05;
  letter-spacing: 1px;
  color: rgba(0, 200, 240, 0.20);
  font-family: 'Courier New', monospace;
  white-space: pre;
  pointer-events: none;
  mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,1) 100%);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,1) 100%);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
pre.ascii-globe.dimmed {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}
```

### Modified: `src/components/panels/CoachPanel.vue`

- Add new prop: `descriptionFocused: boolean`
- In the Explore Mode empty state template (lines 65–113), wrap existing content to ensure it's above the globe:
  - Add `position: relative; z-index: 1` to existing `.empty-state` children
  - Add `<AsciiGlobe :dimmed="descriptionFocused" />` inside `.empty-state`, behind the content
- Make `.empty-state` have `position: relative; overflow: hidden` to contain the globe

### Modified: `src/components/form/DescriptionEditor.vue`

- Add `@focus` and `@blur` event listeners to the `<textarea>` element
- Define new emits: `focus` and `blur`

### Modified: `src/components/form/TaskForm.vue`

- Listen for `@focus` and `@blur` on `<DescriptionEditor>` and re-emit them upward

### Modified: `src/App.vue`

- Add reactive ref: `descriptionFocused: ref(false)`
- Listen for focus/blur events from TaskForm, update the ref
- Pass `descriptionFocused` as prop to CoachPanel

## Data Flow

```
DescriptionEditor @focus/@blur
  → TaskForm @focus/@blur (re-emit)
    → App.vue (sets descriptionFocused ref)
      → CoachPanel :description-focused prop
        → AsciiGlobe :dimmed prop
          → CSS transition (fade + slide)
```

## Files to Modify

| File | Change |
|------|--------|
| `src/components/effects/AsciiGlobe.vue` | **NEW** — globe rendering component |
| `src/components/panels/CoachPanel.vue` | Add globe to empty state, add `descriptionFocused` prop |
| `src/components/form/DescriptionEditor.vue` | Add focus/blur emits on textarea |
| `src/components/form/TaskForm.vue` | Bubble focus/blur events |
| `src/App.vue` | Wire focus state ref, pass as prop |
| `src/components/layout/AppHeader.vue` | Version bump |
| `PLAN.md` | Changelog entry |

## Verification

1. Run `npm run build` — no type errors
2. Open the app in Explore Mode — globe should animate at the bottom of the empty AI Chat panel
3. Switch to Task Mode — globe should NOT appear
4. Click into the description editor — globe should fade out and slide down over ~0.6s
5. Click away from description editor (without sending a message) — globe should fade/slide back in
6. Send a message — empty state (and globe) replaced by chat messages; no console errors or animation leaks
