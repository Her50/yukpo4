# 🔗 Liens AWS Irlande - Variables d'Environnement Expo Production

**Date**: 2026-02-14  
**Compte AWS**: `108964700972`  
**Région**: `eu-west-1` (Irlande)  
**Projet**: `yukpo`

---

## 📋 Configuration pour `production (2).json`

### ✅ Variables AWS à utiliser

```json
{
  "EXPO_PUBLIC_API_URL": "https://api.yukpomnang.com",
  "EXPO_PUBLIC_CDN_CLOUDFLARE_URL": "https://d3jyvgg46kev8.cloudfront.net",
  "EXPO_PUBLIC_ENVIRONMENT": "production",
  "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "738929393617-i2ss2ql4nr25hsffr5ri97gnesh0go3t.apps.googleusercontent.com",
  "EXPO_PUBLIC_GOOGLE_CLIENT_ID": "738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com",
  "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID": "738929393617-j47rj98t5nprrlmdl1nk56mfa2cnmeee.apps.googleusercontent.com",
  "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY": "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ",
  "EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY": "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ",
  "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": "738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com",
  "EXPO_PUBLIC_SHARE_URL": "https://yukpomnang.com",
  "EXPO_PUBLIC_UPLOAD_BASE_URL": "https://api.yukpomnang.com",
  "EXPO_PUBLIC_WASABI_DIRECT_URL": "https://yukpo-backend-media.s3.eu-west-1.amazonaws.com",
  "EXPO_PUBLIC_WS_URL": "wss://api.yukpomnang.com"
}
```

---

## 🔗 URLs AWS Principales

### 1. **S3 Bucket Direct URL** ✅
```
https://yukpo-backend-media.s3.eu-west-1.amazonaws.com
```
- **Bucket**: `yukpo-backend-media`
- **Région**: `eu-west-1` (Irlande)
- **Variable**: `EXPO_PUBLIC_WASABI_DIRECT_URL`
- **Statut**: ✅ Déjà configuré correctement

### 2. **CloudFront CDN URL** ⚠️
```
https://d3jyvgg46kev8.cloudfront.net
```
- **Distribution ID**: `d3jyvgg46kev8`
- **Variable**: `EXPO_PUBLIC_CDN_CLOUDFLARE_URL`
- **⚠️ Action requise**: Vérifier que cette distribution pointe vers `yukpo-backend-media.s3.eu-west-1.amazonaws.com`

### 3. **API Backend** ✅
```
https://api.yukpomnang.com
```
- **Variable**: `EXPO_PUBLIC_API_URL`
- **Statut**: ✅ Déjà configuré correctement

### 4. **WebSocket** ✅
```
wss://api.yukpomnang.com
```
- **Variable**: `EXPO_PUBLIC_WS_URL`
- **Statut**: ✅ Déjà configuré correctement

---

## 🔍 Vérifications Requises

### ✅ Vérifier le Bucket S3

```bash
aws s3 ls s3://yukpo-backend-media --region eu-west-1
```

**Si le bucket n'existe pas**, le créer :
```bash
aws s3 mb s3://yukpo-backend-media --region eu-west-1
```

### ⚠️ Vérifier la Distribution CloudFront

```bash
aws cloudfront list-distributions \
  --region eu-west-1 \
  --query 'DistributionList.Items[*].[Id,DomainName,Origins.Items[0].DomainName]' \
  --output table
```

**Vérifier que** :
- La distribution `d3jyvgg46kev8` existe
- L'origine pointe vers `yukpo-backend-media.s3.eu-west-1.amazonaws.com`

**Si la distribution n'existe pas ou pointe vers l'ancien bucket** :
1. Créer une nouvelle distribution CloudFront
2. Configurer l'origine : `yukpo-backend-media.s3.eu-west-1.amazonaws.com`
3. Attendre le déploiement (5-10 minutes)
4. Mettre à jour `EXPO_PUBLIC_CDN_CLOUDFLARE_URL` avec le nouveau Domain Name

---

## 📊 Résumé des Modifications

| Variable | Valeur Actuelle | Statut |
|----------|----------------|--------|
| `EXPO_PUBLIC_WASABI_DIRECT_URL` | `https://yukpo-backend-media.s3.eu-west-1.amazonaws.com` | ✅ Correct |
| `EXPO_PUBLIC_CDN_CLOUDFLARE_URL` | `https://d3jyvgg46kev8.cloudfront.net` | ⚠️ À vérifier |
| `EXPO_PUBLIC_API_URL` | `https://api.yukpomnang.com` | ✅ Correct |
| `EXPO_PUBLIC_WS_URL` | `wss://api.yukpomnang.com` | ✅ Correct |
| `EXPO_PUBLIC_UPLOAD_BASE_URL` | `https://api.yukpomnang.com` | ✅ Correct |

---

## 🚀 Actions Immédiates

1. ✅ **Vérifier le bucket S3** : `yukpo-backend-media` existe dans `eu-west-1`
2. ⚠️ **Vérifier CloudFront** : Distribution `d3jyvgg46kev8` pointe vers le bon bucket
3. ✅ **Mettre à jour `production (2).json`** : Les valeurs sont déjà correctes (sauf CloudFront à vérifier)

---

## 📝 Notes Importantes

- **Région**: Toutes les ressources sont dans `eu-west-1` (Irlande)
- **Account ID**: `108964700972`
- **Bucket S3**: `yukpo-backend-media` (pas `yukpomnang-media-prod`)
- **CloudFront**: Vérifier que la distribution existe et pointe vers le bon bucket

---

## 🔗 Liens Utiles

- **AWS Console S3**: https://console.aws.amazon.com/s3/home?region=eu-west-1
- **AWS Console CloudFront**: https://console.aws.amazon.com/cloudfront/v3/home?region=eu-west-1
- **AWS Console ECS**: https://console.aws.amazon.com/ecs/v2/clusters?region=eu-west-1



