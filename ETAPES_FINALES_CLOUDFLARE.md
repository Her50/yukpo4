# 🚀 Étapes Finales : Configuration Cloudflare CDN

## ✅ Ce Qui Est Déjà Fait

- [x] Domaine `yukpomnang.com` acheté
- [x] Domaine ajouté dans Cloudflare
- [x] Serveurs de noms configurés (`isaac.ns.cloudflare.com`, `jillian.ns.cloudflare.com`)
- [x] Cloudflare actif
- [x] Sous-domaine `cdn.yukpomnang.com` créé (CNAME)

---

## 📋 Prochaines Étapes

### **Étape 1 : Configurer Workers ou Page Rules**

Pour que `cdn.yukpomnang.com` lise depuis Wasabi, vous devez configurer un Worker ou une Page Rule.

#### **Option A : Workers (Recommandé)**

1. **Dans Cloudflare Dashboard** → **Workers** → **Create Worker**

2. **Nom** : `cdn-video-proxy`

3. **Code** :

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Origin Wasabi
  const wasabiOrigin = 'https://yukpo-video-prod.s3.eu-central-1.wasabisys.com'
  
  // Construire URL Wasabi
  let path = url.pathname
  if (path.startsWith('/cdn/')) {
    path = path.replace('/cdn', '')
  }
  
  const wasabiUrl = `${wasabiOrigin}${path}${url.search}`
  
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
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
    },
  })
  
  return newResponse
}
```

4. **Deploy**

5. **Routes** → **Add route**
   - **Pattern** : `cdn.yukpomnang.com/*`
   - **Worker** : `cdn-video-proxy`
   - **Sauvegardez**

---

#### **Option B : Page Rules (Plus Simple)**

1. **Rules** → **Page Rules** → **Create Page Rule**

2. **URL Pattern** : `cdn.yukpomnang.com/*`

3. **Settings** :
   - **Cache Level** : Cache Everything
   - **Edge Cache TTL** : 1 month
   - **Browser Cache TTL** : 1 month
   - **Origin URL** : `https://yukpo-video-prod.s3.eu-central-1.wasabisys.com`

4. **Sauvegardez**

---

### **Étape 2 : Mettre à Jour mobile/.env**

**Créer ou Modifier** : `mobile/.env`

```env
# Cloudflare CDN
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.yukpomnang.com

# Wasabi Direct (Fallback)
EXPO_PUBLIC_WASABI_DIRECT_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
```

---

### **Étape 3 : Tester**

```bash
# Tester que cdn.yukpomnang.com fonctionne
curl -I https://cdn.yukpomnang.com/videos/test.mp4

# Headers attendus :
# - CF-Cache-Status: HIT ou MISS
# - Server: cloudflare
```

---

## ✅ Checklist Finale

- [x] CDN créé (`cdn.yukpomnang.com`)
- [ ] Workers ou Page Rules configurés
- [ ] `mobile/.env` mis à jour
- [ ] CDN testé et fonctionnel

---

*Date : 2025-12-03*  
*Étapes finales Cloudflare*

