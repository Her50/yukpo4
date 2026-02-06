# 🔍 Vérification des Services Externes - AWS

## 📋 Résumé

Script de vérification amélioré pour contrôler que **tous les services externes** mentionnés dans `SERVICES_EXTERNES_A_METTRE_A_JOUR.md` sont bien liés à AWS et non à Render.

---

## 🚀 Utilisation

### Exécution du Script

```powershell
cd c:\Users\23767\yukpomnang2
powershell -ExecutionPolicy Bypass -File scripts/verify_external_services_aws.ps1
```

### Avec Paramètres Personnalisés

```powershell
.\scripts\verify_external_services_aws.ps1 -Region "us-east-1" -ParameterPrefix "/yukpomnang/production"
```

---

## ✅ Vérifications Effectuées

### 1. Variables Critiques

Le script vérifie que les variables suivantes ne pointent **PAS** vers Render :

- ✅ `DATABASE_URL` → Doit pointer vers AWS RDS
- ✅ `YOUTUBE_REDIRECT_URI` → Doit pointer vers AWS ALB
- ✅ `PUBLIC_BASE_URL` → Doit pointer vers AWS S3/CloudFront
- ✅ `UPLOAD_BASE_URL` → Doit pointer vers AWS S3/CloudFront
- ✅ `LIVEKIT_API_URL` → Ne doit pas pointer vers Render
- ✅ `LIVEKIT_WS_URL` → Ne doit pas pointer vers Render
- ✅ `LIVEKIT_HLS_URL` → Ne doit pas pointer vers Render
- ✅ `VIDEO_RENDERER_RPC_URL` → Ne doit pas pointer vers Render
- ✅ `SRS_HLS_URL` → Ne doit pas pointer vers Render
- ✅ `SRS_RTMP_URL` → Ne doit pas pointer vers Render

### 2. Variables OAuth

- ✅ `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- ✅ `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET`

**⚠️ IMPORTANT** : Les redirect URIs doivent être mis à jour dans **Google Cloud Console** :
- Google OAuth: `https://VOTRE_ALB_DNS/api/auth/google/callback`
- YouTube OAuth: `https://VOTRE_ALB_DNS/api/social/youtube/callback`

### 3. Variables GPU

- ✅ `GPU_AVAILABLE` = `true`
- ✅ `VIDEO_RENDERER_ENABLE_GPU` = `true`
- ✅ `GPU_TYPE` = `nvidia`
- ✅ `CUDA_VISIBLE_DEVICES`
- ✅ `NVIDIA_VISIBLE_DEVICES`

### 4. Services AWS

Le script vérifie automatiquement :

- ✅ **ALB (Application Load Balancer)** : DNS name et vérification des callbacks
- ✅ **RDS (PostgreSQL)** : Endpoint et vérification de `DATABASE_URL`
- ✅ **CloudFront** : Distributions trouvées
- ✅ **S3** : Buckets yukpomnang trouvés

### 5. Services Externes

Vérification que les services suivants ne pointent **PAS** vers Render :

- ✅ **LiveKit** (API, WebSocket, HLS)
- ✅ **Video Renderer** (RPC URL)
- ✅ **SRS** (HLS, RTMP)

### 6. Webhooks et Services de Paiement

- ✅ **Slack Webhooks** : `PIPELINE_ALERT_WEBHOOK`, `SLA_ALERT_WEBHOOK`
- ✅ **Services de Paiement** : Callbacks MTN Money et Orange Money

**⚠️ IMPORTANT** : Les callbacks de paiement doivent être mis à jour dans les dashboards MTN/Orange :
- MTN: `https://VOTRE_ALB_DNS/api/payments/mtn/callback`
- Orange: `https://VOTRE_ALB_DNS/api/payments/orange/callback`

---

## 📊 Rapport Généré

Le script génère automatiquement un rapport Markdown :

```
RAPPORT_VERIFICATION_SERVICES_EXTERNES_YYYYMMDD_HHMMSS.md
```

Le rapport contient :
- ✅ Résumé des succès
- ⚠️ Liste des avertissements
- ❌ Liste des problèmes à corriger
- 📋 Actions requises

---

## 🔧 Améliorations Apportées

### 1. Détection Améliorée des URLs Render

- Détection des URLs Render explicites (`render.com`, `onrender.com`)
- Détection des bases de données Render (`dpg-*.render.com`)
- Détection des services externes (IPs directes, domaines personnalisés)

### 2. Vérifications Spécifiques par Service

- **DATABASE_URL** : Vérification spécifique pour RDS
- **YOUTUBE_REDIRECT_URI** : Vérification spécifique pour ALB
- **PUBLIC_BASE_URL / UPLOAD_BASE_URL** : Vérification pour S3/CloudFront
- **Services externes** : Détection des IPs directes (LiveKit, Video Renderer, SRS)

### 3. Gestion des Erreurs

- Mode non-bloquant : Le script continue même si les credentials AWS ne sont pas configurés
- Vérifications conditionnelles : Les vérifications AWS nécessitent des credentials
- Messages d'aide : Instructions pour configurer les credentials si nécessaire

### 4. Vérifications AWS Automatiques

- Recherche automatique de l'ALB
- Recherche automatique de RDS
- Recherche automatique de CloudFront
- Recherche automatique de S3

### 5. Rapport Détaillé

- Rapport Markdown avec toutes les informations
- Actions requises clairement identifiées
- Références vers `SERVICES_EXTERNES_A_METTRE_A_JOUR.md`

---

## ⚠️ Prérequis

### 1. AWS CLI Installé

```powershell
# Vérifier l'installation
aws --version

# Si non installé, télécharger depuis:
# https://aws.amazon.com/cli/
```

### 2. Credentials AWS (Optionnel mais Recommandé)

Pour les vérifications complètes (ALB, RDS, CloudFront, S3), configurez les credentials :

```powershell
aws configure
```

**Note** : Le script fonctionne en mode lecture seule même sans credentials, mais certaines vérifications seront limitées.

### 3. Permissions AWS Requises

Si vous configurez les credentials, assurez-vous d'avoir les permissions suivantes :

- `ssm:GetParameter` (pour lire les paramètres SSM)
- `elbv2:DescribeLoadBalancers` (pour vérifier l'ALB)
- `rds:DescribeDBInstances` (pour vérifier RDS)
- `cloudfront:ListDistributions` (pour vérifier CloudFront)
- `s3:ListBuckets` (pour vérifier S3)

---

## 📝 Exemple de Sortie

```
Verification des Services Externes - AWS

✅ AWS credentials configurées

Recherche des parametres SSM...
Parametres trouves: 45

=== VERIFICATION DES VARIABLES CRITIQUES ===

✅ DATABASE_URL : Pointe vers AWS RDS
   Valeur: postgresql://***:***@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/postgres?sslmode=require

❌ YOUTUBE_REDIRECT_URI : Pointe vers RENDER (doit pointer vers AWS ALB)
   Valeur actuelle: https://yukpomnang.onrender.com/api/social/youtube/callback
   Valeur attendue: https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/social/youtube/callback
   → Mettre à jour dans Google Cloud Console ET AWS SSM

...

=== RESUMÉ ===

✅ Succès: 25
⚠️ Avertissements: 8
❌ Problèmes: 3

Rapport sauvegarde dans: RAPPORT_VERIFICATION_SERVICES_EXTERNES_20260130_143022.md
```

---

## 🎯 Prochaines Étapes

1. **Exécuter le script** pour identifier les problèmes
2. **Consulter le rapport** généré
3. **Corriger les problèmes** identifiés :
   - Mettre à jour les redirect URIs dans Google Cloud Console
   - Mettre à jour les variables dans AWS SSM Parameter Store
   - Mettre à jour les callbacks dans les dashboards MTN/Orange
4. **Réexécuter le script** pour vérifier que tout est corrigé

---

## 📚 Références

- **Document principal** : `SERVICES_EXTERNES_A_METTRE_A_JOUR.md`
- **Script de mise à jour** : `scripts/update_all_env_variables_aws.ps1`
- **Résumé GPU** : `RESUME_VARIABLES_GPU.md`

---

**Date** : 2026-01-30  
**Statut** : ✅ Script amélioré et prêt à l'emploi



