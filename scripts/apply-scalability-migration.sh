#!/bin/bash
# ✅ Script pour appliquer la migration de scalabilité sur la base de données Render

set -e

# ✅ Configuration de la base de données Render
DB_HOST="your-render-db-host.render.com"
DB_NAME="yukpo_db"
DB_USER="yukpo_db_user"
DB_PASSWORD="YOUR_PASSWORD"
DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}/${DB_NAME}"

echo "🚀 Application de la migration de scalabilité sur Render DB"
echo "=================================================="
echo "Host: $DB_HOST"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

# ✅ Vérifier que psql est disponible
if ! command -v psql &> /dev/null; then
    echo "❌ psql n'est pas installé"
    echo "   Installer PostgreSQL client: https://www.postgresql.org/download/"
    exit 1
fi

# ✅ Vérifier la connexion
echo "🔍 Vérification de la connexion..."
if psql "$DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Connexion réussie"
else
    echo "❌ Échec de la connexion"
    exit 1
fi

# ✅ Appliquer la migration
echo ""
echo "📦 Application de la migration 20250101_scalability_improvements.sql..."
psql "$DB_URL" -f backend/migrations/20250101_scalability_improvements.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration appliquée avec succès!"
    echo ""
    echo "🔍 Vérification des objets créés..."
    
    # ✅ Vérifier les tables
    echo ""
    echo "Tables créées:"
    psql "$DB_URL" -c "\dt video_generation_metrics rate_limit_tracking studio_session_cache" 2>/dev/null || echo "  (certaines tables peuvent déjà exister)"
    
    # ✅ Vérifier les index
    echo ""
    echo "Index créés (exemples):"
    psql "$DB_URL" -c "\di idx_video_jobs_status_created idx_video_jobs_user_status idx_studio_sessions_user_updated" 2>/dev/null || echo "  (certains index peuvent déjà exister)"
    
    # ✅ Vérifier la vue matérialisée
    echo ""
    echo "Vue matérialisée:"
    psql "$DB_URL" -c "\dm video_generation_stats_hourly" 2>/dev/null || echo "  (la vue peut déjà exister)"
    
    echo ""
    echo "✅ Migration complète!"
else
    echo ""
    echo "❌ Erreur lors de l'application de la migration"
    exit 1
fi

