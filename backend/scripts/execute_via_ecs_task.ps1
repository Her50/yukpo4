# Script pour executer les scripts SQL via une task ECS one-shot
# Date: 2026-01-30

param(
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$TaskDefinition = "yukpomnang-backend:3",
    [string]$Region = "us-east-1",
    [switch]$AutoConfirm
)

Write-Host "Execution des scripts SQL via task ECS one-shot" -ForegroundColor Cyan
Write-Host ""

# DATABASE_URL
$databaseUrl = "postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/yukpomnang"

# Creer un script bash qui sera execute dans le conteneur
$bashScript = @"
#!/bin/bash
set -e

export DATABASE_URL="$databaseUrl"
export PGPASSWORD="SztViedrXvuBDyj16TWaIAs25FfUColh"
export PGSSLMODE="require"

echo "============================================================"
echo "ETAPE 1: DIAGNOSTIC"
echo "============================================================"
echo ""

cd /app/backend/scripts || cd /backend/scripts || pwd

if [ -f diagnostic_migrations_aws.sql ]; then
    echo "Execution du script de diagnostic..."
    psql `$DATABASE_URL -f diagnostic_migrations_aws.sql || echo "Erreurs detectees (continuation...)"
    echo ""
else
    echo "ERREUR: Script diagnostic_migrations_aws.sql non trouve"
    exit 1
fi

echo "============================================================"
echo "ETAPE 2: CORRECTION"
echo "============================================================"
echo ""

if [ -f fix_migrations_aws.sql ]; then
    echo "Execution du script de correction..."
    psql `$DATABASE_URL -f fix_migrations_aws.sql
    echo ""
else
    echo "ERREUR: Script fix_migrations_aws.sql non trouve"
    exit 1
fi

echo "============================================================"
echo "ETAPE 3: VERIFICATION FINALE"
echo "============================================================"
echo ""

echo "Execution du diagnostic final..."
psql `$DATABASE_URL -f diagnostic_migrations_aws.sql || echo "Erreurs detectees"
echo ""

echo "============================================================"
echo "PROCESSUS TERMINE"
echo "============================================================"
"@

# Encoder le script en base64 pour le passer en variable d'environnement
$scriptBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($bashScript))

Write-Host "Lancement d'une task ECS one-shot..." -ForegroundColor Yellow
Write-Host ""

# Creer la task avec le script en commande
$taskOutput = aws ecs run-task `
    --region $Region `
    --cluster $ClusterName `
    --task-definition $TaskDefinition `
    --launch-type FARGATE `
    --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" `
    --overrides "{
        `"containerOverrides`": [{
            `"name`": `"backend`",
            `"command`": [`"sh`", `"-c`", `"echo '$scriptBase64' | base64 -d | sh`"]
        }]
    }" 2>&1

# Note: Les subnets et security groups doivent etre recuperes depuis la configuration du service
# Pour l'instant, utilisons une approche plus simple avec un script inline

Write-Host "Note: Cette methode necessite de connaitre les subnets et security groups du VPC" -ForegroundColor Yellow
Write-Host ""
Write-Host "Alternative: Utiliser AWS CloudShell qui a acces au VPC" -ForegroundColor Cyan
Write-Host "  1. Ouvrir AWS CloudShell depuis la console AWS" -ForegroundColor Gray
Write-Host "  2. Cloner le repo dans CloudShell" -ForegroundColor Gray
Write-Host "  3. Executer les scripts depuis CloudShell" -ForegroundColor Gray






