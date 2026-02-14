# Script PowerShell simplifie pour mettre a jour le DNS Route53
# Date: 2026-02-14

Write-Host "Verification et Mise a Jour DNS Route53" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$REGION = "eu-west-1"
$DOMAIN = "api.yukpomnang.com"
$ZONE_NAME = "yukpomnang.com"

# Etape 1: Verifier le DNS actuel
Write-Host "Etape 1: Verification DNS actuel..." -ForegroundColor Yellow
nslookup $DOMAIN
Write-Host ""

# Etape 2: Verifier si le Load Balancer existe
Write-Host "Etape 2: Recherche du Load Balancer..." -ForegroundColor Yellow
try {
    $lbOutput = aws elbv2 describe-load-balancers --region $REGION --query 'LoadBalancers[?contains(LoadBalancerName, `yukpo`) || contains(LoadBalancerName, `backend`)][*].[LoadBalancerName,DNSName,State.Code,LoadBalancerArn]' --output json
    $loadBalancers = $lbOutput | ConvertFrom-Json

    if ($loadBalancers -and $loadBalancers.Count -gt 0) {
        Write-Host "Load Balancer trouve:" -ForegroundColor Green
        $ALB_NAME = $loadBalancers[0][0]
        $ALB_DNS_NAME = $loadBalancers[0][1]
        $ALB_STATE = $loadBalancers[0][2]
        $ALB_ARN = $loadBalancers[0][3]
        
        Write-Host "  Nom: $ALB_NAME" -ForegroundColor White
        Write-Host "  DNS: $ALB_DNS_NAME" -ForegroundColor White
        Write-Host "  Etat: $ALB_STATE" -ForegroundColor White
        Write-Host ""
        
        $ALB_HOSTED_ZONE_ID = aws elbv2 describe-load-balancers --region $REGION --load-balancer-arns $ALB_ARN --query 'LoadBalancers[0].CanonicalHostedZoneId' --output text
        Write-Host "  Hosted Zone ID: $ALB_HOSTED_ZONE_ID" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "Aucun Load Balancer trouve!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Solution:" -ForegroundColor Yellow
        Write-Host "  1. Activer le Load Balancer dans Terraform" -ForegroundColor White
        Write-Host "  2. Appliquer Terraform: terraform apply" -ForegroundColor White
        Write-Host ""
        exit 1
    }
} catch {
    Write-Host "Erreur lors de la recherche du Load Balancer:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    exit 1
}

# Etape 3: Trouver la Zone Hebergee Route53
Write-Host "Etape 3: Recherche de la Zone Hebergee Route53..." -ForegroundColor Yellow
try {
    $zonesOutput = aws route53 list-hosted-zones --query "HostedZones[?Name=='${ZONE_NAME}.'].[Id,Name]" --output json
    $zones = $zonesOutput | ConvertFrom-Json
    
    if ($zones -and $zones.Count -gt 0) {
        $ZONE_ID = $zones[0][0] -replace '/hostedzone/', ''
        Write-Host "Zone hebergee trouvee:" -ForegroundColor Green
        Write-Host "  ID: $ZONE_ID" -ForegroundColor White
        Write-Host "  Nom: $($zones[0][1])" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "Zone hebergee '$ZONE_NAME' non trouvee!" -ForegroundColor Red
        Write-Host ""
        exit 1
    }
} catch {
    Write-Host "Erreur lors de la recherche de la zone hebergee:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    exit 1
}

# Etape 4: Verifier l'enregistrement actuel
Write-Host "Etape 4: Verification de l'enregistrement actuel..." -ForegroundColor Yellow
try {
    $currentRecordOutput = aws route53 list-resource-record-sets --hosted-zone-id $ZONE_ID --query "ResourceRecordSets[?Name=='${DOMAIN}.']" --output json
    $currentRecord = $currentRecordOutput | ConvertFrom-Json
    
    if ($currentRecord -and $currentRecord.Count -gt 0) {
        Write-Host "Enregistrement actuel trouve:" -ForegroundColor Cyan
        Write-Host "  Nom: $($currentRecord[0].Name)" -ForegroundColor White
        Write-Host "  Type: $($currentRecord[0].Type)" -ForegroundColor White
        if ($currentRecord[0].AliasTarget) {
            Write-Host "  Alias Target: $($currentRecord[0].AliasTarget.DNSName)" -ForegroundColor White
        }
        Write-Host ""
    } else {
        Write-Host "Aucun enregistrement trouve pour $DOMAIN" -ForegroundColor Yellow
        Write-Host "Un nouvel enregistrement sera cree." -ForegroundColor White
        Write-Host ""
    }
} catch {
    Write-Host "Impossible de recuperer l'enregistrement actuel" -ForegroundColor Yellow
    Write-Host ""
}

# Etape 5: Demander confirmation
Write-Host "Etape 5: Preparation de la mise a jour..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Configuration a appliquer:" -ForegroundColor Cyan
Write-Host "  Domaine: $DOMAIN" -ForegroundColor White
Write-Host "  Type: A (Alias)" -ForegroundColor White
Write-Host "  Target: $ALB_DNS_NAME" -ForegroundColor White
Write-Host "  Hosted Zone ID: $ALB_HOSTED_ZONE_ID" -ForegroundColor White
Write-Host ""

$confirmation = Read-Host "Voulez-vous mettre a jour le DNS maintenant? (O/N)"

if ($confirmation -ne "O" -and $confirmation -ne "o" -and $confirmation -ne "Y" -and $confirmation -ne "y") {
    Write-Host "Mise a jour annulee." -ForegroundColor Yellow
    exit 0
}

# Etape 6: Creer le fichier JSON
Write-Host "Etape 6: Creation du fichier de changement..." -ForegroundColor Yellow
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
Write-Host "Fichier cree: route53-change.json" -ForegroundColor Green
Write-Host ""

# Etape 7: Appliquer le changement
Write-Host "Etape 7: Application du changement Route53..." -ForegroundColor Yellow
try {
    $changeResultOutput = aws route53 change-resource-record-sets --hosted-zone-id $ZONE_ID --change-batch file://route53-change.json --output json
    $changeResult = $changeResultOutput | ConvertFrom-Json
    
    $changeId = $changeResult.ChangeInfo.Id -replace '/change/', ''
    Write-Host "Changement applique avec succes!" -ForegroundColor Green
    Write-Host "  Change ID: $changeId" -ForegroundColor White
    Write-Host "  Status: $($changeResult.ChangeInfo.Status)" -ForegroundColor White
    Write-Host ""
    Write-Host "Attendez 2-3 minutes pour la propagation DNS..." -ForegroundColor Yellow
    Write-Host ""
} catch {
    Write-Host "Erreur lors de l'application du changement:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    exit 1
}

# Etape 8: Verification finale
Write-Host "Etape 8: Verification finale..." -ForegroundColor Yellow
Write-Host "Attendez 2-3 minutes, puis testez:" -ForegroundColor White
Write-Host "  nslookup $DOMAIN" -ForegroundColor Gray
Write-Host "  Invoke-WebRequest -Uri https://$DOMAIN/health -Method GET" -ForegroundColor Gray
Write-Host ""

# Nettoyer
if (Test-Path "route53-change.json") {
    Remove-Item "route53-change.json"
    Write-Host "Fichier temporaire supprime" -ForegroundColor Green
}

Write-Host "Script termine!" -ForegroundColor Green

