# Script de Configuration DNS Route53 et Verification CDN
# Date: 2026-02-14
# Objectif: Configurer le DNS pour api.yukpomnang.com et verifier CDN/CloudFront

param(
    [string]$Region = "eu-west-1",
    [string]$Domain = "api.yukpomnang.com",
    [string]$BackendIP = "52.211.202.11"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIGURATION DNS ET VERIFICATION CDN" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# 1. VERIFIER L'IP PUBLIQUE ACTUELLE
# ============================================
Write-Host "[1/4] Verification de l'IP publique ECS..." -ForegroundColor Yellow
try {
    $taskArn = aws ecs list-tasks --cluster yukpo-cluster --service-name yukpo-backend-service --region $Region --desired-status RUNNING --query 'taskArns[0]' --output text
    
    if ($taskArn) {
        $taskDetails = aws ecs describe-tasks --cluster yukpo-cluster --tasks $taskArn --region $Region --query 'tasks[0]' --output json | ConvertFrom-Json
        $eniId = $taskDetails.attachments[0].details | Where-Object { $_.name -eq "networkInterfaceId" } | Select-Object -ExpandProperty value
        
        if ($eniId) {
            $eniDetails = aws ec2 describe-network-interfaces --network-interface-ids $eniId --region $Region --query 'NetworkInterfaces[0]' --output json | ConvertFrom-Json
            
            if ($eniDetails.Association.PublicIp) {
                $BackendIP = $eniDetails.Association.PublicIp
                Write-Host "  [OK] IP publique actuelle: $BackendIP" -ForegroundColor Green
            }
        }
    }
} catch {
    Write-Host "  [ATTENTION] Utilisation de l'IP par defaut: $BackendIP" -ForegroundColor Yellow
    Write-Host "  [INFO] Note: Cette IP peut changer a chaque redemarrage ECS" -ForegroundColor Gray
}
Write-Host ""

# ============================================
# 2. VERIFIER LE DNS ACTUEL
# ============================================
Write-Host "[2/4] Verification du DNS actuel..." -ForegroundColor Yellow
try {
    $dnsResult = Resolve-DnsName -Name $Domain -ErrorAction SilentlyContinue
    if ($dnsResult) {
        $currentIP = $dnsResult[0].IPAddress
        Write-Host "  [INFO] DNS actuel: $Domain -> $currentIP" -ForegroundColor Gray
        
        if ($currentIP -eq $BackendIP) {
            Write-Host "  [OK] DNS pointe deja vers la bonne IP" -ForegroundColor Green
        } else {
            Write-Host "  [ATTENTION] DNS pointe vers une IP differente: $currentIP" -ForegroundColor Yellow
            Write-Host "  [ACTION] Mettre a jour le DNS pour pointer vers: $BackendIP" -ForegroundColor Cyan
        }
    } else {
        Write-Host "  [ATTENTION] DNS non resolu - Le domaine n'est pas configure" -ForegroundColor Yellow
        Write-Host "  [ACTION] Configurer le DNS pour pointer vers: $BackendIP" -ForegroundColor Cyan
    }
} catch {
    Write-Host "  [ATTENTION] Impossible de resoudre le DNS" -ForegroundColor Yellow
}
Write-Host ""

# ============================================
# 3. VERIFIER ROUTE53
# ============================================
Write-Host "[3/4] Verification Route53..." -ForegroundColor Yellow
try {
    $zones = aws route53 list-hosted-zones --query 'HostedZones[?Name==`yukpomnang.com.`]' --output json 2>&1 | ConvertFrom-Json
    if ($zones -and $zones.Count -gt 0) {
        $zoneId = $zones[0].Id -replace '/hostedzone/', ''
        Write-Host "  [OK] Zone Route53 trouvee: $zoneId" -ForegroundColor Green
        
        # Verifier l'enregistrement actuel
        $records = aws route53 list-resource-record-sets --hosted-zone-id $zoneId --query "ResourceRecordSets[?Name=='${Domain}.']" --output json 2>&1 | ConvertFrom-Json
        
        if ($records -and $records.Count -gt 0) {
            $record = $records[0]
            Write-Host "  [INFO] Enregistrement existant trouve:" -ForegroundColor Gray
            Write-Host "    Type: $($record.Type)" -ForegroundColor Gray
            if ($record.ResourceRecords) {
                $currentValue = $record.ResourceRecords[0].Value
                Write-Host "    Valeur: $currentValue" -ForegroundColor Gray
            }
            if ($record.AliasTarget) {
                Write-Host "    Alias Target: $($record.AliasTarget.DNSName)" -ForegroundColor Gray
            }
            
            Write-Host ""
            Write-Host "  [ACTION] Mettre a jour l'enregistrement pour pointer vers: $BackendIP" -ForegroundColor Cyan
            Write-Host "  [INFO] Utilisez le script mettre-a-jour-dns-route53.ps1 ou AWS Console" -ForegroundColor Gray
        } else {
            Write-Host "  [ATTENTION] Aucun enregistrement trouve pour $Domain" -ForegroundColor Yellow
            Write-Host "  [ACTION] Creer un enregistrement A pointant vers: $BackendIP" -ForegroundColor Cyan
        }
    } else {
        Write-Host "  [ATTENTION] Zone Route53 non trouvee pour yukpomnang.com" -ForegroundColor Yellow
        Write-Host "  [INFO] Le domaine peut etre gere par un autre fournisseur DNS (Cloudflare, etc.)" -ForegroundColor Gray
    }
} catch {
    $errorMsg = $_.Exception.Message
    if ($errorMsg -like "*AccessDenied*") {
        Write-Host "  [ATTENTION] Pas de permissions Route53 avec les credentials actuels" -ForegroundColor Yellow
        Write-Host "  [ACTION] Configurer Route53 manuellement via AWS Console" -ForegroundColor Cyan
    } else {
        Write-Host "  [ERREUR] Erreur lors de la verification Route53: $errorMsg" -ForegroundColor Red
    }
}
Write-Host ""

# ============================================
# 4. VERIFIER CLOUDFRONT
# ============================================
Write-Host "[4/4] Verification CloudFront..." -ForegroundColor Yellow
try {
    $distributions = aws cloudfront list-distributions --region $Region --query 'DistributionList.Items[*].[Id,DomainName,Origins.Items[0].DomainName,Status]' --output json 2>&1 | ConvertFrom-Json
    
    if ($distributions -and $distributions.Count -gt 0) {
        Write-Host "  [OK] $($distributions.Count) distribution(s) CloudFront trouvee(s)" -ForegroundColor Green
        
        $targetDistribution = $null
        foreach ($dist in $distributions) {
            $distId = $dist[0]
            $domainName = $dist[1]
            $originDomain = $dist[2]
            $status = $dist[3]
            
            Write-Host ""
            Write-Host "    Distribution ID: $distId" -ForegroundColor Gray
            Write-Host "    Domain: $domainName" -ForegroundColor Gray
            Write-Host "    Origin: $originDomain" -ForegroundColor Gray
            Write-Host "    Status: $status" -ForegroundColor Gray
            
            # Verifier si c'est la distribution utilisee
            if ($domainName -like "*d3jyvgg46kev8*") {
                $targetDistribution = $dist
                Write-Host "    [OK] C'est la distribution utilisee dans production (2).json" -ForegroundColor Green
                
                # Verifier l'origine
                if ($originDomain -like "*yukpo-backend-media*") {
                    Write-Host "    [OK] Pointe vers le bon bucket S3: yukpo-backend-media" -ForegroundColor Green
                } elseif ($originDomain -like "*yukpomnang-media-prod*") {
                    Write-Host "    [ATTENTION] Pointe vers l'ancien bucket: yukpomnang-media-prod" -ForegroundColor Yellow
                    Write-Host "    [ACTION] Mettre a jour l'origine vers: yukpo-backend-media.s3.eu-west-1.amazonaws.com" -ForegroundColor Cyan
                } else {
                    Write-Host "    [ATTENTION] Origine inconnue: $originDomain" -ForegroundColor Yellow
                    Write-Host "    [ACTION] Verifier que l'origine pointe vers le nouveau bucket" -ForegroundColor Cyan
                }
            }
        }
        
        if (-not $targetDistribution) {
            Write-Host ""
            Write-Host "  [ATTENTION] Distribution d3jyvgg46kev8.cloudfront.net non trouvee dans le nouveau compte" -ForegroundColor Yellow
            Write-Host "  [ACTION] Creer une nouvelle distribution CloudFront ou verifier dans l'ancien compte" -ForegroundColor Cyan
        }
    } else {
        Write-Host "  [ATTENTION] Aucune distribution CloudFront trouvee dans le nouveau compte" -ForegroundColor Yellow
        Write-Host "  [ACTION] Creer une nouvelle distribution CloudFront pointant vers yukpo-backend-media" -ForegroundColor Cyan
    }
} catch {
    Write-Host "  [ERREUR] Erreur lors de la verification CloudFront: $_" -ForegroundColor Red
}
Write-Host ""

# ============================================
# 5. VERIFIER CLOUDFLARE (si utilise)
# ============================================
Write-Host "[BONUS] Verification Cloudflare..." -ForegroundColor Yellow
Write-Host "  [INFO] Cloudflare est un service externe (pas AWS)" -ForegroundColor Gray
Write-Host "  [INFO] Si vous utilisez Cloudflare pour le DNS:" -ForegroundColor Gray
Write-Host "    1. Aller sur https://dash.cloudflare.com" -ForegroundColor Cyan
Write-Host "    2. Selectionner le domaine yukpomnang.com" -ForegroundColor Cyan
Write-Host "    3. Aller dans DNS > Enregistrements" -ForegroundColor Cyan
Write-Host "    4. Trouver l'enregistrement api.yukpomnang.com" -ForegroundColor Cyan
Write-Host "    5. Mettre a jour pour pointer vers: $BackendIP" -ForegroundColor Cyan
Write-Host "    6. Desactiver le proxy (nuage orange -> gris) si vous voulez un acces direct" -ForegroundColor Cyan
Write-Host ""

# ============================================
# RESUME ET ACTIONS
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RESUME ET ACTIONS REQUISES" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "DNS (api.yukpomnang.com):" -ForegroundColor Yellow
Write-Host "  IP Backend actuelle: $BackendIP" -ForegroundColor Gray
Write-Host "  [ACTION] Configurer le DNS pour pointer vers cette IP" -ForegroundColor Cyan
Write-Host "  [INFO] Option 1: Route53 (si zone existe)" -ForegroundColor Gray
Write-Host "  [INFO] Option 2: Cloudflare (si domaine gere par Cloudflare)" -ForegroundColor Gray
Write-Host "  [INFO] Option 3: Autre fournisseur DNS" -ForegroundColor Gray
Write-Host ""

Write-Host "CloudFront:" -ForegroundColor Yellow
Write-Host "  Distribution utilisee: d3jyvgg46kev8.cloudfront.net" -ForegroundColor Gray
Write-Host "  [ACTION] Verifier que cette distribution pointe vers yukpo-backend-media" -ForegroundColor Cyan
Write-Host "  [INFO] Si non, creer une nouvelle distribution dans le nouveau compte" -ForegroundColor Gray
Write-Host ""

Write-Host "Cloudflare CDN:" -ForegroundColor Yellow
Write-Host "  [INFO] Cloudflare est un service externe (pas AWS)" -ForegroundColor Gray
Write-Host "  [INFO] Si utilise, verifier dans Cloudflare Dashboard" -ForegroundColor Gray
Write-Host ""

Write-Host "Verification terminee!" -ForegroundColor Cyan


