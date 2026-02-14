# Script simplifié pour appliquer les migrations via EC2
# Utilise AWS Systems Manager pour exécuter les commandes directement

$ErrorActionPreference = "Stop"

$region = "eu-west-1"
$instanceId = "i-0b9ad404f8d738d04"
$secretId = "yukpo/backend/secrets"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  APPLICATION MIGRATIONS VIA EC2" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Instance EC2: $instanceId" -ForegroundColor White
Write-Host "Region: $region" -ForegroundColor White
Write-Host ""

# ========================================
# 1. RÉCUPÉRER DATABASE_URL
# ========================================
Write-Host "1. Récupération de DATABASE_URL depuis Secrets Manager..." -ForegroundColor Yellow

try {
    $secret = aws secretsmanager get-secret-value --secret-id $secretId --region $region --query 'SecretString' --output text 2>&1 | ConvertFrom-Json
    
    if ($secret.DATABASE_URL) {
        $databaseUrl = $secret.DATABASE_URL
        Write-Host "  OK: DATABASE_URL récupérée" -ForegroundColor Green
    } else {
        Write-Host "  ERREUR: DATABASE_URL non trouvée dans le secret" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ERREUR: Impossible de récupérer DATABASE_URL: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ========================================
# 2. COPIER LE SCRIPT SQL SUR L'INSTANCE
# ========================================
Write-Host "2. Copie du script SQL sur l'instance EC2..." -ForegroundColor Yellow

# Lire le contenu du script SQL
$fixSqlContent = Get-Content -Path "scripts\fix_merchant_storage_locations.sql" -Raw -Encoding UTF8

# Encoder en base64 pour éviter les problèmes d'échappement
$fixSqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($fixSqlContent))

# Commande pour copier le script SQL
$copySqlCommand = "echo '$fixSqlBase64' | base64 -d > /tmp/fix_merchant_storage_locations.sql"

Write-Host "  Exécution de la commande de copie..." -ForegroundColor Gray
$copyCommandId = aws ssm send-command --instance-ids $instanceId --document-name "AWS-RunShellScript" --parameters "{\"commands\":[\"$copySqlCommand\"]}" --region $region --output text --query 'Command.CommandId' 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERREUR: Impossible de copier le script SQL" -ForegroundColor Red
    exit 1
}

Write-Host "  OK: Script SQL copié (Command ID: $copyCommandId)" -ForegroundColor Green

# Attendre la fin de la copie
Start-Sleep -Seconds 3

Write-Host ""

# ========================================
# 3. CRÉER MERCHANT_STORAGE_LOCATIONS
# ========================================
Write-Host "3. Création de merchant_storage_locations..." -ForegroundColor Yellow

$createTableCommand = "export DATABASE_URL='$databaseUrl' && psql `$DATABASE_URL -f /tmp/fix_merchant_storage_locations.sql"

Write-Host "  Exécution de la commande..." -ForegroundColor Gray
$createCommandId = aws ssm send-command --instance-ids $instanceId --document-name "AWS-RunShellScript" --parameters "{\"commands\":[\"$createTableCommand\"]}" --region $region --output text --query 'Command.CommandId' 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERREUR: Impossible d'exécuter la commande" -ForegroundColor Red
    exit 1
}

Write-Host "  OK: Commande envoyée (Command ID: $createCommandId)" -ForegroundColor Green

# Attendre la fin de l'exécution
Write-Host "  Attente de l'exécution..." -ForegroundColor Gray
$maxWait = 60
$waited = 0
$interval = 2

do {
    Start-Sleep -Seconds $interval
    $waited += $interval
    
    $status = aws ssm get-command-invocation `
        --command-id $createCommandId `
        --instance-id $instanceId `
        --region $region `
        --query 'Status' `
        --output text 2>&1
    
    if ($status -eq "Success") {
        Write-Host "  OK: Table créée avec succès" -ForegroundColor Green
        break
    } elseif ($status -eq "Failed" -or $status -eq "Cancelled") {
        Write-Host "  ATTENTION: Commande échouée (Status: $status)" -ForegroundColor Yellow
        # Continuer quand même (peut-être que la table existe déjà)
        break
    }
    
    if ($waited -ge $maxWait) {
        Write-Host "  ATTENTION: Timeout" -ForegroundColor Yellow
        break
    }
} while ($true)

# Afficher la sortie
$output = aws ssm get-command-invocation `
    --command-id $createCommandId `
    --instance-id $instanceId `
    --region $region `
    --query 'StandardOutputContent' `
    --output text 2>&1

if ($output) {
    Write-Host "  Sortie: $output" -ForegroundColor Gray
}

Write-Host ""

# ========================================
# 4. APPLIQUER LES MIGRATIONS SQLX
# ========================================
Write-Host "4. Application des migrations SQLx..." -ForegroundColor Yellow

# Commande pour installer sqlx si nécessaire et appliquer les migrations
$migrateCommand = @"
export DATABASE_URL='$databaseUrl'
if ! command -v sqlx &> /dev/null; then
    echo "Installation de sqlx-cli..."
    if command -v cargo &> /dev/null; then
        cargo install sqlx-cli --no-default-features --features postgres
    else
        echo "ERREUR: cargo non disponible"
        exit 1
    fi
fi

# Cloner ou mettre à jour le repo
if [ ! -d "/tmp/yukpomnang2" ]; then
    cd /tmp
    git clone https://github.com/Her50/yukpo4.git yukpomnang2 || true
else
    cd /tmp/yukpomnang2
    git pull || true
fi

cd /tmp/yukpomnang2/backend
export DATABASE_URL="\$DATABASE_URL"
echo "Exécution de: sqlx migrate run"
sqlx migrate run
"@

Write-Host "  Exécution de la commande..." -ForegroundColor Gray
Write-Host "  (Cela peut prendre plusieurs minutes...)" -ForegroundColor Gray

# Échapper les guillemets dans la commande pour JSON
$migrateCommandEscaped = $migrateCommand -replace '"', '\"' -replace "`n", '\n' -replace "`r", ''

$migrateCommandId = aws ssm send-command --instance-ids $instanceId --document-name "AWS-RunShellScript" --parameters "{\"commands\":[\"$migrateCommandEscaped\"]}" --region $region --timeout-seconds 600 --output text --query 'Command.CommandId' 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERREUR: Impossible d'envoyer la commande" -ForegroundColor Red
    exit 1
}

Write-Host "  OK: Commande envoyée (Command ID: $migrateCommandId)" -ForegroundColor Green

# Attendre la fin de l'exécution
Write-Host "  Attente de l'exécution..." -ForegroundColor Gray
$maxWait = 600  # 10 minutes max
$waited = 0
$interval = 10

do {
    Start-Sleep -Seconds $interval
    $waited += $interval
    
    $status = aws ssm get-command-invocation `
        --command-id $migrateCommandId `
        --instance-id $instanceId `
        --region $region `
        --query 'Status' `
        --output text 2>&1
    
    if ($status -eq "Success") {
        Write-Host "  OK: Migrations appliquées avec succès!" -ForegroundColor Green
        break
    } elseif ($status -eq "Failed" -or $status -eq "Cancelled") {
        Write-Host "  ERREUR: Commande échouée (Status: $status)" -ForegroundColor Red
        break
    }
    
    if ($waited -ge $maxWait) {
        Write-Host "  ATTENTION: Timeout (plus de $maxWait secondes)" -ForegroundColor Yellow
        break
    }
    
    Write-Host "  En attente... ($waited/$maxWait secondes)" -ForegroundColor Gray
} while ($true)

Write-Host ""

# Récupérer la sortie
Write-Host "5. Récupération de la sortie..." -ForegroundColor Yellow
$output = aws ssm get-command-invocation `
    --command-id $migrateCommandId `
    --instance-id $instanceId `
    --region $region `
    --query 'StandardOutputContent' `
    --output text 2>&1

$errorOutput = aws ssm get-command-invocation `
    --command-id $migrateCommandId `
    --instance-id $instanceId `
    --region $region `
    --query 'StandardErrorContent' `
    --output text 2>&1

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SORTIE DE LA COMMANDE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($output) {
    Write-Host $output
}

if ($errorOutput) {
    Write-Host "ERREURS:" -ForegroundColor Red
    Write-Host $errorOutput -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  APPLICATION TERMINÉE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

