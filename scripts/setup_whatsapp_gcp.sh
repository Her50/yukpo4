#!/bin/bash
# Configuration WhatsApp Business - GCP Secret Manager

echo "🔧 Configuration des secrets WhatsApp pour GCP..."

# 1. Créer le secret WhatsApp
gcloud secrets create whatsapp-config --replication-policy="automatic"

# 2. Préparer le fichier de configuration temporaire
cat > /tmp/whatsapp-config.txt << EOF
WHATSAPP_ENABLED=true
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=VOTRE_ACCOUNT_SID_ICI
TWILIO_AUTH_TOKEN=VOTRE_AUTH_TOKEN_ICI
TWILIO_WHATSAPP_NUMBER=whatsapp:+237697490661
WHATSAPP_WEBHOOK_URL=https://yukpo-backend-376093909298.europe-west1.run.app/api/whatsapp/webhook
WHATSAPP_DEFAULT_GROUP_ID=yukpo_main
EOF

echo "📝 Fichier de configuration créé : /tmp/whatsapp-config.txt"
echo "⚠️  MODIFIEZ les valeurs VOTRE_ACCOUNT_SID_ICI et VOTRE_AUTH_TOKEN_ICI"
echo ""
echo "Quand vous êtes prêt, exécutez :"
echo "gcloud secrets versions add whatsapp-config --data-file=/tmp/whatsapp-config.txt"
echo ""
echo "Puis déployez avec :"
echo "gcloud run services update yukpo-backend --region=europe-west1 --update-secrets='WHATSAPP_CONFIG=whatsapp-config:latest'"
