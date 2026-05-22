#!/usr/bin/env bash
# deploy/fetch-debs.sh — collect Debian packages needed to compile
# better-sqlite3 offline inside the corporate Docker build.
#
# Run this on a host WITH internet access (your laptop, a bastion VM,
# anywhere `docker pull node:20-bookworm-slim` and `apt-get update` both
# succeed). It writes ~150 MB of .deb files to deploy/debs/, which the
# Dockerfile's native-builder stage then COPYs in offline.
#
# Re-run whenever you bump the Node base image or change which native
# packages are needed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$SCRIPT_DIR/debs"

# Must match the FROM image used in deploy/Dockerfile — if you bump it
# there, bump it here so the .debs match the runtime libc / Python ABI.
BASE_IMAGE="node:20-bookworm-slim"
PACKAGES="python3 make g++"

mkdir -p "$OUT_DIR"
# Drop any stale .debs from a previous fetch (old transitive deps that
# may no longer be needed and would confuse dpkg ordering).
rm -f "$OUT_DIR"/*.deb

echo "→ Using base image: $BASE_IMAGE"
echo "→ Collecting: $PACKAGES (and their transitive deps)"
echo "→ Output dir: $OUT_DIR"
echo

docker run --rm \
  -v "$OUT_DIR":/out \
  "$BASE_IMAGE" \
  bash -c "
    set -e
    apt-get update -qq
    apt-get install --download-only -y --no-install-recommends $PACKAGES
    cp /var/cache/apt/archives/*.deb /out/
  "

count=$(ls -1 "$OUT_DIR"/*.deb 2>/dev/null | wc -l)
size=$(du -sh "$OUT_DIR" | cut -f1)

echo
echo "✓ Collected $count packages ($size) in deploy/debs/"
echo "  Transfer this directory to the build host, then run:"
echo "    cd deploy && docker compose build"
