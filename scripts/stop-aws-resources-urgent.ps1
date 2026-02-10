# Script URGENT : Arrêter/Réduire les ressources AWS coûteuses
# ⚠️ ATTENTION : Ce script va arrêter/réduire vos ressources AWS
# Sauvegardez vos données avant d'exécuter !

param(
    [string]$Region = "eu-west-1",
    [string]$ProjectName = "yukpomnang",
    [switch]$Confirm
)

Write-Host "🚨 ARRÊT URGENT DES RESSOURCES AWS" -ForegroundColor Red
Write-Host "===================================`n" -ForegroundColor Red

if (-not $Confirm) {
    Write-Host "⚠️  ATTENTION : Ce script va arrêter/réduire vos ressources AWS !" -ForegroundColor Yellow
    Write-Host "   Cela peut causer un downtime de votre application." -ForegroundColor Yellow
    Write-Host "`n   Pour continuer, exécutez :" -ForegroundColor White
    Write-Host "   .\scripts\stop-aws-resources-urgent.ps1 -Confirm" -ForegroundColor Cyan
    exit 1
}

Write-Host "✅ Mode confirmation activé`n" -ForegroundColor Green

# 1. Arrêter ECS Service
Write-Host "📊 1. Arrêt du service ECS..." -ForegroundColor Yellow
try {
    aws ecs update-service `
        --cluster "$ProjectName-cluster" `
        --service "$ProjectName-backend-service" `
        --desired-count 0 `
        --region $Region `
        --output json | Out-Null
    
    Write-Host "   ✅ Service ECS arrêté (desired-count = 0)" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Erreur lors de l'arrêt du service ECS" -ForegroundColor Yellow
    Write-Host "      Erreur : $_" -ForegroundColor Gray
}

Write-Host ""

# 2. Désactiver Performance Insights RDS
Write-Host "📊 2. Désactivation de Performance Insights sur RDS..." -ForegroundColor Yellow
try {
    aws rds modify-db-instance `
        --db-instance-identifier "$ProjectName-db" `
        --no-enable-performance-insights `
        --apply-immediately `
        --region $Region `
        --output json | Out-Null
    
    Write-Host "   ✅ Performance Insights désactivé (économise ~$10-15/mois)" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Erreur lors de la désactivation de Performance Insights" -ForegroundColor Yellow
    Write-Host "      Erreur : $_" -ForegroundColor Gray
}

Write-Host ""

# 3. Désactiver Container Insights
Write-Host "📊 3. Désactivation de Container Insights..." -ForegroundColor Yellow
try {
    aws ecs update-cluster-settings `
        --cluster "$ProjectName-cluster" `
        --settings name=containerInsights,value=disabled `
        --region $Region `
        --output json | Out-Null
    
    Write-Host "   ✅ Container Insights désactivé (économise ~$5-10/mois)" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Erreur lors de la désactivation de Container Insights" -ForegroundColor Yellow
    Write-Host "      Erreur : $_" -ForegroundColor Gray
}

Write-Host ""

# 4. Vérifier NAT Gateway
Write-Host "📊 4. Vérification du NAT Gateway..." -ForegroundColor Yellow
try {
    $natGateways = aws ec2 describe-nat-gateways `
        --region $Region `
        --filter "Name=tag:Name,Values=$ProjectName-nat-gateway" `
        --output json | ConvertFrom-Json
    
    if ($natGateways.NatGateways -and $natGateways.NatGateways.Count -gt 0) {
        $nat = $natGateways.NatGateways[0]
        Write-Host "   ⚠️  NAT Gateway trouvé : $($nat.NatGatewayId)" -ForegroundColor Yellow
        Write-Host "   💡 Pour le supprimer, utilisez Terraform :" -ForegroundColor Cyan
        Write-Host "      terraform apply -var='enable_nat_gateway=false'" -ForegroundColor White
        Write-Host "   💡 Économie : ~$35-45/mois" -ForegroundColor Green
    } else {
        Write-Host "   ✅ NAT Gateway déjà désactivé" -ForegroundColor Green
    }
} catch {
    Write-Host "   ⚠️  Impossible de vérifier NAT Gateway" -ForegroundColor Yellow
}

Write-Host ""

# 5. Réduire RDS (optionnel - nécessite downtime)
Write-Host "📊 5. Réduction de RDS..." -ForegroundColor Yellow
Write-Host "   ⚠️  ATTENTION : Réduire RDS nécessite un redémarrage (downtime ~10-15 min)" -ForegroundColor Yellow
Write-Host "   💡 Pour réduire RDS à db.t3.micro, utilisez :" -ForegroundColor Cyan
Write-Host "      aws rds modify-db-instance --db-instance-identifier $ProjectName-db --db-instance-class db.t3.micro --apply-immediately" -ForegroundColor White
Write-Host "   💡 Économie : ~$45-60/mois" -ForegroundColor Green

Write-Host ""

# 6. Résumé
Write-Host "📊 RÉSUMÉ DES ACTIONS" -ForegroundColor Cyan
Write-Host "===================`n" -ForegroundColor Cyan

Write-Host "✅ Actions effectuées :" -ForegroundColor Green
Write-Host "   - Service ECS arrêté (desired-count = 0)" -ForegroundColor White
Write-Host "   - Performance Insights désactivé" -ForegroundColor White
Write-Host "   - Container Insights désactivé" -ForegroundColor White

Write-Host "`n💡 Actions manuelles recommandées :" -ForegroundColor Yellow
Write-Host "   1. Réduire RDS à db.t3.micro (via AWS Console ou CLI)" -ForegroundColor White
Write-Host "   2. Désactiver NAT Gateway (via Terraform)" -ForegroundColor White
Write-Host "   3. Réduire ElastiCache à cache.t3.micro (via Terraform)" -ForegroundColor White

Write-Host "`n💰 Économie estimée : ~$50-75/mois immédiatement" -ForegroundColor Green
Write-Host "   + ~$80-100/mois avec actions manuelles" -ForegroundColor Green

Write-Host "`n📄 Voir SOLUTION_FACTURE_AWS_600_DOLLARS.md pour plus de détails" -ForegroundColor Cyan

