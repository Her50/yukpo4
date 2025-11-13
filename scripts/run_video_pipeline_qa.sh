#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
cd "$ROOT_DIR"

printf '\n=== Yukpo Video Pipeline QA Launcher ===\n'

printf '\n[1/4] Backend lint & tests (optional)\n'
cargo fmt --all
cargo clippy --all-targets -- -D warnings

printf '\n[2/4] Remotion worker smoke test\n'
if [ -n "${REMOTION_PROJECT_ROOT:-}" ]; then
  pushd "$REMOTION_PROJECT_ROOT" >/dev/null
  npm install
  npm run build
  popd >/dev/null
else
  echo "REMOTION_PROJECT_ROOT non défini – étape ignorée"
fi

printf '\n[3/4] Mobile Expo E2E (Detox)\n'
if command -v detox >/dev/null 2>&1; then
  pushd mobile >/dev/null
  npm install
  npx expo prebuild
  detox test --configuration ios.sim.debug
  popd >/dev/null
else
  echo "Detox non installé – étape ignorée"
fi

printf '\n[4/4] Web Playwright suite\n'
pushd frontend >/dev/null
npm install
npx playwright install --with-deps
npm run test:e2e -- --project=chromium --grep="Immersive"
popd >/dev/null

printf '\n✅ QA pipeline terminée. Voir docs/video_pipeline_qa.md pour détails.\n'



