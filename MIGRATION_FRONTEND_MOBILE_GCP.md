# ✅ Migration Frontend et Mobile vers GCP Cloud Run

**Date** : 2026-02-14  
**Statut** : ✅ **CONFIGURATION TERMINÉE**

---

## 🎯 RÉSUMÉ

**Les configurations frontend et mobile ont été mises à jour pour pointer vers le nouveau backend GCP Cloud Run, avec les anciennes références AWS commentées pour utilisation future.**

---

## ✅ CONFIGURATIONS MISES À JOUR

### 1. ✅ Frontend (React/Vite)

#### Fichier : `frontend/src/config/api.config.ts`

**Changements** :
- ✅ Backend GCP : `https://yukpo-backend-yukpo-project.a.run.app`
- ⚠️ AWS (commenté) : `https://api.yukpomnang.com`

**Code** :
```typescript
// ✅ GCP Cloud Run (nouveau backend)
const GCP_BACKEND_URL = 'https://yukpo-backend-yukpo-project.a.run.app';
// ⚠️ AWS (ancien backend, commenté pour utilisation future)
// const AWS_BACKEND_URL = 'https://api.yukpomnang.com';

export const API_BASE_URL = VITE_API_URL || ((isNetlify || isVercel) ? '' : GCP_BACKEND_URL);
export const WS_BASE_URL = VITE_WS_URL || `wss://yukpo-backend-yukpo-project.a.run.app`;
```

#### Fichier : `frontend/netlify.toml`

**Changements** :
- ✅ Tous les redirects pointent vers `https://yukpo-backend-yukpo-project.a.run.app`
- ⚠️ Anciennes URLs AWS commentées

**Exemple** :
```toml
[[redirects]]
  from = "/api/*"
  to = "https://yukpo-backend-yukpo-project.a.run.app/api/:splat"
  # to = "https://api.yukpomnang.com/api/:splat"  # ⚠️ AWS (ancien)
```

#### Fichier : `frontend/vercel.json`

**Changements** :
- ✅ Tous les rewrites pointent vers `https://yukpo-backend-yukpo-project.a.run.app`
- ⚠️ Commentaires AWS dans `_comment` et `_comment_aws`

---

### 2. ✅ Mobile (React Native/Expo)

#### Fichier : `mobile/src/config/api.config.ts`

**Changements** :
- ✅ Backend GCP : `https://yukpo-backend-yukpo-project.a.run.app`
- ⚠️ AWS (commenté) : `https://api.yukpomnang.com`

**Code** :
```typescript
// ✅ GCP Cloud Run (nouveau backend)
const GCP_BACKEND_URL = 'https://yukpo-backend-yukpo-project.a.run.app';
// ⚠️ AWS (ancien backend, commenté pour utilisation future)
// const AWS_BACKEND_URL = 'https://api.yukpomnang.com';

export const API_BASE_URL = EXPO_API_URL || GCP_BACKEND_URL;
export const WS_BASE_URL = EXPO_WS_URL || `wss://yukpo-backend-yukpo-project.a.run.app`;
```

#### Fichier : `mobile/eas.json`

**Changements** :
- ✅ Builds `preview` et `production` utilisent GCP Cloud Run
- ⚠️ Anciennes URLs AWS commentées

**Code** :
```json
{
  "preview": {
    "env": {
      // ✅ GCP Cloud Run (nouveau backend)
      "EXPO_PUBLIC_API_URL": "https://yukpo-backend-yukpo-project.a.run.app",
      "EXPO_PUBLIC_WS_URL": "wss://yukpo-backend-yukpo-project.a.run.app",
      // ⚠️ AWS (ancien backend, commenté pour utilisation future)
      // "EXPO_PUBLIC_API_URL": "https://api.yukpomnang.com",
      // "EXPO_PUBLIC_WS_URL": "wss://api.yukpomnang.com"
    }
  }
}
```

#### Fichier : `mobile/src/config/environment.ts`

**Changements** :
- ✅ `API_URL` : `https://yukpo-backend-yukpo-project.a.run.app`
- ✅ `UPLOAD_BASE_URL` : `http://34.54.117.97` (Cloud CDN GCP)
- ✅ `CDN_GCP_URL` : `http://34.54.117.97`
- ⚠️ Anciennes URLs AWS/Wasabi commentées

**Code** :
```typescript
API_URL: process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'https://yukpo-backend-yukpo-project.a.run.app',
// API_URL: process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.yukpomnang.com',  // ⚠️ AWS (ancien)

UPLOAD_BASE_URL: process.env.EXPO_PUBLIC_UPLOAD_BASE_URL || 'http://34.54.117.97',  // Cloud CDN GCP
// UPLOAD_BASE_URL: process.env.EXPO_PUBLIC_UPLOAD_BASE_URL || 'https://cdn.yukpomnang.com',  // ⚠️ AWS CDN (ancien)

CDN_GCP_URL: process.env.EXPO_PUBLIC_CDN_GCP_URL || 'http://34.54.117.97',
// CDN_CLOUDFLARE_URL: process.env.EXPO_PUBLIC_CDN_CLOUDFLARE_URL || 'https://cdn.yukpomnang.com',  // ⚠️ AWS (ancien)
// WASABI_DIRECT_URL: process.env.EXPO_PUBLIC_WASABI_DIRECT_URL || 'https://yukpo-video-prod.s3.eu-central-1.wasabisys.com',  // ⚠️ AWS (ancien)
```

---

## 📊 RÉSUMÉ DES CHANGEMENTS

### URLs Backend

| Environnement | Ancien (AWS) | Nouveau (GCP) | Statut |
|---------------|--------------|---------------|--------|
| **API Backend** | `https://api.yukpomnang.com` | `https://yukpo-backend-yukpo-project.a.run.app` | ✅ |
| **WebSocket** | `wss://api.yukpomnang.com` | `wss://yukpo-backend-yukpo-project.a.run.app` | ✅ |

### URLs CDN

| Environnement | Ancien (AWS/Wasabi) | Nouveau (GCP) | Statut |
|---------------|---------------------|---------------|--------|
| **CDN** | `https://cdn.yukpomnang.com` (Cloudflare) | `http://34.54.117.97` (Cloud CDN GCP) | ✅ |
| **Storage Direct** | `https://yukpo-video-prod.s3.eu-central-1.wasabisys.com` (Wasabi) | `gs://yukpo-project-yukpo-backend-media` (Cloud Storage) | ✅ |

---

## 📋 FICHIERS MODIFIÉS

### Frontend
- ✅ `frontend/src/config/api.config.ts`
- ✅ `frontend/netlify.toml`
- ✅ `frontend/vercel.json`

### Mobile
- ✅ `mobile/src/config/api.config.ts`
- ✅ `mobile/eas.json`
- ✅ `mobile/src/config/environment.ts`

---

## ⚠️ ANCIENNES RÉFÉRENCES AWS

**Toutes les anciennes références AWS sont commentées** et peuvent être réactivées si nécessaire :

### Backend AWS
- `https://api.yukpomnang.com` (Cloudflare → AWS ECS)
- `https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com` (AWS ALB direct)

### CDN AWS/Wasabi
- `https://cdn.yukpomnang.com` (Cloudflare CDN)
- `https://yukpo-video-prod.s3.eu-central-1.wasabisys.com` (Wasabi Direct)

**Pour réactiver AWS** : Décommenter les lignes correspondantes dans les fichiers de configuration.

---

## 🚀 PROCHAINES ÉTAPES

### 1. Déployer le Backend GCP

Le backend doit être déployé sur Cloud Run pour que les URLs fonctionnent :
```bash
git push origin main  # Déclenche le workflow GitHub Actions
```

### 2. Vérifier les URLs

Après déploiement, vérifier :
- ✅ `https://yukpo-backend-yukpo-project.a.run.app/healthz`
- ✅ `https://yukpo-backend-yukpo-project.a.run.app/api/services`

### 3. Tester Frontend

- ✅ Tester l'authentification
- ✅ Tester les appels API
- ✅ Vérifier les WebSockets

### 4. Tester Mobile

- ✅ Tester l'authentification
- ✅ Tester les appels API
- ✅ Vérifier les uploads de médias (CDN GCP)

---

## ✅ CHECKLIST

### Configuration Frontend
- [x] `api.config.ts` mis à jour vers GCP
- [x] `netlify.toml` mis à jour vers GCP
- [x] `vercel.json` mis à jour vers GCP
- [x] Anciennes références AWS commentées

### Configuration Mobile
- [x] `api.config.ts` mis à jour vers GCP
- [x] `eas.json` mis à jour vers GCP
- [x] `environment.ts` mis à jour vers GCP
- [x] URLs CDN mises à jour vers Cloud CDN GCP
- [x] Anciennes références AWS commentées

### Déploiement
- [ ] Backend déployé sur Cloud Run
- [ ] Frontend testé avec nouveau backend
- [ ] Mobile testé avec nouveau backend
- [ ] Uploads de médias testés (CDN GCP)

---

## 🎯 RÉSULTAT

**✅ Configuration Frontend et Mobile terminée !**

- ✅ **Frontend** : Configuré pour GCP Cloud Run
- ✅ **Mobile** : Configuré pour GCP Cloud Run
- ✅ **CDN** : Configuré pour Cloud CDN GCP
- ✅ **Anciennes références AWS** : Commentées pour utilisation future

**Le système est prêt pour utiliser le nouveau backend GCP !**

---

**Date** : 2026-02-14  
**Statut** : ✅ **CONFIGURATION TERMINÉE**

