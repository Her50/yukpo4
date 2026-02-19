# ✅ Migration EXPO_PUBLIC_WASABI_DIRECT_URL vers GCP

**Date** : 2026-02-14  
**Statut** : ✅ **MIGRATION TERMINÉE**

---

## 🎯 RÉSUMÉ

**La variable `EXPO_PUBLIC_WASABI_DIRECT_URL` (AWS S3) a été remplacée par `EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL` (GCP Cloud CDN).**

---

## 📊 VARIABLE MODIFIÉE

### Ancienne Variable (AWS)

| Variable | Ancienne Valeur (AWS) |
|----------|----------------------|
| `EXPO_PUBLIC_WASABI_DIRECT_URL` | `https://yukpo-backend-media.s3.eu-west-1.amazonaws.com` |

### Nouvelle Variable (GCP)

| Variable | Nouvelle Valeur (GCP) |
|----------|----------------------|
| `EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL` | `http://34.54.117.97` (Cloud CDN GCP) |

**Note** : La nouvelle variable remplace `WASABI_DIRECT_URL` et pointe vers le Cloud CDN GCP.

---

## 📋 FICHIERS MODIFIÉS

### 1. ✅ `mobile/src/config/environment.ts`

**Ajout** :
```typescript
// ✅ GCP Cloud Storage Direct (remplace WASABI_DIRECT_URL)
GCP_STORAGE_DIRECT_URL: process.env.EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL || process.env.EXPO_PUBLIC_WASABI_DIRECT_URL || 'http://34.54.117.97',
// ⚠️ AWS/Wasabi (ancien, commenté pour utilisation future)
// WASABI_DIRECT_URL: process.env.EXPO_PUBLIC_WASABI_DIRECT_URL || 'https://yukpo-video-prod.s3.eu-central-1.wasabisys.com',
// AWS_S3_DIRECT_URL: process.env.EXPO_PUBLIC_AWS_S3_DIRECT_URL || 'https://yukpo-backend-media.s3.eu-west-1.amazonaws.com',
```

---

### 2. ✅ `mobile/src/services/mediaService.ts`

**Modifications** :
- ✅ `getImageUrlWithFallback()` : Utilise `GCP_STORAGE_DIRECT_URL` au lieu de `WASABI_DIRECT_URL`
- ✅ `isGCPStorageUrl()` : Nouvelle méthode pour vérifier les URLs GCP
- ✅ `getGCPStorageBaseUrl()` : Nouvelle méthode pour obtenir l'URL GCP
- ⚠️ `isWasabiUrl()` et `getWasabiBaseUrl()` : Conservées mais commentées pour utilisation future

**Code** :
```typescript
// ✅ Fallback GCP Cloud Storage Direct (remplace Wasabi)
if (ENVIRONMENT.GCP_STORAGE_DIRECT_URL) {
    urls.push(`${ENVIRONMENT.GCP_STORAGE_DIRECT_URL}${normalizedPath}`);
}
```

---

### 3. ✅ `mobile/src/services/cdnService.ts`

**Modifications** :
- ✅ `CDN_ENDPOINTS` : Remplace "Cloudflare" et "Wasabi Direct" par "GCP Cloud CDN" et "GCP Storage Direct"
- ✅ `detectBestEndpoint()` : Priorité : GCP Cloud CDN > GCP Storage Direct > Backend
- ✅ Toutes les références à "Wasabi" remplacées par "GCP Storage"

**Code** :
```typescript
const CDN_ENDPOINTS: CDNEndpoint[] = [
    {
        name: 'GCP Cloud CDN',
        url: ENVIRONMENT.CDN_GCP_URL || 'http://34.54.117.97',
        region: 'europe-west1',
    },
    {
        name: 'GCP Storage Direct',
        url: ENVIRONMENT.GCP_STORAGE_DIRECT_URL || 'http://34.54.117.97',
        region: 'europe-west1',
    },
];
```

---

### 4. ✅ `mobile/eas.json`

**Ajout dans `preview` et `production`** :
```json
{
  "env": {
    // ✅ GCP Cloud Storage Direct (remplace WASABI_DIRECT_URL)
    "EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL": "http://34.54.117.97",
    "EXPO_PUBLIC_CDN_GCP_URL": "http://34.54.117.97",
    "EXPO_PUBLIC_UPLOAD_BASE_URL": "http://34.54.117.97",
    // ⚠️ AWS/Wasabi (ancien, commenté pour utilisation future)
    // "EXPO_PUBLIC_WASABI_DIRECT_URL": "https://yukpo-backend-media.s3.eu-west-1.amazonaws.com",
    // "EXPO_PUBLIC_WASABI_DIRECT_URL": "https://yukpo-video-prod.s3.eu-central-1.wasabisys.com"
  }
}
```

---

## 📊 TABLEAU RÉCAPITULATIF

| Fichier | Variable | Ancien (AWS) | Nouveau (GCP) | Statut |
|---------|----------|-------------|---------------|--------|
| `environment.ts` | `GCP_STORAGE_DIRECT_URL` | (nouveau) | `http://34.54.117.97` | ✅ |
| `environment.ts` | `WASABI_DIRECT_URL` | `https://yukpo-video-prod.s3.eu-central-1.wasabisys.com` | (commenté) | ✅ |
| `environment.ts` | `AWS_S3_DIRECT_URL` | `https://yukpo-backend-media.s3.eu-west-1.amazonaws.com` | (commenté) | ✅ |
| `mediaService.ts` | Fallback URL | Wasabi | GCP Storage | ✅ |
| `cdnService.ts` | CDN Endpoints | Cloudflare/Wasabi | GCP CDN/Storage | ✅ |
| `eas.json` | `EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL` | (nouveau) | `http://34.54.117.97` | ✅ |
| `eas.json` | `EXPO_PUBLIC_WASABI_DIRECT_URL` | `https://yukpo-backend-media.s3.eu-west-1.amazonaws.com` | (commenté) | ✅ |

---

## 🎯 VALEURS GCP

### URLs GCP

| Service | URL |
|---------|-----|
| **Cloud CDN** | `http://34.54.117.97` |
| **Cloud Storage Direct** | `http://34.54.117.97` |
| **Upload Base URL** | `http://34.54.117.97` |

---

## ⚠️ ANCIENNES VALEURS AWS/WASABI (COMMENTÉES)

**Toutes les anciennes valeurs sont commentées** et peuvent être réactivées si nécessaire :

### AWS S3
- `https://yukpo-backend-media.s3.eu-west-1.amazonaws.com`

### Wasabi
- `https://yukpo-video-prod.s3.eu-central-1.wasabisys.com`

---

## ✅ CHECKLIST

### Fichiers Modifiés
- [x] `mobile/src/config/environment.ts` - ✅ Ajout `GCP_STORAGE_DIRECT_URL`
- [x] `mobile/src/services/mediaService.ts` - ✅ Utilise GCP au lieu de Wasabi
- [x] `mobile/src/services/cdnService.ts` - ✅ Utilise GCP au lieu de Wasabi/Cloudflare
- [x] `mobile/eas.json` - ✅ Ajout variables GCP dans `preview` et `production`

### Variables
- [x] `EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL` - ✅ Ajoutée
- [x] `EXPO_PUBLIC_CDN_GCP_URL` - ✅ Ajoutée
- [x] `EXPO_PUBLIC_UPLOAD_BASE_URL` - ✅ Ajoutée
- [x] `EXPO_PUBLIC_WASABI_DIRECT_URL` - ✅ Commentée

---

## 🚀 PROCHAINES ÉTAPES

### 1. Tester les Builds

**Build Preview** :
```bash
eas build --profile preview --platform android
```

**Build Production** :
```bash
eas build --profile production --platform android
```

### 2. Vérifier les Variables

Les builds EAS utiliseront automatiquement les nouvelles variables GCP :
- ✅ `EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL` = `http://34.54.117.97`
- ✅ `EXPO_PUBLIC_CDN_GCP_URL` = `http://34.54.117.97`
- ✅ `EXPO_PUBLIC_UPLOAD_BASE_URL` = `http://34.54.117.97`

### 3. Tester l'Application

Après build :
- ✅ Tester les uploads de médias (CDN GCP)
- ✅ Vérifier l'affichage des images/vidéos (CDN GCP)
- ✅ Tester le fallback CDN → Storage Direct → Backend

---

## 🎯 RÉSULTAT

**✅ Variable `EXPO_PUBLIC_WASABI_DIRECT_URL` migrée vers GCP !**

- ✅ **Variable remplacée** : `EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL`
- ✅ **4 fichiers modifiés**
- ✅ **Anciennes valeurs AWS/Wasabi commentées**
- ✅ **Prêt pour les builds EAS**

**Le système mobile utilise maintenant GCP Cloud CDN pour tous les médias !**

---

**Date** : 2026-02-14  
**Statut** : ✅ **MIGRATION TERMINÉE**



