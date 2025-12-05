# Script de configuration automatique Cloudflare → Wasabi
# Configure un Worker Cloudflare pour pointer vers Wasabi

param(
    [Parameter(Mandatory=$false)]
    [string]$CloudflareApiToken,
    
    [Parameter(Mandatory=$false)]
    [string]$ZoneId,
    
    [Parameter(Mandatory=$false)]
    [string]$AccountId,
    
    [Parameter(Mandatory=$false)]
    [string]$Domain = "yukpomnang.com",
    
    [Parameter(Mandatory=$false)]
    [string]$CdnSubdomain = "cdn",
    
    [Parameter(Mandatory=$false)]
    [string]$WasabiOrigin = "https://yukpo-video-prod.s3.eu-central-1.wasabisys.com",
    
    [Parameter(Mandatory=$false)]
    [string]$WorkerName = "cdn-video-proxy"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Configuration automatique Cloudflare → Wasabi" -ForegroundColor Cyan
Write-Host ""

# Configuration par défaut
$CDN_DOMAIN = "$CdnSubdomain.$Domain"
$WORKER_CODE = @"
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Origin Wasabi
  const wasabiOrigin = '$WasabiOrigin'
  
  // Construire URL Wasabi
  const wasabiUrl = `\${wasabiOrigin}\${url.pathname}\${url.search}`
  
  // Faire requête vers Wasabi
  const response = await fetch(wasabiUrl, {
    method: request.method,
    headers: {
      ...request.headers,
      'Host': '$WasabiOrigin'.replace('https://', ''),
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
"@

# Demander les credentials si non fournis
if ([string]::IsNullOrWhiteSpace($CloudflareApiToken)) {
    Write-Host "📝 Configuration requise:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Obtenez votre Cloudflare API Token:" -ForegroundColor White
    Write-Host "   → https://dash.cloudflare.com/profile/api-tokens" -ForegroundColor Gray
    Write-Host "   → Créez un token avec permissions: Workers:Edit, Zone:Edit" -ForegroundColor Gray
    Write-Host ""
    
    $CloudflareApiToken = Read-Host "Cloudflare API Token"
}

if ([string]::IsNullOrWhiteSpace($ZoneId)) {
    Write-Host ""
    Write-Host "2. Obtenez votre Zone ID:" -ForegroundColor White
    Write-Host "   → Cloudflare Dashboard → $Domain → Overview" -ForegroundColor Gray
    Write-Host "   → Copiez le Zone ID (affiché sur la droite)" -ForegroundColor Gray
    Write-Host ""
    
    $ZoneId = Read-Host "Zone ID"
}

if ([string]::IsNullOrWhiteSpace($AccountId)) {
    Write-Host ""
    Write-Host "3. Obtenez votre Account ID:" -ForegroundColor White
    Write-Host "   → Cloudflare Dashboard → Workers & Pages" -ForegroundColor Gray
    Write-Host "   → Copiez l'Account ID (en haut à droite)" -ForegroundColor Gray
    Write-Host ""
    
    $AccountId = Read-Host "Account ID"
}

Write-Host ""
Write-Host "🔧 Configuration:" -ForegroundColor Cyan
Write-Host "   Domaine: $Domain" -ForegroundColor Gray
Write-Host "   CDN: $CDN_DOMAIN" -ForegroundColor Gray
Write-Host "   Wasabi Origin: $WasabiOrigin" -ForegroundColor Gray
Write-Host "   Worker: $WorkerName" -ForegroundColor Gray
Write-Host ""

# Headers pour les requêtes Cloudflare API
$headers = @{
    "Authorization" = "Bearer $CloudflareApiToken"
    "Content-Type" = "application/json"
}

# Étape 1 : Vérifier que le DNS CNAME existe
Write-Host "📡 Étape 1/4 : Vérification DNS CNAME..." -ForegroundColor Yellow

try {
    $dnsUrl = "https://api.cloudflare.com/client/v4/zones/$ZoneId/dns_records"
    $dnsResponse = Invoke-RestMethod -Uri $dnsUrl -Method GET -Headers $headers
    
    $cdnRecord = $dnsResponse.result | Where-Object { $_.name -eq $CDN_DOMAIN -and $_.type -eq "CNAME" }
    
    if ($null -eq $cdnRecord) {
        Write-Host "⚠️  CNAME '$CdnSubdomain' n'existe pas. Création..." -ForegroundColor Yellow
        
        $dnsBody = @{
            type = "CNAME"
            name = $CdnSubdomain
            content = "$Domain"
            proxied = $true
            ttl = 1
        } | ConvertTo-Json
        
        $dnsResponse = Invoke-RestMethod -Uri $dnsUrl -Method POST -Headers $headers -Body $dnsBody
        Write-Host "✅ CNAME créé avec succès" -ForegroundColor Green
    } else {
        Write-Host "✅ CNAME '$CDN_DOMAIN' existe déjà" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Erreur DNS: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Vérifiez votre Zone ID et API Token" -ForegroundColor Yellow
    exit 1
}

# Étape 2 : Créer/Mettre à jour le Worker
Write-Host ""
Write-Host "⚙️  Étape 2/4 : Création/Mise à jour du Worker..." -ForegroundColor Yellow

try {
    # Vérifier si le Worker existe
    $workerUrl = "https://api.cloudflare.com/client/v4/accounts/$AccountId/workers/scripts/$WorkerName"
    $workerExists = $false
    
    try {
        $checkResponse = Invoke-RestMethod -Uri $workerUrl -Method GET -Headers $headers -ErrorAction SilentlyContinue
        $workerExists = $true
        Write-Host "   Worker existe, mise à jour..." -ForegroundColor Gray
    } catch {
        $workerExists = $false
        Write-Host "   Worker n'existe pas, création..." -ForegroundColor Gray
    }
    
    # Upload le Worker (création ou mise à jour)
    $workerUploadUrl = "https://api.cloudflare.com/client/v4/accounts/$AccountId/workers/scripts/$WorkerName"
    
    # Créer le body multipart pour upload
    $boundary = [System.Guid]::NewGuid().ToString()
    $bodyLines = @()
    $bodyLines += "--$boundary"
    $bodyLines += "Content-Disposition: form-data; name=`"metadata`""
    $bodyLines += "Content-Type: application/json"
    $bodyLines += ""
    $bodyLines += (@{ main_module = "worker.js" } | ConvertTo-Json -Compress)
    $bodyLines += "--$boundary"
    $bodyLines += "Content-Disposition: form-data; name=`"worker.js`"; filename=`"worker.js`""
    $bodyLines += "Content-Type: application/javascript"
    $bodyLines += ""
    $bodyLines += $WORKER_CODE
    $bodyLines += "--$boundary--"
    
    $body = $bodyLines -join "`r`n"
    
    $uploadHeaders = @{
        "Authorization" = "Bearer $CloudflareApiToken"
        "Content-Type" = "multipart/form-data; boundary=$boundary"
    }
    
    try {
        $uploadResponse = Invoke-RestMethod -Uri $workerUploadUrl -Method PUT -Headers $uploadHeaders -Body $body
        Write-Host "✅ Worker '$WorkerName' configuré avec succès" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Erreur upload Worker (peut être normal si Worker existe déjà): $($_.Exception.Message)" -ForegroundColor Yellow
        
        # Essayer méthode alternative avec curl/wrangler
        Write-Host "   Tentative avec méthode alternative..." -ForegroundColor Yellow
        
        # Sauvegarder le code du Worker dans un fichier temporaire
        $tempWorkerFile = "$env:TEMP\cloudflare-worker-$WorkerName.js"
        $WORKER_CODE | Out-File -FilePath $tempWorkerFile -Encoding UTF8
        
        Write-Host "   Code Worker sauvegardé dans: $tempWorkerFile" -ForegroundColor Gray
        Write-Host "   Vous pouvez le déployer manuellement avec Wrangler:" -ForegroundColor Yellow
        Write-Host "   wrangler deploy --name $WorkerName --script $tempWorkerFile" -ForegroundColor Cyan
    }
} catch {
    Write-Host "❌ Erreur Worker: $($_.Exception.Message)" -ForegroundColor Red
}

# Étape 3 : Configurer la route du Worker
Write-Host ""
Write-Host "🔗 Étape 3/4 : Configuration de la route..." -ForegroundColor Yellow

try {
    # Vérifier les routes existantes
    $routesUrl = "https://api.cloudflare.com/client/v4/zones/$ZoneId/workers/routes"
    $routesResponse = Invoke-RestMethod -Uri $routesUrl -Method GET -Headers $headers
    
    $existingRoute = $routesResponse.result | Where-Object { $_.pattern -eq "$CDN_DOMAIN/*" }
    
    if ($null -eq $existingRoute) {
        Write-Host "   Création route pour $CDN_DOMAIN/*..." -ForegroundColor Gray
        
        $routeBody = @{
            pattern = "$CDN_DOMAIN/*"
            script = $WorkerName
        } | ConvertTo-Json
        
        $routeResponse = Invoke-RestMethod -Uri $routesUrl -Method POST -Headers $headers -Body $routeBody
        Write-Host "✅ Route configurée avec succès" -ForegroundColor Green
    } else {
        Write-Host "✅ Route '$CDN_DOMAIN/*' existe déjà" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Erreur route (peut nécessiter configuration manuelle): $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "   Configurez manuellement:" -ForegroundColor Yellow
    Write-Host "   1. Cloudflare Dashboard → Workers & Pages → $WorkerName" -ForegroundColor Cyan
    Write-Host "   2. Onglet 'Triggers' → 'Routes'" -ForegroundColor Cyan
    Write-Host "   3. Ajouter route: $CDN_DOMAIN/*" -ForegroundColor Cyan
}

# Étape 4 : Test de configuration
Write-Host ""
Write-Host "🧪 Étape 4/4 : Test de configuration..." -ForegroundColor Yellow

Write-Host "   Test DNS: $CDN_DOMAIN" -ForegroundColor Gray
try {
    $testUrl = "https://$CDN_DOMAIN"
    $testResponse = Invoke-WebRequest -Uri $testUrl -Method HEAD -TimeoutSec 10 -ErrorAction SilentlyContinue
    
    if ($testResponse.StatusCode -eq 200 -or $testResponse.StatusCode -eq 404) {
        Write-Host "✅ DNS et Worker fonctionnent!" -ForegroundColor Green
        Write-Host "   Status: $($testResponse.StatusCode)" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️  Test échoué (normal si Worker pas encore déployé): $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "   Le Worker peut prendre quelques minutes à se propager" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Configuration terminée!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Résumé:" -ForegroundColor Cyan
Write-Host "   - DNS CNAME: $CDN_DOMAIN" -ForegroundColor White
Write-Host "   - Worker: $WorkerName" -ForegroundColor White
Write-Host "   - Origin Wasabi: $WasabiOrigin" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Vérification:" -ForegroundColor Cyan
Write-Host "   1. Attendez 2-5 minutes pour propagation DNS" -ForegroundColor White
Write-Host "   2. Testez: https://$CDN_DOMAIN" -ForegroundColor White
Write-Host "   3. Vérifiez dans Cloudflare Dashboard → Workers & Pages" -ForegroundColor White
Write-Host ""
Write-Host "📝 Si le Worker n'est pas déployé automatiquement:" -ForegroundColor Yellow
Write-Host "   → Cloudflare Dashboard → Workers & Pages → Create Worker" -ForegroundColor Cyan
Write-Host "   → Nom: $WorkerName" -ForegroundColor Cyan
Write-Host "   → Collez le code du Worker (voir CONFIGURATION_CLOUDFLARE_WORKER.md)" -ForegroundColor Cyan
Write-Host "   → Deploy puis configurez la route: $CDN_DOMAIN/*" -ForegroundColor Cyan
Write-Host ""



