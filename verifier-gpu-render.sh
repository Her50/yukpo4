#!/bin/bash
# Script pour verifier la configuration GPU sur Render (via API ou logs)

BACKEND_URL="https://yukpomnang.onrender.com"

echo "=== VERIFICATION GPU SUR RENDER ==="
echo "Backend URL: $BACKEND_URL"
echo ""

# Vérifier le health endpoint pour voir si GPU est mentionné
echo "1. Verification via /healthz"
HEALTH=$(curl -s -k "$BACKEND_URL/healthz" 2>/dev/null)
if [ -n "$HEALTH" ]; then
    echo "Reponse: $HEALTH"
    if echo "$HEALTH" | grep -qi "gpu"; then
        echo "OK: GPU mentionne dans la reponse"
    else
        echo "INFO: GPU non mentionne dans /healthz"
    fi
else
    echo "ERREUR: Impossible d'acceder au backend"
fi

echo ""
echo "2. Verification via /metrics"
METRICS=$(curl -s -k "$BACKEND_URL/metrics" 2>/dev/null | head -50)
if [ -n "$METRICS" ]; then
    if echo "$METRICS" | grep -qi "gpu"; then
        echo "OK: Metriques GPU trouvees"
        echo "$METRICS" | grep -i "gpu"
    else
        echo "INFO: Aucune metrique GPU trouvee"
    fi
else
    echo "ERREUR: Impossible d'acceder aux metriques"
fi

echo ""
echo "3. Variables d'environnement a verifier sur Render"
echo "---------------------------------------------------"
echo "Variables GPU a configurer sur Render:"
echo "  - GPU_AVAILABLE=true"
echo "  - CUDA_VISIBLE_DEVICES=0 (si GPU disponible)"
echo "  - GPU_TYPE=nvidia"
echo "  - GPU_MEMORY_GB=16 (selon votre GPU)"
echo ""
echo "Variables video renderer GPU:"
echo "  - VIDEO_RENDERER_ENABLE_GPU=true"
echo "  - VIDEO_RENDERER_RPC_URL=... (si worker GPU separe)"
echo ""
echo "Pour verifier sur Render:"
echo "  1. Aller sur https://dashboard.render.com"
echo "  2. Service 'yukpomnang' → Environment"
echo "  3. Verifier que les variables GPU sont configurees"

