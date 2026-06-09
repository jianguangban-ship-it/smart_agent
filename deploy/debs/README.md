# deploy/debs/

This directory holds pre-downloaded Debian `.deb` packages that
`deploy/Dockerfile`'s native-builder stage installs offline.

## Why this exists

The corporate Docker build environment cannot reach `github.com` (where
`better-sqlite3` publishes its prebuilt `.node` binary) nor
`deb.debian.org` (where Debian's apt-get fetches `python3 make g++`).
Without a way to compile `better-sqlite3` from source, the image build
fails.

We stage the required `.deb` files in-repo so `dpkg -i` runs fully
offline at build time. The toolchain only lives in the throwaway
`native-builder` stage; the final runtime image is unaffected in size.

## Populating this directory

On a host with internet access **and** Docker installed:

```bash
./deploy/fetch-debs.sh
```

This pulls `node:20-bookworm-slim`, runs `apt-get install --download-only`
inside it for `python3 make g++` (plus all transitive dependencies),
and copies the resulting `~50 .deb files` (~150 MB) here.

Then transfer this directory to the build host and run:

```bash
cd deploy
docker compose build
```

## When to re-fetch

Re-run `fetch-debs.sh` whenever:

- You bump the `node:20-bookworm-slim` base image in `deploy/Dockerfile`.
- You add a new dependency that itself needs a native compile step.
- Debian Bookworm publishes security updates you want to pick up.

## Why .deb files are gitignored

`.deb` files are large binary artifacts; committing them would bloat
the repo by ~150 MB and the cache would go stale quickly. They are
listed in `.gitignore` as `deploy/debs/*.deb`. This `README.md` and
`.gitkeep` are committed so the directory exists in fresh clones.
