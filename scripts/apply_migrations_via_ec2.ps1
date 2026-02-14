# Script pour appliquer les migrations via EC2
# Utilise AWS Systems Manager Session Manager pour exécuter les commandes

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
# 2. CRÉER LE SCRIPT SQL SUR L'INSTANCE EC2
# ========================================
Write-Host "2. Préparation du script SQL sur l'instance EC2..." -ForegroundColor Yellow

# Lire le contenu du script SQL
$fixSqlContent = Get-Content -Path "scripts\fix_merchant_storage_locations.sql" -Raw -Encoding UTF8

# Créer un script bash qui sera exécuté sur EC2
$bashScript = @"
#!/bin/bash
set -e

echo "========================================"
echo "  APPLICATION MIGRATIONS VIA EC2"
echo "========================================"
echo ""

# Récupérer DATABASE_URL depuis l'environnement
DATABASE_URL="$databaseUrl"

if [ -z "\$DATABASE_URL" ]; then
    echo "ERREUR: DATABASE_URL non définie"
    exit 1
fi

echo "Base de données: \$(echo \$DATABASE_URL | sed -n 's#.*@\([^:]*\):.*#\1#p')"
echo ""

# ========================================
# ÉTAPE 1: Créer merchant_storage_locations
# ========================================
echo "ÉTAPE 1: Création de merchant_storage_locations..."
cat > /tmp/fix_merchant_storage_locations.sql << 'EOFSQL'
$fixSqlContent
EOFSQL

psql "\$DATABASE_URL" -f /tmp/fix_merchant_storage_locations.sql

if [ \$? -eq 0 ]; then
    echo "OK: merchant_storage_locations créée ou existe déjà"
else
    echo "ATTENTION: Erreur (peut-être existe déjà)"
fi
echo ""

# ========================================
# ÉTAPE 2: Vérifier si sqlx est disponible
# ========================================
echo "ÉTAPE 2: Vérification de sqlx..."
if command -v sqlx &> /dev/null; then
    echo "OK: sqlx disponible"
    SQLX_AVAILABLE=true
else
    echo "ATTENTION: sqlx non disponible, installation..."
    # Installer sqlx-cli
    if command -v cargo &> /dev/null; then
        cargo install sqlx-cli --no-default-features --features postgres
        SQLX_AVAILABLE=true
    else
        echo "ERREUR: cargo non disponible, impossible d'installer sqlx"
        SQLX_AVAILABLE=false
    fi
fi
echo ""

# ========================================
# ÉTAPE 3: Appliquer les migrations SQLx
# ========================================
if [ "\$SQLX_AVAILABLE" = "true" ]; then
    echo "ÉTAPE 3: Application des migrations SQLx..."
    
    # Cloner ou mettre à jour le repo si nécessaire
    if [ ! -d "/tmp/yukpomnang2" ]; then
        echo "Clonage du repo..."
        cd /tmp
        git clone https://github.com/Her50/yukpo4.git yukpomnang2 || echo "ATTENTION: Erreur clonage (peut-être existe déjà)"
    else
        echo "Mise à jour du repo..."
        cd /tmp/yukpomnang2
        git pull || echo "ATTENTION: Erreur pull"
    fi
    
    cd /tmp/yukpomnang2/backend
    export DATABASE_URL="\$DATABASE_URL"
    
    echo "Exécution de: sqlx migrate run"
    sqlx migrate run
    
    if [ \$? -eq 0 ]; then
        echo "OK: Migrations appliquées avec succès!"
    else
        echo "ERREUR: Échec de l'application des migrations"
        exit 1
    fi
else
    echo "ATTENTION: sqlx non disponible, migrations non appliquées"
    echo "  Les migrations seront appliquées au démarrage de l'application ECS"
fi
echo ""

# ========================================
# ÉTAPE 4: Vérification finale
# ========================================
echo "ÉTAPE 4: Vérification finale..."
TABLES_COUNT=\$(psql "\$DATABASE_URL" -t -c "
    SELECT COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';
" | tr -d ' ')

echo "Nombre de tables créées: \$TABLES_COUNT"
echo ""

# Vérifier les tables critiques
echo "Vérification des tables critiques:"
for table in users services deliveries merchant_storage_locations; do
    EXISTS=\$(psql "\$DATABASE_URL" -t -c "
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '\$table'
        );
    " | tr -d ' ')
    
    if [ "\$EXISTS" = "t" ]; then
        echo "  OK: \$table"
    else
        echo "  ERREUR: \$table (MANQUANTE)"
    fi
done

echo ""
echo "========================================"
echo "  APPLICATION TERMINÉE"
echo "========================================"
"@

# Sauvegarder le script bash temporairement
$bashScriptPath = "scripts/temp_apply_migrations_ec2.sh"
$bashScript | Out-File -FilePath $bashScriptPath -Encoding UTF8 -NoNewline

Write-Host "  OK: Script bash créé: $bashScriptPath" -ForegroundColor Green
Write-Host ""

# ========================================
# 3. EXÉCUTER LE SCRIPT SUR L'INSTANCE EC2
# ========================================
Write-Host "3. Exécution du script sur l'instance EC2..." -ForegroundColor Yellow
Write-Host "  (Cela peut prendre quelques minutes...)" -ForegroundColor Gray
Write-Host ""

# Copier le script sur l'instance EC2 via SSM
Write-Host "  Copie du script sur l'instance..." -ForegroundColor Gray

# Lire le contenu du script et l'encoder en base64 pour éviter les problèmes d'échappement
$scriptContent = Get-Content -Path $bashScriptPath -Raw -Encoding UTF8
$scriptBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($scriptContent))

# Créer une commande qui décode et exécute le script
$command = @"
echo '$scriptBase64' | base64 -d > /tmp/apply_migrations.sh && chmod +x /tmp/apply_migrations.sh && /tmp/apply_migrations.sh
"@

Write-Host "  Exécution de la commande..." -ForegroundColor Gray
Write-Host ""

# Exécuter via SSM
$commandId = aws ssm send-command `
    --instance-ids $instanceId `
    --document-name "AWS-RunShellScript" `
    --parameters "commands=[$command]" `
    --region $region `
    --output text `
    --query 'Command.CommandId' 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERREUR: Impossible d'envoyer la commande SSM" -ForegroundColor Red
    Write-Host "  Sortie: $commandId" -ForegroundColor Red
    exit 1
}

Write-Host "  OK: Commande envoyée (Command ID: $commandId)" -ForegroundColor Green
Write-Host ""

# Attendre la fin de l'exécution
Write-Host "  Attente de l'exécution..." -ForegroundColor Gray
$maxWait = 300  # 5 minutes max
$waited = 0
$interval = 5

do {
    Start-Sleep -Seconds $interval
    $waited += $interval
    
    $status = aws ssm get-command-invocation `
        --command-id $commandId `
        --instance-id $instanceId `
        --region $region `
        --query 'Status' `
        --output text 2>&1
    
    if ($status -eq "Success") {
        Write-Host "  OK: Commande exécutée avec succès" -ForegroundColor Green
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
Write-Host "4. Récupération de la sortie..." -ForegroundColor Yellow
$output = aws ssm get-command-invocation `
    --command-id $commandId `
    --instance-id $instanceId `
    --region $region `
    --query 'StandardOutputContent' `
    --output text 2>&1

$errorOutput = aws ssm get-command-invocation `
    --command-id $commandId `
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

# Nettoyer le fichier temporaire
Remove-Item -Path $bashScriptPath -ErrorAction SilentlyContinue

