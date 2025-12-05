#!/bin/bash
# ✅ Script de test pour l'API des effets (Phase 1.2)

BASE_URL="http://localhost:3000"
TOKEN="${1:-your_jwt_token_here}"

echo "🧪 Tests API Effets - Phase 1.2"
echo "=================================="

# Test 1: Liste des effets
echo ""
echo "Test 1: Liste des effets"
response=$(curl -s -X GET "${BASE_URL}/api/effects" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json")

total=$(echo $response | jq '.total // 0')
echo "✅ Total effets: $total"
if [ "$total" -eq 49 ]; then
  echo "✅ SUCCÈS: 49 effets trouvés"
else
  echo "❌ ÉCHEC: Attendu 49, obtenu $total"
fi

# Test 2: Filtrage par catégorie
echo ""
echo "Test 2: Filtrage par catégorie (transitions)"
response=$(curl -s -X GET "${BASE_URL}/api/effects?category=transitions" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json")

count=$(echo $response | jq '.effects | length')
echo "✅ Effets transitions: $count"

# Test 3: Recherche textuelle
echo ""
echo "Test 3: Recherche textuelle (fade)"
response=$(curl -s -X GET "${BASE_URL}/api/effects?q=fade" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json")

count=$(echo $response | jq '.effects | length')
echo "✅ Résultats recherche: $count"

# Test 4: Pagination
echo ""
echo "Test 4: Pagination (limit=10, offset=0)"
response=$(curl -s -X GET "${BASE_URL}/api/effects?limit=10&offset=0" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json")

count=$(echo $response | jq '.effects | length')
echo "✅ Effets retournés: $count (limit: 10)"

echo ""
echo "✅ Tests terminés!"

