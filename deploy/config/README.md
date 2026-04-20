# Runtime configuration — `deploy/config/`

These JSON files drive the **Basic Information** and **Task Summary** dropdowns. Edit them and restart the container — **no Docker image rebuild required**.

## The four files

| File | Controls | Shape |
|------|----------|-------|
| `projects.json` | Project/Team dropdown in Basic Information | `ProjectConfig[]` |
| `team-members.json` | Assignee list (filtered by selected project) | `Record<projectKey, TeamMember[]>` |
| `summary-options.json` | Vehicles, Products, Layers in Task Summary | `{ vehicles, products, layers }` (all `string[]`) |
| `components.json` | Component list in Task Summary — **scoped per Agile Team** | `Record<projectKey, string[]>` |

### Key-match invariant

The keys in `team-members.json` and `components.json` **must** match `projects.json[].key`. Example:

```
projects.json has         → { key: "HW", ... }
team-members.json needs   → { "HW": [...] }
components.json needs     → { "HW": [...] }
```

If a project key exists in `projects.json` but is missing from `components.json`, that team sees an empty component list (still selectable, but no datalist suggestions).

## Edit workflow

```bash
# 1. Edit the file on the host
vi deploy/config/components.json

# 2. Restart the container so users get the fresh JSON on next request
docker compose restart smart-agent

# 3. Users hard-refresh (Ctrl+Shift+R) OR wait — each page load cache-busts /config/*.json with ?v=<timestamp>
```

## Schemas

### `projects.json`
```json
[
  { "name": "IDC_PDHW", "key": "HW", "teamName": "Hardware Team" }
]
```

### `team-members.json`
```json
{
  "HW": [
    { "id": "user1", "name": "Alice Chen", "role": "HW Designer" }
  ]
}
```
`role` is optional. `id` is used as the JIRA assignee identifier; `name` is what the user sees.

### `summary-options.json`
```json
{
  "vehicles": ["Platform", "GWM_DE09", "GWM_EC15"],
  "products": ["EPS", "IBC", "EMB"],
  "layers": ["SYS", "SW", "APP", "HW", "ME", "TEST", "SWF"]
}
```

### `components.json`
```json
{
  "HW":   ["TLE9461", "L9300", "Gate Driver"],
  "DKKF": ["MCAL", "CAN_Driver", "EcuM"],
  "SWCD": ["Dcm", "Nm", "Xcp", "CanTp"]
}
```

## Validation

On startup the app fetches each file, validates its shape, and falls back to baked-in defaults if anything is wrong.

Check the browser DevTools console for one of:

```
[runtime-config] loaded: projects=runtime, team=runtime, summary=runtime, components=runtime
[runtime-config] /config/components.json: HTTP 404 — using fallback
[runtime-config] /config/components.json: invalid shape (expect Record<projectKey, string[]>) — using fallback
```

If you see `fallback` or `invalid`, the file was either missing, unreachable, or malformed JSON — fix it and `docker compose restart smart-agent`.

## Where do the fallbacks live?

Fallbacks are compiled into the image at `src/config/projects.ts` and `src/config/constants.ts` (`DEFAULT_COMPONENTS_BY_PROJECT`, `VEHICLE_OPTIONS`, etc.). They are a safety net only — edit the JSON here, not the source.
