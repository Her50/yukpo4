# ✅ Configuration Restante - Checklist Complète

## 🎯 Ce qui reste à configurer

Pendant que vous attendez la réponse du support Wasabi, voici tout ce qu'il faut vérifier/configurer :

## 📋 Checklist de Configuration

### ✅ 1. Variables d'environnement mobile (`mobile/.env`)

**Créez le fichier** `mobile/.env` avec ces variables :

```env
# ============================================
# CDN Configuration
# ============================================
# URL Cloudflare CDN (via Worker)
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.yukpomnang.com

# URL Wasabi Direct (fallback si Cloudflare indisponible)
EXPO_PUBLIC_WASABI_DIRECT_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com

# ============================================
# Backend API
# ============================================
EXPO_PUBLIC_API_BASE_URL=https://yukpomnang.onrender.com
EXPO_PUBLIC_ENVIRONMENT=production

# ============================================
# Autres (si nécessaire)
# ============================================
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ
EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY=AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ
```

**Action** : Créez ce fichier dans `mobile/.env`

### ✅ 2. Cloudflare Worker (Vérification)

**Vérifiez que** :
- [ ] Worker `cdn-video-proxy` est **déployé** et **actif**
- [ ] Code du Worker est correct (voir ci-dessous)
- [ ] Route `cdn.yukpomnang.com/*` est configurée

**Code Worker** (vérifiez qu'il est bien ceci) :

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const wasabiOrigin = 'https://yukpo-video-prod.s3.eu-central-1.wasabisys.com'
  const wasabiUrl = `${wasabiOrigin}${url.pathname}${url.search}`
  
  const response = await fetch(wasabiUrl, {
    method: request.method,
    headers: {
      ...request.headers,
      'Host': 'yukpo-video-prod.s3.eu-central-1.wasabisys.com',
    },
  })
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...response.headers,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
```

### ✅ 3. Route Cloudflare

**Vérifiez** :
- [ ] Dans Cloudflare Dashboard → **Workers & Pages** → **Itinéraires des travailleurs**
- [ ] Route existe : `cdn.yukpomnang.com/*`
- [ ] Worker associé : `cdn-video-proxy`

**Si la route n'existe pas** :
1. Cliquez sur **"Ajouter un itinéraire"**
2. Route : `cdn.yukpomnang.com/*`
3. Worker : `cdn-video-proxy`
4. Sauvegardez

### ✅ 4. DNS Cloudflare

**Vérifiez** :
- [ ] Dans Cloudflare Dashboard → **DNS**
- [ ] Enregistrement CNAME existe pour `cdn.yukpomnang.com`
- [ ] Mode Proxy activé (nuage orange)

**Si l'enregistrement n'existe pas** :
1. Cliquez sur **"Add record"**
2. Type : **CNAME**
3. Name : `cdn`
4. Target : `cdn.yukpomnang.com.workers.dev` (ou votre Worker URL)
5. Proxy : **Proxied** (orange)
6. Sauvegardez

### ✅ 5. Wasabi (En attente du support)

**Une fois que Wasabi Support vous confirme** :
- [ ] Accès public activé
- [ ] Test direct Wasabi fonctionne (URL complète dans navigateur)
- [ ] Bucket Policy est correctement configurée

**Test direct** :
```
https://yukpo-video-prod.s3.eu-central-1.wasabisys.com/uploads/videos/un-fichier.mp4
```

## 🔧 Configuration dans l'Application

### ✅ Fichiers déjà configurés (à vérifier)

1. **`mobile/src/config/environment.ts`** ✅
   - Variables CDN déjà définies
   - Utilise `process.env.EXPO_PUBLIC_CDN_CLOUDFLARE_URL`
   - Fallback : `'https://cdn.yukpo.app'` (à changer si nécessaire)

2. **`mobile/src/services/cdnService.ts`** ✅
   - Service CDN déjà créé
   - Gère fallback Cloudflare → Wasabi → Backend

3. **`mobile/src/services/videoCacheService.ts`** ✅
   - Cache local vidéo déjà implémenté

4. **`mobile/src/services/mediaService.ts`** ✅
   - Service média unifié déjà créé

### ⚠️ Fichier manquant : `.env`

**Créez** : `mobile/.env` avec les variables ci-dessus.

## 📝 Action Immédiate

### Étape 1 : Créer `mobile/.env`

Créez le fichier `mobile/.env` avec ce contenu :

```env
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.yukpomnang.com
EXPO_PUBLIC_WASABI_DIRECT_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
EXPO_PUBLIC_API_BASE_URL=https://yukpomnang.onrender.com
EXPO_PUBLIC_ENVIRONMENT=production
```

### Étape 2 : Vérifier Cloudflare

1. Worker déployé ✅
2. Route configurée ✅
3. DNS configuré ✅

### Étape 3 : Attendre Wasabi Support

Une fois l'accès public activé par Wasabi, tout devrait fonctionner automatiquement.

## 🎯 Résumé

**Configuration application** :
- ✅ Code déjà prêt
- ⚠️ Créer `.env` avec les variables CDN

**Configuration Cloudflare** :
- ⚠️ Vérifier Worker, Route, DNS

**Configuration Wasabi** :
- ⚠️ En attente du support (accès public)

## 📋 Checklist Finale

- [ ] Créer `mobile/.env` avec variables CDN
- [ ] Vérifier Worker Cloudflare déployé
- [ ] Vérifier route `cdn.yukpomnang.com/*`
- [ ] Vérifier DNS `cdn.yukpomnang.com`
- [ ] Attendre réponse Wasabi Support
- [ ] Tester après activation accès public

---

**Action immédiate** : Créez le fichier `mobile/.env` avec les variables ci-dessus !



