# Script pour configurer le DNS Cloudflare avec PowerShell natif
# Date: 2026-02-14
# Utilise Invoke-RestMethod au lieu de curl

param(
    [string]$Domain = "yukpomnang.com",
    [string]$Subdomain = "api",
    [string]$TargetIP = "54.171.220.203",
    [string]$CloudflareEmail = "",
    [string]$CloudflareAPIKey = "",
    [string]$CloudflareZoneID = ""
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIGURATION DNS CLOUDFLARE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Demander les credentials si non fournis
if ([string]::IsNullOrEmpty($CloudflareAPIKey)) {
    Write-Host "[INFO] Credentials Cloudflare requis" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Utiliser API Token (Recommandé)" -ForegroundColor Cyan
    Write-Host "  1. Aller sur https://dash.cloudflare.com/profile/api-tokens" -ForegroundColor Gray
    Write-Host "  2. Creer un token avec permissions: Zone DNS Edit" -ForegroundColor Gray
    Write-Host "  3. Utiliser: -CloudflareAPIKey <TOKEN>" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 2: Configuration manuelle (Plus simple)" -ForegroundColor Cyan
    Write-Host "  1. Aller sur https://dash.cloudflare.com" -ForegroundColor White
    Write-Host "  2. Selectionner le domaine $Domain" -ForegroundColor White
    Write-Host "  3. Aller dans DNS > Enregistrements" -ForegroundColor White
    Write-Host "  4. Creer/Modifier:" -ForegroundColor White
    Write-Host "     Type: A" -ForegroundColor Gray
    Write-Host "     Nom: $Subdomain" -ForegroundColor Gray
    Write-Host "     IPv4: $TargetIP" -ForegroundColor Gray
    Write-Host "     Proxy: Desactiver (nuage gris)" -ForegroundColor Gray
    Write-Host "     TTL: Auto" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  [ACTION] Executez avec: -CloudflareAPIKey <VOTRE_TOKEN>" -ForegroundColor Yellow
    exit 0
}

# Préparer les headers
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

# Obtenir le Zone ID si non fourni
if ([string]::IsNullOrEmpty($CloudflareZoneID)) {
    Write-Host "[1/3] Recuperation du Zone ID..." -ForegroundColor Yellow
    try {
        $zoneUri = "https://api.cloudflare.com/client/v4/zones?name=$Domain"
        $zoneResponse = Invoke-RestMethod -Uri $zoneUri -Method Get -Headers $headers
        
        if ($zoneResponse.success -and $zoneResponse.result.Count -gt 0) {
            $CloudflareZoneID = $zoneResponse.result[0].id
            Write-Host "  [OK] Zone ID trouve: $CloudflareZoneID" -ForegroundColor Green
        } else {
            Write-Host "  [ERREUR] Zone non trouvee pour $Domain" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "  [ERREUR] Impossible de recuperer le Zone ID: $_" -ForegroundColor Red
        Write-Host "  [INFO] Verifiez votre token API et le nom du domaine" -ForegroundColor Yellow
        exit 1
    }
}

# Vérifier l'enregistrement existant
Write-Host "[2/3] Verification de l'enregistrement existant..." -ForegroundColor Yellow
try {
    $recordName = "${Subdomain}.${Domain}"
    $recordUri = "https://api.cloudflare.com/client/v4/zones/$CloudflareZoneID/dns_records?type=A&name=$recordName"
    $recordResponse = Invoke-RestMethod -Uri $recordUri -Method Get -Headers $headers
    
    if ($recordResponse.success -and $recordResponse.result.Count -gt 0) {
        $existingRecord = $recordResponse.result[0]
        Write-Host "  [INFO] Enregistrement existant trouve:" -ForegroundColor Gray
        Write-Host "    ID: $($existingRecord.id)" -ForegroundColor Gray
        Write-Host "    IP: $($existingRecord.content)" -ForegroundColor Gray
        Write-Host "    Proxy: $($existingRecord.proxied)" -ForegroundColor Gray
        
        if ($existingRecord.content -eq $TargetIP -and -not $existingRecord.proxied) {
            Write-Host "  [OK] Enregistrement deja correct!" -ForegroundColor Green
            exit 0
        }
        
        # Mettre à jour l'enregistrement
        Write-Host "[3/3] Mise a jour de l'enregistrement..." -ForegroundColor Yellow
        $updateBody = @{
            type = "A"
            name = $Subdomain
            content = $TargetIP
            proxied = $false
            ttl = 1  # Auto
        } | ConvertTo-Json
        
        $updateUri = "https://api.cloudflare.com/client/v4/zones/$CloudflareZoneID/dns_records/$($existingRecord.id)"
        $updateResponse = Invoke-RestMethod -Uri $updateUri -Method Put -Headers $headers -Body $updateBody
        
        if ($updateResponse.success) {
            Write-Host "  [OK] Enregistrement mis a jour avec succes!" -ForegroundColor Green
        } else {
            Write-Host "  [ERREUR] Echec de la mise a jour: $($updateResponse.errors)" -ForegroundColor Red
            exit 1
        }
    } else {
        # Créer un nouvel enregistrement
        Write-Host "[3/3] Creation d'un nouvel enregistrement..." -ForegroundColor Yellow
        $createBody = @{
            type = "A"
            name = $Subdomain
            content = $TargetIP
            proxied = $false
            ttl = 1  # Auto
        } | ConvertTo-Json -Depth 10
        
        $createUri = "https://api.cloudflare.com/client/v4/zones/$CloudflareZoneID/dns_records"
        try {
            $createResponse = Invoke-RestMethod -Uri $createUri -Method Post -Headers $headers -Body $createBody -ErrorAction Stop
            
            if ($createResponse.success) {
                Write-Host "  [OK] Enregistrement cree avec succes!" -ForegroundColor Green
                Write-Host "    ID: $($createResponse.result.id)" -ForegroundColor Gray
                Write-Host "    Nom: $($createResponse.result.name)" -ForegroundColor Gray
                Write-Host "    IP: $($createResponse.result.content)" -ForegroundColor Gray
            } else {
                Write-Host "  [ERREUR] Echec de la creation:" -ForegroundColor Red
                if ($createResponse.errors) {
                    foreach ($error in $createResponse.errors) {
                        Write-Host "    - $($error.message) (Code: $($error.code))" -ForegroundColor Red
                    }
                }
                exit 1
            }
        } catch {
            $errorDetails = $_.ErrorDetails.Message
            $errorResponse = $_.Exception.Response
            Write-Host "  [ERREUR] Erreur HTTP lors de la creation:" -ForegroundColor Red
            if ($errorDetails) {
                Write-Host "    $errorDetails" -ForegroundColor Red
                try {
                    $errorJson = $errorDetails | ConvertFrom-Json
                    if ($errorJson.errors) {
                        foreach ($error in $errorJson.errors) {
                            Write-Host "    - $($error.message) (Code: $($error.code))" -ForegroundColor Red
                        }
                    }
                } catch {
                    Write-Host "    Reponse brute: $errorDetails" -ForegroundColor Red
                }
            } else {
                Write-Host "    $($_.Exception.Message)" -ForegroundColor Red
            }
            exit 1
        }
    }
} catch {
    Write-Host "  [ERREUR] Erreur lors de la configuration: $_" -ForegroundColor Red
    Write-Host "  [INFO] Verifiez votre token API et les permissions" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[OK] Configuration DNS terminee!" -ForegroundColor Green
Write-Host "[INFO] Attendez 2-5 minutes pour la propagation DNS" -ForegroundColor Yellow
Write-Host "[INFO] Testez avec: nslookup ${Subdomain}.${Domain}" -ForegroundColor Cyan
Write-Host ""

