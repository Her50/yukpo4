# Script de mise à jour automatique DNS Cloudflare
# Date: 2026-02-14
# Objectif: Vérifier l'IP ECS et mettre à jour Cloudflare automatiquement si elle a changé

param(
    [string]$CloudflareAPIKey = "SIlEiOG1y92DC2_Kg1u2_tlpCXiwi98kYlNzRsmL",
    [string]$CloudflareZoneID = "98970e23637def46d0a62c789ed66039",
    [string]$Subdomain = "api",
    [string]$Domain = "yukpomnang.com",
    [string]$Region = "eu-west-1",
    [string]$Cluster = "yukpo-cluster",
    [string]$Service = "yukpo-backend-service"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MISE A JOUR AUTOMATIQUE DNS CLOUDFLARE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Préparer les headers Cloudflare
$headers = @{
    "Authorization" = "Bearer $CloudflareAPIKey"
    "Content-Type" = "application/json"
}

# Étape 1: Récupérer l'IP actuelle du backend ECS
Write-Host "[1/3] Recuperation de l'IP publique ECS..." -ForegroundColor Yellow
try {
    $taskArn = aws ecs list-tasks --cluster $Cluster --service-name $Service --region $Region --desired-status RUNNING --query 'taskArns[0]' --output text
    
    if (-not $taskArn) {
        Write-Host "  [ERREUR] Aucune tache ECS en cours d'execution" -ForegroundColor Red
        exit 1
    }
    
    $taskDetails = aws ecs describe-tasks --cluster $Cluster --tasks $taskArn --region $Region --query 'tasks[0]' --output json | ConvertFrom-Json
    $eniId = $taskDetails.attachments[0].details | Where-Object { $_.name -eq "networkInterfaceId" } | Select-Object -ExpandProperty value
    
    if (-not $eniId) {
        Write-Host "  [ERREUR] Impossible de recuperer l'interface reseau" -ForegroundColor Red
        exit 1
    }
    
    $eniDetails = aws ec2 describe-network-interfaces --network-interface-ids $eniId --region $Region --query 'NetworkInterfaces[0]' --output json | ConvertFrom-Json
    
    if (-not $eniDetails.Association.PublicIp) {
        Write-Host "  [ERREUR] Aucune IP publique associee" -ForegroundColor Red
        exit 1
    }
    
    $currentIP = $eniDetails.Association.PublicIp
    Write-Host "  [OK] IP publique actuelle: $currentIP" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "  [ERREUR] Impossible de recuperer l'IP: $_" -ForegroundColor Red
    exit 1
}

# Étape 2: Vérifier l'IP actuelle dans Cloudflare
Write-Host "[2/3] Verification de l'IP dans Cloudflare..." -ForegroundColor Yellow
try {
    $recordName = "${Subdomain}.${Domain}"
    $recordUri = "https://api.cloudflare.com/client/v4/zones/$CloudflareZoneID/dns_records?type=A&name=$recordName"
    $recordResponse = Invoke-RestMethod -Uri $recordUri -Method Get -Headers $headers
    
    if (-not $recordResponse.success) {
        Write-Host "  [ERREUR] Impossible de recuperer l'enregistrement DNS" -ForegroundColor Red
        exit 1
    }
    
    if ($recordResponse.result.Count -eq 0) {
        Write-Host "  [ATTENTION] Aucun enregistrement trouve, creation..." -ForegroundColor Yellow
        $needsUpdate = $true
        $recordId = $null
        $cloudflareIP = $null
    } else {
        $existingRecord = $recordResponse.result[0]
        $recordId = $existingRecord.id
        $cloudflareIP = $existingRecord.content
        Write-Host "  [OK] Enregistrement trouve:" -ForegroundColor Green
        Write-Host "    ID: $recordId" -ForegroundColor Gray
        Write-Host "    IP actuelle dans Cloudflare: $cloudflareIP" -ForegroundColor Gray
        Write-Host ""
        
        # Vérifier si une mise à jour est nécessaire
        if ($cloudflareIP -eq $currentIP) {
            Write-Host "  [OK] IP deja a jour, aucune action necessaire" -ForegroundColor Green
            $needsUpdate = $false
        } else {
            Write-Host "  [INFO] IP differente detectee, mise a jour necessaire" -ForegroundColor Yellow
            Write-Host "    Ancienne IP: $cloudflareIP" -ForegroundColor Gray
            Write-Host "    Nouvelle IP: $currentIP" -ForegroundColor Gray
            $needsUpdate = $true
        }
    }
} catch {
    Write-Host "  [ERREUR] Erreur lors de la verification: $_" -ForegroundColor Red
    exit 1
}

# Étape 3: Mettre à jour si nécessaire
if ($needsUpdate) {
    Write-Host "[3/3] Mise a jour de l'enregistrement DNS..." -ForegroundColor Yellow
    
    $updateBody = @{
        type = "A"
        name = $Subdomain
        content = $currentIP
        proxied = $false
        ttl = 1
    } | ConvertTo-Json
    
    try {
        if ($recordId) {
            # Mise à jour de l'enregistrement existant
            $updateUri = "https://api.cloudflare.com/client/v4/zones/$CloudflareZoneID/dns_records/$recordId"
            $updateResponse = Invoke-RestMethod -Uri $updateUri -Method Put -Headers $headers -Body $updateBody
            
            if ($updateResponse.success) {
                Write-Host "  [OK] Enregistrement mis a jour avec succes!" -ForegroundColor Green
                Write-Host "    Nom: $($updateResponse.result.name)" -ForegroundColor Gray
                Write-Host "    Nouvelle IP: $($updateResponse.result.content)" -ForegroundColor Gray
            } else {
                Write-Host "  [ERREUR] Echec de la mise a jour: $($updateResponse.errors)" -ForegroundColor Red
                exit 1
            }
        } else {
            # Création d'un nouvel enregistrement
            $createUri = "https://api.cloudflare.com/client/v4/zones/$CloudflareZoneID/dns_records"
            $createResponse = Invoke-RestMethod -Uri $createUri -Method Post -Headers $headers -Body $updateBody
            
            if ($createResponse.success) {
                Write-Host "  [OK] Enregistrement cree avec succes!" -ForegroundColor Green
                Write-Host "    Nom: $($createResponse.result.name)" -ForegroundColor Gray
                Write-Host "    IP: $($createResponse.result.content)" -ForegroundColor Gray
            } else {
                Write-Host "  [ERREUR] Echec de la creation: $($createResponse.errors)" -ForegroundColor Red
                exit 1
            }
        }
    } catch {
        Write-Host "  [ERREUR] Erreur lors de la mise a jour: $_" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            try {
                $errorJson = $_.ErrorDetails.Message | ConvertFrom-Json
                if ($errorJson.errors) {
                    foreach ($error in $errorJson.errors) {
                        Write-Host "    - $($error.message) (Code: $($error.code))" -ForegroundColor Red
                    }
                }
            } catch {
                Write-Host "    Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
            }
        }
        exit 1
    }
} else {
    Write-Host "[3/3] Aucune mise a jour necessaire" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TERMINE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[INFO] Attendez 2-5 minutes pour la propagation DNS" -ForegroundColor Yellow
Write-Host "[INFO] Testez avec: nslookup ${Subdomain}.${Domain}" -ForegroundColor Cyan
Write-Host ""

