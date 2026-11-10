# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: build the Next.js frontend as a static export (frontend/out/)
# ---------------------------------------------------------------------------
FROM node:20-slim AS frontend-build

WORKDIR /app/frontend

# Install dependencies first so this layer is cached until package files change.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# ---------------------------------------------------------------------------
# Stage 2: Python runtime (FastAPI + static frontend). No Node toolchain here.
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS runtime

# uv pinned to a known-good release for reproducible builds.
COPY --from=ghcr.io/astral-sh/uv:0.13.7 /uv /uvx /usr/local/bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/backend/.venv \
    FINALLY_DB_PATH=/app/db/finally.db \
    FINALLY_STATIC_DIR=/app/static \
    MARKET_DATA_PROVIDER=yahoo \
    PATH=/app/backend/.venv/bin:$PATH

# Non-root user. The DB directory is owned by it so a fresh named volume
# (which inherits the image directory's ownership) is writable.
RUN groupadd --system --gid 1000 app \
 && useradd --system --uid 1000 --gid app --home-dir /home/app --create-home app \
 && mkdir -p /app/db /app/static \
 && chown -R app:app /app

WORKDIR /app/backend

# Dependencies first (cached until the lockfile changes), then the source.
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/ ./
RUN uv sync --frozen --no-dev \
 && chown -R app:app /app/backend

COPY --from=frontend-build --chown=app:app /app/frontend/out /app/static

USER app

VOLUME ["/app/db"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4).status == 200 else 1)"

# Single worker on purpose: the market data source and price cache live in-process.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
