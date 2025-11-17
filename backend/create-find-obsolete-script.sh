#!/bin/bash
# Script à exécuter sur Ubuntu pour créer et exécuter find-obsolete-sqlx-files.sh

cd /opt/yukpo/backend

cat > find-obsolete-sqlx-files.sh << 'SCRIPT_END'
#!/bin/bash
# Script pour identifier les fichiers .sqlx dans Git qui ne sont plus générés

echo "=== Identification des fichiers .sqlx obsolètes dans Git ==="

cd "$(dirname "$0")"

# 1. Exporter DATABASE_URL
export DATABASE_URL="postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"
export SQLX_OFFLINE=false

# 2. Lister les fichiers dans Git
echo "1. Liste des fichiers .sqlx dans Git..."
git ls-files backend/.sqlx > git-sqlx-files.txt
GIT_COUNT=$(wc -l < git-sqlx-files.txt | tr -d ' ')
echo "   Fichiers dans Git: $GIT_COUNT"

# 3. Sauvegarder l'ancien cache
echo "2. Sauvegarde de l'ancien cache..."
if [ -d ".sqlx" ]; then
    mv .sqlx .sqlx.backup
fi

# 4. Régénérer le cache
echo "3. Régénération complète du cache..."
rm -rf .sqlx
cargo sqlx prepare -- --lib 2>&1 | grep -E "query data|error" | head -5
cargo sqlx prepare --workspace 2>&1 | grep -E "query data|error" | head -5

# 5. Lister les nouveaux fichiers générés
echo "4. Liste des fichiers .sqlx générés..."
find .sqlx -type f -name "*.json" | sed 's|^\.sqlx/||' | sort > newly-generated-sqlx-files.txt
NEW_COUNT=$(wc -l < newly-generated-sqlx-files.txt | tr -d ' ')
echo "   Fichiers générés: $NEW_COUNT"

# 6. Normaliser les noms Git (retirer le préfixe backend/.sqlx/)
sed 's|^backend/\.sqlx/||' git-sqlx-files.txt | sort > git-sqlx-files-normalized.txt

# 7. Trouver les fichiers dans Git mais pas dans le nouveau cache
echo "5. Identification des fichiers obsolètes..."
comm -23 git-sqlx-files-normalized.txt newly-generated-sqlx-files.txt > obsolete-files.txt
OBSOLETE_COUNT=$(wc -l < obsolete-files.txt | tr -d ' ')
echo "   Fichiers obsolètes dans Git: $OBSOLETE_COUNT"

if [ "$OBSOLETE_COUNT" -gt 0 ]; then
    echo ""
    echo "=== Fichiers .sqlx obsolètes dans Git (ne sont plus générés) ==="
    head -20 obsolete-files.txt
    if [ "$OBSOLETE_COUNT" -gt 20 ]; then
        echo "... et $((OBSOLETE_COUNT - 20)) autres fichiers"
    fi
fi

# 8. Trouver les fichiers générés mais pas dans Git
echo ""
echo "6. Identification des fichiers manquants dans Git..."
comm -13 git-sqlx-files-normalized.txt newly-generated-sqlx-files.txt > missing-in-git.txt
MISSING_COUNT=$(wc -l < missing-in-git.txt | tr -d ' ')
echo "   Fichiers générés mais pas dans Git: $MISSING_COUNT"

if [ "$MISSING_COUNT" -gt 0 ]; then
    echo ""
    echo "=== Fichiers .sqlx manquants dans Git ==="
    head -20 missing-in-git.txt
    if [ "$MISSING_COUNT" -gt 20 ]; then
        echo "... et $((MISSING_COUNT - 20)) autres fichiers"
    fi
fi

# 9. Résumé
echo ""
echo "=== Résumé ==="
echo "Fichiers dans Git: $GIT_COUNT"
echo "Fichiers générés: $NEW_COUNT"
echo "Fichiers obsolètes dans Git: $OBSOLETE_COUNT"
echo "Fichiers manquants dans Git: $MISSING_COUNT"
echo ""
echo "Gap: $OBSOLETE_COUNT fichiers obsolètes dans Git"

# 10. Restaurer l'ancien cache
if [ -d ".sqlx.backup" ]; then
    rm -rf .sqlx
    mv .sqlx.backup .sqlx
    echo ""
    echo "✅ Ancien cache restauré"
fi

echo ""
echo "=== Fichiers générés ==="
echo "- git-sqlx-files.txt : Tous les fichiers dans Git"
echo "- newly-generated-sqlx-files.txt : Fichiers générés par cargo sqlx prepare"
echo "- obsolete-files.txt : Fichiers dans Git mais obsolètes"
echo "- missing-in-git.txt : Fichiers générés mais manquants dans Git"
SCRIPT_END

chmod +x find-obsolete-sqlx-files.sh

echo "✅ Script find-obsolete-sqlx-files.sh créé"
echo ""
echo "Vous pouvez maintenant exécuter:"
echo "  ./find-obsolete-sqlx-files.sh"

