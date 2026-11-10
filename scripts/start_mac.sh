#!/usr/bin/env bash
# Start FinAlly in Docker (macOS / Linux).
#
# Usage: scripts/start_mac.sh [--build] [--open]
#   --build  rebuild the image before starting
#   --open   open the app in the default browser once it responds
#
# Idempotent: safe to run repeatedly. If the container is already running and
# no --build is requested, it is left alone. Otherwise the old container is
# replaced. The data volume is never removed.

set -euo pipefail

IMAGE="finally"
CONTAINER="finally-app"
VOLUME="finally-data"
PORT="8000"
URL="http://localhost:${PORT}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

BUILD=0
OPEN=0
for arg in "$@"; do
  case "${arg}" in
    --build) BUILD=1 ;;
    --open) OPEN=1 ;;
    -h|--help)
      sed -n '2,9p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)
      echo "Error: unknown option '${arg}'. Use --build, --open, or --help." >&2
      exit 2 ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed or not on PATH." >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "Error: the Docker daemon is not running. Start Docker and try again." >&2
  exit 1
fi
if [ ! -f .env ]; then
  echo "Error: ${ROOT_DIR}/.env not found." >&2
  echo "Copy .env.example to .env and set OPENROUTER_API_KEY." >&2
  exit 1
fi

if [ "${BUILD}" -eq 1 ] || [ -z "$(docker images -q "${IMAGE}")" ]; then
  echo "Building image '${IMAGE}'..."
  docker build -t "${IMAGE}" .
fi

if docker ps --format '{{.Names}}' | grep -x "${CONTAINER}" >/dev/null && [ "${BUILD}" -eq 0 ]; then
  echo "FinAlly is already running."
else
  # Remove any stopped or outdated container with this name (keeps the volume).
  if docker ps -a --format '{{.Names}}' | grep -x "${CONTAINER}" >/dev/null; then
    docker rm -f "${CONTAINER}" >/dev/null
  fi
  echo "Starting container '${CONTAINER}'..."
  docker run -d \
    --name "${CONTAINER}" \
    --restart unless-stopped \
    -v "${VOLUME}:/app/db" \
    -p "${PORT}:8000" \
    --env-file .env \
    "${IMAGE}" >/dev/null
fi

echo "Waiting for ${URL}/api/health ..."
for _ in $(seq 1 30); do
  if curl -fsS "${URL}/api/health" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [ "${READY:-0}" -eq 1 ]; then
  echo "FinAlly is ready at ${URL}"
  if [ "${OPEN}" -eq 1 ]; then
    if command -v open >/dev/null 2>&1; then open "${URL}"
    elif command -v xdg-open >/dev/null 2>&1; then xdg-open "${URL}" >/dev/null 2>&1 || true
    fi
  fi
else
  echo "Warning: ${URL}/api/health did not respond within 30s." >&2
  echo "Check logs with: docker logs ${CONTAINER}" >&2
  exit 1
fi
