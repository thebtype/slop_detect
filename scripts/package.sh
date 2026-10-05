#!/usr/bin/env bash
# Builds the zip to upload to the Chrome Web Store: dist/slop-detect-<version>.zip
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(node -p 'require("./manifest.json").version')
out="dist/slop-detect-${version}.zip"

npm test --silent
mkdir -p dist
rm -f "$out"
zip -qr "$out" manifest.json src icons -x '*.DS_Store'
echo "Built $out"
unzip -l "$out"
