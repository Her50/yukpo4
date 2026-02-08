# Script pour appliquer le script de correction des tables/fonctions manquantes via ECS Task
# Date: 2026-02-07

param(
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$TaskDefinition = "yukpomnang-backend:3",
    [string]$Region = "us-east-1",
    [switch]$AutoConfirm
)

Write-Host "🚀 Application du script de correction via ECS Task" -ForegroundColor Cyan
Write-Host ""

# DATABASE_URL AWS RDS
$databaseUrl = "postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/yukpomnang"

# Créer un script bash qui sera exécuté dans le conteneur
$bashScript = @"
#!/bin/bash
set -e

export DATABASE_URL="$databaseUrl?sslmode=require"
export PGPASSWORD="SztViedrXvuBDyj16TWaIAs25FfUColh"
export PGSSLMODE="require"

echo "============================================================"
echo "🔧 APPLICATION DU SCRIPT DE CORRECTION"
echo "============================================================"
echo ""
echo "Ce script va:"
echo "  1. Créer la table user_saved_addresses"
echo "  2. Créer la fonction calculate_best_vector_match_score"
echo "  3. Créer la fonction product_combination_exists"
echo "  4. Corriger l'index unique pour services_search_optimized_v2"
echo ""

cd /app/backend || cd /backend || pwd

if [ -f migrations/20260207_fix_all_missing_tables_and_functions.sql ]; then
    echo "✅ Script trouvé: migrations/20260207_fix_all_missing_tables_and_functions.sql"
    echo ""
    echo "📄 Exécution du script SQL..."
    psql `$DATABASE_URL -f migrations/20260207_fix_all_missing_tables_and_functions.sql
    echo ""
    echo "✅ Script exécuté avec succès!"
    echo ""
    echo "🔍 Vérification des résultats..."
    echo ""
    
    # Vérifier la table
    psql `$DATABASE_URL -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_saved_addresses') as table_exists;" -t
    echo ""
    
    # Vérifier les fonctions
    psql `$DATABASE_URL -c "SELECT proname FROM pg_proc WHERE proname IN ('calculate_best_vector_match_score', 'product_combination_exists');" -t
    echo ""
    
    # Vérifier l'index
    psql `$DATABASE_URL -c "SELECT indexname FROM pg_indexes WHERE tablename = 'services_search_optimized_v2' AND indexname = 'idx_services_search_optimized_v2_unique';" -t
    echo ""
    
    echo "🎉 Correction terminée!"
else
    echo "❌ ERREUR: Script migrations/20260207_fix_all_missing_tables_and_functions.sql non trouvé"
    echo "   Chemins vérifiés:"
    echo "   - /app/backend/migrations/"
    echo "   - /backend/migrations/"
    echo "   - $(pwd)/migrations/"
    exit 1
fi
"@

# Créer un fichier temporaire avec le script bash
$tempScript = [System.IO.Path]::GetTempFileName()
$bashScript | Out-File -FilePath $tempScript -Encoding UTF8

Write-Host "📋 Configuration:" -ForegroundColor Yellow
Write-Host "   Cluster: $ClusterName"
Write-Host "   Task Definition: $TaskDefinition"
Write-Host "   Region: $Region"
Write-Host ""

if (-not $AutoConfirm) {
    $confirm = Read-Host "Voulez-vous continuer? (O/N)"
    if ($confirm -ne "O" -and $confirm -ne "o") {
        Write-Host "❌ Annulé par l'utilisateur" -ForegroundColor Red
        Remove-Item $tempScript -ErrorAction SilentlyContinue
        exit 0
    }
}

Write-Host "🚀 Lancement de la tâche ECS..." -ForegroundColor Green

try {
    # Exécuter la tâche ECS
    $taskResponse = aws ecs run-task `
        --cluster $ClusterName `
        --task-definition $TaskDefinition `
        --region $Region `
        --launch-type FARGATE `
        --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" `
        --overrides "{\"containerOverrides\":[{\"name\":\"backend\",\"command\":[\"bash\",\"-c\",\"$(Get-Content $tempScript -Raw)\"]}]}" `
        2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Tâche ECS lancée avec succès!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 Pour voir les logs:" -ForegroundColor Cyan
        Write-Host "   aws logs tail /aws/ecs/$ClusterName --follow --region $Region"
    } else {
        Write-Host "❌ Erreur lors du lancement de la tâche ECS" -ForegroundColor Red
        Write-Host $taskResponse
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
} finally {
    Remove-Item $tempScript -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "💡 Alternative: Exécuter manuellement sur une instance EC2" -ForegroundColor Yellow
Write-Host "   1. Se connecter à une instance EC2 dans le même VPC"
Write-Host "   2. Exécuter: psql `$DATABASE_URL -f migrations/20260207_fix_all_missing_tables_and_functions.sql"



