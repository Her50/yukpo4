# Script PowerShell pour mettre à jour le DNS Route53 vers le nouveau Load Balancer
# Date: 2026-02-14

Write-Host "🔍 Vérification et Mise à Jour DNS Route53" -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

# Configuration
$REGION = "eu-west-1"
$DOMAIN = "api.yukpomnang.com"
$ZONE_NAME = "yukpomnang.com"

# Étape 1: Vérifier le DNS actuel
Write-Host "📋 Étape 1: Vérification DNS actuel..." -ForegroundColor Yellow
try {
    $dnsResult = nslookup $DOMAIN 2>&1
    Write-Host "Résultat DNS actuel:" -ForegroundColor Gray
    $dnsResult | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
    Write-Host ""
} catch {
    Write-Host "⚠️ Impossible de résoudre le DNS actuel" -ForegroundColor Yellow
    Write-Host ""
}

# Étape 2: Vérifier si le Load Balancer existe
Write-Host "📋 Étape 2: Recherche du Load Balancer..." -ForegroundColor Yellow
try {
    $loadBalancers = aws elbv2 describe-load-balancers `
        --region $REGION `
        --query 'LoadBalancers[?contains(LoadBalancerName, `yukpo`) || contains(LoadBalancerName, `backend`)][*].[LoadBalancerName,DNSName,State.Code,LoadBalancerArn]' `
        --output json | ConvertFrom-Json

    if ($loadBalancers -and $loadBalancers.Count -gt 0) {
        Write-Host "✅ Load Balancer trouvé:" -ForegroundColor Green
        $lb = $loadBalancers[0]
        $ALB_NAME = $lb[0]
        $ALB_DNS_NAME = $lb[1]
        $ALB_STATE = $lb[2]
        $ALB_ARN = $lb[3]
        
        Write-Host "  Nom: $ALB_NAME" -ForegroundColor White
        Write-Host "  DNS: $ALB_DNS_NAME" -ForegroundColor White
        Write-Host "  État: $ALB_STATE" -ForegroundColor White
        Write-Host ""
        
        # Récupérer le Hosted Zone ID du Load Balancer
        Write-Host "📋 Récupération du Hosted Zone ID du Load Balancer..." -ForegroundColor Yellow
        $ALB_HOSTED_ZONE_ID = aws elbv2 describe-load-balancers `
            --region $REGION `
            --load-balancer-arns $ALB_ARN `
            --query 'LoadBalancers[0].CanonicalHostedZoneId' `
            --output text
        
        Write-Host "  Hosted Zone ID: $ALB_HOSTED_ZONE_ID" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "❌ Aucun Load Balancer trouvé!" -ForegroundColor Red
        Write-Host ""
        Write-Host "💡 Solution:" -ForegroundColor Yellow
        Write-Host "  1. Activer le Load Balancer dans Terraform:" -ForegroundColor White
        Write-Host "     - Éditer infra/aws/terraform.tfvars" -ForegroundColor Gray
        Write-Host "     - Ajouter: enable_load_balancer = true" -ForegroundColor Gray
        Write-Host "  2. Appliquer Terraform:" -ForegroundColor White
        Write-Host "     cd infra/aws" -ForegroundColor Gray
        Write-Host "     terraform apply" -ForegroundColor Gray
        Write-Host ""
        exit 1
    }
} catch {
    Write-Host "❌ Erreur lors de la recherche du Load Balancer:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    exit 1
}

# Étape 3: Trouver la Zone Hébergée Route53
Write-Host "📋 Étape 3: Recherche de la Zone Hébergée Route53..." -ForegroundColor Yellow
try {
    $zones = aws route53 list-hosted-zones `
        --query "HostedZones[?Name=='${ZONE_NAME}.'].[Id,Name]" `
        --output json | ConvertFrom-Json
    
    if ($zones -and $zones.Count -gt 0) {
        $ZONE_ID = $zones[0][0] -replace '/hostedzone/', ''
        Write-Host "✅ Zone hébergée trouvée:" -ForegroundColor Green
        Write-Host "  ID: $ZONE_ID" -ForegroundColor White
        Write-Host "  Nom: $($zones[0][1])" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "❌ Zone hébergée '$ZONE_NAME' non trouvée!" -ForegroundColor Red
        Write-Host ""
        Write-Host "💡 Solutions possibles:" -ForegroundColor Yellow
        Write-Host "  1. La zone est dans un autre compte AWS" -ForegroundColor White
        Write-Host "  2. Créer une nouvelle zone hébergée:" -ForegroundColor White
        Write-Host "     aws route53 create-hosted-zone --name $ZONE_NAME --caller-reference $(Get-Date -Format 'yyyyMMddHHmmss')" -ForegroundColor Gray
        Write-Host ""
        exit 1
    }
} catch {
    Write-Host "❌ Erreur lors de la recherche de la zone hébergée:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    exit 1
}

# Étape 4: Vérifier l'enregistrement actuel
Write-Host "📋 Étape 4: Vérification de l'enregistrement actuel..." -ForegroundColor Yellow
try {
    $currentRecord = aws route53 list-resource-record-sets `
        --hosted-zone-id $ZONE_ID `
        --query "ResourceRecordSets[?Name=='${DOMAIN}.']" `
        --output json | ConvertFrom-Json
    
    if ($currentRecord -and $currentRecord.Count -gt 0) {
        Write-Host "📝 Enregistrement actuel trouvé:" -ForegroundColor Cyan
        Write-Host "  Nom: $($currentRecord[0].Name)" -ForegroundColor White
        Write-Host "  Type: $($currentRecord[0].Type)" -ForegroundColor White
        if ($currentRecord[0].AliasTarget) {
            Write-Host "  Alias Target: $($currentRecord[0].AliasTarget.DNSName)" -ForegroundColor White
        } elseif ($currentRecord[0].ResourceRecords) {
            Write-Host "  Resource Records: $($currentRecord[0].ResourceRecords[0].Value)" -ForegroundColor White
        }
        Write-Host ""
    } else {
        Write-Host "⚠️ Aucun enregistrement trouvé pour $DOMAIN" -ForegroundColor Yellow
        Write-Host "  Un nouvel enregistrement sera créé." -ForegroundColor White
        Write-Host ""
    }
} catch {
    Write-Host "⚠️ Impossible de récupérer l'enregistrement actuel" -ForegroundColor Yellow
    Write-Host ""
}

# Étape 5: Demander confirmation avant mise à jour
Write-Host "📋 Étape 5: Préparation de la mise à jour..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Configuration à appliquer:" -ForegroundColor Cyan
Write-Host "  Domaine: $DOMAIN" -ForegroundColor White
Write-Host "  Type: A (Alias)" -ForegroundColor White
Write-Host "  Target: $ALB_DNS_NAME" -ForegroundColor White
Write-Host "  Hosted Zone ID: $ALB_HOSTED_ZONE_ID" -ForegroundColor White
Write-Host ""

$confirmation = Read-Host "Voulez-vous mettre à jour le DNS maintenant? (O/N)"

if ($confirmation -ne "O" -and $confirmation -ne "o" -and $confirmation -ne "Y" -and $confirmation -ne "y") {
    Write-Host "❌ Mise à jour annulée." -ForegroundColor Yellow
    exit 0
}

# Étape 6: Créer le fichier JSON pour la mise à jour
Write-Host "📋 Étape 6: Création du fichier de changement..." -ForegroundColor Yellow
$changeBatch = @{
    Changes = @(
        @{
            Action = "UPSERT"
            ResourceRecordSet = @{
                Name = "$DOMAIN."
                Type = "A"
                AliasTarget = @{
                    DNSName = $ALB_DNS_NAME
                    EvaluateTargetHealth = $true
                    HostedZoneId = $ALB_HOSTED_ZONE_ID
                }
            }
        }
    )
}

$changeBatchJson = $changeBatch | ConvertTo-Json -Depth 10
$changeBatchJson | Out-File -FilePath "route53-change.json" -Encoding UTF8 -NoNewline
Write-Host "✅ Fichier créé: route53-change.json" -ForegroundColor Green
Write-Host ""

# Étape 7: Appliquer le changement
Write-Host "📋 Étape 7: Application du changement Route53..." -ForegroundColor Yellow
try {
    $changeResult = aws route53 change-resource-record-sets `
        --hosted-zone-id $ZONE_ID `
        --change-batch file://route53-change.json `
        --output json | ConvertFrom-Json
    
    $changeId = $changeResult.ChangeInfo.Id -replace '/change/', ''
    Write-Host "✅ Changement appliqué avec succès!" -ForegroundColor Green
    Write-Host "  Change ID: $changeId" -ForegroundColor White
    Write-Host "  Status: $($changeResult.ChangeInfo.Status)" -ForegroundColor White
    Write-Host ""
    Write-Host "⏳ Attendez 2-3 minutes pour la propagation DNS..." -ForegroundColor Yellow
    Write-Host ""
    
    # Vérifier le statut du changement
    Write-Host "📋 Vérification du statut du changement..." -ForegroundColor Yellow
    $status = "PENDING"
    $attempts = 0
    $maxAttempts = 10
    
    while ($status -eq "PENDING" -and $attempts -lt $maxAttempts) {
        Start-Sleep -Seconds 5
        $changeInfo = aws route53 get-change --id $changeId --output json | ConvertFrom-Json
        $status = $changeInfo.ChangeInfo.Status
        $attempts++
        Write-Host "  Tentative $attempts/$maxAttempts - Status: $status" -ForegroundColor Gray
    }
    
    if ($status -eq "INSYNC") {
        Write-Host "✅ Le changement est synchronisé!" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Le changement est toujours en cours..." -ForegroundColor Yellow
    }
    Write-Host ""
    
} catch {
    Write-Host "❌ Erreur lors de l'application du changement:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    exit 1
}

# Étape 8: Vérification finale
Write-Host "📋 Étape 8: Vérification finale..." -ForegroundColor Yellow
Write-Host "Attendez 2-3 minutes, puis testez:" -ForegroundColor White
Write-Host "  nslookup $DOMAIN" -ForegroundColor Gray
Write-Host "  Invoke-WebRequest -Uri https://$DOMAIN/health -Method GET" -ForegroundColor Gray
Write-Host ""

# Nettoyer le fichier temporaire
if (Test-Path "route53-change.json") {
    Remove-Item "route53-change.json"
    Write-Host "✅ Fichier temporaire supprimé" -ForegroundColor Green
}

Write-Host "✅ Script terminé!" -ForegroundColor Green

