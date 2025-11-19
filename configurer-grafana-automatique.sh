#!/bin/bash
# Script automatique de configuration Grafana avec sauvegarde du mot de passe

GRAFANA_URL="http://localhost:3002"
OLD_PASSWORD="admin"

# Generer un mot de passe fort
NEW_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-24)
# S'assurer qu'il contient des caracteres speciaux
NEW_PASSWORD="${NEW_PASSWORD}!@#"

echo "Configuration automatique de Grafana..."
echo ""

# Changer le mot de passe
echo "Changement du mot de passe admin..."
RESPONSE=$(curl -s -X PUT \
    -u "admin:$OLD_PASSWORD" \
    -H "Content-Type: application/json" \
    -d "{
        \"oldPassword\": \"$OLD_PASSWORD\",
        \"newPassword\": \"$NEW_PASSWORD\",
        \"confirmNew\": \"$NEW_PASSWORD\"
    }" \
    "$GRAFANA_URL/api/user/password")

if echo "$RESPONSE" | grep -q "\"message\":\"User password changed\""; then
    echo "OK Mot de passe change avec succes!"
    echo ""
    
    # Sauvegarder dans un fichier securise
    SECRETS_FILE="/opt/yukpo/.grafana-secrets"
    echo "GRAFANA_URL=$GRAFANA_URL" > "$SECRETS_FILE"
    echo "GRAFANA_USER=admin" >> "$SECRETS_FILE"
    echo "GRAFANA_PASSWORD=$NEW_PASSWORD" >> "$SECRETS_FILE"
    chmod 600 "$SECRETS_FILE"
    
    echo "Mot de passe sauvegarde dans: $SECRETS_FILE"
    echo ""
    echo "=== INFORMATIONS DE CONNEXION GRAFANA ==="
    echo "URL: http://46.224.14.85:3002"
    echo "Login: admin"
    echo "Password: $NEW_PASSWORD"
    echo "=========================================="
    echo ""
    echo "IMPORTANT: Sauvegardez ces informations en securite!"
    echo ""
    
    # Creer aussi un fichier pour les scripts
    echo "export GRAFANA_URL=\"$GRAFANA_URL\"" > /opt/yukpo/.grafana-env
    echo "export GRAFANA_USER=\"admin\"" >> /opt/yukpo/.grafana-env
    echo "export GRAFANA_PASSWORD=\"$NEW_PASSWORD\"" >> /opt/yukpo/.grafana-env
    chmod 600 /opt/yukpo/.grafana-env
    
    echo "Variables d'environnement sauvegardees dans: /opt/yukpo/.grafana-env"
    echo "Pour utiliser: source /opt/yukpo/.grafana-env"
    
else
    echo "ERREUR lors du changement de mot de passe"
    echo "Reponse: $RESPONSE"
    exit 1
fi

