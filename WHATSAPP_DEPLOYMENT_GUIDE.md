# 🎯 Configuration WhatsApp Business - Guide Complet

## 📱 **État actuel**
- ✅ **Service WhatsApp** implémenté dans le backend
- ✅ **Secrets GCP** créés : `twilio-account-sid`, `twilio-auth-token`, `whatsapp-config`
- ✅ **Client WhatsApp** existant dans ChatModalMobile.tsx
- ✅ **Numéro Business** : +237697490661

## 🔧 **Étapes restantes**

### 1. **Créer compte Twilio** (5 minutes)
1. Allez sur https://www.twilio.com/try-twilio
2. Inscrivez-vous avec votre email
3. Vérifiez votre numéro +237697490661
4. Récupérez vos credentials dans le dashboard :
   - `Account SID` (commence par AC...)
   - `Auth Token` (token de 32 caractères)

### 2. **Configurer WhatsApp Business dans Twilio**
1. Dans le dashboard Twilio → Messaging → Senders → WhatsApp Senders
2. Cliquez "Add WhatsApp Sender"
3. Entrez : **+237697490661**
4. Suivez la vérification par SMS
5. **Configurez le webhook** :
   - URL: `https://yukpo-backend-376093909298.europe-west1.run.app/api/whatsapp/webhook`
   - Method: POST

### 3. **Ajouter vos clés dans GCP**
```bash
# Remplacez VOTRE_ACCOUNT_SID par votre vraie valeur
echo "VOTRE_ACCOUNT_SID" | gcloud secrets versions add twilio-account-sid --data-file=-

# Remplacez VOTRE_AUTH_TOKEN par votre vraie valeur  
echo "VOTRE_AUTH_TOKEN" | gcloud secrets versions add twilio-auth-token --data-file=-

# Configurer WhatsApp
gcloud secrets versions add whatsapp-config --data-file=scripts/whatsapp-config.txt
```

### 4. **Déployer le backend**
```bash
gcloud run services update yukpo-backend --region=europe-west1 \
  --update-secrets='TWILIO_ACCOUNT_SID=twilio-account-sid:latest,TWILIO_AUTH_TOKEN=twilio-auth-token:latest,WHATSAPP_CONFIG=whatsapp-config:latest'
```

### 5. **Activer SMS dans les workflows CI/CD**
Modifiez `.github/workflows/docker-build-optimized.yml` et `gcp-deploy.yml` :
```yaml
"SMS_ENABLED": "true",  # Changez false → true
```

## 🎯 **Comment ça fonctionnera**

### **Flux existant (ChatModalMobile)**
- User clique sur bouton WhatsApp → Ouvre app WhatsApp native
- Message pré-rempli avec le service
- Conversation 1-1 directe avec le prestataire

### **Flux nouveau (WhatsApp Business)**
- Contact WhatsApp sur +237697490661 → Webhook backend
- Analyse du message → Routage automatique vers groupe
- Message de bienvenue envoyé automatiquement

## 📊 **Groupes configurés**
1. **yukpo_main** - Support client (yukpo, support, aide)
2. **yukpo_partners** - Partenaires/Livreurs (partenaire, livraison)  
3. **yukpo_tech** - Support technique (bug, erreur, technique)

## 🧪 **Tester le déploiement**
```bash
# Vérifier le statut
curl https://yukpo-backend-376093909298.europe-west1.run.app/api/whatsapp/status

# Envoyer un message de test
curl -X POST https://yukpo-backend-376093909298.europe-west1.run.app/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{"to": "+237123456789", "message": "support yukpo"}'
```

## 💰 **Coûts Twilio**
- WhatsApp : ~$0.05/message envoyé
- Réception webhook : Gratuit
- Niveau gratuit : 1000 messages/mois

## 🎉 **Résultat final**
- ✅ **Support client** automatisé via WhatsApp
- ✅ **Routage intelligent** vers bons groupes
- ✅ **Intégration** avec chat existant
- ✅ **Scalable** et monitoré

Une fois configuré, votre numéro +237697490661 redirigera automatiquement les contacts ! 🚀
