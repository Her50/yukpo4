# ✅ Correction "AccessDenied" Wasabi

## 🔍 Problème identifié

L'erreur "AccessDenied" signifie que :
- ✅ Le Worker Cloudflare fonctionne correctement
- ✅ Il fait bien la requête vers Wasabi
- ❌ **Wasabi refuse l'accès** (permissions bucket)

## 🛠️ Solution : Configurer Wasabi pour l'accès public

### Option 1 : Rendre le bucket public (Recommandé pour CDN)

1. **Connectez-vous à Wasabi Console** : **https://console.wasabisys.com**
2. **Allez dans votre bucket** : `yukpo-video-prod`
3. **Configuration du bucket** :
   - Onglet **"Bucket Settings"** ou **"Permissions"**
   - Cherchez **"Public Access"** ou **"Bucket Policy"**

4. **Ajoutez une Bucket Policy** pour autoriser la lecture publique :

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

5. **Activez "Public Access"** ou désactivez "Block Public Access" si nécessaire

### Option 2 : Utiliser des credentials dans le Worker (Plus sécurisé)

Si vous préférez garder le bucket privé, modifiez le Worker pour utiliser des credentials Wasabi :

**Dans Cloudflare Worker, ajoutez des secrets :**
1. Worker Dashboard → **Settings** → **Variables**
2. Ajoutez :
   - `WASABI_ACCESS_KEY`
   - `WASABI_SECRET_KEY`

**Modifiez le code du Worker :**

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const wasabiOrigin = 'https://yukpo-video-prod.s3.eu-central-1.wasabisys.com'
  const wasabiUrl = `${wasabiOrigin}${url.pathname}${url.search}`
  
  // Créer signature AWS S3 compatible pour Wasabi
  const accessKeyId = WASABI_ACCESS_KEY  // Variable d'environnement
  const secretAccessKey = WASABI_SECRET_KEY  // Variable d'environnement
  
  // Headers avec authentification (si nécessaire)
  const headers = {
    ...request.headers,
    'Host': 'yukpo-video-prod.s3.eu-central-1.wasabisys.com',
  }
  
  // Optionnel : Ajouter signature AWS S3 (complexe)
  // Ou simplement rendre le bucket public (Option 1)
  
  const response = await fetch(wasabiUrl, {
    method: request.method,
    headers,
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

## ✅ Recommandation

**Utilisez l'Option 1** (Bucket public) car :
- Plus simple à configurer
- Performance optimale avec Cloudflare CDN
- Les vidéos sont déjà publiques via votre application
- Cloudflare fait le cache, donc moins de requêtes vers Wasabi

## 🔧 Vérification après configuration

1. Testez directement Wasabi :
   - URL : `https://yukpo-video-prod.s3.eu-central-1.wasabisys.com/votre-video.mp4`
   - Si vous voyez la vidéo → Bucket public ✅
   - Si "AccessDenied" → Continuez la configuration

2. Testez via le Worker :
   - URL : `https://cdn.yukpomnang.com/votre-video.mp4`
   - Devrait fonctionner après configuration

## 📝 Note importante

Si vous avez déjà configuré la route `cdn.yukpomnang.com/*` dans Cloudflare, le Worker sera utilisé automatiquement. Sinon, configurez la route dans :
- **Itinéraires des travailleurs** → **Ajouter un itinéraire**
- Route : `cdn.yukpomnang.com/*`
- Worker : `cdn-video-proxy`

