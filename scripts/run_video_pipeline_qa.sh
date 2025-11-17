#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Yukpo Video Pipeline QA
-----------------------
Options:
  --ci                     Active le mode CI (logs -> artifacts, non interactif)
  --scenarios list         Liste séparée par des virgules (ex: audio-premium,fallback-local)
  --skip-backend           Ignore les vérifications backend locales
  --help                   Affiche cette aide
Variables utiles :
  QA_ARTIFACTS_DIR         Dossier cible pour les artefacts (par défaut ./artifacts/video-qa/<timestamp>)
  QA_MOBILE_CONFIGURATION  Configuration Detox à utiliser (défaut ios.sim.debug)
  QA_PLAYWRIGHT_PROJECT    Projet Playwright à exécuter (défaut chromium)
  QA_VIDEO_SCENARIOS       Liste de scénarios appliquée par défaut
EOF
}

copy_tree() {
  local src="$1"
  local dest="$2"
  if [ ! -d "$src" ]; then
    return 0
  fi
  mkdir -p "$dest"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a "$src"/ "$dest"/ || true
  else
    cp -R "$src"/. "$dest"/ || true
  fi
}

CI_MODE=0
SCENARIOS="${QA_VIDEO_SCENARIOS:-}"
SKIP_BACKEND=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ci)
      CI_MODE=1
      ;;
    --scenarios)
      SCENARIOS="$2"
      shift
      ;;
    --skip-backend)
      SKIP_BACKEND=1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Argument inconnu: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
cd "$ROOT_DIR"

timestamp="$(date +%Y%m%d-%H%M%S)"
ARTIFACT_ROOT="${QA_ARTIFACTS_DIR:-"$ROOT_DIR/artifacts/video-qa/$timestamp"}"
LOG_FILE="$ARTIFACT_ROOT/qa.log"
SUMMARY_FILE="$ARTIFACT_ROOT/summary.json"
mkdir -p "$ARTIFACT_ROOT"

if [[ $CI_MODE -eq 1 ]]; then
  echo "Mode CI activé - logs dans $LOG_FILE"
  exec > >(tee -a "$LOG_FILE") 2>&1
  export DETOX_CONFIG_SILENT=1
fi

printf '\n=== Yukpo Video Pipeline QA Launcher ===\n'
printf 'Artefacts: %s\n' "$ARTIFACT_ROOT"
printf 'Scénarios: %s\n' "${SCENARIOS:-"<aucun>"}"

record_summary() {
  local backend="$1"
  local remotion="$2"
  local detox="$3"
  local playwright="$4"

  if command -v jq >/dev/null 2>&1; then
    jq -n \
      --arg ts "$timestamp" \
      --arg scenarios "${SCENARIOS:-""}" \
      --arg backendStatus "$backend" \
      --arg remotionStatus "$remotion" \
      --arg detoxStatus "$detox" \
      --arg playwrightStatus "$playwright" \
      '{run_id: $ts, scenarios: ($scenarios | split(",") | map(select(length>0))), steps: {backend: $backendStatus, remotion: $remotionStatus, detox: $detoxStatus, playwright: $playwrightStatus}}' \
      >"$SUMMARY_FILE"
  else
    cat >"$SUMMARY_FILE" <<EOF
{
  "run_id": "$timestamp",
  "scenarios": "$(printf '%s' "${SCENARIOS:-}" )",
  "steps": {
    "backend": "$backend",
    "remotion": "$remotion",
    "detox": "$detox",
    "playwright": "$playwright"
  }
}
EOF
  fi
}

BACKEND_STATUS="skipped"
if [[ $SKIP_BACKEND -eq 0 ]]; then
  printf '\n[1/4] Backend lint & tests\n'
  if cargo --version >/dev/null 2>&1; then
    (cd backend && cargo fmt --all && cargo clippy --all-targets -- -D warnings && cargo test --lib)
    BACKEND_STATUS="ok"
  else
    echo "cargo introuvable – étape backend ignorée"
    BACKEND_STATUS="missing-cargo"
  fi
else
  echo "Étape backend ignorée (flag --skip-backend)"
fi

printf '\n[2/4] Remotion worker smoke test\n'
REMOTION_ROOT="${REMOTION_PROJECT_ROOT:-"$ROOT_DIR/video-renderer"}"
if [ -d "$REMOTION_ROOT" ]; then
  pushd "$REMOTION_ROOT" >/dev/null
  npm ci
  npm run build
  npm run render:sample || npm run render
  popd >/dev/null
  REMOTION_STATUS="ok"
  mkdir -p "$ARTIFACT_ROOT/remotion"
  copy_tree "$REMOTION_ROOT/renders" "$ARTIFACT_ROOT/remotion"
else
  echo "REMOTION_PROJECT_ROOT non défini ou introuvable – étape ignorée"
  REMOTION_STATUS="missing-root"
fi

printf '\n[3/4] Mobile Expo E2E (Detox)\n'
DETOX_STATUS="skipped"
if command -v detox >/dev/null 2>&1; then
  pushd mobile >/dev/null
  npm ci
  npx expo prebuild >/dev/null
  detoxConfig="${QA_MOBILE_CONFIGURATION:-ios.sim.debug}"
  echo "→ Configuration Detox : $detoxConfig"
  if detox test --configuration "$detoxConfig"; then
    DETOX_STATUS="ok"
  else
    DETOX_STATUS="failed"
  fi
  popd >/dev/null
  copy_tree mobile/artifacts "$ARTIFACT_ROOT/mobile"
else
  echo "Detox non installé – étape ignorée"
  DETOX_STATUS="missing-detox"
fi

printf '\n[4/4] Web Playwright suite\n'
PLAYWRIGHT_STATUS="skipped"
pushd frontend >/dev/null
npm ci
npx playwright install --with-deps
playwrightProject="${QA_PLAYWRIGHT_PROJECT:-chromium}"
if npm run test:e2e -- --project="$playwrightProject" --grep="Immersive" --reporter=html; then
  PLAYWRIGHT_STATUS="ok"
else
  PLAYWRIGHT_STATUS="failed"
fi
popd >/dev/null
copy_tree frontend/playwright-report "$ARTIFACT_ROOT/playwright"

record_summary "$BACKEND_STATUS" "$REMOTION_STATUS" "$DETOX_STATUS" "$PLAYWRIGHT_STATUS"

printf '\n✅ QA pipeline terminée. Résumé : %s\n' "$SUMMARY_FILE"
printf 'Voir docs/video_pipeline_qa.md pour détails.\n'