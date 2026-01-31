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
- **AWS SSM Parameter Store** : `/yukpomnang/production/LIVEKIT_*`
  - Console AWS : https://console.aws.amazon.com/systems-manager/parameters
  - Ou via AWS CLI : `aws ssm put-parameter --name "/yukpomnang/production/LIVEKIT_API_URL" --value "..." --region us-east-1 --overwrite`
- **Configuration LiveKit** : Si LiveKit a une console web, vérifier les URLs de callback
  - Console LiveKit (si hébergé) : Généralement sur le même serveur que l'API (`http://46.224.14.85:7880`)
  - Dashboard LiveKit : Vérifier les paramètres de configuration

---

### 2. **Video Renderer** 🎬

**Configuration actuelle (Render)** :
- `VIDEO_RENDERER_RPC_URL`: `http://46.224.14.85:8088/render`

**Action** : Vérifier si ce service est hébergé sur Render ou externe. Si Render, mettre à jour vers AWS.

**Où mettre à jour** :
- **AWS SSM Parameter Store** : `/yukpomnang/production/VIDEO_RENDERER_RPC_URL`
  - Console AWS : https://console.aws.amazon.com/systems-manager/parameters
  - Ou via AWS CLI : `aws ssm put-parameter --name "/yukpomnang/production/VIDEO_RENDERER_RPC_URL" --value "http://VOTRE_SERVEUR:8088/render" --region us-east-1 --overwrite`
- **Configuration du service Video Renderer** :
  - Si hébergé sur un serveur : Accéder à la configuration du service (fichier de config ou interface web)
  - Si sur Render : https://dashboard.render.com → Voir les services

---

### 3. **SRS (Simple Realtime Server)** 📡

**Configuration actuelle (Render)** :
- `SRS_HLS_URL`: `https://srs.46.224.14.85.sslip.io/live`
- `SRS_RTMP_URL`: `rtmp://46.224.14.85:1935/live`

**Action** : Vérifier si SRS est hébergé sur Render ou externe.

**Où mettre à jour** :
- **AWS SSM Parameter Store** : `/yukpomnang/production/SRS_*`
  - Console AWS : https://console.aws.amazon.com/systems-manager/parameters
  - Ou via AWS CLI : `aws ssm put-parameter --name "/yukpomnang/production/SRS_HLS_URL" --value "..." --region us-east-1 --overwrite`
- **Configuration SRS** :
  - Console SRS : Généralement `http://46.224.14.85:1985` (port par défaut)
  - Dashboard SRS : `http://46.224.14.85:1985/console`
  - Fichier de configuration : `/usr/local/srs/conf/srs.conf` (si accès SSH)

---

### 4. **OAuth Callbacks** 🔐

**Configuration actuelle (Render)** :
- `YOUTUBE_REDIRECT_URI`: `https://yukpomnang.onrender.com/api/social/youtube/callback`

**⚠️ CRITIQUE** : Cette URL doit être mise à jour vers l'URL AWS ALB.

**Où mettre à jour** :

1. **Google Cloud Console** (YouTube OAuth) :
   - **Lien direct** : https://console.cloud.google.com/apis/credentials
   - **Étapes** :
     - Aller dans [Google Cloud Console](https://console.cloud.google.com/)
     - Sélectionner votre projet (ou créer un projet si nécessaire)
     - Menu latéral : **APIs & Services** → **Credentials**
     - Chercher le **OAuth 2.0 Client ID** utilisé pour YouTube
     - Cliquer sur le nom du client pour l'éditer
     - Dans **Authorized redirect URIs**, ajouter/modifier :
       ```
       https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/social/youtube/callback
       ```
     - Cliquer sur **Save**

2. **AWS SSM Parameter Store** :
   - **Lien direct** : https://console.aws.amazon.com/systems-manager/parameters?region=us-east-1
   - **Étapes** :
     - Aller dans [AWS Systems Manager Parameter Store](https://console.aws.amazon.com/systems-manager/parameters?region=us-east-1)
     - Rechercher `/yukpomnang/production/YOUTUBE_REDIRECT_URI`
     - Cliquer sur le paramètre → **Edit**
     - Nouvelle valeur : `https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/social/youtube/callback`
     - Cliquer sur **Save changes**
   - **Ou via AWS CLI** :
     ```powershell
     aws ssm put-parameter --name "/yukpomnang/production/YOUTUBE_REDIRECT_URI" --value "https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/social/youtube/callback" --type "String" --region us-east-1 --overwrite
     ```

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

1. **AWS CloudFront** (si vous utilisez CloudFront) :
   - **Lien direct** : https://console.aws.amazon.com/cloudfront/v3/home
   - **Étapes** :
     - Aller dans [AWS CloudFront Console](https://console.aws.amazon.com/cloudfront/v3/home)
     - Sélectionner votre distribution CloudFront
     - Vérifier les **Origins** et **Behaviors**
     - Si le CDN pointe vers Render, mettre à jour vers S3 ou ALB

2. **AWS S3** (si vous utilisez S3 directement) :
   - **Lien direct** : https://s3.console.aws.amazon.com/s3/buckets
   - **Étapes** :
     - Aller dans [AWS S3 Console](https://s3.console.aws.amazon.com/s3/buckets)
     - Vérifier que le bucket `yukpomnang-media-prod` est configuré correctement
     - Vérifier les permissions et la configuration CORS

3. **AWS SSM Parameter Store** :
   - **Lien direct** : https://console.aws.amazon.com/systems-manager/parameters?region=us-east-1
   - **Étapes** :
     - Mettre à jour `/yukpomnang/production/PUBLIC_BASE_URL` et `/yukpomnang/production/UPLOAD_BASE_URL`
     - Si vous utilisez CloudFront, utiliser l'URL CloudFront
     - Si vous utilisez S3 directement, utiliser l'URL S3 (ex: `https://yukpomnang-media-prod.s3.us-east-1.amazonaws.com`)

---

### 6. **Webhooks Externes** 🔔

**Configuration actuelle (Render)** :
- `PIPELINE_ALERT_WEBHOOK`: `https://hooks.slack.com/services/***/***/***` (à mettre à jour dans SSM)
- `SLA_ALERT_WEBHOOK`: `https://hooks.slack.com/services/***/***/***` (à mettre à jour dans SSM)

**Action** : Ces webhooks Slack sont externes, pas besoin de changement. Mais vérifier que les notifications pointent vers le bon backend.

**Où mettre à jour** :

1. **Slack** (si vous devez créer/modifier des webhooks) :
   - **Lien direct** : https://api.slack.com/apps
   - **Étapes** :
     - Aller dans [Slack API Apps](https://api.slack.com/apps)
     - Sélectionner votre application Slack
     - **Incoming Webhooks** → Vérifier/modifier les URLs de webhook
     - Ou créer de nouveaux webhooks si nécessaire

2. **AWS SSM Parameter Store** :
   - **Lien direct** : https://console.aws.amazon.com/systems-manager/parameters?region=us-east-1
   - **Étapes** :
     - Mettre à jour `/yukpomnang/production/PIPELINE_ALERT_WEBHOOK` et `/yukpomnang/production/SLA_ALERT_WEBHOOK`
     - Les valeurs sont déjà correctes (webhooks Slack), juste vérifier qu'elles existent dans SSM

---

### 7. **Services d'Authentification OAuth** 🔑

**Services à vérifier** :
- **Google OAuth** : `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`
- **YouTube OAuth** : `YOUTUBE_CLIENT_ID` et `YOUTUBE_CLIENT_SECRET`

**Action** : Mettre à jour les "Authorized redirect URIs" dans :

1. **Google Cloud Console** :
   - **Lien direct** : https://console.cloud.google.com/apis/credentials
   - **Étapes** :
     - Aller dans [Google Cloud Console](https://console.cloud.google.com/)
     - Sélectionner votre projet
     - Menu latéral : **APIs & Services** → **Credentials**
     - Chercher les **OAuth 2.0 Client IDs** :
       - Un pour Google OAuth général
       - Un pour YouTube OAuth
     - Pour chaque client :
       - Cliquer sur le nom du client pour l'éditer
       - Dans **Authorized redirect URIs**, ajouter/modifier :
         - Google OAuth : `https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/auth/google/callback`
         - YouTube OAuth : `https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/social/youtube/callback`
       - Cliquer sur **Save**

**Nouvelle URL attendue** :
```
https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/auth/google/callback
https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/social/youtube/callback
```

---

### 8. **Services de Paiement** 💳

**Configuration actuelle (Render)** :
- `MTN_MONEY_*`, `ORANGE_MONEY_*`

**Action** : Vérifier si ces services ont des webhooks ou callbacks qui pointent vers Render.

**Où mettre à jour** :

1. **MTN Money** :
   - **Lien direct** : https://momodeveloper.mtn.com/ (si vous utilisez l'API MTN)
   - **Étapes** :
     - Aller dans le dashboard MTN Money Developer
     - Vérifier les **Webhooks** ou **Callbacks**
     - Mettre à jour les URLs vers AWS ALB :
       ```
       https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/payments/mtn/callback
       ```

2. **Orange Money** :
   - **Lien direct** : https://developer.orange.com/ (si vous utilisez l'API Orange)
   - **Étapes** :
     - Aller dans le dashboard Orange Developer
     - Vérifier les **Webhooks** ou **Callbacks**
     - Mettre à jour les URLs vers AWS ALB :
       ```
       https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/payments/orange/callback
       ```

3. **AWS SSM Parameter Store** :
   - **Lien direct** : https://console.aws.amazon.com/systems-manager/parameters?region=us-east-1
   - Vérifier que les variables `MTN_MONEY_*` et `ORANGE_MONEY_*` sont présentes

---

## 🔍 Comment Trouver l'URL AWS ALB

### Via AWS Console

1. **Lien direct** : https://console.aws.amazon.com/ec2/v2/home?region=us-east-1#LoadBalancers:
2. **Étapes** :
   - Aller dans [AWS EC2 Console - Load Balancers](https://console.aws.amazon.com/ec2/v2/home?region=us-east-1#LoadBalancers:)
   - Sélectionner votre ALB : `yukpomnang-backend-alb`
   - Onglet **Description**
   - Copier le **DNS name** : `yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com`

### Via AWS CLI

```powershell
aws elbv2 describe-load-balancers --region us-east-1 --query "LoadBalancers[?contains(LoadBalancerName, 'yukpomnang')].DNSName" --output text
```

**Résultat actuel** : `yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com`

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

