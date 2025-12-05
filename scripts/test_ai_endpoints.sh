#!/bin/bash
# ✅ Script pour tester les endpoints IA
# Usage: ./scripts/test_ai_endpoints.sh [API_URL]

set -e

API_URL="${1:-http://localhost:3000}"
JWT_TOKEN="${2:-}"

echo "🧪 Test des endpoints IA sur $API_URL"

# Couleurs pour les résultats
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour tester un endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "\n${YELLOW}Test: $description${NC}"
    echo "Endpoint: $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$API_URL$endpoint" \
            ${JWT_TOKEN:+-H "Authorization: Bearer $JWT_TOKEN"})
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint" \
            ${JWT_TOKEN:+-H "Authorization: Bearer $JWT_TOKEN"} \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✅ Succès (HTTP $http_code)${NC}"
        echo "Réponse: $(echo "$body" | head -c 200)..."
    else
        echo -e "${RED}❌ Erreur (HTTP $http_code)${NC}"
        echo "Réponse: $body"
    fi
}

# Tests Bourse du Livre IA
echo -e "\n${YELLOW}=== Tests Bourse du Livre IA ===${NC}"
test_endpoint "GET" "/api/bourse-livre/ai/price-suggestions?titre=Mathématiques%206ème&etat_livre=Bon&classe_actuelle=6ème&matiere=Mathématiques" "" "Suggestions prix IA (publique)"

# Tests Orientation Scolaire IA (nécessitent authentification)
if [ -n "$JWT_TOKEN" ]; then
    echo -e "\n${YELLOW}=== Tests Orientation Scolaire IA ===${NC}"
    test_endpoint "POST" "/api/orientation/ai/analyze-profile" '{"profile_data":{"age":18,"niveau_etude_actuel":"Lycée","interets":["Informatique"],"matieres_preferees":["Mathématiques"]}}' "Analyse profil IA"
    test_endpoint "POST" "/api/orientation/ai/recommendations" '{"criteria":{"niveau_etude_actuel":"Lycée","interets":["Informatique"]}}' "Recommandations programmes IA"
fi

# Tests Offres d'Emploi IA
echo -e "\n${YELLOW}=== Tests Offres d'Emploi IA ===${NC}"
test_endpoint "GET" "/api/offres-emploi/ai/salary-prediction?titre_poste=Développeur%20Full%20Stack&secteur=Informatique&ville=Douala&experience_annees=3&niveau_etude=Bac+5" "" "Prédiction salaire IA (publique)"

if [ -n "$JWT_TOKEN" ]; then
    test_endpoint "POST" "/api/offres-emploi/ai/analyze-cv" '{"candidat_id":1,"cv_text":"Développeur Full Stack avec 5 ans d\'expérience"}' "Analyse CV IA"
fi

echo -e "\n${GREEN}✅ Tests terminés!${NC}"
echo -e "\nNote: Pour tester avec authentification, passez un JWT token:"
echo "  ./scripts/test_ai_endpoints.sh $API_URL YOUR_JWT_TOKEN"

