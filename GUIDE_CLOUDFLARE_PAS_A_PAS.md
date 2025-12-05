# 🚀 Configuration Cloudflare - Guide Pas à Pas

## 📋 Étape 1 : Ajouter votre Domaine

### **Sur la page actuelle (ajout de domaine)** :

1. **Dans le champ "Saisissez un domaine existant"** :
   - Entrez votre domaine (ex: `yukpo.app` ou `yukpomnang.com`)
   - ⚠️ **Important** : Utilisez votre domaine principal, pas un sous-domaine

2. **Sélectionnez** : "Analyse rapide des enregistrements DNS" (Recommandé)
   - Cloudflare analysera automatiquement vos DNS existants

3. **Cliquez sur "Ajouter un site"** ou le bouton de validation

---

## 📋 Étape 2 : Configuration DNS

### **Après l'ajout du domaine** :

1. **Cloudflare va analyser vos DNS existants**
   - Attendez quelques secondes
   - Cloudflare va importer vos enregistrements DNS

2. **Vérifiez les enregistrements importés** :
   - Vous verrez une liste de vos DNS (A, CNAME, MX, etc.)
   - ✅ **Important** : Vérifiez que tous vos DNS sont présents

3. **Modifiez les serveurs de noms (Nameservers)** :
   - Cloudflare vous donnera 2 serveurs de noms (ex: `ns1.cloudflare.com`, `ns2.cloudflare.com`)
   - ⚠️ **Action requise** : Allez dans votre registrar (où vous avez acheté le domaine)
   - Remplacez les serveurs de noms par ceux de Cloudflare
   - ⏱️ **Délai** : 24-48h pour propagation (souvent plus rapide)

---

## 📋 Étape 3 : Créer le Sous-domaine CDN

### **Une fois les DNS configurés** :

1. **Allez dans** : **DNS** → **Enregistrements**

2. **Cliquez sur "Ajouter un enregistrement"**

3. **Créez un CNAME pour CDN** :
   ```
   Type : CNAME
   Nom : cdn
   Cible : (laissez vide ou mettez votre domaine principal)
   Proxy : ✅ Proxied (nuage orange activé)
   TTL : Auto
   ```

4. **Sauvegardez**

   **Résultat** : Vous aurez `cdn.votredomaine.com` (ex: `cdn.yukpo.app`)

---

## 📋 Étape 4 : Configurer Workers (Pour Origin Pull vers Wasabi)

### **Option A : Workers (Recommandé pour vidéos)**

1. **Allez dans** : **Workers** → **Create Worker**

2. **Nom du Worker** : `cdn-video-proxy`

3. **Code du Worker** :

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

4. **Cliquez sur "Deploy"**

5. **Configurez la Route** :
   - **Routes** → **Add route**
   - **Pattern** : `cdn.votredomaine.com/*` (ex: `cdn.yukpo.app/*`)
   - **Worker** : `cdn-video-proxy`
   - **Sauvegardez**

---

### **Option B : Page Rules (Plus Simple, mais moins flexible)**

1. **Allez dans** : **Rules** → **Page Rules** → **Create Page Rule**

2. **URL Pattern** : `cdn.votredomaine.com/*`

3. **Settings** :
   - **Cache Level** : Cache Everything
   - **Edge Cache TTL** : 1 month
   - **Browser Cache TTL** : 1 month
   - **Origin URL** : `https://yukpo-video-prod.s3.eu-central-1.wasabisys.com`

4. **Sauvegardez**

---

## 📋 Étape 5 : Configurer Cache

1. **Allez dans** : **Caching** → **Configuration**

2. **Caching Level** : Standard

3. **Browser Cache TTL** : 1 month

4. **Always Online** : ✅ Activé

5. **Sauvegardez**

---

## 📋 Étape 6 : Configurer SSL/TLS

1. **Allez dans** : **SSL/TLS** → **Overview**

2. **Encryption mode** : Full (ou Full (strict) si certificat Wasabi)

3. ✅ **Always Use HTTPS** : Activé

4. **Sauvegardez**

---

## ✅ Étape 7 : Obtenir les Valeurs pour Variables d'Environnement

### **Après configuration complète** :

1. **URL Cloudflare CDN** :
   ```
   https://cdn.votredomaine.com
   ```
   Exemple : `https://cdn.yukpo.app`

2. **URL Wasabi Direct** (déjà connue) :
   ```
   https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
   ```

---

## 📝 Configuration dans mobile/.env

### **Ouvrez** : `mobile/.env`

### **Ajoutez/Modifiez** :

```env
# Cloudflare CDN (remplacez par votre domaine)
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.votredomaine.com

# Wasabi Direct (fallback)
EXPO_PUBLIC_WASABI_DIRECT_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
```

### **Exemple concret** :

```env
# Si votre domaine est yukpo.app
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.yukpo.app

# Wasabi Direct (fallback)
EXPO_PUBLIC_WASABI_DIRECT_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
```

---

## ✅ Vérification

### **Test 1 : Vérifier DNS**

```bash
# Vérifier que cdn.votredomaine.com existe
nslookup cdn.votredomaine.com
# Doit retourner une IP Cloudflare
```

### **Test 2 : Tester une vidéo**

```bash
# Tester une vidéo via Cloudflare
curl -I https://cdn.votredomaine.com/videos/test.mp4

# Headers attendus :
# - CF-Cache-Status: HIT ou MISS
# - Server: cloudflare
```

### **Test 3 : Vérifier Cache**

1. Première requête : `CF-Cache-Status: MISS` (Cloudflare lit depuis Wasabi)
2. Deuxième requête : `CF-Cache-Status: HIT` (Cloudflare sert depuis cache)

---

## 🎯 Résumé des Valeurs à Récupérer

1. ✅ **Votre domaine Cloudflare** : `votredomaine.com`
2. ✅ **Sous-domaine CDN créé** : `cdn.votredomaine.com`
3. ✅ **URL Cloudflare CDN** : `https://cdn.votredomaine.com`
4. ✅ **URL Wasabi** : `https://yukpo-video-prod.s3.eu-central-1.wasabisys.com` (déjà connue)

---

*Date : 2025-12-03*  
*Guide pas à pas Cloudflare*

