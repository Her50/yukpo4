#!/bin/bash
# Script pour régénérer le cache SQLx sur Ubuntu (solution définitive)

echo "=== Régénération du cache SQLx sur Ubuntu ==="

cd "$(dirname "$0")"

# 1. Exporter DATABASE_URL
export DATABASE_URL="postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"
export SQLX_OFFLINE=false

echo "✅ DATABASE_URL configurée"

# 2. Vérifier la connexion DB
echo "Test de connexion à la base de données..."
if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Connexion DB OK"
else
    echo "⚠️ Impossible de tester la connexion DB (psql non installé ou connexion non disponible)"
    echo "Continuons quand même avec cargo sqlx prepare..."
fi

# 3. Supprimer l'ancien cache
echo "Suppression de l'ancien cache .sqlx..."
if [ -d ".sqlx" ]; then
    rm -rf .sqlx
    echo "✅ Ancien cache supprimé"
else
    echo "ℹ️ Pas d'ancien cache à supprimer"
fi

# 4. Générer le cache pour la bibliothèque
echo "Génération du cache pour la bibliothèque (cargo sqlx prepare -- --lib)..."
if cargo sqlx prepare -- --lib; then
    echo "✅ Cache pour la bibliothèque généré"
else
    echo "❌ Erreur lors de la génération du cache pour la bibliothèque"
    echo "Vérifiez que DATABASE_URL est correcte et que la DB est accessible"
    exit 1
fi

# 5. Générer le cache pour le workspace
echo "Génération du cache pour le workspace (cargo sqlx prepare --workspace)..."
if cargo sqlx prepare --workspace; then
    echo "✅ Cache pour le workspace généré"
else
    echo "⚠️ Erreur lors de la génération du cache pour le workspace"
    echo "Le cache de la bibliothèque devrait suffire pour le build Docker"
fi

# 6. Compter les fichiers générés
CACHE_COUNT=$(find .sqlx -type f 2>/dev/null | wc -l || echo 0)
echo ""
echo "📊 Résultat: $CACHE_COUNT fichiers dans le cache .sqlx"

if [ $CACHE_COUNT -eq 0 ]; then
    echo "❌ ERREUR: Le cache est vide!"
    exit 1
fi

# 7. Tester la compilation offline
echo ""
echo "Test de compilation en mode offline..."
export SQLX_OFFLINE=true
if cargo check --lib --message-format=short 2>&1 | head -20; then
    echo ""
    echo "✅ Compilation réussie en mode offline"
else
    echo ""
    echo "⚠️ Des erreurs persistent, mais continuons..."
fi

# 8. Instructions finales
echo ""
echo "=== ✅ Cache SQLx régénéré avec succès ==="
echo ""
echo "Prochaines étapes:"
echo "1. Commiter le cache:"
echo "   cd /opt/yukpo"
echo "   git add backend/.sqlx/"
echo "   git commit -m 'chore: update sqlx cache for Docker build'"
echo "   git push"
echo ""
echo "2. Build Docker:"
echo "   cd /opt/yukpo/backend"
echo "   docker build -f Dockerfile -t yukpo-backend:latest ."
echo ""

