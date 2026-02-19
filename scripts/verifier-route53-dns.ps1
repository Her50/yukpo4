# Script de vérification Route 53 DNS pour le nouveau compte AWS
# Date: 2026-02-14
# Compte AWS: 108964700972 (eu-west-1)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VERIFICATION ROUTE 53 DNS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier le compte AWS actuel
Write-Host "[1/5] Verification du compte AWS..." -ForegroundColor Yellow
try {
    $accountInfo = aws sts get-caller-identity --output json | ConvertFrom-Json
    Write-Host "  [OK] Compte AWS: $($accountInfo.Account)" -ForegroundColor Green
    Write-Host "  [OK] Utilisateur: $($accountInfo.Arn)" -ForegroundColor Green
    Write-Host "  [OK] Region: eu-west-1" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "  [ERREUR] Impossible de recuperer les informations du compte: $_" -ForegroundColor Red
    exit 1
}

# Vérifier les permissions Route 53
Write-Host "[2/5] Verification des permissions Route 53..." -ForegroundColor Yellow
try {
    $zones = aws route53 list-hosted-zones --output json 2>&1 | ConvertFrom-Json
    Write-Host "  [OK] Permissions Route 53 OK" -ForegroundColor Green
    Write-Host "  [INFO] Nombre de zones: $($zones.HostedZones.Count)" -ForegroundColor Gray
    Write-Host ""
} catch {
    $errorMsg = $_.Exception.Message
    if ($errorMsg -like "*AccessDenied*" -or $errorMsg -like "*not authorized*") {
        Write-Host "  [ATTENTION] Permissions Route 53 insuffisantes" -ForegroundColor Yellow
        Write-Host "  [INFO] L'utilisateur AWS n'a pas les permissions route53:ListHostedZones" -ForegroundColor Gray
        Write-Host "  [ACTION] Ajouter les permissions IAM suivantes:" -ForegroundColor Cyan
        Write-Host "    - route53:ListHostedZones" -ForegroundColor White
        Write-Host "    - route53:GetHostedZone" -ForegroundColor White
        Write-Host "    - route53:ListResourceRecordSets" -ForegroundColor White
        Write-Host "    - route53:ChangeResourceRecordSets" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "  [ERREUR] Erreur lors de la verification: $errorMsg" -ForegroundColor Red
    }
    Write-Host ""
}

# Vérifier si une zone hébergée existe pour yukpomnang.com
Write-Host "[3/5] Recherche de la zone yukpomnang.com..." -ForegroundColor Yellow
try {
    $zones = aws route53 list-hosted-zones --query 'HostedZones[?Name==`yukpomnang.com.`]' --output json 2>&1 | ConvertFrom-Json
    
    if ($zones -and $zones.Count -gt 0) {
        $zone = $zones[0]
        $zoneId = $zone.Id -replace '/hostedzone/', ''
        Write-Host "  [OK] Zone Route 53 trouvee!" -ForegroundColor Green
        Write-Host "    ID: $zoneId" -ForegroundColor Gray
        Write-Host "    Nom: $($zone.Name)" -ForegroundColor Gray
        Write-Host ""
        
        # Vérifier les enregistrements DNS
        Write-Host "[4/5] Verification des enregistrements DNS..." -ForegroundColor Yellow
        try {
            $records = aws route53 list-resource-record-sets `
                --hosted-zone-id $zoneId `
                --query "ResourceRecordSets[?contains(Name, 'api')]" `
                --output json 2>&1 | ConvertFrom-Json
            
            if ($records -and $records.Count -gt 0) {
                Write-Host "  [INFO] Enregistrements trouves pour 'api':" -ForegroundColor Gray
                foreach ($record in $records) {
                    Write-Host "    - $($record.Name) ($($record.Type))" -ForegroundColor Gray
                    if ($record.AliasTarget) {
                        Write-Host "      -> $($record.AliasTarget.DNSName)" -ForegroundColor Gray
                    } elseif ($record.ResourceRecords) {
                        Write-Host "      -> $($record.ResourceRecords[0].Value)" -ForegroundColor Gray
                    }
                }
                Write-Host ""
            } else {
                Write-Host "  [ATTENTION] Aucun enregistrement trouve pour 'api.yukpomnang.com'" -ForegroundColor Yellow
                Write-Host "  [ACTION] Creer un enregistrement A ou CNAME" -ForegroundColor Cyan
                Write-Host ""
            }
        } catch {
            Write-Host "  [ATTENTION] Impossible de recuperer les enregistrements: $_" -ForegroundColor Yellow
            Write-Host ""
        }
    } else {
        Write-Host "  [ATTENTION] Zone Route 53 non trouvee pour yukpomnang.com" -ForegroundColor Yellow
        Write-Host "  [INFO] La zone peut etre dans un autre compte AWS" -ForegroundColor Gray
        Write-Host "  [INFO] OU le domaine est gere par un autre fournisseur DNS (Cloudflare, etc.)" -ForegroundColor Gray
        Write-Host ""
    }
} catch {
    Write-Host "  [ATTENTION] Impossible de rechercher la zone: $_" -ForegroundColor Yellow
    Write-Host ""
}

# Vérifier le DNS actuel
Write-Host "[5/5] Verification DNS actuel..." -ForegroundColor Yellow
try {
    $dnsResult = nslookup api.yukpomnang.com 2>&1
    if ($dnsResult -like "*54.171.220.203*" -or $dnsResult -like "*52.211.202.11*") {
        Write-Host "  [OK] DNS resolut vers une IP backend" -ForegroundColor Green
    } elseif ($dnsResult -like "*NXDOMAIN*" -or $dnsResult -like "*Non-existent*") {
        Write-Host "  [ATTENTION] api.yukpomnang.com ne resolut pas" -ForegroundColor Yellow
        Write-Host "  [ACTION] Configurer le DNS (Route 53 ou Cloudflare)" -ForegroundColor Cyan
    } else {
        Write-Host "  [INFO] DNS resolut vers: $dnsResult" -ForegroundColor Gray
    }
    Write-Host ""
} catch {
    Write-Host "  [ATTENTION] Impossible de verifier le DNS: $_" -ForegroundColor Yellow
    Write-Host ""
}

# Résumé et recommandations
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RESUME ET RECOMMANDATIONS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Récupérer l'IP actuelle du backend
Write-Host "IP actuelle du backend:" -ForegroundColor Yellow
try {
    $taskArn = aws ecs list-tasks --cluster yukpo-cluster --service-name yukpo-backend-service --region eu-west-1 --desired-status RUNNING --query 'taskArns[0]' --output text
    
    if ($taskArn) {
        $taskDetails = aws ecs describe-tasks --cluster yukpo-cluster --tasks $taskArn --region eu-west-1 --query 'tasks[0]' --output json | ConvertFrom-Json
        $eniId = $taskDetails.attachments[0].details | Where-Object { $_.name -eq "networkInterfaceId" } | Select-Object -ExpandProperty value
        
        if ($eniId) {
            $eniDetails = aws ec2 describe-network-interfaces --network-interface-ids $eniId --region eu-west-1 --query 'NetworkInterfaces[0]' --output json | ConvertFrom-Json
            if ($eniDetails.Association.PublicIp) {
                $currentIP = $eniDetails.Association.PublicIp
                Write-Host "  $currentIP:8080" -ForegroundColor Green
            }
        }
    }
} catch {
    Write-Host "  54.171.220.203:8080 (par defaut)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Actions recommandees:" -ForegroundColor Cyan
Write-Host "  1. Si Route 53 est disponible:" -ForegroundColor White
Write-Host "     - Ajouter permissions IAM pour Route 53" -ForegroundColor Gray
Write-Host "     - Executer: scripts\mettre-a-jour-dns-route53.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Si Cloudflare est utilise:" -ForegroundColor White
Write-Host "     - Configurer manuellement sur https://dash.cloudflare.com" -ForegroundColor Gray
Write-Host "     - OU executer: scripts\configurer-dns-cloudflare-powershell.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Pour une solution stable:" -ForegroundColor White
Write-Host "     - Activer le Load Balancer (necessite AWS Support)" -ForegroundColor Gray
Write-Host "     - Configurer Route 53 vers le Load Balancer" -ForegroundColor Gray
Write-Host ""



