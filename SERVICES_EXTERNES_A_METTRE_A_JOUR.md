# 🔄 Services Externes à Mettre à Jour : Render → AWS

## 📋 Résumé

Liste des services externes qui référencent encore Render et doivent être mis à jour avec les nouvelles références AWS.

---

## 🎯 Services Identifiés

### 1. **LiveKit** 📹

**Configuration actuelle (Render)** :
- `LIVEKIT_API_URL`: `http://46.224.14.85:7880`
- `LIVEKIT_WS_URL`: `ws://46.224.14.85:7880`
- `LIVEKIT_HLS_URL`: `http://46.224.14.85:8080/live`

**Action** : Vérifier si ces URLs pointent vers Render ou un serveur externe. Si c'est un serveur externe, pas de changement nécessaire.

**Où mettre à jour** :
- AWS SSM Parameter Store : `/yukpomnang/production/LIVEKIT_*`
- Configuration LiveKit si elle référence le backend Render

---

### 2. **Video Renderer** 🎬

**Configuration actuelle (Render)** :
- `VIDEO_RENDERER_RPC_URL`: `http://46.224.14.85:8088/render`

**Action** : Vérifier si ce service est hébergé sur Render ou externe. Si Render, mettre à jour vers AWS.

**Où mettre à jour** :
- AWS SSM Parameter Store : `/yukpomnang/production/VIDEO_RENDERER_RPC_URL`
- Configuration du service Video Renderer

---

### 3. **SRS (Simple Realtime Server)** 📡

**Configuration actuelle (Render)** :
- `SRS_HLS_URL`: `https://srs.46.224.14.85.sslip.io/live`
- `SRS_RTMP_URL`: `rtmp://46.224.14.85:1935/live`

**Action** : Vérifier si SRS est hébergé sur Render ou externe.

**Où mettre à jour** :
- AWS SSM Parameter Store : `/yukpomnang/production/SRS_*`
- Configuration SRS

---

### 4. **OAuth Callbacks** 🔐

**Configuration actuelle (Render)** :
- `YOUTUBE_REDIRECT_URI`: `https://yukpomnang.onrender.com/api/social/youtube/callback`

**⚠️ CRITIQUE** : Cette URL doit être mise à jour vers l'URL AWS ALB.

**Où mettre à jour** :
1. **Google Cloud Console** (YouTube OAuth) :
   - Aller dans [Google Cloud Console](https://console.cloud.google.com/)
   - APIs & Services → Credentials
   - Sélectionner le OAuth 2.0 Client ID
   - Mettre à jour "Authorized redirect URIs" avec l'URL AWS ALB

2. **AWS SSM Parameter Store** :
   - `/yukpomnang/production/YOUTUBE_REDIRECT_URI`
   - Nouvelle valeur : `https://VOTRE_ALB_URL/api/social/youtube/callback`

**Nouvelle URL attendue** :
```
https://VOTRE_ALB_DNS_NAME.region.elb.amazonaws.com/api/social/youtube/callback
```

---

### 5. **CDN / Public URLs** 🌐

**Configuration actuelle (Render)** :
- `PUBLIC_BASE_URL`: `https://cdn.yukpomnang.com`
- `UPLOAD_BASE_URL`: `https://cdn.yukpomnang.com`

**Action** : Vérifier si le CDN pointe vers Render ou AWS S3/CloudFront.

**Où mettre à jour** :
- Si le CDN pointe vers Render, mettre à jour vers AWS S3/CloudFront
- AWS SSM Parameter Store : `/yukpomnang/production/PUBLIC_BASE_URL` et `/yukpomnang/production/UPLOAD_BASE_URL`

---

### 6. **Webhooks Externes** 🔔

**Configuration actuelle (Render)** :
- `PIPELINE_ALERT_WEBHOOK`: `https://hooks.slack.com/services/***/***/***` (à mettre à jour dans SSM)
- `SLA_ALERT_WEBHOOK`: `https://hooks.slack.com/services/***/***/***` (à mettre à jour dans SSM)

**Action** : Ces webhooks Slack sont externes, pas besoin de changement. Mais vérifier que les notifications pointent vers le bon backend.

**Où mettre à jour** :
- Si les webhooks doivent notifier le backend, mettre à jour les URLs dans Slack
- AWS SSM Parameter Store : `/yukpomnang/production/PIPELINE_ALERT_WEBHOOK` et `/yukpomnang/production/SLA_ALERT_WEBHOOK`

---

### 7. **Services d'Authentification OAuth** 🔑

**Services à vérifier** :
- **Google OAuth** : `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`
- **YouTube OAuth** : `YOUTUBE_CLIENT_ID` et `YOUTUBE_CLIENT_SECRET`

**Action** : Mettre à jour les "Authorized redirect URIs" dans :
1. **Google Cloud Console** :
   - APIs & Services → Credentials
   - Mettre à jour les redirect URIs pour pointer vers AWS ALB

**Nouvelle URL attendue** :
```
https://VOTRE_ALB_DNS_NAME/api/auth/google/callback
https://VOTRE_ALB_DNS_NAME/api/social/youtube/callback
```

---

### 8. **Services de Paiement** 💳

**Configuration actuelle (Render)** :
- `MTN_MONEY_*`, `ORANGE_MONEY_*`

**Action** : Vérifier si ces services ont des webhooks ou callbacks qui pointent vers Render.

**Où mettre à jour** :
- Dashboards MTN Money / Orange Money
- URLs de callback/webhook vers AWS ALB

---

## 🔍 Comment Trouver l'URL AWS ALB

### Via AWS Console

1. **Console AWS** → **EC2** → **Load Balancers**
2. Sélectionner votre ALB (Application Load Balancer)
3. Onglet **Description**
4. Copier le **DNS name** (ex: `yukpomnang-alb-123456789.us-east-1.elb.amazonaws.com`)

### Via AWS CLI

```powershell
aws elbv2 describe-load-balancers --region us-east-1 --query "LoadBalancers[?contains(LoadBalancerName, 'yukpomnang')].DNSName" --output text
```

---

## 📝 Checklist de Mise à Jour

### Services OAuth (CRITIQUE)

- [ ] **Google OAuth** : Mettre à jour redirect URI dans Google Cloud Console
- [ ] **YouTube OAuth** : Mettre à jour redirect URI dans Google Cloud Console
- [ ] **AWS SSM** : Mettre à jour `YOUTUBE_REDIRECT_URI` avec l'URL AWS ALB

### Services Externes

- [ ] **LiveKit** : Vérifier si les URLs pointent vers Render ou externe
- [ ] **Video Renderer** : Vérifier si le service est sur Render ou externe
- [ ] **SRS** : Vérifier si le service est sur Render ou externe
- [ ] **CDN** : Vérifier si le CDN pointe vers Render ou AWS

### Webhooks

- [ ] **Slack Webhooks** : Vérifier que les notifications fonctionnent
- [ ] **Services de Paiement** : Mettre à jour les callbacks si nécessaire

---

## 🎯 URLs AWS à Utiliser

### Backend API

**Format** :
```
https://VOTRE_ALB_DNS_NAME/api/...
```

**Exemples** :
- Health check : `https://VOTRE_ALB_DNS_NAME/health`
- API auth : `https://VOTRE_ALB_DNS_NAME/api/auth/...`
- API social : `https://VOTRE_ALB_DNS_NAME/api/social/...`

### OAuth Callbacks

**Google OAuth** :
```
https://VOTRE_ALB_DNS_NAME/api/auth/google/callback
```

**YouTube OAuth** :
```
https://VOTRE_ALB_DNS_NAME/api/social/youtube/callback
```

---

## 🔧 Script de Mise à Jour Automatique

Le script `update_all_env_variables_aws.ps1` met déjà à jour les variables dans AWS SSM Parameter Store.

**Pour les services externes (Google, YouTube, etc.)**, vous devez les mettre à jour manuellement dans leurs consoles respectives.

---

## 📞 Support

Si vous avez besoin d'aide pour mettre à jour un service spécifique, consultez la documentation du service ou contactez le support.

---

**Date** : 2026-01-30  
**Statut** : ⚠️ **Action requise pour OAuth callbacks et services externes**

