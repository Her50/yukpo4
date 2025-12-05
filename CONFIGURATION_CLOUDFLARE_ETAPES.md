# 🚀 Configuration Cloudflare CDN - Étapes

## 📋 Prérequis

1. ✅ Compte Cloudflare (gratuit ou payant)
2. ✅ Domaine configuré dans Cloudflare (ex: `yukpo.app`)
3. ✅ Wasabi bucket configuré : `yukpo-video-prod`

---

## 🔧 Configuration Cloudflare Dashboard

### **Étape 1 : Créer un Sous-domaine CDN**

1. Allez dans **Cloudflare Dashboard** → Votre domaine
2. **DNS** → **Ajouter un enregistrement**
3. Créez :
   ```
   Type : CNAME
   Name : cdn
   Target : (laissez vide ou utilisez votre domaine principal)
   Proxy : ✅ Proxied (orange cloud)
   ```
4. Sauvegardez

**Résultat** : `cdn.yukpo.app` (ou votre domaine)

---

### **Étape 2 : Configurer Workers ou Page Rules**

#### **Option A : Workers (Recommandé)**

1. **Workers** → **Create Worker**
2. Nom : `cdn-video-proxy`
3. Code :

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Origin Wasabi
  const wasabiOrigin = 'https://yukpo-video-prod.s3.eu-central-1.wasabisys.com'
  
  // Construire URL Wasabi
  const wasabiUrl = `${wasabiOrigin}${url.pathname}${url.search}`
  
  // Faire requête vers Wasabi
  const response = await fetch(wasabiUrl, {
    method: request.method,
    headers: {
      ...request.headers,
      'Host': 'yukpo-video-prod.s3.eu-central-1.wasabisys.com',
    },
  })
  
  // Créer nouvelle réponse avec headers de cache
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...response.headers,
      'Cache-Control': 'public, max-age=31536000, immutable', // Cache 1 an pour vidéos
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    },
  })
  
  return newResponse
}
```

4. **Deploy**
5. **Routes** → **Add route**
   - Pattern : `cdn.yukpo.app/*`
   - Worker : `cdn-video-proxy`

---

#### **Option B : Page Rules (Plus Simple)**

1. **Rules** → **Page Rules** → **Create Page Rule**
2. URL Pattern : `cdn.yukpo.app/*`
3. Settings :
   - **Cache Level** : Cache Everything
   - **Edge Cache TTL** : 1 month
   - **Browser Cache TTL** : 1 month
   - **Origin** : `https://yukpo-video-prod.s3.eu-central-1.wasabisys.com`

---

### **Étape 3 : Configurer Cache**

1. **Caching** → **Configuration**
2. **Caching Level** : Standard
3. **Browser Cache TTL** : 1 month
4. **Always Online** : ✅ Activé

---

### **Étape 4 : Configurer SSL/TLS**

1. **SSL/TLS** → **Overview**
2. **Encryption mode** : Full (strict si certificat Wasabi)
3. ✅ **Always Use HTTPS**

---

## ✅ Vérification

### **Test 1 : Vérifier DNS**

```bash
# Vérifier que cdn.yukpo.app pointe vers Cloudflare
nslookup cdn.yukpo.app
# Doit retourner une IP Cloudflare
```

### **Test 2 : Vérifier Origin Pull**

```bash
# Tester une vidéo via Cloudflare
curl -I https://cdn.yukpo.app/videos/test.mp4

# Headers attendus :
# - CF-Cache-Status: HIT ou MISS
# - Server: cloudflare
```

### **Test 3 : Vérifier Cache**

1. Première requête : `CF-Cache-Status: MISS` (Cloudflare lit depuis Wasabi)
2. Deuxième requête : `CF-Cache-Status: HIT` (Cloudflare sert depuis cache)

---

## 🔄 Workflow Complet

```
1. Vidéo créée → Upload Wasabi
   └─> URL Wasabi : https://yukpo-video-prod.s3.eu-central-1.wasabisys.com/video123.mp4

2. Application utilise URL Cloudflare
   └─> URL Cloudflare : https://cdn.yukpo.app/video123.mp4

3. Utilisateur demande vidéo
   └─> Requête vers Cloudflare
       └─> Cloudflare vérifie cache (PoP local)
           ├─> Cache HIT → Sert directement (ultra rapide)
           └─> Cache MISS → Cloudflare lit depuis Wasabi
               └─> Cloudflare cache dans PoP
                   └─> Cloudflare envoie à utilisateur
```

---

## 📊 Résultat

**Avant (Wasabi seul)** :
- ❌ Latence élevée pour utilisateurs éloignés
- ❌ Pas de cache
- ❌ Performance variable

**Après (Wasabi + Cloudflare)** :
- ✅ Latence minimale (PoP proche)
- ✅ Cache intelligent
- ✅ Performance optimale partout

---

## ⚙️ Configuration Mobile (.env)

```env
# Cloudflare CDN (configurez votre domaine)
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.yukpo.app

# Wasabi Direct (fallback)
EXPO_PUBLIC_WASABI_DIRECT_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
```

---

*Date : 2025-12-03*  
*Configuration Cloudflare CDN*

