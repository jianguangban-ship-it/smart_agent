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

## First-time deployment — seed the host volumes

`docker-compose.yml` mounts two host dirs. They are **empty until you seed them**, and the Team editor
needs the config files present (it reads *and* writes them):

```bash
# 1. Runtime configs → the dist/config volume. Copy the four seed files from the repo.
sudo mkdir -p /usr/local/smart_agent/data
sudo cp deploy/config/projects.json \
        deploy/config/team-members.json \
        deploy/config/components.json \
        deploy/config/summary-options.json \
        /usr/local/smart_agent/data/

# 2. Per-team edit codes → the data (db) volume. NOT web-served. Copy your real file.
#    (deploy/team-codes.json is gitignored; deploy/team-codes.sample.json shows the shape.)
sudo mkdir -p /usr/local/smart_agent/quality-db
sudo cp deploy/team-codes.json /usr/local/smart_agent/quality-db/team-codes.json
```

Without step 1 the dropdowns fall back to baked-in defaults and **in-app saves fail** (the file the
editor reads isn't there). Without step 2 every team is locked (read-only) — a safe default.

## Edit workflow

Two ways to change the runtime configs, interchangeable (both touch the same files on the host volume):

```bash
# A. In-app (preferred): Config → Team, unlock with the team's code, edit, Save.
#    Writes straight to /usr/local/smart_agent/data/*.json — live on next page load.

# B. By hand on the host:
sudo vi /usr/local/smart_agent/data/components.json   # the MOUNTED file, not deploy/config/
docker compose restart smart-agent                    # only needed for hand edits
# Users hard-refresh (Ctrl+Shift+R) OR wait — each load cache-busts /config/*.json with ?v=<timestamp>
```

> `deploy/config/*.json` are only the **seed** copied in step 1 — the running container never reads them
> directly. Edit the mounted host files (or use the in-app editor), not `deploy/config/`.

### Rotating team-codes

Edit `/usr/local/smart_agent/quality-db/team-codes.json` on the host — it's read **fresh per request**, so
no restart is needed. `"*"` is an ops master code that unlocks any team.

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

## In-app Team editor (Config mode → Team)

As of v10.222 these two files can also be edited **from inside the app** — no SSH, no restart:

- **`team-members.json`** — add / remove / edit members per team.
- **`components.json`** — edit the component list per team.

The editor writes the same JSON files this volume maps, so on-disk edits and in-app edits are interchangeable. Each write first copies the previous file to a `backups/` folder (kept out of the web root) and validates shape before saving. Changes are live for all users on their next page load (the app cache-busts `/config/*.json`).

### Per-team edit codes — `team-codes.json` (REQUIRED for editing)

The network is open on the intranet, but **editing a team is gated by a per-team code**. Whoever enters a team's code may edit *that team's* members and components only.

- **Location:** NOT here. This file must **not** be web-served, so it lives in the **data volume** next to the SQLite db — by default `/usr/local/smart_agent/quality-db/team-codes.json` (override with `TEAM_CODES_PATH`). See `deploy/team-codes.sample.json` for the shape.
- **Shape:** `{ "HW": "code-hw", "DKKF": "code-swdev", "*": "ops-master" }`. Keys are `projects.json[].key`. `"*"` is an ops master code that unlocks **any** team.
- **Locked by default:** a team with no entry (and no `"*"`) cannot be unlocked in the UI — it stays read-only until ops adds a code.
- Plaintext is intentional (ops-managed, intranet-only, low-value per-team edit PIN). The file is `.gitignore`d.
- Edits to `team-codes.json` are picked up **without a restart** (read fresh per request).

> **Config dir resolution:** in **prod** (Docker sets `NODE_ENV=production`) the server writes — and serves — `dist/config`, which is this mounted volume. In local **`dev:all`** Vite serves `/config` from `public/config`, so the server writes `public/config` there (a stale `dist/` from an earlier `npm run build` is intentionally ignored, otherwise edits wouldn't show on reload). Override either with `SMART_AGENT_CONFIG_DIR`.
>
> Note: `deploy/config/` is **not** read by the running app — it's a manual seed you copy onto the prod host volume during deployment. In-app edits do not (and should not) write back to it.
