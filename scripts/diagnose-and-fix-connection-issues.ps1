# Script de Diagnostic et Correction des Problèmes de Connexion Backend GCP
# Date: 2026-02-19
# Objectif: Diagnostiquer et corriger les problèmes de connexion PostgreSQL et Redis

$PROJECT = "yukpo-project"
$INSTANCE = "yukpo-postgres"
$DB_USER = "yukpo_user"
$SECRET_DB = "database-url"
$SECRET_REDIS = "redis-url"
$SERVICE = "yukpo-backend"
$REGION = "europe-west1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Diagnostic Problèmes de Connexion GCP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Fonction pour récupérer un secret sans erreur Unicode
function Get-GcpSecret {
    param(
        [string]$SecretName,
        [string]$Project
    )
    
    try {
        # Utiliser un fichier temporaire pour éviter les problèmes d'encodage
        $tempFile = [System.IO.Path]::GetTempFileName()
        
        # Récupérer le secret dans un fichier
        gcloud secrets versions access latest --secret=$SecretName --project=$Project --out-file=$tempFile 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0 -and (Test-Path $tempFile)) {
            # Lire le contenu du fichier
            $content = Get-Content -Path $tempFile -Raw -Encoding UTF8
            Remove-Item $tempFile -Force
            return $content.Trim()
        }
        else {
            if (Test-Path $tempFile) {
                Remove-Item $tempFile -Force
            }
            Write-Host "❌ Erreur lors de la récupération du secret: $SecretName" -ForegroundColor Red
            return $null
        }
    }
    catch {
        if (Test-Path $tempFile) {
            Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
        }
        Write-Host "❌ Exception lors de la récupération du secret: $_" -ForegroundColor Red
        return $null
    }
}

# 1. Vérifier l'instance Cloud SQL
Write-Host "[1/8] Vérification de l'instance Cloud SQL..." -ForegroundColor Yellow
$instanceInfo = gcloud sql instances describe $INSTANCE --project=$PROJECT --format="json" 2>&1 | ConvertFrom-Json
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Instance trouvée: $INSTANCE" -ForegroundColor Green
    Write-Host "   État: $($instanceInfo.state)" -ForegroundColor Gray
    Write-Host "   Région: $($instanceInfo.region)" -ForegroundColor Gray
    Write-Host "   Version: $($instanceInfo.databaseVersion)" -ForegroundColor Gray
}
else {
    Write-Host "❌ Instance $INSTANCE non trouvée" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 2. Lister les bases de données
Write-Host "[2/8] Liste des bases de données..." -ForegroundColor Yellow
$databases = gcloud sql databases list --instance=$INSTANCE --project=$PROJECT --format="json" 2>&1 | ConvertFrom-Json
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Bases de données trouvées:" -ForegroundColor Green
    foreach ($db in $databases) {
        Write-Host "   - $($db.name)" -ForegroundColor Gray
    }
    
    # Identifier la base principale
    $yukpoDb = $databases | Where-Object { $_.name -eq "yukpo_db" }
    $yukpoPostgres = $databases | Where-Object { $_.name -eq "yukpo_postgres" }
    
    if ($yukpoDb) {
        Write-Host "   ✅ yukpo_db trouvée" -ForegroundColor Green
    }
    if ($yukpoPostgres) {
        Write-Host "   ✅ yukpo_postgres trouvée" -ForegroundColor Green
    }
}
else {
    Write-Host "❌ Erreur lors de la liste des bases de données" -ForegroundColor Red
}
Write-Host ""

# 3. Vérifier l'utilisateur PostgreSQL
Write-Host "[3/8] Vérification de l'utilisateur PostgreSQL..." -ForegroundColor Yellow
$users = gcloud sql users list --instance=$INSTANCE --project=$PROJECT --format="json" 2>&1 | ConvertFrom-Json
if ($LASTEXITCODE -eq 0) {
    $userExists = $users | Where-Object { $_.name -eq $DB_USER }
    if ($userExists) {
        Write-Host "✅ Utilisateur $DB_USER trouvé" -ForegroundColor Green
        Write-Host "   Type: $($userExists.type)" -ForegroundColor Gray
    }
    else {
        Write-Host "❌ Utilisateur $DB_USER non trouvé!" -ForegroundColor Red
        Write-Host "   Action requise: Créer l'utilisateur" -ForegroundColor Yellow
    }
}
else {
    Write-Host "❌ Erreur lors de la liste des utilisateurs" -ForegroundColor Red
}
Write-Host ""

# 4. Récupérer et analyser DATABASE_URL
Write-Host "[4/8] Analyse du secret DATABASE_URL..." -ForegroundColor Yellow
$databaseUrl = Get-GcpSecret -SecretName $SECRET_DB -Project $PROJECT
if ($databaseUrl) {
    Write-Host "✅ Secret récupéré" -ForegroundColor Green
    
    # Masquer le mot de passe pour l'affichage
    if ($databaseUrl -match "postgresql://([^:]+):([^@]+)@") {
        $user = $matches[1]
        $password = $matches[2]
        $maskedUrl = $databaseUrl -replace [regex]::Escape($password), "***"
        Write-Host "   URL: $maskedUrl" -ForegroundColor Gray
        
        # Vérifier l'utilisateur
        if ($user -ne $DB_USER) {
            Write-Host "   ⚠️ Utilisateur différent: $user (attendu: $DB_USER)" -ForegroundColor Yellow
        }
        else {
            Write-Host "   ✅ Utilisateur correct: $user" -ForegroundColor Green
        }
        
        # Vérifier la base de données
        if ($databaseUrl -match "@/([^?]+)") {
            $dbName = $matches[1]
            Write-Host "   Base de données: $dbName" -ForegroundColor Gray
            
            if ($dbName -eq "yukpo_db") {
                Write-Host "   ✅ Base de données correcte: yukpo_db" -ForegroundColor Green
            }
            elseif ($dbName -eq "yukpo_postgres") {
                Write-Host "   ⚠️ Base de données: yukpo_postgres (vérifier si c'est la bonne)" -ForegroundColor Yellow
            }
            else {
                Write-Host "   ⚠️ Base de données inattendue: $dbName" -ForegroundColor Yellow
            }
        }
        
        # Vérifier le format Unix socket
        if ($databaseUrl -match "host=/cloudsql/") {
            Write-Host "   ✅ Format Unix socket détecté" -ForegroundColor Green
        }
        else {
            Write-Host "   ⚠️ Format Unix socket non détecté (peut causer des problèmes)" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "   ⚠️ Format DATABASE_URL non reconnu" -ForegroundColor Yellow
        Write-Host "   Valeur: $($databaseUrl.Substring(0, [Math]::Min(100, $databaseUrl.Length)))..." -ForegroundColor Gray
    }
}
else {
    Write-Host "❌ Impossible de récupérer le secret $SECRET_DB" -ForegroundColor Red
}
Write-Host ""

# 5. Récupérer et analyser REDIS_URL
Write-Host "[5/8] Analyse du secret REDIS_URL..." -ForegroundColor Yellow
$redisUrl = Get-GcpSecret -SecretName $SECRET_REDIS -Project $PROJECT
if ($redisUrl) {
    Write-Host "✅ Secret récupéré" -ForegroundColor Green
    $redisUrlTrimmed = $redisUrl.Trim()
    
    # Masquer le mot de passe pour l'affichage
    if ($redisUrlTrimmed -match "redis://([^:]+):([^@]+)@") {
        $maskedRedis = $redisUrlTrimmed -replace [regex]::Escape($matches[2]), "***"
        Write-Host "   URL: $maskedRedis" -ForegroundColor Gray
    }
    elseif ($redisUrlTrimmed -match "rediss://([^:]+):([^@]+)@") {
        $maskedRedis = $redisUrlTrimmed -replace [regex]::Escape($matches[2]), "***"
        Write-Host "   URL: $maskedRedis (TLS)" -ForegroundColor Gray
    }
    else {
        Write-Host "   URL: $($redisUrlTrimmed.Substring(0, [Math]::Min(50, $redisUrlTrimmed.Length)))..." -ForegroundColor Gray
    }
    
    # Vérifier les placeholders
    if ($redisUrlTrimmed -match "PLACEHOLDER|REMPLACER|VRAIE_VALEUR") {
        Write-Host "   ❌ Placeholder détecté dans REDIS_URL!" -ForegroundColor Red
        Write-Host "   Action requise: Mettre à jour avec une vraie URL Redis" -ForegroundColor Yellow
    }
    else {
        Write-Host "   ✅ Aucun placeholder détecté" -ForegroundColor Green
    }
}
else {
    Write-Host "⚠️ Secret $SECRET_REDIS non trouvé ou vide" -ForegroundColor Yellow
    Write-Host "   Redis sera désactivé si non configuré" -ForegroundColor Gray
}
Write-Host ""

# 6. Analyser les logs récents
Write-Host "[6/8] Analyse des logs récents (dernières 2 heures)..." -ForegroundColor Yellow
$logs = gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE" --limit=50 --project=$PROJECT --format="json" --freshness=2h 2>&1 | ConvertFrom-Json
if ($logs) {
    $dbErrors = $logs | Where-Object { $_.textPayload -match "password authentication failed" -or $_.textPayload -match "authentication failed for user" }
    $redisErrors = $logs | Where-Object { $_.textPayload -match "Redis connection failed" -or $_.textPayload -match "failed to lookup address" }
    
    if ($dbErrors) {
        Write-Host "   ❌ Erreurs PostgreSQL trouvées: $($dbErrors.Count)" -ForegroundColor Red
        $latestDbError = $dbErrors | Select-Object -First 1
        Write-Host "   Dernière erreur: $($latestDbError.textPayload.Substring(0, [Math]::Min(100, $latestDbError.textPayload.Length)))" -ForegroundColor Gray
    }
    else {
        Write-Host "   ✅ Aucune erreur PostgreSQL récente" -ForegroundColor Green
    }
    
    if ($redisErrors) {
        Write-Host "   ⚠️ Erreurs Redis trouvées: $($redisErrors.Count)" -ForegroundColor Yellow
        $latestRedisError = $redisErrors | Select-Object -First 1
        Write-Host "   Dernière erreur: $($latestRedisError.textPayload.Substring(0, [Math]::Min(100, $latestRedisError.textPayload.Length)))" -ForegroundColor Gray
    }
    else {
        Write-Host "   ✅ Aucune erreur Redis récente" -ForegroundColor Green
    }
}
else {
    Write-Host "   ⚠️ Impossible de récupérer les logs" -ForegroundColor Yellow
}
Write-Host ""

# 7. Vérifier la configuration Cloud Run
Write-Host "[7/8] Vérification de la configuration Cloud Run..." -ForegroundColor Yellow
$serviceInfo = gcloud run services describe $SERVICE --region=$REGION --project=$PROJECT --format="json" 2>&1 | ConvertFrom-Json
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Service trouvé: $SERVICE" -ForegroundColor Green
    Write-Host "   URL: $($serviceInfo.status.url)" -ForegroundColor Gray
    
    # Vérifier les connexions Cloud SQL
    $cloudSqlInstances = $serviceInfo.spec.template.spec.containers[0].env | Where-Object { $_.name -eq "CLOUDSQL_INSTANCE" }
    if ($cloudSqlInstances) {
        Write-Host "   ✅ Cloud SQL configuré" -ForegroundColor Green
    }
    else {
        # Vérifier dans les annotations
        $annotations = $serviceInfo.spec.template.metadata.annotations
        if ($annotations.'run.googleapis.com/cloudsql-instances') {
            Write-Host "   ✅ Cloud SQL configuré via annotations" -ForegroundColor Green
            Write-Host "      Instances: $($annotations.'run.googleapis.com/cloudsql-instances')" -ForegroundColor Gray
        }
        else {
            Write-Host "   ⚠️ Cloud SQL non configuré dans Cloud Run" -ForegroundColor Yellow
        }
    }
}
else {
    Write-Host "❌ Service $SERVICE non trouvé" -ForegroundColor Red
}
Write-Host ""

# 8. Résumé et recommandations
Write-Host "[8/8] Résumé et recommandations..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RÉSUMÉ DU DIAGNOSTIC" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Problèmes identifiés
$issues = @()

if (-not $databaseUrl) {
    $issues += "❌ Secret DATABASE_URL non accessible"
}
elseif ($databaseUrl -match "password authentication failed") {
    $issues += "❌ Mot de passe PostgreSQL incorrect dans DATABASE_URL"
}

if (-not $redisUrl -or $redisUrl -match "PLACEHOLDER") {
    $issues += "⚠️ REDIS_URL non configuré ou contient un placeholder"
}

if ($dbErrors) {
    $issues += "❌ Erreurs d'authentification PostgreSQL dans les logs"
}

if ($issues.Count -eq 0) {
    Write-Host "✅ Aucun problème critique identifié" -ForegroundColor Green
    Write-Host ""
    Write-Host "Actions recommandées:" -ForegroundColor Yellow
    Write-Host "1. Vérifier que le service Cloud Run est redémarré après les changements" -ForegroundColor White
    Write-Host "2. Surveiller les logs pendant quelques minutes" -ForegroundColor White
}
else {
    Write-Host "Problèmes identifiés:" -ForegroundColor Red
    foreach ($issue in $issues) {
        Write-Host "  $issue" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Actions recommandées:" -ForegroundColor Yellow
    
    if ($issues -match "PostgreSQL|password authentication") {
        Write-Host "1. Réinitialiser le mot de passe PostgreSQL:" -ForegroundColor White
        Write-Host "   .\scripts\update-database-secret-and-test.ps1" -ForegroundColor Cyan
    }
    
    if ($issues -match "REDIS") {
        Write-Host "2. Configurer REDIS_URL avec une vraie URL Redis:" -ForegroundColor White
        Write-Host "   # Si Redis n'est pas nécessaire, laisser vide" -ForegroundColor Gray
        Write-Host "   # Si Redis est nécessaire, configurer Memorystore ou Upstash" -ForegroundColor Gray
    }
    
    Write-Host "3. Redéployer le service Cloud Run après corrections" -ForegroundColor White
    Write-Host "   gcloud run services update $SERVICE --region=$REGION --project=$PROJECT" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

