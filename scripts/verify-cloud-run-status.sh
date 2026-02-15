#!/bin/bash
# 🔍 Script de vérification du statut Cloud Run et connexion PostgreSQL
# Usage: ./scripts/verify-cloud-run-status.sh

set -e

echo "🔍 Vérification du statut Cloud Run et connexion PostgreSQL..."
echo ""

# Configuration
PROJECT_ID="yukpo-project"
REGION="europe-west1"
SERVICE_NAME="yukpo-backend"

# 1. Vérifier le statut du service Cloud Run
echo "📊 1. Statut du service Cloud Run..."
echo "----------------------------------------"
gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format="table(
    metadata.name,
    status.url,
    status.conditions[0].type,
    status.conditions[0].status,
    status.latestReadyRevisionName,
    spec.template.spec.containers[0].image
  )" || {
  echo "❌ Erreur: Impossible de récupérer le statut du service"
  exit 1
}

echo ""
echo "📋 2. Détails de la dernière révision..."
echo "----------------------------------------"
LATEST_REVISION=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format="value(status.latestReadyRevisionName)")

if [ -z "$LATEST_REVISION" ]; then
  echo "⚠️ Aucune révision prête trouvée"
else
  echo "✅ Révision active: $LATEST_REVISION"
  gcloud run revisions describe $LATEST_REVISION \
    --region $REGION \
    --project $PROJECT_ID \
    --format="table(
      metadata.name,
      status.conditions[0].type,
      status.conditions[0].status,
      spec.containers[0].image
    )"
fi

echo ""
echo "📝 3. Logs récents (dernières 20 lignes)..."
echo "----------------------------------------"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" \
  --limit 20 \
  --project $PROJECT_ID \
  --format="table(timestamp,severity,textPayload)" \
  --freshness=1h || echo "⚠️ Aucun log récent trouvé"

echo ""
echo "🌐 4. Test de l'endpoint HTTP..."
echo "----------------------------------------"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format="value(status.url)")

if [ -n "$SERVICE_URL" ]; then
  echo "✅ URL du service: $SERVICE_URL"
  echo ""
  echo "Test de connexion HTTP..."
  
  # Test health check
  if curl -s -f -o /dev/null -w "HTTP Status: %{http_code}\n" "$SERVICE_URL/health" 2>/dev/null; then
    echo "✅ Health check: OK"
  else
    echo "⚠️ Health check: Échec ou endpoint non disponible"
  fi
  
  # Test endpoint racine
  if curl -s -f -o /dev/null -w "HTTP Status: %{http_code}\n" "$SERVICE_URL/" 2>/dev/null; then
    echo "✅ Endpoint racine: OK"
  else
    echo "⚠️ Endpoint racine: Échec"
  fi
else
  echo "❌ URL du service non disponible"
fi

echo ""
echo "🗄️ 5. Vérification de la connexion PostgreSQL..."
echo "----------------------------------------"
echo "ℹ️ Pour vérifier la connexion PostgreSQL, consultez les logs Cloud Run ci-dessus"
echo "   Recherchez les messages:"
echo "   - '✅ Connexion PostgreSQL établie'"
echo "   - '❌ ERREUR CRITIQUE: Impossible de se connecter à PostgreSQL'"
echo "   - '🚀 Cloud Run: Migrations SQLx lancées en arrière-plan'"

echo ""
echo "✅ Vérification terminée"
echo ""
echo "📊 Résumé:"
echo "  - Service: $SERVICE_NAME"
echo "  - Région: $REGION"
echo "  - URL: $SERVICE_URL"
echo "  - Révision: $LATEST_REVISION"


