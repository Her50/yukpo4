# 📋 Variables Expo Production - Configuration GCP

**Date** : 2026-02-14  
**Fichier** : `mobile/eas.json` - Section `production`

---

## 🎯 RÉSUMÉ

**Toutes les variables Expo pour les builds production sont configurées pour GCP Cloud Run.**

---

## 📊 VARIABLES DANS `eas.json` - PRODUCTION

### Configuration Actuelle (GCP)

```json
{
  "build": {
    "production": {
      "env": {
        // ✅ GCP Cloud Run (nouveau backend)
        "EXPO_PUBLIC_API_URL": "https://yukpo-backend-yukpo-project.a.run.app",
        "EXPO_PUBLIC_WS_URL": "wss://yukpo-backend-yukpo-project.a.run.app",
        
        // ⚠️ AWS (ancien backend, commenté pour utilisation future)
        // "EXPO_PUBLIC_API_URL": "https://api.yukpomnang.com",
        // "EXPO_PUBLIC_WS_URL": "wss://api.yukpomnang.com",
        
        "EXPO_PUBLIC_SHARE_URL": "https://yukpomnang.com",
        "EXPO_PUBLIC_ENVIRONMENT": "production",
        "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY": "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ",
        "EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY": "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ",
        "EXPO_PUBLIC_GOOGLE_CLIENT_ID": "738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com",
        "GRADLE_OPTS": "-Xmx6144m -XX:MaxMetaspaceSize=1024m",
        "EXPO_ANDROID_ARCHITECTURES": "arm64-v8a"
      }
    }
  }
}
```

---

## 📋 TABLEAU DES VARIABLES

| Variable | Valeur GCP | Ancienne Valeur AWS | Statut |
|----------|------------|---------------------|--------|
| `EXPO_PUBLIC_API_URL` | `https://yukpo-backend-yukpo-project.a.run.app` | `https://api.yukpomnang.com` | ✅ |
| `EXPO_PUBLIC_WS_URL` | `wss://yukpo-backend-yukpo-project.a.run.app` | `wss://api.yukpomnang.com` | ✅ |
| `EXPO_PUBLIC_SHARE_URL` | `https://yukpomnang.com` | (identique) | ✅ |
| `EXPO_PUBLIC_ENVIRONMENT` | `production` | (identique) | ✅ |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | `AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ` | (identique) | ✅ |
| `EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY` | `AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ` | (identique) | ✅ |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | `738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com` | (identique) | ✅ |
| `GRADLE_OPTS` | `-Xmx6144m -XX:MaxMetaspaceSize=1024m` | (identique) | ✅ |
| `EXPO_ANDROID_ARCHITECTURES` | `arm64-v8a` | (identique) | ✅ |

---

## 🔧 VARIABLES OPTIONNELLES (CDN)

**Variables CDN à ajouter** (optionnel, pour utilisation directe du CDN) :

```json
{
  "build": {
    "production": {
      "env": {
        // Variables existantes...
        
        // ✅ CDN GCP (optionnel)
        "EXPO_PUBLIC_CDN_GCP_URL": "http://34.54.117.97",
        "EXPO_PUBLIC_UPLOAD_BASE_URL": "http://34.54.117.97"
        
        // ⚠️ AWS CDN (ancien, commenté pour utilisation future)
        // "EXPO_PUBLIC_CDN_CLOUDFLARE_URL": "https://cdn.yukpomnang.com",
        // "EXPO_PUBLIC_WASABI_DIRECT_URL": "https://yukpo-video-prod.s3.eu-central-1.wasabisys.com"
      }
    }
  }
}
```

**Note** : Ces variables sont déjà configurées dans `mobile/src/config/environment.ts` avec les fallbacks GCP, donc l'ajout dans `eas.json` est optionnel.

---

## 📊 VARIABLES MODIFIÉES (AWS → GCP)

### Variables Backend

| Variable | Ancien (AWS) | Nouveau (GCP) |
|----------|--------------|---------------|
| `EXPO_PUBLIC_API_URL` | `https://api.yukpomnang.com` | `https://yukpo-backend-yukpo-project.a.run.app` ✅ |
| `EXPO_PUBLIC_WS_URL` | `wss://api.yukpomnang.com` | `wss://yukpo-backend-yukpo-project.a.run.app` ✅ |

### Variables CDN (dans `environment.ts`)

| Variable | Ancien (AWS/Wasabi) | Nouveau (GCP) |
|----------|---------------------|---------------|
| `UPLOAD_BASE_URL` | `https://cdn.yukpomnang.com` | `http://34.54.117.97` ✅ |
| `CDN_GCP_URL` | (nouveau) | `http://34.54.117.97` ✅ |

---

## ✅ CHECKLIST

### Variables Backend
- [x] `EXPO_PUBLIC_API_URL` → GCP Cloud Run ✅
- [x] `EXPO_PUBLIC_WS_URL` → GCP Cloud Run ✅

### Variables CDN (optionnel)
- [ ] `EXPO_PUBLIC_CDN_GCP_URL` dans `eas.json` (optionnel)
- [ ] `EXPO_PUBLIC_UPLOAD_BASE_URL` dans `eas.json` (optionnel)

### Variables Non Modifiées (identiques)
- [x] `EXPO_PUBLIC_SHARE_URL` ✅
- [x] `EXPO_PUBLIC_ENVIRONMENT` ✅
- [x] `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` ✅
- [x] `EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY` ✅
- [x] `EXPO_PUBLIC_GOOGLE_CLIENT_ID` ✅
- [x] `GRADLE_OPTS` ✅
- [x] `EXPO_ANDROID_ARCHITECTURES` ✅

---

## 🎯 RÉSUMÉ

**Variables modifiées** : **2 variables** (Backend API et WebSocket)  
**Variables identiques** : **7 variables** (non liées à AWS/GCP)  
**Variables optionnelles** : **2 variables** (CDN, déjà dans `environment.ts`)

**Total variables dans `production`** : **9 variables** (7 identiques + 2 modifiées)

---

**Date** : 2026-02-14  
**Statut** : ✅ **CONFIGURATION TERMINÉE**



