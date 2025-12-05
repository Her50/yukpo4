# Configuration Cloudflare Worker pour Wasabi

## Étape 1 : Créer le Worker

1. Cloudflare Dashboard → **Workers & Pages**
2. **Create** → **Create Worker**
3. Nom : `cdn-video-proxy`

## Étape 2 : Code du Worker

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
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    },
  })
  
  return newResponse
}
```

## Étape 3 : Déployer et Router

1. Cliquez **Deploy**
2. Allez dans **Routes** → **Add route**
3. Pattern : `cdn.yukpomnang.com/*`
4. Worker : `cdn-video-proxy`
5. Sauvegardez

## Résultat

Maintenant, quand quelqu'un accède à `https://cdn.yukpomnang.com/video123.mp4` :
- Cloudflare intercepte la requête
- Le Worker fait une requête vers Wasabi
- Wasabi envoie la vidéo
- Cloudflare cache et distribue



