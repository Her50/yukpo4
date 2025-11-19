#!/bin/bash
# Script pour changer le mot de passe Grafana via API

GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"
OLD_PASSWORD="${GRAFANA_OLD_PASSWORD:-admin}"
NEW_PASSWORD="${GRAFANA_NEW_PASSWORD}"

if [ -z "$NEW_PASSWORD" ]; then
    echo "Usage: GRAFANA_NEW_PASSWORD='votre_mot_de_passe' bash changer-password-grafana.sh"
    echo ""
    echo "Ou avec ancien mot de passe personnalise:"
    echo "GRAFANA_OLD_PASSWORD='ancien' GRAFANA_NEW_PASSWORD='nouveau' bash changer-password-grafana.sh"
    exit 1
fi

echo "Changement du mot de passe Grafana..."
echo "URL: $GRAFANA_URL"
echo ""

# Vérifier que Grafana est accessible
if ! curl -s -f -u "admin:$OLD_PASSWORD" "$GRAFANA_URL/api/user" > /dev/null; then
    echo "ERREUR: Impossible de se connecter a Grafana avec le mot de passe actuel"
    echo "Verifiez que Grafana est accessible et que le mot de passe est correct"
    exit 1
fi

# Changer le mot de passe
RESPONSE=$(curl -s -X PUT \
    -u "admin:$OLD_PASSWORD" \
    -H "Content-Type: application/json" \
    -d "{
        \"oldPassword\": \"$OLD_PASSWORD\",
        \"newPassword\": \"$NEW_PASSWORD\",
        \"confirmNew\": \"$NEW_PASSWORD\"
    }" \
    "$GRAFANA_URL/api/user/password")

# Vérifier la réponse
if echo "$RESPONSE" | grep -q "\"message\":\"User password changed\""; then
    echo "OK Mot de passe change avec succes!"
    echo ""
    echo "Nouveau mot de passe: $NEW_PASSWORD"
    echo ""
    echo "Vous pouvez maintenant vous connecter avec:"
    echo "  Login: admin"
    echo "  Password: $NEW_PASSWORD"
else
    echo "ERREUR lors du changement de mot de passe"
    echo "Reponse: $RESPONSE"
    exit 1
fi

