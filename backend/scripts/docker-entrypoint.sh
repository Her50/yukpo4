#!/bin/bash
# ✅ Script d'entrée Docker unifié pour Cloud Run et autres environnements
# Gère automatiquement la détection de l'environnement et le choix du script approprié

set -e

# Logs de démarrage
echo "🚀 [ENTRYPOINT] Démarrage du conteneur..."
echo "🔍 [ENTRYPOINT] Variables d'environnement détectées:"
echo "   - CLOUD_RUN: ${CLOUD_RUN:-non défini}"
echo "   - PORT: ${PORT:-non défini}"
echo "   - HOST: ${HOST:-non défini}"

# Détecter l'environnement et choisir le script approprié
if [ "$CLOUD_RUN" = "true" ]; then
    echo "✅ [ENTRYPOINT] Environnement Cloud Run détecté"
    echo "🚀 [ENTRYPOINT] Utilisation de startup-wrapper.sh pour Cloud Run"
    exec /app/startup-wrapper.sh
else
    echo "✅ [ENTRYPOINT] Environnement non-Cloud Run détecté (AWS/autre)"
    echo "🚀 [ENTRYPOINT] Utilisation de start-cloud.sh"
    exec /app/start-cloud.sh
fi

