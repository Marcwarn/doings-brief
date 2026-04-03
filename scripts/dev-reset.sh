#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-3000}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      PORT="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$PORT" ]]; then
  echo "Port is required." >&2
  exit 1
fi

if command -v lsof >/dev/null 2>&1; then
  PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN || true)"
  if [[ -n "$PIDS" ]]; then
    echo "Stopping process on port $PORT: $PIDS"
    kill $PIDS || true
    sleep 1
  fi
fi

if [[ -d ".next" ]]; then
  BACKUP_DIR=".next.bak-$(date +%Y%m%d-%H%M%S)"
  echo "Parking existing .next into $BACKUP_DIR"
  mv .next "$BACKUP_DIR"
fi

echo "Starting Next dev on port $PORT"
exec ./node_modules/.bin/next dev --port "$PORT"
