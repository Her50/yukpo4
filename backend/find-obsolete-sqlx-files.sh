#!/bin/bash
# Script pour identifier les fichiers .sqlx dans Git qui ne sont plus générés

echo "=== Identification des fichiers .sqlx obsolètes dans Git ==="

# Aller dans le répertoire backend
cd "$(dirname "$0")"

# Aller à la racine du repo (parent du répertoire backend)
REPO_ROOT="$(cd .. && pwd)"
cd "$REPO_ROOT"

echo "Répertoire du repo: $REPO_ROOT"

export DATABASE_URL="postgresql://user:password@host:port/database"
export SQLX_OFFLINE=false

echo "1. Liste des fichiers .sqlx dans Git..."
git ls-files backend/.sqlx > backend/git-sqlx-files.txt
GIT_COUNT=$(wc -l < backend/git-sqlx-files.txt | tr -d ' ')
echo "   Fichiers dans Git: $GIT_COUNT"

echo "2. Sauvegarde de l'ancien cache..."
cd backend
if [ -d ".sqlx" ]; then
    mv .sqlx .sqlx.backup
fi

echo "3. Régénération complète du cache..."
rm -rf .sqlx
cargo sqlx prepare -- --lib > /dev/null 2>&1
cargo sqlx prepare --workspace > /dev/null 2>&1

echo "4. Liste des fichiers .sqlx générés..."
find .sqlx -type f -name "*.json" 2>/dev/null | sed 's|^\.sqlx/||' | sort > newly-generated-sqlx-files.txt
NEW_COUNT=$(wc -l < newly-generated-sqlx-files.txt | tr -d ' ')
echo "   Fichiers générés: $NEW_COUNT"

sed 's|^backend/\.sqlx/||' git-sqlx-files.txt | sort > git-sqlx-files-normalized.txt

echo "5. Identification des fichiers obsolètes..."
comm -23 git-sqlx-files-normalized.txt newly-generated-sqlx-files.txt > obsolete-files.txt
OBSOLETE_COUNT=$(wc -l < obsolete-files.txt | tr -d ' ')
echo "   Fichiers obsolètes dans Git: $OBSOLETE_COUNT"

if [ "$OBSOLETE_COUNT" -gt 0 ]; then
    echo ""
    echo "=== Fichiers obsolètes (premiers 20) ==="
    head -20 obsolete-files.txt
fi

comm -13 git-sqlx-files-normalized.txt newly-generated-sqlx-files.txt > missing-in-git.txt
MISSING_COUNT=$(wc -l < missing-in-git.txt | tr -d ' ')
echo ""
echo "6. Fichiers manquants dans Git: $MISSING_COUNT"

if [ "$MISSING_COUNT" -gt 0 ]; then
    echo ""
    echo "=== Fichiers manquants (premiers 20) ==="
    head -20 missing-in-git.txt
fi

echo ""
echo "=== Résumé ==="
echo "Fichiers dans Git: $GIT_COUNT"
echo "Fichiers générés: $NEW_COUNT"
echo "Fichiers obsolètes: $OBSOLETE_COUNT"
echo "Fichiers manquants: $MISSING_COUNT"

if [ -d ".sqlx.backup" ]; then
    rm -rf .sqlx
    mv .sqlx.backup .sqlx
    echo ""
    echo "✅ Ancien cache restauré"
fi

echo ""
echo "✅ Script terminé"
echo "   - obsolete-files.txt : Liste des fichiers obsolètes"
echo "   - missing-in-git.txt : Liste des fichiers manquants"
