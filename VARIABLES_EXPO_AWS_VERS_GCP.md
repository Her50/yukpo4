# 📋 Variables Expo : Migration AWS → GCP

**Date** : 2026-02-14  
**Objectif** : Identifier toutes les variables Expo liées à AWS et leurs valeurs GCP correspondantes

---

## 🎯 RÉSUMÉ

**6 fichiers contiennent des variables Expo avec des fallbacks AWS qui doivent être mis à jour vers GCP.**

---

## 📊 VARIABLES À MODIFIER

### 1. ✅ `mobile/eas.json` (DÉJÀ MIS À JOUR)

**Statut** : ✅ **DÉJÀ CONFIGURÉ**

**Variables** :
- ✅ `EXPO_PUBLIC_API_URL` = `https://yukpo-backend-yukpo-project.a.run.app` (GCP)
- ✅ `EXPO_PUBLIC_WS_URL` = `wss://yukpo-backend-yukpo-project.a.run.app` (GCP)
- ⚠️ Anciennes valeurs AWS commentées

**À ajouter** (optionnel, pour CDN) :
```json
{
  "preview": {
    "env": {
      "EXPO_PUBLIC_CDN_GCP_URL": "http://34.54.117.97",
      "EXPO_PUBLIC_UPLOAD_BASE_URL": "http://34.54.117.97"
    }
  },
  "production": {
    "env": {
      "EXPO_PUBLIC_CDN_GCP_URL": "http://34.54.117.97",
      "EXPO_PUBLIC_UPLOAD_BASE_URL": "http://34.54.117.97"
    }
  }
}
```

---

### 2. ⚠️ `mobile/app.config.js` (À MODIFIER)

**Fichier** : `mobile/app.config.js`  
**Lignes** : 187-188

**Avant (AWS)** :
```javascript
apiUrl: getEnvVar('EXPO_PUBLIC_API_URL', 'https://api.yukpomnang.com'),
wsUrl: getEnvVar('EXPO_PUBLIC_WS_URL', 'wss://api.yukpomnang.com'),
```

**Après (GCP)** :
```javascript
// ✅ GCP Cloud Run (nouveau backend)
apiUrl: getEnvVar('EXPO_PUBLIC_API_URL', 'https://yukpo-backend-yukpo-project.a.run.app'),
wsUrl: getEnvVar('EXPO_PUBLIC_WS_URL', 'wss://yukpo-backend-yukpo-project.a.run.app'),
// ⚠️ AWS (ancien backend, commenté pour utilisation future)
// apiUrl: getEnvVar('EXPO_PUBLIC_API_URL', 'https://api.yukpomnang.com'),
// wsUrl: getEnvVar('EXPO_PUBLIC_WS_URL', 'wss://api.yukpomnang.com'),
```

---

### 3. ⚠️ `mobile/src/config/websocket.ts` (À MODIFIER)

**Fichier** : `mobile/src/config/websocket.ts`  
**Lignes** : 11, 17, 23, 29

**Avant (AWS)** :
```typescript
const baseUrl = process.env.EXPO_PUBLIC_WS_URL || 'wss://api.yukpomnang.com';
```

**Après (GCP)** :
```typescript
// ✅ GCP Cloud Run (nouveau backend)
const baseUrl = process.env.EXPO_PUBLIC_WS_URL || 'wss://yukpo-backend-yukpo-project.a.run.app';
// ⚠️ AWS (ancien backend, commenté pour utilisation future)
// const baseUrl = process.env.EXPO_PUBLIC_WS_URL || 'wss://api.yukpomnang.com';
```

**4 occurrences à modifier** :
- Ligne 11 : `notifications`
- Ligne 17 : `chat`
- Ligne 23 : `status`
- Ligne 29 : `payments`

---

### 4. ⚠️ `mobile/src/hooks/useCombinationProgress.ts` (À MODIFIER)

**Fichier** : `mobile/src/hooks/useCombinationProgress.ts`  
**Ligne** : 5

**Avant (AWS)** :
```typescript
const API_URL = process.env.EXPO_PUBLIC_API_URL || process.env.REACT_APP_API_URL || 'https://api.yukpomnang.com';
```

**Après (GCP)** :
```typescript
// ✅ GCP Cloud Run (nouveau backend)
const API_URL = process.env.EXPO_PUBLIC_API_URL || process.env.REACT_APP_API_URL || 'https://yukpo-backend-yukpo-project.a.run.app';
// ⚠️ AWS (ancien backend, commenté pour utilisation future)
// const API_URL = process.env.EXPO_PUBLIC_API_URL || process.env.REACT_APP_API_URL || 'https://api.yukpomnang.com';
```

---

### 5. ⚠️ `mobile/src/config/weatherConfig.ts` (À MODIFIER)

**Fichier** : `mobile/src/config/weatherConfig.ts`  
**Ligne** : 5

**Avant (AWS)** :
```typescript
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.yukpomnang.com';
```

**Après (GCP)** :
```typescript
// ✅ GCP Cloud Run (nouveau backend)
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'https://yukpo-backend-yukpo-project.a.run.app';
// ⚠️ AWS (ancien backend, commenté pour utilisation future)
// const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.yukpomnang.com';
```

---

### 6. ⚠️ `mobile/build-local-with-env.ps1` (À MODIFIER)

**Fichier** : `mobile/build-local-with-env.ps1`  
**Lignes** : 33, 36

**Avant (AWS)** :
```powershell
if (-not $env:EXPO_PUBLIC_API_URL) {
    $env:EXPO_PUBLIC_API_URL = "https://api.yukpomnang.com"
}
if (-not $env:EXPO_PUBLIC_WS_URL) {
    $env:EXPO_PUBLIC_WS_URL = "wss://api.yukpomnang.com"
}
```

**Après (GCP)** :
```powershell
# ✅ GCP Cloud Run (nouveau backend)
if (-not $env:EXPO_PUBLIC_API_URL) {
    $env:EXPO_PUBLIC_API_URL = "https://yukpo-backend-yukpo-project.a.run.app"
    # $env:EXPO_PUBLIC_API_URL = "https://api.yukpomnang.com"  # ⚠️ AWS (ancien)
}
if (-not $env:EXPO_PUBLIC_WS_URL) {
    $env:EXPO_PUBLIC_WS_URL = "wss://yukpo-backend-yukpo-project.a.run.app"
    # $env:EXPO_PUBLIC_WS_URL = "wss://api.yukpomnang.com"  # ⚠️ AWS (ancien)
}
```

---

### 7. ⚠️ `mobile/test-create-product-with-images.js` (À MODIFIER)

**Fichier** : `mobile/test-create-product-with-images.js`  
**Ligne** : 17

**Avant (AWS)** :
```javascript
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.yukpomnang.com';
```

**Après (GCP)** :
```javascript
// ✅ GCP Cloud Run (nouveau backend)
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://yukpo-backend-yukpo-project.a.run.app';
// ⚠️ AWS (ancien backend, commenté pour utilisation future)
// const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.yukpomnang.com';
```

---

### 8. ⚠️ `mobile/test-product-images.js` (À MODIFIER)

**Fichier** : `mobile/test-product-images.js`  
**Ligne** : 16

**Avant (AWS)** :
```javascript
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.yukpomnang.com';
```

**Après (GCP)** :
```javascript
// ✅ GCP Cloud Run (nouveau backend)
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://yukpo-backend-yukpo-project.a.run.app';
// ⚠️ AWS (ancien backend, commenté pour utilisation future)
// const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.yukpomnang.com';
```

---

## 📋 TABLEAU RÉCAPITULATIF

| Fichier | Variable | Ancien (AWS) | Nouveau (GCP) | Statut |
|---------|----------|--------------|---------------|--------|
| `eas.json` | `EXPO_PUBLIC_API_URL` | `https://api.yukpomnang.com` | `https://yukpo-backend-yukpo-project.a.run.app` | ✅ |
| `eas.json` | `EXPO_PUBLIC_WS_URL` | `wss://api.yukpomnang.com` | `wss://yukpo-backend-yukpo-project.a.run.app` | ✅ |
| `app.config.js` | `apiUrl` (fallback) | `https://api.yukpomnang.com` | `https://yukpo-backend-yukpo-project.a.run.app` | ⚠️ |
| `app.config.js` | `wsUrl` (fallback) | `wss://api.yukpomnang.com` | `wss://yukpo-backend-yukpo-project.a.run.app` | ⚠️ |
| `websocket.ts` | `baseUrl` (fallback) | `wss://api.yukpomnang.com` | `wss://yukpo-backend-yukpo-project.a.run.app` | ⚠️ (4x) |
| `useCombinationProgress.ts` | `API_URL` (fallback) | `https://api.yukpomnang.com` | `https://yukpo-backend-yukpo-project.a.run.app` | ⚠️ |
| `weatherConfig.ts` | `BACKEND_URL` (fallback) | `https://api.yukpomnang.com` | `https://yukpo-backend-yukpo-project.a.run.app` | ⚠️ |
| `build-local-with-env.ps1` | `EXPO_PUBLIC_API_URL` (default) | `https://api.yukpomnang.com` | `https://yukpo-backend-yukpo-project.a.run.app` | ⚠️ |
| `build-local-with-env.ps1` | `EXPO_PUBLIC_WS_URL` (default) | `wss://api.yukpomnang.com` | `wss://yukpo-backend-yukpo-project.a.run.app` | ⚠️ |
| `test-create-product-with-images.js` | `API_BASE_URL` (fallback) | `https://api.yukpomnang.com` | `https://yukpo-backend-yukpo-project.a.run.app` | ⚠️ |
| `test-product-images.js` | `API_BASE_URL` (fallback) | `https://api.yukpomnang.com` | `https://yukpo-backend-yukpo-project.a.run.app` | ⚠️ |

---

## 🔧 VARIABLES CDN (OPTIONNEL)

**Variables CDN à ajouter dans `eas.json`** (optionnel, pour utilisation directe du CDN) :

```json
{
  "preview": {
    "env": {
      "EXPO_PUBLIC_CDN_GCP_URL": "http://34.54.117.97",
      "EXPO_PUBLIC_UPLOAD_BASE_URL": "http://34.54.117.97"
    }
  },
  "production": {
    "env": {
      "EXPO_PUBLIC_CDN_GCP_URL": "http://34.54.117.97",
      "EXPO_PUBLIC_UPLOAD_BASE_URL": "http://34.54.117.97"
    }
  }
}
```

**Note** : Ces variables sont déjà configurées dans `mobile/src/config/environment.ts` avec les fallbacks GCP.

---

## ✅ CHECKLIST

### Fichiers à Modifier

- [x] `mobile/eas.json` - ✅ Déjà mis à jour
- [ ] `mobile/app.config.js` - ⚠️ À modifier (lignes 187-188)
- [ ] `mobile/src/config/websocket.ts` - ⚠️ À modifier (lignes 11, 17, 23, 29)
- [ ] `mobile/src/hooks/useCombinationProgress.ts` - ⚠️ À modifier (ligne 5)
- [ ] `mobile/src/config/weatherConfig.ts` - ⚠️ À modifier (ligne 5)
- [ ] `mobile/build-local-with-env.ps1` - ⚠️ À modifier (lignes 33, 36)
- [ ] `mobile/test-create-product-with-images.js` - ⚠️ À modifier (ligne 17)
- [ ] `mobile/test-product-images.js` - ⚠️ À modifier (ligne 16)

### Variables Optionnelles (CDN)

- [ ] `EXPO_PUBLIC_CDN_GCP_URL` dans `eas.json` (optionnel)
- [ ] `EXPO_PUBLIC_UPLOAD_BASE_URL` dans `eas.json` (optionnel)

---

## 🎯 VALEURS GCP

### Backend
- **API Backend** : `https://yukpo-backend-yukpo-project.a.run.app`
- **WebSocket** : `wss://yukpo-backend-yukpo-project.a.run.app`

### CDN
- **Cloud CDN** : `http://34.54.117.97`
- **Upload Base URL** : `http://34.54.117.97`

---

## ⚠️ ANCIENNES VALEURS AWS (COMMENTÉES)

### Backend AWS
- `https://api.yukpomnang.com` (Cloudflare → AWS ECS)
- `https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com` (AWS ALB direct)

### CDN AWS/Wasabi
- `https://cdn.yukpomnang.com` (Cloudflare CDN)
- `https://yukpo-video-prod.s3.eu-central-1.wasabisys.com` (Wasabi Direct)

**Toutes les anciennes valeurs doivent être commentées pour utilisation future.**

---

**Date** : 2026-02-14  
**Statut** : ⚠️ **6 FICHIERS À MODIFIER**



