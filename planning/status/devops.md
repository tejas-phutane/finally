# DevOps status

## Done
- Dockerfile: 2 stages. Stage 1 `node:20-slim` builds frontend to `out/`. Stage 2 `python:3.12-slim`, uv pinned to 0.13.7, `uv sync --frozen --no-dev`, runs as uid 1000 (`app`), HEALTHCHECK on `/api/health`, CMD uvicorn single worker on 8000.
- .dockerignore (excludes .env, db/*.db, .git, test, planning, node_modules, .venv, caches).
- .env.example (placeholders only, PLAN.md §5 variables).
- db/.gitkeep.
- scripts/start_mac.sh, stop_mac.sh (executable). Flags: `--build`, `--open`, `--help`.
- scripts/start_windows.ps1, stop_windows.ps1 (written, NOT executed: pwsh is not installed here).
- docker-compose.yml (optional wrapper, same service and volume).

## Verified
- `docker build -t finally .` succeeds. Image has no node binary. Runs as `app` (uid 1000).
- `start_mac.sh` twice: second run reports "already running". `/api/health` returns `{"status":"ok"}`. Container reports `healthy`. DB file created in the `finally-data` volume, owned by `app`.
- `stop_mac.sh` twice: first removes the container and keeps the volume, second is a no-op.
- Missing `.env` fails with a clear message. `--build` rebuilds. Unknown flag exits 2.
- Test ran from a scratch copy with a dummy `.env` (LLM_MOCK=true). Test volume removed afterwards.

## In progress
- Nothing.

## Notes and requests
- Request (lead): `.gitignore` only ignores `.env`. `db/finally.db` is NOT ignored and currently exists untracked in `db/`. Add `db/*.db`, `db/*.db-journal`, `db/*.db-wal`, `db/*.db-shm` to `.gitignore`. Not my file, so I did not edit it.
- Node 20: `npm ci` works, but npm prints EBADENGINE warnings (some frontend deps want Node 22+, e.g. jsdom 31, undici 8). Build passes on 20. If the frontend team adds more such deps, switch stage 1 to `node:22-slim`. Plan says keep 20 unless it breaks.
- Image size is about 1.2 GB, mostly the Python venv (litellm, numpy, etc.).
- The PowerShell scripts need a manual run on Windows, or `pwsh` to be installed here to test.
