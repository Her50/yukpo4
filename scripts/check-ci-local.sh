#!/bin/bash
# Script pour vérifier localement avec les mêmes flags que le CI
# Usage: ./scripts/check-ci-local.sh

set -e

echo "🔍 Vérification locale avec les mêmes flags que le CI..."
echo ""

cd backend

# Vérification formatage
echo "📝 1/4 Vérification formatage (cargo fmt --check)..."
if ! cargo fmt -- --check; then
    echo "❌ Formatage incorrect. Exécutez: cargo fmt"
    exit 1
fi
echo "✅ Formatage OK"
echo ""

# Vérification clippy strict (comme le CI)
echo "🔍 2/4 Vérification clippy strict (--all-targets -- -D warnings)..."
if ! cargo clippy --all-targets -- -D warnings; then
    echo "❌ Erreurs clippy détectées"
    exit 1
fi
echo "✅ Clippy OK"
echo ""

# Vérification build release
echo "🔨 3/4 Vérification build release (--release --locked)..."
if ! cargo build --release --locked; then
    echo "❌ Erreurs de build détectées"
    exit 1
fi
echo "✅ Build OK"
echo ""

# Vérification sqlx (si base accessible)
echo "📊 4/4 Vérification sqlx..."
if [ -f "sqlx-data.json" ] || [ -d ".sqlx" ]; then
    echo "✅ Fichiers sqlx préparés trouvés"
else
    echo "⚠️  Aucun fichier sqlx préparé trouvé (sqlx-data.json ou .sqlx/)"
    echo "   Pour générer: cargo sqlx prepare -- --lib (avec DATABASE_URL configuré)"
fi
echo ""

echo "✅ Toutes les vérifications CI passent localement !"
echo "🎉 Vous pouvez push en toute sécurité"

