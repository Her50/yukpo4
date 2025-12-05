# 🔍 Debug Complet : Pourquoi ça ne fonctionne pas

## ⚠️ Problèmes identifiés

### 1. **Bucket Policy : Format incorrect**

Dans votre Bucket Policy, je vois :
```json
"Principal": { "AWS": "*" }
```

**Pour Wasabi, cela devrait être** :
```json
"Principal": "*"
```

### 2. **Public Access Override toujours bloqué**

L'alerte jaune dans "Properties" → "Public Access Override" dit toujours que l'accès public est désactivé.

## ✅ Solutions étape par étape

### Étape 1 : Corriger la Bucket Policy

1. **Allez dans "Permissions"** → **"Bucket Policy"** → **"Edit"**
2. **Remplacez tout le code** par ceci :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::yukpo-video-prod/*"
    }
  ]
}
```

**Important** : `"Principal": "*"` (pas `{ "AWS": "*" }`)

3. **Sauvegardez**

### Étape 2 : Tester Wasabi directement

**Testez si Wasabi est accessible directement** (sans Cloudflare) :

1. **Trouvez un fichier vidéo** dans votre bucket Wasabi
   - Allez dans Wasabi Console → Bucket `yukpo-video-prod`
   - Regardez dans le dossier `uploads/videos/`
   - Notez le chemin complet d'un fichier (ex: `uploads/videos/test123.mp4`)

2. **Testez cette URL dans votre navigateur** :
   ```
   https://yukpo-video-prod.s3.eu-central-1.wasabisys.com/uploads/videos/test123.mp4
   ```
   (Remplacez `test123.mp4` par un vrai nom de fichier)

**Résultats possibles :**
- ✅ **Vidéo s'affiche** = Wasabi est public ✅
- ❌ **AccessDenied** = Wasabi n'est pas public, problème avec Bucket Policy
- ❌ **404 Not Found** = Fichier n'existe pas, mais accès fonctionne (c'est bon !)

### Étape 3 : Vérifier le Worker Cloudflare

1. **Allez dans Cloudflare Dashboard**
2. **Workers & Pages** → **cdn-video-proxy**
3. **Vérifiez que le code est bien** :

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

4. **Vérifiez que le Worker est déployé** (bouton "Deploy" visible)

### Étape 4 : Vérifier la route Cloudflare

1. **Dans Cloudflare Dashboard** → Votre domaine `yukpomnang.com`
2. **Workers & Pages** → **Itinéraires des travailleurs** (Worker Routes)
3. **Vérifiez qu'il y a une route** :
   - **Route** : `cdn.yukpomnang.com/*`
   - **Worker** : `cdn-video-proxy`

4. **Si la route n'existe pas** :
   - Cliquez sur **"Ajouter un itinéraire"**
   - Route : `cdn.yukpomnang.com/*`
   - Worker : `cdn-video-proxy`
   - Sauvegardez

### Étape 5 : Vérifier le DNS

1. **Dans Cloudflare Dashboard** → **DNS**
2. **Vérifiez qu'il y a un enregistrement** :
   - Type : **CNAME** ou **A**
   - Nom : `cdn`
   - Contenu : `cdn.yukpomnang.com` ou une adresse IP
   - Proxy : **Proxied** (nuage orange) ✅

3. **Si l'enregistrement n'existe pas** :
   - Cliquez sur **"Add record"**
   - Type : **CNAME**
   - Name : `cdn`
   - Target : `cdn.yukpomnang.com` ou `cdn.yukpomnang.com.workers.dev`
   - Proxy : **Proxied** (orange)
   - Sauvegardez

## 📋 Checklist de vérification

- [ ] Bucket Policy a `"Principal": "*"` (corrigé)
- [ ] Test direct Wasabi fonctionne (URL complète dans navigateur)
- [ ] Worker Cloudflare est déployé et actif
- [ ] Route `cdn.yukpomnang.com/*` est configurée
- [ ] DNS `cdn.yukpomnang.com` existe

## 🎯 Actions immédiates

1. **Corrigez la Bucket Policy** avec `"Principal": "*"`
2. **Testez Wasabi directement** avec une URL complète
3. **Vérifiez la route Cloudflare** `cdn.yukpomnang.com/*`

**Dites-moi les résultats de chaque étape !**



