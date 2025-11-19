#!/bin/bash
# Script pour charger les credentials Grafana depuis le fichier de secrets

SECRETS_FILE="/opt/yukpo/.grafana-secrets"

if [ ! -f "$SECRETS_FILE" ]; then
    echo "ERREUR: Fichier de secrets non trouve: $SECRETS_FILE"
    exit 1
fi

# Charger les variables
source "$SECRETS_FILE"

# Exporter pour utilisation dans les scripts
export GRAFANA_URL
export GRAFANA_USER
export GRAFANA_PASSWORD

echo "Credentials Grafana charges depuis: $SECRETS_FILE"
echo "URL: $GRAFANA_URL"
echo "User: $GRAFANA_USER"
echo "Password: [masque]"

