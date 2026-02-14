# 🔗 Comptes Externes Impactés par le Nouveau Compte AWS

**Date**: 2026-02-14  
**Objectif**: Identifier et corriger tous les comptes externes qui référencent l'ancien compte AWS

---

## 📋 Résumé

Lors du passage de l'ancien compte AWS (`846505724644`, `us-east-1`) au nouveau compte (`108964700972`, `eu-west-1`), plusieurs services externes doivent être mis à jour avec les nouvelles URLs et configurations.

---

## 🔴 PRIORITÉ HAUTE - Services Critiques

### 1. 🔐 Google Cloud Console (OAuth)

**Impact**: ⚠️ **CRITIQUE** - L'authentification OAuth ne fonctionnera pas si non mis à jour

#### Services à Mettre à Jour:

##### A. YouTube OAuth Client
- **Où**: https://console.cloud.google.com/apis/credentials
- **Client ID**: `738929393617-XXXXX` (YouTube)
- **Action Requise**: Mettre à jour l'**Authorized redirect URI**

**Ancien URI** (à remplacer):
```
https://yukpomnang.onrender.com/api/social/youtube/callback
```

**Nouveau URI** (à ajouter):
```
https://api.yukpomnang.com/api/social/youtube/callback
```

**Si Load Balancer activé** (temporaire, utiliser l'URL du Load Balancer):
```
https://[ALB_DNS_NAME]/api/social/youtube/callback
```

##### B. Google OAuth Client (Général)
- **Où**: https://console.cloud.google.com/apis/credentials
- **Client ID**: `738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com`
- **Type**: Application Web
- **Action Requise**: Mettre à jour l'**Authorized redirect URI**

**Ancien URI** (à remplacer):
```
https://yukpomnang.onrender.com/api/auth/google/callback
```

**Nouveau URI** (à ajouter):
```
https://api.yukpomnang.com/api/auth/google/callback
```

**Si Load Balancer activé** (temporaire):
```
https://[ALB_DNS_NAME]/api/auth/google/callback
```

#### 📝 Étapes dans Google Cloud Console:

1. Aller sur: https://console.cloud.google.com/apis/credentials
2. Sélectionner le projet: **yukpomnang** (ou **yukpomnang-460203**)
3. Dans **"ID clients OAuth 2.0"**, trouver le client concerné
4. Cliquer sur le nom du client pour l'éditer
5. Dans **"URI de redirection autorisés"**, ajouter le nouveau URI
6. ⚠️ **Optionnel**: Garder l'ancien URI pendant la transition, ou le supprimer
7. Cliquer sur **"Enregistrer"**

---

### 2. 🌐 DNS / Route53

**Impact**: ⚠️ **CRITIQUE** - Le domaine ne pointera pas vers le nouveau backend

#### Domaine à Mettre à Jour:

- **Domaine**: `api.yukpomnang.com`
- **Action Requise**: Mettre à jour l'enregistrement DNS pour pointer vers le nouveau compte AWS

#### Options:

##### Option A: Load Balancer (Recommandé)
- **Type**: Alias vers ALB
- **Target**: DNS du Load Balancer du nouveau compte
- **Exemple**: `yukpo-backend-alb-xxxxx.eu-west-1.elb.amazonaws.com`

##### Option B: IP Publique Directe (Temporaire)
- **Type**: A Record
- **Target**: IP publique ECS (actuellement: `52.211.202.11`)
- ⚠️ **Note**: Cette IP change à chaque redémarrage ECS

#### 📝 Étapes dans Route53:

1. Aller sur: AWS Console → Route53
2. Trouver la zone hébergée: `yukpomnang.com`
3. Trouver l'enregistrement: `api.yukpomnang.com`
4. Modifier l'enregistrement pour pointer vers:
   - Le Load Balancer (si activé)
   - Ou l'IP publique ECS (temporaire)
5. Sauvegarder

**Script disponible**: `scripts/mettre-a-jour-dns-route53.ps1`

---

## 🟡 PRIORITÉ MOYENNE - Services Importants

### 3. 📧 SendGrid (Email)

**Impact**: ⚠️ **IMPORTANT** - Les emails ne seront pas envoyés si mal configuré

#### Variables SSM à Vérifier:

- `SENDGRID_API_KEY`: Déjà configuré (SecureString)
- `SENDGRID_FROM_EMAIL`: `noreply@yukpomnang.com`
- `SENDGRID_FROM_NAME`: `Yukpomnang`

#### Action Requise:

✅ **Aucune action requise** - Les credentials SendGrid sont indépendants d'AWS

⚠️ **Vérifier**: Que les webhooks SendGrid (si utilisés) pointent vers le nouveau backend:
- **Webhook URL**: `https://api.yukpomnang.com/api/webhooks/sendgrid`

---

### 4. 📱 Twilio (SMS)

**Impact**: ⚠️ **IMPORTANT** - Les SMS ne seront pas envoyés si mal configuré

#### Variables SSM à Vérifier:

- `TWILIO_ACCOUNT_SID`: Déjà configuré (SecureString)
- `TWILIO_AUTH_TOKEN`: Déjà configuré (SecureString)
- `TWILIO_FROM_NUMBER`: `+1234567890` (à vérifier)

#### Action Requise:

✅ **Aucune action requise** - Les credentials Twilio sont indépendants d'AWS

⚠️ **Vérifier**: Que les webhooks Twilio (si utilisés) pointent vers le nouveau backend:
- **Webhook URL**: `https://api.yukpomnang.com/api/webhooks/twilio`

---

### 5. 🎥 LiveKit (Streaming)

**Impact**: ⚠️ **IMPORTANT** - Le streaming ne fonctionnera pas si mal configuré

#### Variables SSM Actuelles:

- `LIVEKIT_API_URL`: `http://46.224.14.85:7880`
- `LIVEKIT_WS_URL`: `ws://46.224.14.85:7880`
- `LIVEKIT_HLS_URL`: `http://46.224.14.85:8080/live`

#### Action Requise:

✅ **Aucune action requise** - LiveKit est hébergé sur un serveur externe (Hetzner)

⚠️ **Vérifier**: Que les webhooks LiveKit pointent vers le nouveau backend:
- **Webhook URL**: `https://api.yukpomnang.com/api/webhooks/livekit`

**Où configurer**: Dans la configuration LiveKit (serveur `46.224.14.85`)

---

## 🟢 PRIORITÉ BASSE - Services Optionnels

### 6. 💳 Stripe (Paiements)

**Impact**: ⚠️ **IMPORTANT** - Les paiements ne fonctionneront pas si mal configuré

#### Action Requise:

⚠️ **Vérifier**: Que les webhooks Stripe pointent vers le nouveau backend:
- **Webhook URL**: `https://api.yukpomnang.com/api/webhooks/stripe`

**Où configurer**: 
1. Aller sur: https://dashboard.stripe.com/webhooks
2. Trouver les webhooks existants
3. Mettre à jour l'URL vers: `https://api.yukpomnang.com/api/webhooks/stripe`
4. Vérifier que le secret webhook est mis à jour dans SSM

#### Variables SSM à Vérifier:

- `STRIPE_SECRET_KEY`: Déjà configuré (SecureString)
- `STRIPE_WEBHOOK_SECRET`: À vérifier si mis à jour

---

### 7. 💰 PayPal (Paiements)

**Impact**: ⚠️ **IMPORTANT** - Les paiements ne fonctionneront pas si mal configuré

#### Action Requise:

⚠️ **Vérifier**: Que les webhooks PayPal pointent vers le nouveau backend:
- **Webhook URL**: `https://api.yukpomnang.com/api/webhooks/paypal`

**Où configurer**: 
1. Aller sur: https://developer.paypal.com/dashboard
2. Trouver les webhooks existants
3. Mettre à jour l'URL vers: `https://api.yukpomnang.com/api/webhooks/paypal`

---

### 8. ☁️ CloudFront (CDN)

**Impact**: ⚠️ **MOYEN** - Les médias seront servis directement depuis S3 (pas de CDN)

#### Statut Actuel:

- **Distribution CloudFront**: Aucune trouvée dans le nouveau compte
- **Distribution existante**: `d3jyvgg46kev8.cloudfront.net` (à vérifier si elle pointe vers l'ancien bucket)

#### Action Requise:

**Option A**: Créer une nouvelle distribution CloudFront dans le nouveau compte
- **Origin**: `yukpo-backend-media.s3.eu-west-1.amazonaws.com`
- **Région**: `eu-west-1`

**Option B**: Vérifier si l'ancienne distribution peut être migrée
- Vérifier dans l'ancien compte AWS si la distribution existe
- Si oui, mettre à jour l'origine vers le nouveau bucket

---

### 9. 🔄 GitHub Actions (CI/CD)

**Impact**: ⚠️ **IMPORTANT** - Les déploiements ne fonctionneront pas si mal configuré

#### Variables à Vérifier:

Dans `.github/workflows/docker-build-optimized.yml`:

- `AWS_REGION`: Doit être `eu-west-1`
- `AWS_ACCOUNT_ID`: Doit être `108964700972`
- `ECR_REPO_URI`: Doit pointer vers le nouveau compte ECR

#### Action Requise:

✅ **Déjà vérifié** - Les workflows GitHub Actions sont configurés pour le nouveau compte

⚠️ **Vérifier**: Que les secrets GitHub sont à jour:
- `AWS_ACCESS_KEY_ID`: Credentials du nouveau compte
- `AWS_SECRET_ACCESS_KEY`: Credentials du nouveau compte

**Où configurer**: 
1. Aller sur: https://github.com/[repo]/settings/secrets/actions
2. Vérifier que les secrets AWS sont ceux du nouveau compte

---

### 10. 📊 Analytics & Monitoring

#### Services Potentiels:

- **Google Analytics**: Vérifier que les URLs de tracking pointent vers le nouveau backend
- **Sentry**: Vérifier que les DSN pointent vers le nouveau backend
- **Datadog/New Relic**: Vérifier que les endpoints pointent vers le nouveau backend

#### Action Requise:

⚠️ **Vérifier manuellement** chaque service d'analytics utilisé

---

## 📋 Checklist Complète

### 🔴 Priorité Haute

- [ ] **Google Cloud Console - YouTube OAuth**: Mettre à jour redirect URI
- [ ] **Google Cloud Console - Google OAuth**: Mettre à jour redirect URI
- [ ] **Route53/DNS**: Mettre à jour `api.yukpomnang.com` vers le nouveau compte

### 🟡 Priorité Moyenne

- [ ] **SendGrid**: Vérifier webhooks (si utilisés)
- [ ] **Twilio**: Vérifier webhooks (si utilisés)
- [ ] **LiveKit**: Vérifier webhooks pointent vers nouveau backend
- [ ] **Stripe**: Vérifier webhooks pointent vers nouveau backend
- [ ] **PayPal**: Vérifier webhooks pointent vers nouveau backend

### 🟢 Priorité Basse

- [ ] **CloudFront**: Créer nouvelle distribution ou migrer l'ancienne
- [ ] **GitHub Actions**: Vérifier secrets AWS
- [ ] **Analytics**: Vérifier chaque service utilisé

---

## 🔧 Scripts Disponibles

### Script de Vérification

```powershell
# Vérifier toutes les variables SSM
.\scripts\verifier-compte-aws-complet.ps1

# Vérifier les services externes
.\scripts\verify_external_services_aws.ps1
```

### Script de Mise à Jour DNS

```powershell
# Mettre à jour Route53
.\scripts\mettre-a-jour-dns-route53.ps1
```

---

## 📝 Variables SSM à Vérifier

### Variables avec URLs Anciennes (à Mettre à Jour):

| Variable | Ancienne Valeur | Nouvelle Valeur | Statut |
|----------|----------------|-----------------|--------|
| `YOUTUBE_REDIRECT_URI` | `https://yukpomnang.onrender.com/api/social/youtube/callback` | `https://api.yukpomnang.com/api/social/youtube/callback` | ⚠️ À vérifier |
| `GOOGLE_REDIRECT_URI` | `https://yukpomnang.onrender.com/api/auth/google/callback` | `https://api.yukpomnang.com/api/auth/google/callback` | ⚠️ À vérifier |

### Commandes pour Vérifier:

```powershell
# Vérifier YOUTUBE_REDIRECT_URI
aws ssm get-parameter --name "/yukpo/production/YOUTUBE_REDIRECT_URI" --region eu-west-1 --query 'Parameter.Value' --output text

# Vérifier GOOGLE_REDIRECT_URI (si existe)
aws ssm get-parameter --name "/yukpo/production/GOOGLE_REDIRECT_URI" --region eu-west-1 --query 'Parameter.Value' --output text
```

### Commandes pour Mettre à Jour:

```powershell
# Mettre à jour YOUTUBE_REDIRECT_URI
aws ssm put-parameter `
    --name "/yukpo/production/YOUTUBE_REDIRECT_URI" `
    --value "https://api.yukpomnang.com/api/social/youtube/callback" `
    --type "String" `
    --region eu-west-1 `
    --overwrite

# Mettre à jour GOOGLE_REDIRECT_URI (si existe)
aws ssm put-parameter `
    --name "/yukpo/production/GOOGLE_REDIRECT_URI" `
    --value "https://api.yukpomnang.com/api/auth/google/callback" `
    --type "String" `
    --region eu-west-1 `
    --overwrite
```

---

## 🎯 Résumé des Actions

### Actions Immédiates (Aujourd'hui)

1. ✅ Mettre à jour **Google Cloud Console** (OAuth redirect URIs)
2. ✅ Mettre à jour **Route53** (DNS pour `api.yukpomnang.com`)
3. ✅ Mettre à jour **Variables SSM** (`YOUTUBE_REDIRECT_URI`, `GOOGLE_REDIRECT_URI`)

### Actions à Faire Cette Semaine

4. ⚠️ Vérifier **Stripe webhooks**
5. ⚠️ Vérifier **PayPal webhooks**
6. ⚠️ Vérifier **LiveKit webhooks**
7. ⚠️ Vérifier **SendGrid webhooks** (si utilisés)
8. ⚠️ Vérifier **Twilio webhooks** (si utilisés)

### Actions Optionnelles

9. 🔄 Créer **CloudFront distribution** dans le nouveau compte
10. 📊 Vérifier **Analytics services** (Google Analytics, Sentry, etc.)

---

## 📚 Références

- Guide OAuth Google: `MISE_A_JOUR_OAUTH_GOOGLE_CLOUD.md`
- Guide DNS Route53: `GUIDE_MISE_A_JOUR_DNS_ROUTE53.md`
- Services externes: `SERVICES_EXTERNES_A_METTRE_A_JOUR.md`
- Vérification AWS: `RAPPORT_VERIFICATION_COMPLETE_AWS.md`

---

**Document généré le**: 2026-02-14

