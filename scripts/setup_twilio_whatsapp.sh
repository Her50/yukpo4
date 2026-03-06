#!/bin/bash
# ✅ Configuration complète Twilio pour WhatsApp + SMS

echo "🔧 Configuration des secrets Twilio pour WhatsApp et SMS..."

# 1. Créer les secrets Twilio (s'ils n'existent pas)
echo "📱 Création des secrets Twilio..."
gcloud secrets create twilio-account-sid --replication-policy="automatic" || echo "Secret twilio-account-sid existe déjà"
gcloud secrets create twilio-auth-token --replication-policy="automatic" || echo "Secret twilio-auth-token existe déjà"

# 2. Créer le secret WhatsApp (déjà fait)
echo "📱 Secret whatsapp-config déjà créé"

# 3. Préparer le fichier de configuration Twilio
cat > /tmp/twilio-config.txt << EOF
TWILIO_ACCOUNT_SID=VOTRE_ACCOUNT_SID_ICI
TWILIO_AUTH_TOKEN=VOTRE_AUTH_TOKEN_ICI
TWILIO_FROM_NUMBER=VOTRE_NUMERO_SMS_ICI
TWILIO_WHATSAPP_NUMBER=whatsapp:+237697490661
EOF

echo "📝 Fichier Twilio créé : /tmp/twilio-config.txt"
echo "⚠️  MODIFIEZ les valeurs VOTRE_..._ICI avec vos vraies clés Twilio"
echo ""
echo "Quand prêt, exécutez :"
echo "# Ajouter les secrets Twilio"
echo "echo 'VOTRE_ACCOUNT_SID' | gcloud secrets versions add twilio-account-sid --data-file=-"
echo "echo 'VOTRE_AUTH_TOKEN' | gcloud secrets versions add twilio-auth-token --data-file=-"
echo ""
echo "# Configurer WhatsApp"
echo "gcloud secrets versions add whatsapp-config --data-file=scripts/whatsapp-config.txt"
echo ""
echo "# Déployer avec tous les secrets"
echo "gcloud run services update yukpo-backend --region=europe-west1 \\"
echo "  --update-secrets='TWILIO_ACCOUNT_SID=twilio-account-sid:latest,TWILIO_AUTH_TOKEN=twilio-auth-token:latest,WHATSAPP_CONFIG=whatsapp-config:latest'"
