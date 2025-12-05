# ✅ Étapes Suivantes : Configuration Cloudflare avec yukpomnang.com

## 🎉 Félicitations ! Votre domaine est acheté

**Domaine** : `yukpomnang.com`  
**Registrar** : Namecheap  
**Statut** : Activation en cours (24-48h, souvent plus rapide)

---

## 📋 Étape 1 : Ajouter le Domaine dans Cloudflare

### **Dans Cloudflare Dashboard (où vous êtes actuellement)** :

1. **Dans le champ "Saisissez un domaine existant"** :
   - Entrez : `yukpomnang.com`

2. **Sélectionnez** : "Analyse rapide des enregistrements DNS" (Recommandé)

3. **Cliquez sur "Ajouter un site"** ou le bouton de validation

4. **Cloudflare va analyser vos DNS** :
   - Attendez quelques secondes
   - Cloudflare va importer vos enregistrements DNS (s'il y en a)

---

## 📋 Étape 2 : Modifier les Serveurs de Noms (Nameservers)

### **Cloudflare va vous donner 2 serveurs de noms** :

Exemple :
```
ns1.cloudflare.com
ns2.cloudflare.com
```

### **Action requise dans Namecheap** :

1. **Allez dans** : https://www.namecheap.com
2. **Connectez-vous** à votre compte
3. **Domain List** → Cliquez sur `yukpomnang.com`
4. **Advanced DNS** → **Nameservers**
5. **Sélectionnez** : "Custom nameservers"
6. **Entrez les 2 serveurs Cloudflare** :
   - `ns1.cloudflare.com`
   - `ns2.cloudflare.com`
7. **Sauvegardez**

**⏱️ Délai** : 24-48h pour propagation (souvent 1-2h)

**✅ Vérification** : Cloudflare Dashboard vous dira quand c'est actif

---

## 📋 Étape 3 : Créer le Sous-domaine CDN

### **Une fois les DNS propagés (Cloudflare actif)** :

1. **Dans Cloudflare Dashboard** → **DNS** → **Enregistrements**

2. **Cliquez sur "Ajouter un enregistrement"**

3. **Créez un CNAME pour CDN** :
   ```
   Type : CNAME
   Nom : cdn
   Cible : (laissez vide ou mettez yukpomnang.com)
   Proxy : ✅ Proxied (nuage orange activé - IMPORTANT)
   TTL : Auto
   ```

4. **Sauvegardez**

   **Résultat** : Vous aurez `cdn.yukpomnang.com`

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
   - **Pattern** : `cdn.yukpomnang.com/*`
   - **Worker** : `cdn-video-proxy`
   - **Sauvegardez**

---

### **Option B : Page Rules (Plus Simple, mais moins flexible)**

1. **Allez dans** : **Rules** → **Page Rules** → **Create Page Rule**

2. **URL Pattern** : `cdn.yukpomnang.com/*`

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

## 📋 Étape 7 : Configurer Variables d'Environnement

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

### **Test 3 : Vérifier Cache**

1. Première requête : `CF-Cache-Status: MISS` (Cloudflare lit depuis Wasabi)
2. Deuxième requête : `CF-Cache-Status: HIT` (Cloudflare sert depuis cache)

---

## 🎯 Résumé des Valeurs

| Variable | Valeur |
|----------|--------|
| **Domaine** | `yukpomnang.com` |
| **Sous-domaine CDN** | `cdn.yukpomnang.com` |
| **URL Cloudflare CDN** | `https://cdn.yukpomnang.com` |
| **URL Wasabi** | `https://yukpo-video-prod.s3.eu-central-1.wasabisys.com` |

---

## 📝 Checklist

- [ ] Domaine `yukpomnang.com` acheté ✅
- [ ] Domaine ajouté dans Cloudflare
- [ ] Serveurs de noms modifiés dans Namecheap
- [ ] Attendre propagation DNS (24-48h)
- [ ] Créer sous-domaine `cdn` dans Cloudflare
- [ ] Configurer Workers ou Page Rules
- [ ] Configurer Cache
- [ ] Configurer SSL/TLS
- [ ] Mettre à jour `mobile/.env`
- [ ] Tester CDN

---

## 🚀 Prochaines Actions Immédiates

1. **Maintenant** : Ajouter `yukpomnang.com` dans Cloudflare Dashboard
2. **Ensuite** : Modifier serveurs de noms dans Namecheap
3. **Attendre** : Propagation DNS (vérifier dans Cloudflare)
4. **Puis** : Créer sous-domaine `cdn` et configurer Workers

---

*Date : 2025-12-03*  
*Configuration Cloudflare pour yukpomnang.com*

