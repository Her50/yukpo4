# 📋 Variables Production Complètes - Configuration GCP

**Date** : 2026-02-14  
**Fichier de référence** : `mobile/eas.json` - Section `production`

---

## 🎯 RÉSUMÉ

**Toutes les variables nécessaires pour les builds production, avec les nouvelles valeurs GCP et les anciennes valeurs AWS commentées.**

---

## ⚠️ IMPORTANT : EXPO_PUBLIC_WASABI_DIRECT_URL

**La variable `EXPO_PUBLIC_WASABI_DIRECT_URL` a été remplacée par `EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL`.**

**Pour compatibilité**, vous pouvez garder les deux :
- ✅ **Nouvelle variable** : `EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL` = `http://34.54.117.97`
- ⚠️ **Ancienne variable** (pour compatibilité) : `EXPO_PUBLIC_WASABI_DIRECT_URL` = `http://34.54.117.97`

---

## 📊 VARIABLES PRODUCTION COMPLÈTES

### Configuration JSON pour `production` dans `eas.json`

```json
{
  "build": {
    "production": {
      "env": {
        // ============================================
        // ✅ BACKEND GCP CLOUD RUN (NOUVEAU)
        // ============================================
        "EXPO_PUBLIC_API_URL": "https://yukpo-backend-yukpo-project.a.run.app",
        "EXPO_PUBLIC_WS_URL": "wss://yukpo-backend-yukpo-project.a.run.app",
        
        // ⚠️ AWS (ancien backend, commenté pour utilisation future)
        // "EXPO_PUBLIC_API_URL": "https://api.yukpomnang.com",
        // "EXPO_PUBLIC_WS_URL": "wss://api.yukpomnang.com",
        
        // ============================================
        // ✅ CDN ET STORAGE GCP (NOUVEAU)
        // ============================================
        "EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL": "http://34.54.117.97",
        "EXPO_PUBLIC_CDN_GCP_URL": "http://34.54.117.97",
        "EXPO_PUBLIC_UPLOAD_BASE_URL": "http://34.54.117.97",
        
        // ⚠️ Pour compatibilité avec ancien code (optionnel)
        "EXPO_PUBLIC_WASABI_DIRECT_URL": "http://34.54.117.97",
        
        // ⚠️ AWS/Wasabi (ancien, commenté pour utilisation future)
        // "EXPO_PUBLIC_WASABI_DIRECT_URL": "https://yukpo-backend-media.s3.eu-west-1.amazonaws.com",
        // "EXPO_PUBLIC_WASABI_DIRECT_URL": "https://yukpo-video-prod.s3.eu-central-1.wasabisys.com",
        // "EXPO_PUBLIC_CDN_CLOUDFLARE_URL": "https://cdn.yukpomnang.com",
        
        // ============================================
        // ✅ CONFIGURATION APPLICATION
        // ============================================
        "EXPO_PUBLIC_SHARE_URL": "https://yukpomnang.com",
        "EXPO_PUBLIC_ENVIRONMENT": "production",
        
        // ============================================
        // ✅ GOOGLE SERVICES
        // ============================================
        "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY": "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ",
        "EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY": "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ",
        "EXPO_PUBLIC_GOOGLE_CLIENT_ID": "738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com",
        
        // ============================================
        // ✅ BUILD ANDROID
        // ============================================
        "GRADLE_OPTS": "-Xmx6144m -XX:MaxMetaspaceSize=1024m",
        "EXPO_ANDROID_ARCHITECTURES": "arm64-v8a"
      }
    }
  }
}
```

---

## 📋 TABLEAU DES VARIABLES

| Variable | Valeur GCP | Ancienne Valeur AWS | Statut | Description |
|----------|------------|---------------------|---------|-------------|
| **BACKEND** |
| `EXPO_PUBLIC_API_URL` | `https://yukpo-backend-yukpo-project.a.run.app` | `https://api.yukpomnang.com` | ✅ | URL API Backend |
| `EXPO_PUBLIC_WS_URL` | `wss://yukpo-backend-yukpo-project.a.run.app` | `wss://api.yukpomnang.com` | ✅ | URL WebSocket |
| **CDN & STORAGE** |
| `EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL` | `http://34.54.117.97` | (nouveau) | ✅ | **NOUVELLE** - URL Cloud Storage GCP |
| `EXPO_PUBLIC_CDN_GCP_URL` | `http://34.54.117.97` | (nouveau) | ✅ | **NOUVELLE** - URL Cloud CDN GCP |
| `EXPO_PUBLIC_UPLOAD_BASE_URL` | `http://34.54.117.97` | `https://cdn.yukpomnang.com` | ✅ | URL base pour uploads |
| `EXPO_PUBLIC_WASABI_DIRECT_URL` | `http://34.54.117.97` | `https://yukpo-backend-media.s3.eu-west-1.amazonaws.com` | ⚠️ | **COMPATIBILITÉ** - Même valeur que GCP |
| **APPLICATION** |
| `EXPO_PUBLIC_SHARE_URL` | `https://yukpomnang.com` | (identique) | ✅ | URL de partage |
| `EXPO_PUBLIC_ENVIRONMENT` | `production` | (identique) | ✅ | Environnement |
| **GOOGLE** |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | `AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ` | (identique) | ✅ | Clé API Google Maps |
| `EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY` | `AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ` | (identique) | ✅ | Clé API Google Translate |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | `738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com` | (identique) | ✅ | Client ID Google OAuth |
| **BUILD** |
| `GRADLE_OPTS` | `-Xmx6144m -XX:MaxMetaspaceSize=1024m` | (identique) | ✅ | Options Gradle |
| `EXPO_ANDROID_ARCHITECTURES` | `arm64-v8a` | (identique) | ✅ | Architectures Android |

---

## 🔧 EXPO_PUBLIC_WASABI_DIRECT_URL - EXPLICATION

### Pourquoi vous ne voyez pas la nouvelle valeur ?

**La variable `EXPO_PUBLIC_WASABI_DIRECT_URL` a été remplacée par `EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL`.**

### Solution : Ajouter les deux variables

**Pour compatibilité avec l'ancien code**, ajoutez les deux variables dans `eas.json` :

```json
{
  "build": {
    "production": {
      "env": {
        // ✅ NOUVELLE variable (recommandée)
        "EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL": "http://34.54.117.97",
        
        // ⚠️ ANCIENNE variable (pour compatibilité)
        "EXPO_PUBLIC_WASABI_DIRECT_URL": "http://34.54.117.97"
      }
    }
  }
}
```

**Les deux pointent vers la même URL GCP** (`http://34.54.117.97`), donc :
- ✅ Le nouveau code utilise `EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL`
- ✅ L'ancien code continue d'utiliser `EXPO_PUBLIC_WASABI_DIRECT_URL`
- ✅ Les deux fonctionnent avec GCP

---

## 📝 FICHIER PRODUCTION COMPLET

### Contenu exact pour `mobile/eas.json` - Section `production`

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://yukpo-backend-yukpo-project.a.run.app",
        "EXPO_PUBLIC_WS_URL": "wss://yukpo-backend-yukpo-project.a.run.app",
        "EXPO_PUBLIC_SHARE_URL": "https://yukpomnang.com",
        "EXPO_PUBLIC_ENVIRONMENT": "production",
        "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY": "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ",
        "EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY": "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ",
        "EXPO_PUBLIC_GOOGLE_CLIENT_ID": "738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com",
        "GRADLE_OPTS": "-Xmx6144m -XX:MaxMetaspaceSize=1024m",
        "EXPO_ANDROID_ARCHITECTURES": "arm64-v8a",
        "EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL": "http://34.54.117.97",
        "EXPO_PUBLIC_CDN_GCP_URL": "http://34.54.117.97",
        "EXPO_PUBLIC_UPLOAD_BASE_URL": "http://34.54.117.97",
        "EXPO_PUBLIC_WASABI_DIRECT_URL": "http://34.54.117.97"
      }
    }
  }
}
```

---

## ✅ CHECKLIST

### Variables Backend
- [x] `EXPO_PUBLIC_API_URL` → GCP Cloud Run ✅
- [x] `EXPO_PUBLIC_WS_URL` → GCP Cloud Run ✅

### Variables CDN/Storage
- [x] `EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL` → GCP Cloud CDN ✅
- [x] `EXPO_PUBLIC_CDN_GCP_URL` → GCP Cloud CDN ✅
- [x] `EXPO_PUBLIC_UPLOAD_BASE_URL` → GCP Cloud CDN ✅
- [x] `EXPO_PUBLIC_WASABI_DIRECT_URL` → GCP Cloud CDN (compatibilité) ✅

### Variables Application
- [x] `EXPO_PUBLIC_SHARE_URL` ✅
- [x] `EXPO_PUBLIC_ENVIRONMENT` ✅

### Variables Google
- [x] `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` ✅
- [x] `EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY` ✅
- [x] `EXPO_PUBLIC_GOOGLE_CLIENT_ID` ✅

### Variables Build
- [x] `GRADLE_OPTS` ✅
- [x] `EXPO_ANDROID_ARCHITECTURES` ✅

---

## 🎯 RÉSUMÉ

**Total variables** : **13 variables**

**Variables modifiées (AWS → GCP)** : **5 variables**
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_WS_URL`
- `EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL` (nouvelle)
- `EXPO_PUBLIC_CDN_GCP_URL` (nouvelle)
- `EXPO_PUBLIC_UPLOAD_BASE_URL`
- `EXPO_PUBLIC_WASABI_DIRECT_URL` (compatibilité, même valeur GCP)

**Variables identiques** : **7 variables**
- `EXPO_PUBLIC_SHARE_URL`
- `EXPO_PUBLIC_ENVIRONMENT`
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- `EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY`
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID`
- `GRADLE_OPTS`
- `EXPO_ANDROID_ARCHITECTURES`

---

**Date** : 2026-02-14  
**Statut** : ✅ **CONFIGURATION COMPLÈTE**

