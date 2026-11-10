#!/usr/bin/env bash
# Stop and remove the FinAlly container (macOS / Linux).
# The data volume 'finally-data' is kept, so portfolio data persists.
# Idempotent: exits 0 if the container does not exist.

set -euo pipefail

CONTAINER="finally-app"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed or not on PATH." >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "Error: the Docker daemon is not running." >&2
  exit 1
fi

if docker ps -a --format '{{.Names}}' | grep -x "${CONTAINER}" >/dev/null; then
  docker rm -f "${CONTAINER}" >/dev/null
  echo "Stopped and removed '${CONTAINER}'. Data volume 'finally-data' was kept."
else
  echo "No container named '${CONTAINER}' found. Nothing to stop."
fi
