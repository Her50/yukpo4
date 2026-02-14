# 🔄 Mise à Jour des Variables AWS - Nouveau Compte

**Date**: 2026-02-14  
**Objectif**: Mettre à jour toutes les variables d'environnement pour utiliser le nouveau compte AWS

---

## 📋 Informations du Nouveau Compte AWS

- **Account ID**: `108964700972`
- **Région**: `eu-west-1` (Irlande)
- **Projet**: `yukpo` (au lieu de `yukpomnang`)
- **Bucket S3**: `yukpo-backend-media`
- **URL Backend**: `https://api.yukpomnang.com` (déjà configuré ✅)

---

## ✅ Variables Identifiées à Modifier

### 1. **Fichier: `production (2).json`**

#### Variables AWS à mettre à jour:

| Variable | Ancienne Valeur (Ancien Compte) | Nouvelle Valeur (Nouveau Compte) | Statut |
|----------|--------------------------------|----------------------------------|--------|
| `EXPO_PUBLIC_WASABI_DIRECT_URL` | `https://yukpomnang-media-prod.s3.us-east-1.amazonaws.com` | `https://yukpo-backend-media.s3.eu-west-1.amazonaws.com` | ✅ **MODIFIÉ** |
| `EXPO_PUBLIC_CDN_CLOUDFLARE_URL` | `https://d3jyvgg46kev8.cloudfront.net` | ⚠️ **À VÉRIFIER** (peut être valide ou à remplacer) | ⏳ À vérifier |

#### Variables déjà correctes:
- ✅ `EXPO_PUBLIC_API_URL`: `https://api.yukpomnang.com`
- ✅ `EXPO_PUBLIC_WS_URL`: `wss://api.yukpomnang.com`
- ✅ `EXPO_PUBLIC_UPLOAD_BASE_URL`: `https://api.yukpomnang.com`
- ✅ `EXPO_PUBLIC_SHARE_URL`: `https://yukpomnang.com`

---

### 2. **Fichier: `mobile/eas.json`**

#### Variables dans `production`:
- ✅ `EXPO_PUBLIC_API_URL`: `https://api.yukpomnang.com` (déjà correct)
- ✅ `EXPO_PUBLIC_WS_URL`: `wss://api.yukpomnang.com` (déjà correct)

**Note**: Les variables CDN et S3 ne sont pas définies dans `eas.json`, elles sont chargées depuis `production (2).json` ou `.env`.

---

### 3. **Fichiers de Configuration Mobile**

#### `mobile/src/config/environment.ts`
- ✅ Utilise `process.env.EXPO_PUBLIC_WASABI_DIRECT_URL` (chargé depuis variables d'environnement)
- ✅ Utilise `process.env.EXPO_PUBLIC_CDN_CLOUDFLARE_URL` (chargé depuis variables d'environnement)
- ✅ Fallback: `https://yukpo-video-prod.s3.eu-central-1.wasabisys.com` (Wasabi - différent de S3 AWS)

#### `mobile/src/config/api.config.ts`
- ✅ Utilise `process.env.EXPO_PUBLIC_API_URL` (déjà correct)
- ✅ Fallback: `http://18.201.235.152:8080` (IP publique EC2 - temporaire)

---

## 🔍 Actions Requises

### ✅ Action 1: Vérifier la Distribution CloudFront

La distribution CloudFront `d3jyvgg46kev8.cloudfront.net` peut être:
1. **Valide** si elle pointe vers le nouveau bucket S3 `yukpo-backend-media`
2. **À remplacer** si elle pointe vers l'ancien compte/bucket

**Comment vérifier:**
```bash
# Vérifier dans AWS Console > CloudFront
# Ou via CLI:
aws cloudfront list-distributions --region eu-west-1 --query 'DistributionList.Items[*].[Id,DomainName,Origins.Items[0].DomainName]' --output table
```

**Si la distribution est valide:**
- ✅ Garder `https://d3jyvgg46kev8.cloudfront.net` dans `production (2).json`

**Si la distribution doit être remplacée:**
- Créer une nouvelle distribution CloudFront pointant vers `yukpo-backend-media.s3.eu-west-1.amazonaws.com`
- Mettre à jour `EXPO_PUBLIC_CDN_CLOUDFLARE_URL` avec la nouvelle URL

---

### ✅ Action 2: Vérifier le Bucket S3

**Vérifier que le bucket existe:**
```bash
aws s3 ls s3://yukpo-backend-media --region eu-west-1
```

**Si le bucket n'existe pas:**
- Créer le bucket: `yukpo-backend-media` dans `eu-west-1`
- Configurer les permissions publiques (si nécessaire pour les médias)
- Voir: `CONFIGURER_S3_AWS_POUR_MEDIAS.md`

---

### ✅ Action 3: Mettre à Jour les Variables SSM (Backend)

Les variables SSM dans AWS Parameter Store doivent aussi être mises à jour:

```powershell
# Mettre à jour S3_BUCKET
aws ssm put-parameter `
  --name "/yukpo/production/S3_BUCKET" `
  --value "yukpo-backend-media" `
  --type "String" `
  --region eu-west-1 `
  --overwrite

# Mettre à jour S3_REGION
aws ssm put-parameter `
  --name "/yukpo/production/S3_REGION" `
  --value "eu-west-1" `
  --type "String" `
  --region eu-west-1 `
  --overwrite

# Mettre à jour UPLOAD_BASE_URL (si utilisé)
aws ssm put-parameter `
  --name "/yukpo/production/UPLOAD_BASE_URL" `
  --value "https://yukpo-backend-media.s3.eu-west-1.amazonaws.com" `
  --type "String" `
  --region eu-west-1 `
  --overwrite
```

---

## 📝 Résumé des Modifications Effectuées

### ✅ Fichiers Modifiés

1. **`production (2).json`**
   - ✅ `EXPO_PUBLIC_WASABI_DIRECT_URL`: Mis à jour vers `https://yukpo-backend-media.s3.eu-west-1.amazonaws.com`

### ⏳ Actions en Attente

1. **Vérifier CloudFront Distribution**
   - Vérifier si `d3jyvgg46kev8.cloudfront.net` est valide pour le nouveau compte
   - Si non, créer une nouvelle distribution et mettre à jour `EXPO_PUBLIC_CDN_CLOUDFLARE_URL`

2. **Vérifier/Créer Bucket S3**
   - Vérifier que `yukpo-backend-media` existe dans `eu-west-1`
   - Si non, créer le bucket avec les bonnes permissions

3. **Mettre à Jour Variables SSM**
   - Mettre à jour les variables SSM pour le backend (S3_BUCKET, S3_REGION, UPLOAD_BASE_URL)

---

## 🔄 Migration Complète

### Ancien Compte → Nouveau Compte

| Ressource | Ancien | Nouveau |
|-----------|--------|---------|
| **Région** | `us-east-1` | `eu-west-1` |
| **Account ID** | `846505724644` | `108964700972` |
| **Bucket S3** | `yukpomnang-media-prod` | `yukpo-backend-media` |
| **URL S3** | `*.s3.us-east-1.amazonaws.com` | `*.s3.eu-west-1.amazonaws.com` |
| **Cluster ECS** | `yukpomnang-cluster` | `yukpo-cluster` |
| **Service ECS** | `yukpomnang-backend-service` | `yukpo-backend-service` |

---

## ✅ Checklist Finale

- [x] Mettre à jour `EXPO_PUBLIC_WASABI_DIRECT_URL` dans `production (2).json`
- [ ] Vérifier/Créer bucket S3 `yukpo-backend-media` dans `eu-west-1`
- [ ] Vérifier/Mettre à jour distribution CloudFront
- [ ] Mettre à jour variables SSM (S3_BUCKET, S3_REGION, UPLOAD_BASE_URL)
- [ ] Tester l'accès aux médias depuis le mobile
- [ ] Vérifier que les uploads fonctionnent correctement

---

## 📚 Références

- Configuration S3: `CONFIGURER_S3_AWS_POUR_MEDIAS.md`
- Configuration CDN: `CONFIGURATION_CDN_COMPLETE.md`
- Variables SSM: `GUIDE_CONFIGURATION_VARIABLES_RENDER_VERS_AWS.md`

