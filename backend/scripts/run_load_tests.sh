#!/bin/bash
# ✅ Script pour exécuter les tests de charge covoiturage
# Usage: ./scripts/run_load_tests.sh

set -e

echo "🚀 Démarrage tests de charge covoiturage..."

# Vérifier variables d'environnement
if [ -z "$TEST_DATABASE_URL" ]; then
    echo "⚠️  TEST_DATABASE_URL non défini, utilisation valeur par défaut"
    export TEST_DATABASE_URL="postgresql://test:test@localhost:5432/yukpomnang_test"
fi

if [ -z "$TEST_REDIS_URL" ]; then
    echo "⚠️  TEST_REDIS_URL non défini, utilisation valeur par défaut"
    export TEST_REDIS_URL="redis://localhost:6379/1"
fi

echo "📊 Configuration:"
echo "   - Database: $TEST_DATABASE_URL"
echo "   - Redis: $TEST_REDIS_URL"
echo ""

# Tests unitaires
echo "🧪 Exécution tests unitaires..."
cargo test --test covoiturage_endpoints_test -- --ignored --nocapture

# Tests de charge
echo ""
echo "⚡ Exécution tests de charge..."
cargo test --test covoiturage_load_tests --release -- --ignored --nocapture

echo ""
echo "✅ Tests terminés!"

