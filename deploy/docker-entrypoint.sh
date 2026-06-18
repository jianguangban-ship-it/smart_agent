#!/bin/sh
# First-boot seeding for the runtime config volume.
#
# docker-compose mounts the host dir /usr/local/smart_agent/data over
# /app/dist/config. On a fresh deployment that host dir is empty, which would
# leave the app with no config files (the in-app Team editor would 500 on save,
# and dropdowns would fall back to baked-in defaults). The image bakes the
# canonical defaults (built from public/config) to /app/config-defaults — a path
# OUTSIDE the mount — and this script copies any MISSING file into the volume,
# then hands off to the real command.
#
# Idempotent: only fills gaps. Files already present (ops edits or in-app editor
# writes) are never overwritten, so the volume stays the live source of truth.
set -e

CFG=/app/dist/config
DEFAULTS=/app/config-defaults
mkdir -p "$CFG"

for f in projects.json team-members.json components.json summary-options.json; do
  if [ ! -f "$CFG/$f" ]; then
    cp "$DEFAULTS/$f" "$CFG/$f"
    echo "[entrypoint] seeded $CFG/$f from baked defaults"
  fi
done

exec "$@"
