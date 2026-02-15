# Script pour configurer le DNS Cloudflare automatiquement
# Date: 2026-02-14
# Note: Nécessite les credentials Cloudflare (API Token ou Global API Key)

param(
    [string]$Domain = "yukpomnang.com",
    [string]$Subdomain = "api",
    [string]$TargetIP = "52.211.202.11",
    [string]$CloudflareEmail = "",
    [string]$CloudflareAPIKey = "",
    [string]$CloudflareZoneID = ""
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIGURATION DNS CLOUDFLARE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier si curl est disponible
$curlAvailable = $false
try {
    $curlVersion = curl --version 2>&1
    if ($curlVersion) {
        $curlAvailable = $true
    }
} catch {
    $curlAvailable = $false
}

if (-not $curlAvailable) {
    Write-Host "[ERREUR] curl n'est pas disponible" -ForegroundColor Red
    Write-Host "[INFO] Installez curl ou utilisez Cloudflare Dashboard manuellement" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Instructions manuelles:" -ForegroundColor Cyan
    Write-Host "1. Aller sur https://dash.cloudflare.com" -ForegroundColor White
    Write-Host "2. Selectionner le domaine $Domain" -ForegroundColor White
    Write-Host "3. Aller dans DNS > Enregistrements" -ForegroundColor White
    Write-Host "4. Creer/Modifier l'enregistrement:" -ForegroundColor White
    Write-Host "   - Type: A" -ForegroundColor Gray
    Write-Host "   - Nom: $Subdomain" -ForegroundColor Gray
    Write-Host "   - IPv4: $TargetIP" -ForegroundColor Gray
    Write-Host "   - Proxy: Desactiver (nuage gris)" -ForegroundColor Gray
    Write-Host "   - TTL: Auto" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

# Demander les credentials si non fournis
if ([string]::IsNullOrEmpty($CloudflareEmail) -or [string]::IsNullOrEmpty($CloudflareAPIKey)) {
    Write-Host "[INFO] Credentials Cloudflare requis" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Utiliser API Token (Recommandé)" -ForegroundColor Cyan
    Write-Host "  1. Aller sur https://dash.cloudflare.com/profile/api-tokens" -ForegroundColor Gray
    Write-Host "  2. Creer un token avec permissions: Zone DNS Edit" -ForegroundColor Gray
    Write-Host "  3. Utiliser: -CloudflareAPIKey <TOKEN>" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 2: Utiliser Global API Key" -ForegroundColor Cyan
    Write-Host "  1. Aller sur https://dash.cloudflare.com/profile/api-tokens" -ForegroundColor Gray
    Write-Host "  2. Voir Global API Key" -ForegroundColor Gray
    Write-Host "  3. Utiliser: -CloudflareEmail <EMAIL> -CloudflareAPIKey <KEY>" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 3: Configuration manuelle (Recommandé si pas d'API)" -ForegroundColor Cyan
    Write-Host "  1. Aller sur https://dash.cloudflare.com" -ForegroundColor White
    Write-Host "  2. Selectionner le domaine $Domain" -ForegroundColor White
    Write-Host "  3. Aller dans DNS > Enregistrements" -ForegroundColor White
    Write-Host "  4. Creer/Modifier:" -ForegroundColor White
    Write-Host "     Type: A, Nom: $Subdomain, IPv4: $TargetIP, Proxy: OFF" -ForegroundColor Gray
    Write-Host ""
    exit 0
}

# Obtenir le Zone ID si non fourni
if ([string]::IsNullOrEmpty($CloudflareZoneID)) {
    Write-Host "[INFO] Recuperation du Zone ID..." -ForegroundColor Yellow
    
    if (-not [string]::IsNullOrEmpty($CloudflareEmail)) {
        # Utiliser Global API Key
        $headers = @{
            "X-Auth-Email" = $CloudflareEmail
            "X-Auth-Key" = $CloudflareAPIKey
            "Content-Type" = "application/json"
        }
    } else {
        # Utiliser API Token
        $headers = @{
            "Authorization" = "Bearer $CloudflareAPIKey"
            "Content-Type" = "application/json"
        }
    }
    
    try {
        $zoneResponse = curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=$Domain" `
            -H "X-Auth-Email: $CloudflareEmail" `
            -H "X-Auth-Key: $CloudflareAPIKey" `
            -H "Content-Type: application/json" 2>&1
        
        $zoneData = $zoneResponse | ConvertFrom-Json
        if ($zoneData.success -and $zoneData.result.Count -gt 0) {
            $CloudflareZoneID = $zoneData.result[0].id
            Write-Host "  [OK] Zone ID trouve: $CloudflareZoneID" -ForegroundColor Green
        } else {
            Write-Host "  [ERREUR] Zone non trouvee" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "  [ERREUR] Impossible de recuperer le Zone ID: $_" -ForegroundColor Red
        Write-Host "  [INFO] Utilisez la configuration manuelle" -ForegroundColor Yellow
        exit 1
    }
}

# Vérifier l'enregistrement existant
Write-Host "[INFO] Verification de l'enregistrement existant..." -ForegroundColor Yellow
try {
    $recordResponse = curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$CloudflareZoneID/dns_records?type=A&name=${Subdomain}.${Domain}" `
        -H "X-Auth-Email: $CloudflareEmail" `
        -H "X-Auth-Key: $CloudflareAPIKey" `
        -H "Content-Type: application/json" 2>&1
    
    $recordData = $recordResponse | ConvertFrom-Json
    
    if ($recordData.success -and $recordData.result.Count -gt 0) {
        $existingRecord = $recordData.result[0]
        Write-Host "  [INFO] Enregistrement existant trouve:" -ForegroundColor Gray
        Write-Host "    ID: $($existingRecord.id)" -ForegroundColor Gray
        Write-Host "    IP: $($existingRecord.content)" -ForegroundColor Gray
        Write-Host "    Proxy: $($existingRecord.proxied)" -ForegroundColor Gray
        
        if ($existingRecord.content -eq $TargetIP -and -not $existingRecord.proxied) {
            Write-Host "  [OK] Enregistrement deja correct!" -ForegroundColor Green
            exit 0
        }
        
        # Mettre à jour l'enregistrement
        Write-Host "[INFO] Mise a jour de l'enregistrement..." -ForegroundColor Yellow
        $updateBody = @{
            type = "A"
            name = $Subdomain
            content = $TargetIP
            proxied = $false
            ttl = 1  # Auto
        } | ConvertTo-Json
        
        $updateResponse = curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$CloudflareZoneID/dns_records/$($existingRecord.id)" `
            -H "X-Auth-Email: $CloudflareEmail" `
            -H "X-Auth-Key: $CloudflareAPIKey" `
            -H "Content-Type: application/json" `
            -d $updateBody 2>&1
        
        $updateData = $updateResponse | ConvertFrom-Json
        if ($updateData.success) {
            Write-Host "  [OK] Enregistrement mis a jour avec succes!" -ForegroundColor Green
        } else {
            Write-Host "  [ERREUR] Echec de la mise a jour: $($updateData.errors)" -ForegroundColor Red
            exit 1
        }
    } else {
        # Créer un nouvel enregistrement
        Write-Host "[INFO] Creation d'un nouvel enregistrement..." -ForegroundColor Yellow
        $createBody = @{
            type = "A"
            name = $Subdomain
            content = $TargetIP
            proxied = $false
            ttl = 1  # Auto
        } | ConvertTo-Json
        
        $createResponse = curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CloudflareZoneID/dns_records" `
            -H "X-Auth-Email: $CloudflareEmail" `
            -H "X-Auth-Key: $CloudflareAPIKey" `
            -H "Content-Type: application/json" `
            -d $createBody 2>&1
        
        $createData = $createResponse | ConvertFrom-Json
        if ($createData.success) {
            Write-Host "  [OK] Enregistrement cree avec succes!" -ForegroundColor Green
        } else {
            Write-Host "  [ERREUR] Echec de la creation: $($createData.errors)" -ForegroundColor Red
            exit 1
        }
    }
} catch {
    Write-Host "  [ERREUR] Erreur lors de la configuration: $_" -ForegroundColor Red
    Write-Host "  [INFO] Utilisez la configuration manuelle" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[OK] Configuration DNS terminee!" -ForegroundColor Green
Write-Host "[INFO] Attendez 2-5 minutes pour la propagation DNS" -ForegroundColor Yellow
Write-Host "[INFO] Testez avec: nslookup ${Subdomain}.${Domain}" -ForegroundColor Cyan


