#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-3000}"
URLS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      PORT="${2:-}"
      shift 2
      ;;
    --url)
      URLS+=("${2:-}")
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

echo "1/3 Building app"
npm run build

echo "2/3 Resetting dev server on port $PORT"
bash scripts/dev-reset.sh --port "$PORT" >/tmp/doings-brief-verify-ui.log 2>&1 &
DEV_RESET_PID=$!

cleanup() {
  if kill -0 "$DEV_RESET_PID" >/dev/null 2>&1; then
    kill "$DEV_RESET_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

READY=0
for _ in {1..30}; do
  if curl -I -sS "http://localhost:$PORT" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [[ "$READY" -ne 1 ]]; then
  echo "Dev server did not become ready on port $PORT" >&2
  echo "----- dev:reset log -----" >&2
  cat /tmp/doings-brief-verify-ui.log >&2 || true
  exit 1
fi

echo "3/3 Verifying routes"
if [[ "${#URLS[@]}" -eq 0 ]]; then
  URLS=("/")
fi

for url in "${URLS[@]}"; do
  status="$(curl -I -sS -o /dev/null -w "%{http_code}" "http://localhost:$PORT$url")"
  echo "$status  $url"
  if [[ "$status" -ge 400 ]]; then
    echo "Route check failed for $url" >&2
    exit 1
  fi
done

echo "UI verification complete on port $PORT"
wait "$DEV_RESET_PID"
