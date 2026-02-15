#!/bin/bash
# ✅ Script de vérification des variables GPU dans GCP Cloud Run
# Usage: ./scripts/verify-gpu-variables-gcp.sh

SERVICE_NAME="${1:-yukpomnang-backend}"
REGION="${2:-europe-west1}"

echo "🔍 Vérification des variables GPU dans GCP Cloud Run..."
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"
echo ""

# Variables GPU requises
REQUIRED_VARS=(
    "GPU_ENABLED"
    "GPU_ENDPOINT"
    "GPU_ZONE"
    "GPU_INSTANCE_NAME"
    "GCP_PROJECT_ID"
    "GPU_MONTHLY_BUDGET"
    "GPU_SCALE_UP_THRESHOLD"
    "GPU_SCALE_DOWN_THRESHOLD"
    "GPU_MAX_INSTANCES"
    "GPU_MIN_INSTANCES"
)

# Variables GPU optionnelles
OPTIONAL_VARS=(
    "GCP_SERVICE_ACCOUNT"
    "GPU_SCALE_DOWN_COOLDOWN"
    "GPU_REQUEST_TIMEOUT"
)

echo "📋 Variables GPU requises:"
MISSING_VARS=()
FOUND_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    VALUE=$(gcloud run services describe "$SERVICE_NAME" \
        --region="$REGION" \
        --format="value(spec.template.spec.containers[0].env[?(@.name=='$var')].value)" \
        2>/dev/null)
    
    if [ -n "$VALUE" ]; then
        echo "  ✅ $var = $VALUE"
        FOUND_VARS+=("$var")
    else
        echo "  ❌ $var = NON DÉFINIE"
        MISSING_VARS+=("$var")
    fi
done

echo ""
echo "📋 Variables GPU optionnelles:"
for var in "${OPTIONAL_VARS[@]}"; do
    VALUE=$(gcloud run services describe "$SERVICE_NAME" \
        --region="$REGION" \
        --format="value(spec.template.spec.containers[0].env[?(@.name=='$var')].value)" \
        2>/dev/null)
    
    if [ -n "$VALUE" ]; then
        echo "  ✅ $var = $VALUE"
    else
        echo "  ⚠️  $var = Non définie (optionnel)"
    fi
done

echo ""
echo "📊 Résumé:"
echo "  Variables trouvées: ${#FOUND_VARS[@]}/${#REQUIRED_VARS[@]}"
echo "  Variables manquantes: ${#MISSING_VARS[@]}"

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo ""
    echo "❌ Variables manquantes:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "💡 Pour activer les variables, utilisez:"
    echo "   gcloud run services update $SERVICE_NAME --region=$REGION --update-env-vars=\"GPU_ENABLED=true\""
    echo ""
    echo "   Ou consultez VARIABLES_GPU_GCP_ALIGNEMENT.md pour les instructions complètes"
else
    echo ""
    echo "✅ Toutes les variables GPU sont configurées !"
    echo ""
    echo "💡 Vérifiez les logs au démarrage pour confirmer:"
    echo "   gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME\" --limit=50 --format=json"
fi

echo ""
echo "🔍 Vérification du statut GPU via API:"
echo "   curl https://your-backend-url/api/gpu/status"

