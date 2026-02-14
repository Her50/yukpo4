# ✅ Résumé - Mise à Jour des Comptes Externes

**Date**: 2026-02-14  
**Statut**: ✅ **Variables SSM mises à jour automatiquement**

---

## ✅ Actions Effectuées Automatiquement

### Variables SSM Mises à Jour

1. ✅ **YOUTUBE_REDIRECT_URI**
   - **Ancien**: `https://yukpomnang.onrender.com/api/social/youtube/callback`
   - **Nouveau**: `https://api.yukpomnang.com/api/social/youtube/callback`
   - **Statut**: ✅ Mis à jour

2. ✅ **GOOGLE_REDIRECT_URI**
   - **Ancien**: N'existait pas
   - **Nouveau**: `https://api.yukpomnang.com/api/auth/google/callback`
   - **Statut**: ✅ Créé

3. ✅ **APP_BASE_URL**
   - **Ancien**: N'existait pas
   - **Nouveau**: `https://api.yukpomnang.com`
   - **Statut**: ✅ Créé

### Service ECS

✅ **Service ECS redémarré** pour charger les nouvelles variables

---

## ⚠️ Actions Manuelles Requises

### 1. 🔐 Google Cloud Console (CRITIQUE)

**⚠️ IMPORTANT**: L'authentification OAuth ne fonctionnera pas tant que ces URLs ne sont pas mises à jour dans Google Cloud Console.

#### YouTube OAuth

1. Aller sur: https://console.cloud.google.com/apis/credentials
2. Sélectionner le projet: **yukpomnang** (ou **yukpomnang-460203**)
3. Dans **"ID clients OAuth 2.0"**, trouver le client YouTube
4. Cliquer sur le nom du client pour l'éditer
5. Dans **"URI de redirection autorisés"**, ajouter:
   ```
   https://api.yukpomnang.com/api/social/youtube/callback
   ```
6. Cliquer sur **"Enregistrer"**

#### Google OAuth (Général)

1. Aller sur: https://console.cloud.google.com/apis/credentials
2. Sélectionner le projet: **yukpomnang** (ou **yukpomnang-460203**)
3. Dans **"ID clients OAuth 2.0"**, trouver le client **"Yukpomnang Web Client"**
   - **Client ID**: `738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com`
   - **Type**: Application Web
4. Cliquer sur le nom du client pour l'éditer
5. Dans **"URI de redirection autorisés"**, ajouter:
   ```
   https://api.yukpomnang.com/api/auth/google/callback
   ```
6. Cliquer sur **"Enregistrer"**

**⚠️ Note**: Vous pouvez garder l'ancienne URL Render pendant la transition, ou la supprimer.

---

### 2. 🌐 DNS / Route53 (CRITIQUE)

**⚠️ IMPORTANT**: Le domaine `api.yukpomnang.com` doit pointer vers le nouveau compte AWS.

#### Vérification Actuelle

Le backend est accessible via l'IP publique: `52.211.202.11:8080`

#### Options

**Option A: Load Balancer (Recommandé)**
1. Activer le Load Balancer dans Terraform:
   ```hcl
   # infra/aws/terraform.tfvars
   enable_load_balancer = true
   ```
2. Appliquer Terraform:
   ```bash
   cd infra/aws
   terraform plan
   terraform apply
   ```
3. Récupérer le DNS du Load Balancer:
   ```bash
   terraform output alb_dns_name
   ```
4. Configurer Route53 pour pointer `api.yukpomnang.com` vers le Load Balancer

**Option B: IP Publique Directe (Temporaire)**
1. Configurer Route53 pour pointer `api.yukpomnang.com` vers `52.211.202.11`
2. ⚠️ **Note**: Cette IP change à chaque redémarrage ECS

**Script disponible**: `scripts/mettre-a-jour-dns-route53.ps1`

---

### 3. 💳 Services de Paiement (Si Utilisés)

#### Stripe

1. Aller sur: https://dashboard.stripe.com/webhooks
2. Trouver les webhooks existants
3. Mettre à jour l'URL vers: `https://api.yukpomnang.com/api/webhooks/stripe`
4. Vérifier que le secret webhook est mis à jour dans SSM

#### PayPal

1. Aller sur: https://developer.paypal.com/dashboard
2. Trouver les webhooks existants
3. Mettre à jour l'URL vers: `https://api.yukpomnang.com/api/webhooks/paypal`

---

### 4. 📧 Services de Communication (Si Webhooks Utilisés)

#### SendGrid

Si vous utilisez des webhooks SendGrid:
1. Aller sur: https://app.sendgrid.com/settings/mail_settings
2. Mettre à jour les webhooks vers: `https://api.yukpomnang.com/api/webhooks/sendgrid`

#### Twilio

Si vous utilisez des webhooks Twilio:
1. Aller sur: https://console.twilio.com/
2. Mettre à jour les webhooks vers: `https://api.yukpomnang.com/api/webhooks/twilio`

---

### 5. 🎥 LiveKit (Si Webhooks Utilisés)

Si vous utilisez des webhooks LiveKit:
1. Accéder à la configuration LiveKit (serveur `46.224.14.85`)
2. Mettre à jour les webhooks vers: `https://api.yukpomnang.com/api/webhooks/livekit`

---

## 📋 Checklist Complète

### ✅ Complété Automatiquement

- [x] Mise à jour `YOUTUBE_REDIRECT_URI` dans SSM
- [x] Création `GOOGLE_REDIRECT_URI` dans SSM
- [x] Création `APP_BASE_URL` dans SSM
- [x] Redémarrage du service ECS

### ⚠️ À Faire Manuellement

- [ ] **Google Cloud Console - YouTube OAuth**: Ajouter redirect URI
- [ ] **Google Cloud Console - Google OAuth**: Ajouter redirect URI
- [ ] **Route53/DNS**: Configurer `api.yukpomnang.com` vers le nouveau compte
- [ ] **Stripe**: Mettre à jour webhooks (si utilisé)
- [ ] **PayPal**: Mettre à jour webhooks (si utilisé)
- [ ] **SendGrid**: Mettre à jour webhooks (si utilisé)
- [ ] **Twilio**: Mettre à jour webhooks (si utilisé)
- [ ] **LiveKit**: Mettre à jour webhooks (si utilisé)

---

## 🔧 Commandes Utiles

### Vérifier les Variables SSM

```powershell
# Vérifier YOUTUBE_REDIRECT_URI
aws ssm get-parameter --name "/yukpo/production/YOUTUBE_REDIRECT_URI" --region eu-west-1 --query 'Parameter.Value' --output text

# Vérifier GOOGLE_REDIRECT_URI
aws ssm get-parameter --name "/yukpo/production/GOOGLE_REDIRECT_URI" --region eu-west-1 --query 'Parameter.Value' --output text

# Vérifier APP_BASE_URL
aws ssm get-parameter --name "/yukpo/production/APP_BASE_URL" --region eu-west-1 --query 'Parameter.Value' --output text
```

### Vérifier le Service ECS

```powershell
# Vérifier le statut du service
aws ecs describe-services `
    --cluster yukpo-cluster `
    --services yukpo-backend-service `
    --region eu-west-1 `
    --query 'services[0].[status,runningCount,desiredCount]' `
    --output table
```

### Vérifier le DNS

```powershell
# Résolution DNS
nslookup api.yukpomnang.com

# Test de connectivité
Invoke-WebRequest -Uri "https://api.yukpomnang.com/health" -Method GET
```

---

## 📚 Documents de Référence

- **Comptes externes impactés**: `COMPTES_EXTERNES_IMPACTES_NOUVEAU_AWS.md`
- **Guide OAuth Google**: `MISE_A_JOUR_OAUTH_GOOGLE_CLOUD.md`
- **Guide DNS Route53**: `GUIDE_MISE_A_JOUR_DNS_ROUTE53.md`
- **Rapport vérification AWS**: `RAPPORT_VERIFICATION_COMPLETE_AWS.md`

---

## ✅ Résumé

**Variables SSM**: ✅ **3 variables mises à jour/créées automatiquement**

**Actions manuelles requises**:
1. ⚠️ **Google Cloud Console** (OAuth) - **CRITIQUE**
2. ⚠️ **Route53/DNS** - **CRITIQUE**
3. ⚠️ **Services de paiement** (webhooks) - Si utilisés
4. ⚠️ **Services de communication** (webhooks) - Si utilisés

**Prochaine étape**: Mettre à jour Google Cloud Console pour que l'OAuth fonctionne.

---

**Document généré le**: 2026-02-14

