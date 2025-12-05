#!/bin/bash
# ✅ Script de test pour l'API des templates (Phase 1.4)

BASE_URL="http://localhost:3000"
TOKEN="${1:-your_jwt_token_here}"

echo "🧪 Tests API Templates - Phase 1.4"
echo "==================================="

# Test 1: Liste des templates
echo ""
echo "Test 1: Liste des templates"
response=$(curl -s -X GET "${BASE_URL}/api/templates" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json")

total=$(echo $response | jq '.total // 0')
echo "✅ Total templates: $total"
if [ "$total" -eq 50 ]; then
  echo "✅ SUCCÈS: 50 templates trouvés"
else
  echo "❌ ÉCHEC: Attendu 50, obtenu $total"
fi

# Test 2: Filtrage par industrie
echo ""
echo "Test 2: Filtrage par industrie (ecommerce)"
response=$(curl -s -X GET "${BASE_URL}/api/templates?industry=ecommerce" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json")

count=$(echo $response | jq '.templates | length')
echo "✅ Templates ecommerce: $count"

# Test 3: Recherche textuelle
echo ""
echo "Test 3: Recherche textuelle (produit)"
response=$(curl -s -X GET "${BASE_URL}/api/templates?q=produit" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json")

count=$(echo $response | jq '.templates | length')
echo "✅ Résultats recherche: $count"

# Test 4: Pagination
echo ""
echo "Test 4: Pagination (limit=10, offset=0)"
response=$(curl -s -X GET "${BASE_URL}/api/templates?limit=10&offset=0" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json")

count=$(echo $response | jq '.templates | length')
echo "✅ Templates retournés: $count (limit: 10)"

echo ""
echo "✅ Tests terminés!"

