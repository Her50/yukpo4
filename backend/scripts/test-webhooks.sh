#!/bin/bash

# Script de test pour les webhooks de paiement
# Usage: ./test-webhooks.sh [base_url]

BASE_URL=${1:-"http://localhost:8080"}
API_BASE_URL="${BASE_URL}/api"

echo "🧪 Test des Webhooks de Paiement"
echo "Base URL: $BASE_URL"
echo "=================================="

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour tester un endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "\n${YELLOW}Testing: $description${NC}"
    echo "Endpoint: $method $endpoint"
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method \
            -H "Content-Type: application/json" \
            "$API_BASE_URL$endpoint")
    fi
    
    # Séparer la réponse et le code de statut
    http_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✅ Success (HTTP $http_code)${NC}"
        echo "Response: $response_body"
    else
        echo -e "${RED}❌ Failed (HTTP $http_code)${NC}"
        echo "Response: $response_body"
    fi
}

# Test 1: Santé des webhooks
test_endpoint "GET" "/webhooks/health" "" "Santé des webhooks"

# Test 2: Webhook de test Orange Money
test_endpoint "POST" "/webhooks/test" '{
    "transaction_id": "test_orange_123",
    "status": "SUCCESS",
    "amount": 1000,
    "currency": "XAF",
    "phone_number": "675123456",
    "payment_method": "orange_money"
}' "Webhook de test Orange Money"

# Test 3: Webhook de test MTN Money
test_endpoint "POST" "/webhooks/test" '{
    "transaction_id": "test_mtn_456",
    "status": "SUCCESS",
    "amount": 2500,
    "currency": "XAF",
    "phone_number": "675987654",
    "payment_method": "mtn_money"
}' "Webhook de test MTN Money"

# Test 4: Webhook de test avec échec
test_endpoint "POST" "/webhooks/test" '{
    "transaction_id": "test_failed_789",
    "status": "FAILED",
    "amount": 500,
    "currency": "XAF",
    "phone_number": "675111222",
    "payment_method": "orange_money"
}' "Webhook de test avec échec"

# Test 5: Validation de numéro de téléphone (Cameroun)
test_endpoint "POST" "/payments/validate-phone" '{
    "phone_number": "675123456",
    "country": "CM"
}' "Validation numéro Cameroun"

# Test 6: Validation de numéro de téléphone (Côte d'Ivoire)
test_endpoint "POST" "/payments/validate-phone" '{
    "phone_number": "0712345678",
    "country": "CI"
}' "Validation numéro Côte d'Ivoire"

# Test 7: Validation de numéro invalide
test_endpoint "POST" "/payments/validate-phone" '{
    "phone_number": "123",
    "country": "CM"
}' "Validation numéro invalide"

# Test 8: Validation sans pays (détection automatique)
test_endpoint "POST" "/payments/validate-phone" '{
    "phone_number": "+237675123456"
}' "Validation avec détection automatique"

echo -e "\n${YELLOW}=================================="
echo "Tests terminés"
echo "==================================${NC}"

# Test des méthodes de paiement disponibles
echo -e "\n${YELLOW}Testing: Méthodes de paiement disponibles${NC}"
test_endpoint "GET" "/payments/methods" "" "Méthodes de paiement"

echo -e "\n${GREEN}🎉 Tous les tests sont terminés !${NC}"
echo -e "\n${YELLOW}Note:${NC} Pour tester les webhooks avec authentification JWT, vous devez d'abord vous connecter et obtenir un token."
echo -e "Utilisez: ${YELLOW}curl -X POST $API_BASE_URL/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"your_email\",\"password\":\"your_password\"}'${NC}"
