#!/bin/bash
# ✅ Script pour exécuter les tests de charge

set -e

API_URL="${API_URL:-http://localhost:3000}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
TEST_TYPE="${TEST_TYPE:-all}"

echo "🚀 Tests de Charge"
echo "=================================================="
echo "API URL: $API_URL"
echo "Test Type: $TEST_TYPE"
echo ""

# ✅ Test 1: Apache Bench (si disponible)
if command -v ab &> /dev/null && [ "$TEST_TYPE" = "all" ] || [ "$TEST_TYPE" = "ab" ]; then
    echo "📊 Test Apache Bench..."
    if [ -f "scripts/load_test.sh" ]; then
        chmod +x scripts/load_test.sh
        ./scripts/load_test.sh
    else
        echo "⚠️  Script load_test.sh non trouvé"
    fi
fi

# ✅ Test 2: k6 (si disponible)
if command -v k6 &> /dev/null && [ "$TEST_TYPE" = "all" ] || [ "$TEST_TYPE" = "k6" ]; then
    echo ""
    echo "📊 Test k6..."
    if [ -f "scripts/load_test_k6.js" ]; then
        export API_URL=$API_URL
        export AUTH_TOKEN=$AUTH_TOKEN
        k6 run scripts/load_test_k6.js
    else
        echo "⚠️  Script load_test_k6.js non trouvé"
    fi
fi

# ✅ Résumé
echo ""
echo "✅ Tests de charge terminés!"
echo ""
echo "📊 Pour analyser les résultats:"
echo "  - Vérifier les métriques Prometheus"
echo "  - Vérifier les logs du backend"
echo "  - Vérifier les performances Redis"

