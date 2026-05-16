#!/usr/bin/env bash
# =====================================================================
# Purge des fichiers .env de l'historique git complet.
#
# À EXÉCUTER UNIQUEMENT APRÈS rotation des clés exposées (sinon inutile :
# GitHub conserve les blobs orphelins ~90 jours, accessibles via API).
#
# Clés à rotater AVANT (cf. project_audit_bourse_2026_05_16.md) :
#   - Google Maps API : AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ
#   - Pinecone API    : pcsk_6aD9si_CSCQPpYjfbVR5VKmqaZQYDu2P49KsvSBvbgUftR24tRMYp7YesZfNWDrALRhdmu
#
# ⚠️ DESTRUCTIF : réécrit toute l'histoire git. Tous les clones existants
# (CI, autres devs, ton laptop secondaire) deviendront invalides.
# Les PR ouvertes sur GitHub seront cassées.
# =====================================================================

set -euo pipefail

cd "$(dirname "$0")/.."

REPO_URL="https://github.com/Her50/yukpo4.git"
BACKUP_DIR="/tmp/yukpo4-backup-$(date +%Y%m%d-%H%M%S).git"

echo "==> Step 1/6 : Backup mirror du repo dans $BACKUP_DIR"
git clone --mirror "$REPO_URL" "$BACKUP_DIR"

echo ""
echo "==> Step 2/6 : Vérifier que git-filter-repo est installé"
if ! command -v git-filter-repo > /dev/null 2>&1; then
    echo "ERREUR : git-filter-repo non installé."
    echo "  → pip install git-filter-repo"
    echo "  → ou : brew install git-filter-repo"
    exit 1
fi

echo ""
echo "==> Step 3/6 : Lister les fichiers ciblés dans l'historique"
FILES=(
    "frontend/.env"
    "frontend/.env.production"
    "env_template/backend.qa.env"
    "env_template/mobile.qa.env"
    "env_template/web.qa.env"
)
for f in "${FILES[@]}"; do
    count=$(git log --oneline --all -- "$f" 2>/dev/null | wc -l)
    echo "  - $f : $count commits dans l'historique"
done

echo ""
read -p "==> Confirmer la purge (yes/no) ? " confirm
[ "$confirm" = "yes" ] || { echo "Annulé."; exit 0; }

echo ""
echo "==> Step 4/6 : git filter-repo (réécrit l'historique LOCAL)"
git filter-repo \
    --invert-paths \
    --path frontend/.env \
    --path frontend/.env.production \
    --path env_template/backend.qa.env \
    --path env_template/mobile.qa.env \
    --path env_template/web.qa.env

echo ""
echo "==> Step 5/6 : Re-ajouter le remote (filter-repo le supprime par sécurité)"
git remote add origin "$REPO_URL"

echo ""
echo "==> Step 6/6 : Force push (réécrit l'historique REMOTE)"
echo "    Avant : vérifier qu'AUCUNE PR ouverte n'est dépendante des SHA actuels."
read -p "    Force-push toutes les branches + tags vers origin (yes/no) ? " push_confirm
if [ "$push_confirm" = "yes" ]; then
    git push --force --all origin
    git push --force --tags origin
    echo ""
    echo "✅ Purge terminée. Tous les contributeurs doivent re-cloner."
    echo "   Backup conservé : $BACKUP_DIR"
else
    echo ""
    echo "Push annulé. Pour pousser manuellement plus tard :"
    echo "  git push --force --all origin"
    echo "  git push --force --tags origin"
fi
