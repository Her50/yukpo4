#!/bin/bash
# ✅ Script pour vérifier et configurer le déploiement sur Render.com

set -e

echo "🚀 Configuration Déploiement Render.com"
echo "=================================================="
echo ""

# ✅ Vérifier que nous sommes sur Render ou local
if [ -n "$RENDER" ] || [ -n "$RENDER_SERVICE_URL" ]; then
    echo "✅ Environnement Render détecté"
    BACKEND_URL="${RENDER_SERVICE_URL:-${RENDER_EXTERNAL_URL:-https://yukpomnang.onrender.com}}"
else
    echo "⚠️  Environnement local - utiliser URL Render"
    BACKEND_URL="${BACKEND_URL:-https://yukpomnang.onrender.com}"
fi

echo "Backend URL: $BACKEND_URL"
echo ""

# ✅ Vérifier les variables d'environnement nécessaires
echo "📋 Variables d'environnement nécessaires sur Render.com:"
echo ""
echo "CRITIQUES:"
echo "  - DATABASE_URL (PostgreSQL)"
echo "  - JWT_SECRET"
echo "  - OPENAI_API_KEY"
echo ""
echo "SCALABILITÉ (nouveau):"
echo "  - REDIS_URL (optionnel mais recommandé)"
echo "  - RUST_LOG=info"
echo ""

# ✅ Vérifier la connexion au backend
echo "🔍 Vérification connexion backend..."
if curl -s -f "$BACKEND_URL/healthz" > /dev/null 2>&1; then
    echo "✅ Backend accessible"
    
    # ✅ Vérifier les métriques
    echo ""
    echo "🔍 Vérification métriques..."
    if curl -s -f "$BACKEND_URL/metrics/prometheus" > /dev/null 2>&1; then
        echo "✅ Endpoint /metrics/prometheus accessible"
        
        # Afficher quelques métriques
        METRICS=$(curl -s "$BACKEND_URL/metrics/prometheus" | head -20)
        echo ""
        echo "📊 Exemples de métriques:"
        echo "$METRICS" | grep -E "video_|job=" | head -10 || echo "  (Aucune métrique vidéo trouvée)"
    else
        echo "⚠️  Endpoint /metrics/prometheus non accessible"
    fi
else
    echo "❌ Backend non accessible à $BACKEND_URL"
    echo ""
    echo "💡 Actions:"
    echo "  1. Vérifier que le service est déployé sur Render"
    echo "  2. Vérifier les variables d'environnement"
    echo "  3. Vérifier les logs sur Render Dashboard"
    exit 1
fi

echo ""
echo "✅ Vérification terminée!"
echo ""
echo "📝 Pour configurer sur Render.com:"
echo "  1. Aller sur https://dashboard.render.com"
echo "  2. Sélectionner votre service 'yukpomnang'"
echo "  3. Onglet 'Environment'"
echo "  4. Ajouter les variables nécessaires"
echo "  5. Redéployer si nécessaire"

