# 📋 Variables pour "production (6).json"

**Date** : 2026-02-14  
**Fichier** : Configuration production pour Expo

---

## 🎯 RÉSUMÉ

**Toutes les variables à ajouter dans votre fichier de configuration production, avec les valeurs GCP.**

---

## ⚠️ EXPO_PUBLIC_WASABI_DIRECT_URL - NOUVELLE VALEUR

**La variable `EXPO_PUBLIC_WASABI_DIRECT_URL` a maintenant la valeur GCP :**

```json
"EXPO_PUBLIC_WASABI_DIRECT_URL": "http://34.54.117.97"
```

**Ancienne valeur AWS** (commentée) :
```json
// "EXPO_PUBLIC_WASABI_DIRECT_URL": "https://yukpo-backend-media.s3.eu-west-1.amazonaws.com"
```

---

## 📊 TOUTES LES VARIABLES PRODUCTION

### Format JSON complet

```json
{
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
```

---

## 📋 TABLEAU DÉTAILLÉ

| # | Variable | Valeur GCP | Ancienne Valeur AWS | Description |
|---|----------|------------|---------------------|-------------|
| **BACKEND** |
| 1 | `EXPO_PUBLIC_API_URL` | `https://yukpo-backend-yukpo-project.a.run.app` | `https://api.yukpomnang.com` | URL API Backend |
| 2 | `EXPO_PUBLIC_WS_URL` | `wss://yukpo-backend-yukpo-project.a.run.app` | `wss://api.yukpomnang.com` | URL WebSocket |
| **CDN & STORAGE** |
| 3 | `EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL` | `http://34.54.117.97` | (nouveau) | **NOUVELLE** - URL Cloud Storage GCP |
| 4 | `EXPO_PUBLIC_CDN_GCP_URL` | `http://34.54.117.97` | (nouveau) | **NOUVELLE** - URL Cloud CDN GCP |
| 5 | `EXPO_PUBLIC_UPLOAD_BASE_URL` | `http://34.54.117.97` | `https://cdn.yukpomnang.com` | URL base pour uploads |
| 6 | `EXPO_PUBLIC_WASABI_DIRECT_URL` | `http://34.54.117.97` | `https://yukpo-backend-media.s3.eu-west-1.amazonaws.com` | **✅ NOUVELLE VALEUR GCP** |
| **APPLICATION** |
| 7 | `EXPO_PUBLIC_SHARE_URL` | `https://yukpomnang.com` | (identique) | URL de partage |
| 8 | `EXPO_PUBLIC_ENVIRONMENT` | `production` | (identique) | Environnement |
| **GOOGLE** |
| 9 | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | `AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ` | (identique) | Clé API Google Maps |
| 10 | `EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY` | `AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ` | (identique) | Clé API Google Translate |
| 11 | `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | `738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com` | (identique) | Client ID Google OAuth |
| **BUILD** |
| 12 | `GRADLE_OPTS` | `-Xmx6144m -XX:MaxMetaspaceSize=1024m` | (identique) | Options Gradle |
| 13 | `EXPO_ANDROID_ARCHITECTURES` | `arm64-v8a` | (identique) | Architectures Android |

**Total** : **13 variables**

---

## ✅ EXPO_PUBLIC_WASABI_DIRECT_URL - DÉTAILS

### Ancienne Valeur (AWS)
```json
"EXPO_PUBLIC_WASABI_DIRECT_URL": "https://yukpo-backend-media.s3.eu-west-1.amazonaws.com"
```

### ✅ Nouvelle Valeur (GCP)
```json
"EXPO_PUBLIC_WASABI_DIRECT_URL": "http://34.54.117.97"
```

**Explication** :
- ✅ La variable `EXPO_PUBLIC_WASABI_DIRECT_URL` pointe maintenant vers **GCP Cloud CDN**
- ✅ Même valeur que `EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL` pour compatibilité
- ✅ L'ancien code qui utilise `WASABI_DIRECT_URL` fonctionnera avec GCP

---

## 📝 FORMAT POUR FICHIER EXTERNE

Si vous avez un fichier `production (6).json` séparé, voici le format :

```json
{
  "variables": {
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
```

---

## 🔍 VÉRIFICATION

### Variables modifiées (AWS → GCP) : 6 variables
1. ✅ `EXPO_PUBLIC_API_URL`
2. ✅ `EXPO_PUBLIC_WS_URL`
3. ✅ `EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL` (nouvelle)
4. ✅ `EXPO_PUBLIC_CDN_GCP_URL` (nouvelle)
5. ✅ `EXPO_PUBLIC_UPLOAD_BASE_URL`
6. ✅ `EXPO_PUBLIC_WASABI_DIRECT_URL` **← NOUVELLE VALEUR GCP**

### Variables identiques : 7 variables
- `EXPO_PUBLIC_SHARE_URL`
- `EXPO_PUBLIC_ENVIRONMENT`
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- `EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY`
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID`
- `GRADLE_OPTS`
- `EXPO_ANDROID_ARCHITECTURES`

---

## 🎯 RÉSUMÉ

**✅ `EXPO_PUBLIC_WASABI_DIRECT_URL` a maintenant la valeur GCP : `http://34.54.117.97`**

**Total variables** : **13 variables**

**Toutes les variables sont configurées pour GCP !**

---

**Date** : 2026-02-14  
**Statut** : ✅ **CONFIGURATION COMPLÈTE**

