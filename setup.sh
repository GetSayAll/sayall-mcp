#!/bin/zsh
set -euo pipefail

ROOT="${0:A:h}"
CLIENT_NAME="${1:-Codex}"

cd "$ROOT"
npm install
npm run setup -- --name "$CLIENT_NAME"
