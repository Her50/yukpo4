# 📱 Guide de Configuration Twilio et SendGrid

## 🔴 TWILIO (SMS)

### Étape 1 : Créer un compte Twilio

1. Aller sur https://www.twilio.com/
2. Cliquer sur "Sign Up" (gratuit pour commencer)
3. Remplir le formulaire d'inscription
4. Vérifier votre email et téléphone

### Étape 2 : Obtenir les credentials

Une fois connecté au **Console Twilio** (https://console.twilio.com/) :

#### A. Account SID et Auth Token

1. Sur le dashboard, vous verrez :
   - **Account SID** : Commence par `AC...` (ex: `YOUR_TWILIO_ACCOUNT_SID`)
   - **Auth Token** : Cliquer sur "View" pour le révéler (ex: `your_auth_token_here`)

2. **⚠️ IMPORTANT** : Ne partagez jamais votre Auth Token publiquement !

#### B. Obtenir un numéro de téléphone

1. Dans le menu, aller à **Phone Numbers** → **Manage** → **Buy a number**
2. Choisir votre pays (ex: Cameroun = +237, France = +33)
3. Sélectionner un numéro disponible
4. Cliquer sur "Buy" (gratuit avec compte d'essai)
5. Le numéro sera au format : `+237612345678` (avec indicatif pays)

**Note** : Avec un compte d'essai Twilio, vous pouvez :
- Recevoir des SMS gratuitement
- Envoyer des SMS uniquement vers des numéros vérifiés
- Pour la production, il faut passer à un compte payant

### Étape 3 : Vérifier un numéro de test (compte d'essai)

1. Aller à **Phone Numbers** → **Verified Caller IDs**
2. Ajouter votre numéro de téléphone personnel
3. Recevoir un code de vérification par SMS
4. Entrer le code pour vérifier

**⚠️ Important** : Avec un compte d'essai, vous ne pouvez envoyer des SMS qu'aux numéros vérifiés.

### Étape 4 : Configuration dans `.env`

```env
# SMS Configuration
SMS_ENABLED=true
SMS_PROVIDER=twilio

# Twilio Credentials (à remplacer par vos vraies valeurs)
TWILIO_ACCOUNT_SID=YOUR_TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=your_actual_auth_token_here
TWILIO_FROM_NUMBER=+237612345678  # Votre numéro Twilio acheté
```

### 📋 Exemple de valeurs réelles

```env
TWILIO_ACCOUNT_SID=ACa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
TWILIO_AUTH_TOKEN=abc123def456ghi789jkl012mno345pqr678
TWILIO_FROM_NUMBER=+237698765432
```

---

## 📧 SENDGRID (Email)

### Étape 1 : Créer un compte SendGrid

1. Aller sur https://sendgrid.com/
2. Cliquer sur "Start for free"
3. Remplir le formulaire d'inscription
4. Vérifier votre email

### Étape 2 : Obtenir l'API Key

1. Une fois connecté, aller dans **Settings** → **API Keys**
2. Cliquer sur "Create API Key"
3. Donner un nom (ex: "Yukpomnang Production")
4. Choisir les permissions : **Full Access** (ou au minimum "Mail Send")
5. Cliquer sur "Create & View"
6. **⚠️ IMPORTANT** : Copier l'API Key immédiatement (elle ne sera plus visible après)

L'API Key ressemble à : `SG.abc123def456ghi789jkl012mno345pqr678.stu901vwx234yz567`

### Étape 3 : Vérifier un domaine ou un email sender

#### Option A : Vérifier un email sender (plus simple pour commencer)

1. Aller à **Settings** → **Sender Authentication** → **Single Sender Verification**
2. Cliquer sur "Create New Sender"
3. Remplir le formulaire :
   - **From Email Address** : `noreply@yukpomnang.com` (ou votre email)
   - **From Name** : `Yukpomnang`
   - **Reply To** : `support@yukpomnang.com`
   - **Company Address** : Votre adresse
4. Vérifier l'email en cliquant sur le lien dans l'email reçu

#### Option B : Vérifier un domaine (pour production)

1. Aller à **Settings** → **Sender Authentication** → **Domain Authentication**
2. Suivre les instructions pour ajouter des enregistrements DNS
3. Plus complexe mais permet d'envoyer depuis n'importe quel email du domaine

### Étape 4 : Configuration dans `.env`

```env
# Email Configuration
EMAIL_ENABLED=true
EMAIL_PROVIDER=sendgrid

# SendGrid Credentials (à remplacer par vos vraies valeurs)
SENDGRID_API_KEY=SG.abc123def456ghi789jkl012mno345pqr678.stu901vwx234yz567
SENDGRID_FROM_EMAIL=noreply@yukpomnang.com  # Email vérifié dans SendGrid
SENDGRID_FROM_NAME=Yukpomnang
```

### 📋 Exemple de valeurs réelles

```env
SENDGRID_API_KEY=SG.1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7
SENDGRID_FROM_EMAIL=noreply@yukpomnang.com
SENDGRID_FROM_NAME=Yukpomnang
```

---

## ✅ Vérification de la configuration

### Test Twilio

```bash
# Vérifier que les variables sont bien définies
echo $TWILIO_ACCOUNT_SID
echo $TWILIO_FROM_NUMBER
```

### Test SendGrid

```bash
# Vérifier que les variables sont bien définies
echo $SENDGRID_API_KEY
echo $SENDGRID_FROM_EMAIL
```

### Test depuis le code

Les services loggent automatiquement si la configuration est correcte :
- Si configuré : `[SmsService] ✅ SMS envoyé avec succès`
- Si non configuré : `[SmsService] 📱 Twilio non configuré`

---

## 💰 Coûts

### Twilio

- **Compte d'essai** : Gratuit (limité aux numéros vérifiés)
- **Production** : 
  - ~$0.0075 par SMS (Cameroun)
  - ~$1.00/mois pour un numéro dédié
  - Voir https://www.twilio.com/sms/pricing

### SendGrid

- **Plan gratuit** : 100 emails/jour gratuitement
- **Plan Essentials** : À partir de $19.95/mois pour 50,000 emails
- Voir https://sendgrid.com/pricing/

---

## 🔒 Sécurité

### ⚠️ IMPORTANT : Ne jamais commiter les credentials

1. Ajouter `.env` dans `.gitignore`
2. Utiliser des variables d'environnement sur le serveur
3. Pour production, utiliser un gestionnaire de secrets (AWS Secrets Manager, etc.)

### Exemple `.gitignore`

```
.env
.env.local
.env.production
```

---

## 🚀 Déploiement

### Sur Render/Heroku/etc.

Ajouter les variables d'environnement dans le dashboard :
1. Aller dans **Settings** → **Environment Variables**
2. Ajouter chaque variable :
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_FROM_NUMBER`
   - `SENDGRID_API_KEY`
   - `SENDGRID_FROM_EMAIL`
   - `SENDGRID_FROM_NAME`

---

## 📞 Support

- **Twilio** : https://support.twilio.com/
- **SendGrid** : https://support.sendgrid.com/

---

**Date** : 2025-01-XX
**Status** : Guide de configuration complet

