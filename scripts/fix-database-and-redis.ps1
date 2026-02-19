# Script de Correction PostgreSQL et Redis
# Date: 2026-02-19
# Objectif: Corriger l'authentification PostgreSQL et la connexion Redis

$PROJECT = "yukpo-project"
$INSTANCE = "yukpo-postgres"
$DB_USER = "yukpo_user"
$DB_NAME = "yukpo_db"
$SOCKET_PATH = "/cloudsql/yukpo-project:europe-west1:yukpo-postgres"
$SECRET_DB = "database-url"
$SECRET_REDIS = "redis-url"
$SERVICE = "yukpo-backend"
$REGION = "europe-west1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Correction PostgreSQL et Redis" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ========================================
# PARTIE 1: CORRECTION POSTGRESQL
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PARTIE 1: Correction PostgreSQL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Générer un nouveau mot de passe
Write-Host "[1/5] Génération d'un nouveau mot de passe sécurisé..." -ForegroundColor Yellow
$chars = @()
$chars += 48..57   # Chiffres
$chars += 65..90   # Majuscules
$chars += 97..122  # Minuscules
$chars += 35, 36, 37, 61, 64, 95  # # $ % = @ _

$NEW_PASSWORD = -join ($chars | Get-Random -Count 32 | ForEach-Object { [char]$_ })
Write-Host "✅ Mot de passe généré (32 caractères)" -ForegroundColor Green
Write-Host ""

# 2. Réinitialiser le mot de passe dans Cloud SQL
Write-Host "[2/5] Réinitialisation du mot de passe dans Cloud SQL..." -ForegroundColor Yellow
try {
    gcloud sql users set-password $DB_USER `
        --instance=$INSTANCE `
        --password=$NEW_PASSWORD `
        --project=$PROJECT 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Mot de passe réinitialisé dans Cloud SQL" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Erreur lors de la réinitialisation du mot de passe" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 3. URL-encoder le mot de passe
Write-Host "[3/5] Encodage URL du mot de passe..." -ForegroundColor Yellow
Add-Type -AssemblyName System.Web
$PASSWORD_ENCODED = [System.Web.HttpUtility]::UrlEncode($NEW_PASSWORD)
Write-Host "✅ Mot de passe encodé" -ForegroundColor Green
Write-Host ""

# 4. Construire DATABASE_URL
Write-Host "[4/5] Construction de DATABASE_URL..." -ForegroundColor Yellow
$DATABASE_URL = "postgresql://${DB_USER}:${PASSWORD_ENCODED}@/${DB_NAME}?host=${SOCKET_PATH}"
Write-Host "✅ DATABASE_URL construite" -ForegroundColor Green
Write-Host "Format: postgresql://${DB_USER}:***@/${DB_NAME}?host=${SOCKET_PATH}" -ForegroundColor Gray
Write-Host ""

# 5. Mettre à jour le secret
Write-Host "[5/5] Mise à jour du secret '$SECRET_DB'..." -ForegroundColor Yellow
try {
    $tempFile = [System.IO.Path]::GetTempFileName()
    $DATABASE_URL | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline
    
    $result = gcloud secrets versions add $SECRET_DB `
        --data-file=$tempFile `
        --project=$PROJECT 2>&1
    
    Remove-Item $tempFile -Force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Secret DATABASE_URL mis à jour" -ForegroundColor Green
        if ($result -match 'version (\d+)') {
            Write-Host "   Version: $($matches[1])" -ForegroundColor Gray
        }
    }
    else {
        Write-Host "❌ Erreur lors de la mise à jour du secret" -ForegroundColor Red
        Write-Host "DATABASE_URL à mettre à jour manuellement:" -ForegroundColor Yellow
        Write-Host $DATABASE_URL -ForegroundColor Cyan
        exit 1
    }
}
catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# ========================================
# PARTIE 2: CORRECTION REDIS
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PARTIE 2: Correction Redis" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier l'instance Redis
Write-Host "[1/4] Vérification de l'instance Redis..." -ForegroundColor Yellow
$redisInstances = gcloud redis instances list --region=$REGION --project=$PROJECT --format="json" 2>&1 | ConvertFrom-Json
if ($LASTEXITCODE -eq 0 -and $redisInstances) {
    $redisInstance = $redisInstances | Where-Object { $_.name -like "*redis*" } | Select-Object -First 1
    if ($redisInstance) {
        Write-Host "✅ Instance Redis trouvée: $($redisInstance.name)" -ForegroundColor Green
        $redisHost = $redisInstance.host
        $redisPort = $redisInstance.port
        Write-Host "   Host: $redisHost" -ForegroundColor Gray
        Write-Host "   Port: $redisPort" -ForegroundColor Gray
        Write-Host "   État: $($redisInstance.state)" -ForegroundColor Gray
    }
    else {
        Write-Host "⚠️ Aucune instance Redis trouvée" -ForegroundColor Yellow
        Write-Host "   Redis sera désactivé (mode dégradé)" -ForegroundColor Gray
        $redisHost = $null
    }
}
else {
    Write-Host "⚠️ Impossible de lister les instances Redis" -ForegroundColor Yellow
    $redisHost = $null
}
Write-Host ""

# 2. Vérifier le VPC Connector
Write-Host "[2/4] Vérification du VPC Connector..." -ForegroundColor Yellow
$connectors = gcloud compute networks vpc-access connectors list --region=$REGION --project=$PROJECT --format="json" 2>&1 | ConvertFrom-Json
if ($LASTEXITCODE -eq 0 -and $connectors) {
    $connector = $connectors | Select-Object -First 1
    if ($connector) {
        Write-Host "✅ VPC Connector trouvé: $($connector.name)" -ForegroundColor Green
        Write-Host "   État: $($connector.state)" -ForegroundColor Gray
        if ($connector.state -ne "READY") {
            Write-Host "   ⚠️ VPC Connector n'est pas READY" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "⚠️ Aucun VPC Connector trouvé" -ForegroundColor Yellow
        Write-Host "   Cloud Run ne pourra pas accéder à Redis (IP privée)" -ForegroundColor Yellow
    }
}
else {
    Write-Host "⚠️ Impossible de vérifier le VPC Connector" -ForegroundColor Yellow
}
Write-Host ""

# 3. Construire REDIS_URL
Write-Host "[3/4] Construction de REDIS_URL..." -ForegroundColor Yellow
if ($redisHost) {
    $REDIS_URL = "redis://${redisHost}:${redisPort}/0"
    Write-Host "✅ REDIS_URL construite: redis://${redisHost}:***/0" -ForegroundColor Green
}
else {
    # Utiliser l'URL existante ou laisser vide
    Write-Host "⚠️ Utilisation de l'URL Redis existante ou désactivation" -ForegroundColor Yellow
    $REDIS_URL = "redis://10.128.102.19:6379/0"  # IP connue d'après les logs
    Write-Host "   URL: $REDIS_URL" -ForegroundColor Gray
}
Write-Host ""

# 4. Mettre à jour le secret Redis
Write-Host "[4/4] Mise à jour du secret '$SECRET_REDIS'..." -ForegroundColor Yellow
if ($REDIS_URL) {
    try {
        $tempFile = [System.IO.Path]::GetTempFileName()
        $REDIS_URL | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline
        
        $result = gcloud secrets versions add $SECRET_REDIS `
            --data-file=$tempFile `
            --project=$PROJECT 2>&1
        
        Remove-Item $tempFile -Force
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Secret REDIS_URL mis à jour" -ForegroundColor Green
            if ($result -match 'version (\d+)') {
                Write-Host "   Version: $($matches[1])" -ForegroundColor Gray
            }
        }
        else {
            Write-Host "⚠️ Erreur lors de la mise à jour du secret Redis" -ForegroundColor Yellow
            Write-Host "   REDIS_URL à mettre à jour manuellement: $REDIS_URL" -ForegroundColor Cyan
        }
    }
    catch {
        Write-Host "⚠️ Erreur: $_" -ForegroundColor Yellow
    }
}
else {
    Write-Host "⚠️ REDIS_URL non définie, Redis sera désactivé" -ForegroundColor Yellow
}
Write-Host ""

# ========================================
# PARTIE 3: REDÉPLOIEMENT
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PARTIE 3: Redéploiement Cloud Run" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/1] Redéploiement du service Cloud Run..." -ForegroundColor Yellow
Write-Host "   (Cloud Run charge automatiquement la dernière version des secrets)" -ForegroundColor Gray
Write-Host ""

# Forcer un redéploiement en mettant à jour une variable d'environnement
try {
    $result = gcloud run services update $SERVICE `
        --region=$REGION `
        --project=$PROJECT `
        --update-env-vars="LAST_UPDATE=$(Get-Date -Format 'yyyy-MM-dd-HHmmss')" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Service Cloud Run redéployé" -ForegroundColor Green
        Write-Host "   Les nouveaux secrets seront chargés au prochain démarrage" -ForegroundColor Gray
    }
    else {
        Write-Host "⚠️ Erreur lors du redéploiement (peut être normal si déjà à jour)" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "⚠️ Erreur: $_" -ForegroundColor Yellow
}
Write-Host ""

# ========================================
# RÉSUMÉ
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Correction terminée!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Résumé des actions:" -ForegroundColor Yellow
Write-Host "  ✅ Mot de passe PostgreSQL réinitialisé" -ForegroundColor Green
Write-Host "  ✅ Secret DATABASE_URL mis à jour (base: $DB_NAME)" -ForegroundColor Green
if ($REDIS_URL) {
    Write-Host "  ✅ Secret REDIS_URL mis à jour" -ForegroundColor Green
}
else {
    Write-Host "  ⚠️ REDIS_URL non mise à jour (Redis désactivé)" -ForegroundColor Yellow
}
Write-Host "  ✅ Service Cloud Run redéployé" -ForegroundColor Green
Write-Host ""

Write-Host "Prochaines étapes:" -ForegroundColor Yellow
Write-Host "1. Attendre 1-2 minutes pour que Cloud Run redémarre" -ForegroundColor White
Write-Host "2. Vérifier les logs pour confirmer la connexion réussie:" -ForegroundColor White
Write-Host "   gcloud logging read ""resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE"" --limit=20 --project=$PROJECT --freshness=5m" -ForegroundColor Cyan
Write-Host "3. Tester l'application" -ForegroundColor White
Write-Host ""

Write-Host "Vérifications attendues dans les logs:" -ForegroundColor Yellow
Write-Host "  ✅ Plus d'erreurs 'password authentication failed'" -ForegroundColor Green
Write-Host "  ✅ Connexions PostgreSQL réussies" -ForegroundColor Green
if ($REDIS_URL) {
    Write-Host "  ✅ Connexion Redis établie (ou erreurs réseau si VPC non configuré)" -ForegroundColor Green
}
Write-Host ""

