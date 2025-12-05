# ✅ Cloudflare Actif ! Étapes Suivantes

## 🎉 Félicitations !

**Cloudflare est maintenant actif pour `yukpomnang.com` !**

Les serveurs de noms sont correctement configurés :
- ✅ `isaac.ns.cloudflare.com`
- ✅ `jillian.ns.cloudflare.com`

---

## 📋 Étape 1 : Créer le Sous-domaine CDN

### **Dans Cloudflare Dashboard** :

1. **Cliquez sur "DNS"** dans le menu de gauche

2. **Cliquez sur "Ajouter un enregistrement"** (bouton bleu)

3. **Créez un CNAME pour CDN** :
   ```
   Type : CNAME
   Nom : cdn
   Cible : (laissez vide ou mettez yukpomnang.com)
   Proxy : ✅ Proxied (nuage orange activé - TRÈS IMPORTANT)
   TTL : Auto
   ```

4. **Cliquez sur "Sauvegarder"**

   **Résultat** : Vous aurez `cdn.yukpomnang.com`

---

## 📋 Étape 2 : Configurer Workers (Pour Origin Pull vers Wasabi)

### **Option A : Workers (Recommandé pour vidéos)**

1. **Cliquez sur "Workers"** dans le menu de gauche

2. **Cliquez sur "Create Worker"**

3. **Nom du Worker** : `cdn-video-proxy`

4. **Code du Worker** :

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Origin Wasabi
  const wasabiOrigin = 'https://yukpo-video-prod.s3.eu-central-1.wasabisys.com'
  
  // Construire URL Wasabi (enlever /cdn du path si présent)
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
      'Cache-Control': 'public, max-age=31536000, immutable', // Cache 1 an pour vidéos
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
    },
  })
  
  return newResponse
}
```

5. **Cliquez sur "Deploy"**

6. **Configurez la Route** :
   - **Routes** → **Add route**
   - **Pattern** : `cdn.yukpomnang.com/*`
   - **Worker** : `cdn-video-proxy`
   - **Sauvegardez**

---

### **Option B : Page Rules (Plus Simple, mais moins flexible)**

1. **Cliquez sur "Rules"** → **Page Rules** → **Create Page Rule**

2. **URL Pattern** : `cdn.yukpomnang.com/*`

3. **Settings** :
   - **Cache Level** : Cache Everything
   - **Edge Cache TTL** : 1 month
   - **Browser Cache TTL** : 1 month
   - **Origin URL** : `https://yukpo-video-prod.s3.eu-central-1.wasabisys.com`

4. **Sauvegardez**

---

## 📋 Étape 3 : Configurer Cache

1. **Cliquez sur "Caching"** → **Configuration**

2. **Caching Level** : Standard

3. **Browser Cache TTL** : 1 month

4. **Always Online** : ✅ Activé

5. **Sauvegardez**

---

## 📋 Étape 4 : Configurer SSL/TLS

1. **Cliquez sur "SSL/TLS"** → **Overview**

2. **Encryption mode** : Full (ou Full (strict) si certificat Wasabi)

3. ✅ **Always Use HTTPS** : Activé

4. **Sauvegardez**

---

## 📋 Étape 5 : Mettre à Jour mobile/.env

### **Créer ou Modifier** : `mobile/.env`

```env
# ============================================
# CONFIGURATION CLOUDFLARE CDN
# ============================================
#
# Domaine : yukpomnang.com
# Sous-domaine CDN : cdn.yukpomnang.com
#
# ============================================

# Cloudflare CDN (votre domaine)
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.yukpomnang.com

# Wasabi Direct (Fallback si Cloudflare indisponible)
EXPO_PUBLIC_WASABI_DIRECT_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
```

---

## ✅ Vérification

### **Test 1 : Vérifier DNS**

```bash
# Vérifier que cdn.yukpomnang.com existe
nslookup cdn.yukpomnang.com
# Doit retourner une IP Cloudflare
```

### **Test 2 : Tester une vidéo**

```bash
# Tester une vidéo via Cloudflare
curl -I https://cdn.yukpomnang.com/videos/test.mp4

# Headers attendus :
# - CF-Cache-Status: HIT ou MISS
# - Server: cloudflare
```

---

## 🎯 Checklist

- [x] Domaine `yukpomnang.com` acheté ✅
- [x] Domaine ajouté dans Cloudflare ✅
- [x] Serveurs de noms modifiés dans Namecheap ✅
- [x] Cloudflare actif ✅
- [ ] Créer sous-domaine `cdn` dans Cloudflare
- [ ] Configurer Workers ou Page Rules
- [ ] Configurer Cache
- [ ] Configurer SSL/TLS
- [ ] Mettre à jour `mobile/.env`
- [ ] Tester CDN

---

## 🚀 Prochaine Action Immédiate

**Maintenant** : Créer le sous-domaine `cdn.yukpomnang.com` dans Cloudflare DNS.

1. **DNS** → **Ajouter un enregistrement**
2. **Type** : CNAME
3. **Nom** : `cdn`
4. **Proxy** : ✅ Activé (nuage orange)
5. **Sauvegarder**

---

*Date : 2025-12-03*  
*Cloudflare actif - Étapes suivantes*

