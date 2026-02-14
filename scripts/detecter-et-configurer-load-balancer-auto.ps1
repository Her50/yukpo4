# Script de détection automatique et configuration du Load Balancer
# Date: 2026-02-14
# Objectif: Détecter quand le Load Balancer est activé et configurer automatiquement Route 53

param(
    [string]$Region = "eu-west-1",
    [string]$Domain = "api.yukpomnang.com",
    [string]$ZoneName = "yukpomnang.com",
    [string]$CloudflareAPIKey = "SIlEiOG1y92DC2_Kg1u2_tlpCXiwi98kYlNzRsmL",
    [string]$CloudflareZoneID = "98970e23637def46d0a62c789ed66039"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DETECTION ET CONFIGURATION LOAD BALANCER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Étape 1: Vérifier si un Load Balancer existe
Write-Host "[1/4] Recherche du Load Balancer..." -ForegroundColor Yellow
try {
    $loadBalancers = aws elbv2 describe-load-balancers `
        --region $Region `
        --query 'LoadBalancers[?contains(LoadBalancerName, `yukpo`) || contains(LoadBalancerName, `backend`)][*].[LoadBalancerName,DNSName,State.Code,LoadBalancerArn,CanonicalHostedZoneId]' `
        --output json | ConvertFrom-Json
    
    if ($loadBalancers -and $loadBalancers.Count -gt 0) {
        $lb = $loadBalancers[0]
        $ALB_NAME = $lb[0]
        $ALB_DNS_NAME = $lb[1]
        $ALB_STATE = $lb[2]
        $ALB_ARN = $lb[3]
        $ALB_HOSTED_ZONE_ID = $lb[4]
        
        if ($ALB_STATE -eq "active") {
            Write-Host "  [OK] Load Balancer actif trouve!" -ForegroundColor Green
            Write-Host "    Nom: $ALB_NAME" -ForegroundColor Gray
            Write-Host "    DNS: $ALB_DNS_NAME" -ForegroundColor Gray
            Write-Host "    Etat: $ALB_STATE" -ForegroundColor Gray
            Write-Host ""
        } else {
            Write-Host "  [ATTENTION] Load Balancer trouve mais non actif" -ForegroundColor Yellow
            Write-Host "    Etat: $ALB_STATE" -ForegroundColor Gray
            Write-Host "  [INFO] Attendez que le Load Balancer soit actif" -ForegroundColor Cyan
            exit 0
        }
    } else {
        Write-Host "  [INFO] Aucun Load Balancer trouve" -ForegroundColor Yellow
        Write-Host "  [INFO] Le Load Balancer n'est pas encore active par AWS Support" -ForegroundColor Gray
        Write-Host "  [ACTION] Contactez AWS Support pour activer le Load Balancer" -ForegroundColor Cyan
        exit 0
    }
} catch {
    Write-Host "  [ERREUR] Impossible de rechercher le Load Balancer: $_" -ForegroundColor Red
    exit 1
}

# Étape 2: Vérifier Route 53
Write-Host "[2/4] Verification Route 53..." -ForegroundColor Yellow
try {
    $zones = aws route53 list-hosted-zones `
        --query "HostedZones[?Name=='${ZoneName}.'].[Id,Name]" `
        --output json | ConvertFrom-Json
    
    if ($zones -and $zones.Count -gt 0) {
        $ZONE_ID = $zones[0][0] -replace '/hostedzone/', ''
        Write-Host "  [OK] Zone Route 53 trouvee: $ZONE_ID" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "  [ATTENTION] Zone Route 53 non trouvee" -ForegroundColor Yellow
        Write-Host "  [INFO] Creation de la zone Route 53..." -ForegroundColor Cyan
        
        $callerRef = "yukpomnang-$(Get-Date -Format 'yyyyMMddHHmmss')"
        $createZone = aws route53 create-hosted-zone `
            --name $ZoneName `
            --caller-reference $callerRef `
            --output json | ConvertFrom-Json
        
        $ZONE_ID = $createZone.HostedZone.Id -replace '/hostedzone/', ''
        Write-Host "  [OK] Zone Route 53 creee: $ZONE_ID" -ForegroundColor Green
        Write-Host "  [INFO] Notez les serveurs de noms (NS) pour mettre a jour votre registrar" -ForegroundColor Yellow
        $createZone.DelegationSet.NameServers | ForEach-Object {
            Write-Host "    - $_" -ForegroundColor Gray
        }
        Write-Host ""
    }
} catch {
    Write-Host "  [ERREUR] Erreur Route 53: $_" -ForegroundColor Red
    Write-Host "  [INFO] Utilisation de Cloudflare uniquement" -ForegroundColor Yellow
    $ZONE_ID = $null
}

# Étape 3: Configurer Route 53 (si disponible)
if ($ZONE_ID) {
    Write-Host "[3/4] Configuration Route 53 vers Load Balancer..." -ForegroundColor Yellow
    try {
        $changeBatch = @{
            Changes = @(
                @{
                    Action = "UPSERT"
                    ResourceRecordSet = @{
                        Name = "$Domain."
                        Type = "A"
                        AliasTarget = @{
                            DNSName = $ALB_DNS_NAME
                            EvaluateTargetHealth = $true
                            HostedZoneId = $ALB_HOSTED_ZONE_ID
                        }
                    }
                }
            )
        } | ConvertTo-Json -Depth 10 -Compress
        
        $changeFile = "route53-change-lb.json"
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($changeFile, $changeBatch, $utf8NoBom)
        
        $changeResult = aws route53 change-resource-record-sets `
            --hosted-zone-id $ZONE_ID `
            --change-batch file://$changeFile `
            --output json | ConvertFrom-Json
        
        if ($changeResult.ChangeInfo.Status) {
            Write-Host "  [OK] Route 53 configure vers Load Balancer!" -ForegroundColor Green
            Write-Host "    Change ID: $($changeResult.ChangeInfo.Id -replace '/change/', '')" -ForegroundColor Gray
            Write-Host ""
        }
        
        Remove-Item $changeFile -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Host "  [ATTENTION] Erreur configuration Route 53: $_" -ForegroundColor Yellow
        Write-Host "  [INFO] Continuation avec Cloudflare uniquement" -ForegroundColor Gray
    }
}

# Étape 4: Mettre à jour Cloudflare vers Load Balancer (CNAME)
Write-Host "[4/4] Mise a jour Cloudflare vers Load Balancer..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $CloudflareAPIKey"
        "Content-Type" = "application/json"
    }
    
    # Récupérer l'enregistrement actuel
    $recordName = $Domain
    $recordUri = "https://api.cloudflare.com/client/v4/zones/$CloudflareZoneID/dns_records?type=A&name=$recordName"
    $recordResponse = Invoke-RestMethod -Uri $recordUri -Method Get -Headers $headers
    
    if ($recordResponse.success -and $recordResponse.result.Count -gt 0) {
        $existingRecord = $recordResponse.result[0]
        
        # Supprimer l'enregistrement A
        $deleteUri = "https://api.cloudflare.com/client/v4/zones/$CloudflareZoneID/dns_records/$($existingRecord.id)"
        Invoke-RestMethod -Uri $deleteUri -Method Delete -Headers $headers | Out-Null
        Write-Host "  [OK] Ancien enregistrement A supprime" -ForegroundColor Green
    }
    
    # Créer un enregistrement CNAME vers le Load Balancer
    $createBody = @{
        type = "CNAME"
        name = "api"
        content = $ALB_DNS_NAME
        proxied = $false
        ttl = 1
    } | ConvertTo-Json
    
    $createUri = "https://api.cloudflare.com/client/v4/zones/$CloudflareZoneID/dns_records"
    $createResponse = Invoke-RestMethod -Uri $createUri -Method Post -Headers $headers -Body $createBody
    
    if ($createResponse.success) {
        Write-Host "  [OK] Cloudflare configure vers Load Balancer (CNAME)!" -ForegroundColor Green
        Write-Host "    Target: $ALB_DNS_NAME" -ForegroundColor Gray
        Write-Host ""
    }
} catch {
    Write-Host "  [ATTENTION] Erreur mise a jour Cloudflare: $_" -ForegroundColor Yellow
    Write-Host "  [INFO] Vous pouvez le faire manuellement plus tard" -ForegroundColor Gray
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TERMINE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[OK] Configuration automatique terminee!" -ForegroundColor Green
Write-Host "[INFO] Le domaine api.yukpomnang.com pointe maintenant vers le Load Balancer" -ForegroundColor Cyan
Write-Host "[INFO] Attendez 2-5 minutes pour la propagation DNS" -ForegroundColor Yellow
Write-Host "[INFO] Testez avec: nslookup $Domain" -ForegroundColor Gray
Write-Host ""

