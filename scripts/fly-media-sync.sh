#!/usr/bin/env bash
# Migration médias Yukpo : source S3 (GCS interop ou Wasabi) → Tigris (Fly).
# Réversible : repointe les ENV S3_* du backend pour revenir à la source.
#
# Usage :
#   ./scripts/fly-media-sync.sh from-gcs       # GCS interop → Tigris
#   ./scripts/fly-media-sync.sh from-wasabi    # Wasabi → Tigris
#   ./scripts/fly-media-sync.sh verify         # compte objets & taille des deux côtés
#   ./scripts/fly-media-sync.sh rollback-gcs   # repointe Fly secrets → GCS
#
# Prérequis :
#   - aws CLI installé (compatible S3 generic)
#   - Variables source à fournir via .env.media-sync à la racine du repo
#     (gitignore ce fichier — il contient des credentials)
#
# Format .env.media-sync (à créer manuellement) :
#   GCS_S3_ACCESS_KEY=GOOG1...
#   GCS_S3_SECRET_KEY=...
#   GCS_S3_BUCKET=yukpo-project-yukpo-backend-media
#   WASABI_S3_ACCESS_KEY=GQ12B...
#   WASABI_S3_SECRET_KEY=...
#   WASABI_S3_BUCKET=yukpo-video-prod
#   WASABI_S3_REGION=eu-central-1

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.media-sync"
APP="${FLY_APP:-yukpo-fly-backend}"

# Tigris destination (récupéré via fly storage list ou .env.media-sync)
TIGRIS_ACCESS_KEY="${TIGRIS_ACCESS_KEY:-tid_sYmHzZry_wdRgrWThwrwryybWWXzHpOfuGYC_ckDZqAHaEhxGV}"
TIGRIS_SECRET_KEY="${TIGRIS_SECRET_KEY:-tsec_0wMpNIf6Wavch6c_TcribF7BLibZmmv5rxL9-koCzUuLIgp8WKNhOT7N81nqyEPM12CDzE}"
TIGRIS_ENDPOINT="https://fly.storage.tigris.dev"
TIGRIS_BUCKET="yukpo-media"
TIGRIS_REGION="auto"

[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"

cmd="${1:-}"

aws_src_gcs() {
  AWS_ACCESS_KEY_ID="$GCS_S3_ACCESS_KEY" \
  AWS_SECRET_ACCESS_KEY="$GCS_S3_SECRET_KEY" \
  AWS_DEFAULT_REGION="europe-west1" \
  aws --endpoint-url=https://storage.googleapis.com "$@"
}

aws_src_wasabi() {
  AWS_ACCESS_KEY_ID="$WASABI_S3_ACCESS_KEY" \
  AWS_SECRET_ACCESS_KEY="$WASABI_S3_SECRET_KEY" \
  AWS_DEFAULT_REGION="${WASABI_S3_REGION:-eu-central-1}" \
  aws --endpoint-url="https://s3.${WASABI_S3_REGION:-eu-central-1}.wasabisys.com" "$@"
}

aws_dst_tigris() {
  AWS_ACCESS_KEY_ID="$TIGRIS_ACCESS_KEY" \
  AWS_SECRET_ACCESS_KEY="$TIGRIS_SECRET_KEY" \
  AWS_DEFAULT_REGION="$TIGRIS_REGION" \
  aws --endpoint-url="$TIGRIS_ENDPOINT" "$@"
}

case "$cmd" in
  from-gcs)
    : "${GCS_S3_ACCESS_KEY:?defini dans .env.media-sync}"
    : "${GCS_S3_SECRET_KEY:?defini dans .env.media-sync}"
    : "${GCS_S3_BUCKET:?defini dans .env.media-sync}"
    echo "[sync] GCS s3://$GCS_S3_BUCKET → Tigris s3://$TIGRIS_BUCKET"
    # 1) Liste source pour log
    aws_src_gcs s3 ls "s3://$GCS_S3_BUCKET/" --recursive --summarize | tail -3
    # 2) Sync (idempotent — ne re-télécharge que les fichiers modifiés)
    AWS_ACCESS_KEY_ID="$GCS_S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$GCS_S3_SECRET_KEY" \
      aws s3 cp --recursive --no-progress \
      --source-region europe-west1 \
      --endpoint-url=https://storage.googleapis.com \
      "s3://$GCS_S3_BUCKET/" "/tmp/yukpo-media-stage/" 2>&1 | tail -10
    aws_dst_tigris s3 sync "/tmp/yukpo-media-stage/" "s3://$TIGRIS_BUCKET/" --no-progress 2>&1 | tail -10
    rm -rf /tmp/yukpo-media-stage
    echo "[ok] sync terminé"
    ;;

  from-wasabi)
    : "${WASABI_S3_ACCESS_KEY:?defini dans .env.media-sync}"
    : "${WASABI_S3_SECRET_KEY:?defini dans .env.media-sync}"
    : "${WASABI_S3_BUCKET:?defini dans .env.media-sync}"
    echo "[sync] Wasabi s3://$WASABI_S3_BUCKET → Tigris s3://$TIGRIS_BUCKET"
    aws_src_wasabi s3 ls "s3://$WASABI_S3_BUCKET/" --recursive --summarize | tail -3
    AWS_ACCESS_KEY_ID="$WASABI_S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$WASABI_S3_SECRET_KEY" \
      aws s3 cp --recursive --no-progress \
      --source-region "${WASABI_S3_REGION:-eu-central-1}" \
      --endpoint-url="https://s3.${WASABI_S3_REGION:-eu-central-1}.wasabisys.com" \
      "s3://$WASABI_S3_BUCKET/" "/tmp/yukpo-media-stage/" 2>&1 | tail -10
    aws_dst_tigris s3 sync "/tmp/yukpo-media-stage/" "s3://$TIGRIS_BUCKET/" --no-progress 2>&1 | tail -10
    rm -rf /tmp/yukpo-media-stage
    echo "[ok] sync terminé"
    ;;

  verify)
    echo "── Tigris (destination) ──"
    aws_dst_tigris s3 ls "s3://$TIGRIS_BUCKET/" --recursive --summarize | tail -3
    if [[ -n "${GCS_S3_ACCESS_KEY:-}" ]]; then
      echo "── GCS (source) ──"
      aws_src_gcs s3 ls "s3://$GCS_S3_BUCKET/" --recursive --summarize | tail -3
    fi
    if [[ -n "${WASABI_S3_ACCESS_KEY:-}" ]]; then
      echo "── Wasabi (source) ──"
      aws_src_wasabi s3 ls "s3://$WASABI_S3_BUCKET/" --recursive --summarize | tail -3
    fi
    ;;

  rollback-gcs)
    : "${GCS_S3_ACCESS_KEY:?defini dans .env.media-sync}"
    : "${GCS_S3_SECRET_KEY:?defini dans .env.media-sync}"
    : "${GCS_S3_BUCKET:?defini dans .env.media-sync}"
    echo "[rollback] Fly secrets → GCS interop"
    flyctl secrets set --app "$APP" --stage \
      S3_ACCESS_KEY="$GCS_S3_ACCESS_KEY" \
      S3_SECRET_KEY="$GCS_S3_SECRET_KEY" \
      S3_ENDPOINT="https://storage.googleapis.com" \
      S3_BUCKET="$GCS_S3_BUCKET" \
      S3_REGION="europe-west1" \
      S3_FORCE_PATH_STYLE="false"
    echo "[ok] redéploie pour appliquer : flyctl deploy --app $APP"
    ;;

  rollback-wasabi)
    : "${WASABI_S3_ACCESS_KEY:?defini dans .env.media-sync}"
    : "${WASABI_S3_SECRET_KEY:?defini dans .env.media-sync}"
    : "${WASABI_S3_BUCKET:?defini dans .env.media-sync}"
    echo "[rollback] Fly secrets → Wasabi"
    flyctl secrets set --app "$APP" --stage \
      S3_ACCESS_KEY="$WASABI_S3_ACCESS_KEY" \
      S3_SECRET_KEY="$WASABI_S3_SECRET_KEY" \
      S3_ENDPOINT="https://s3.${WASABI_S3_REGION:-eu-central-1}.wasabisys.com" \
      S3_BUCKET="$WASABI_S3_BUCKET" \
      S3_REGION="${WASABI_S3_REGION:-eu-central-1}" \
      S3_FORCE_PATH_STYLE="false"
    echo "[ok] redéploie pour appliquer : flyctl deploy --app $APP"
    ;;

  *)
    echo "Usage: $0 {from-gcs|from-wasabi|verify|rollback-gcs|rollback-wasabi}"
    exit 1
    ;;
esac
