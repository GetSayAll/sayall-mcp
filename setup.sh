#!/bin/zsh
set -euo pipefail

ROOT="${0:A:h}"
CLIENT_NAME="${1:-Local AI Client}"

if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  print -u2 "Node.js 20 or newer is required: https://nodejs.org/"
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if (( NODE_MAJOR < 20 )); then
  print -u2 "Node.js 20 or newer is required; found $(node --version)."
  exit 1
fi

cd "$ROOT"
npm install --no-audit --no-fund
npm run setup -- --name "$CLIENT_NAME"
