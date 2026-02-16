# Script pour configurer la base de données yukpo_postgres dans Cloud SQL
# Usage: .\scripts\configurer-base-yukpo-postgres.ps1

param(
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_postgres",
    [string]$OldDatabaseName = "yukpo_db",
    [string]$UserName = "yukpo_user",
    [string]$UserPassword = "",
    [switch]$RenameOldDatabase = $false,
    [switch]$SkipMigrations = $false
)

Write-Host "🔧 Configuration Base de Données yukpo_postgres" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que gcloud est installé
$gcloudPath = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"
if (Test-Path "$gcloudPath\gcloud.cmd") {
    $env:Path += ";$gcloudPath"
    Write-Host "[OK] gcloud ajouté au PATH" -ForegroundColor Green
} else {
    Write-Host "[ERREUR] gcloud non trouvé" -ForegroundColor Red
    Write-Host "   Installez Google Cloud SDK: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "   Projet GCP: $ProjectId"
Write-Host "   Instance: $InstanceName"
Write-Host "   Base principale: $DatabaseName"
Write-Host "   Base ancienne: $OldDatabaseName"
Write-Host "   Utilisateur: $UserName"
Write-Host ""

# Étape 1: Vérifier que l'instance existe
Write-Host "[ÉTAPE 1/6] Vérification de l'instance Cloud SQL..." -ForegroundColor Yellow
$instanceExists = gcloud sql instances describe $InstanceName --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Instance Cloud SQL trouvée: $InstanceName" -ForegroundColor Green
    
    # Récupérer l'IP publique
    $instanceIp = gcloud sql instances describe $InstanceName --format="value(ipAddresses[0].ipAddress)" --project=$ProjectId
    Write-Host "   IP Publique: $instanceIp" -ForegroundColor Gray
} else {
    Write-Host "   ❌ Instance Cloud SQL non trouvée: $InstanceName" -ForegroundColor Red
    Write-Host "   Créez d'abord l'instance avec:" -ForegroundColor Yellow
    Write-Host "   gcloud sql instances create $InstanceName --database-version=POSTGRES_15 --tier=db-f1-micro --region=europe-west1 --project=$ProjectId" -ForegroundColor Gray
    exit 1
}

Write-Host ""

# Étape 2: Lister les bases existantes
Write-Host "[ÉTAPE 2/6] Liste des bases de données existantes..." -ForegroundColor Yellow
$databases = gcloud sql databases list --instance=$InstanceName --project=$ProjectId --format="json" 2>&1

if ($LASTEXITCODE -eq 0) {
    $dbList = $databases | ConvertFrom-Json
    $existingDbs = $dbList | ForEach-Object { $_.name }
    
    Write-Host "   Bases trouvées:" -ForegroundColor Green
    foreach ($db in $existingDbs) {
        if ($db -eq $DatabaseName) {
            Write-Host "      ✅ $db (base principale)" -ForegroundColor Green
        } elseif ($db -eq $OldDatabaseName) {
            Write-Host "      ⚠️  $db (base ancienne)" -ForegroundColor Yellow
        } else {
            Write-Host "      ℹ️  $db" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "   ⚠️  Impossible de lister les bases (peut être normal si aucune base n'existe)" -ForegroundColor Yellow
    $existingDbs = @()
}

Write-Host ""

# Étape 3: Créer la base yukpo_postgres si elle n'existe pas
Write-Host "[ÉTAPE 3/6] Création/Vérification de la base $DatabaseName..." -ForegroundColor Yellow

if ($existingDbs -contains $DatabaseName) {
    Write-Host "   ✅ Base de données $DatabaseName existe déjà" -ForegroundColor Green
} else {
    Write-Host "   Création de la base de données $DatabaseName..." -ForegroundColor Yellow
    gcloud sql databases create $DatabaseName --instance=$InstanceName --project=$ProjectId 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Base de données $DatabaseName créée avec succès" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Erreur lors de la création de la base de données" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Étape 4: Gérer l'ancienne base yukpo_db
Write-Host "[ÉTAPE 4/6] Gestion de l'ancienne base $OldDatabaseName..." -ForegroundColor Yellow

if ($existingDbs -contains $OldDatabaseName) {
    if ($RenameOldDatabase) {
        $newOldName = "${OldDatabaseName}_old_backup"
        Write-Host "   Renommage de $OldDatabaseName vers $newOldName..." -ForegroundColor Yellow
        Write-Host "   ⚠️  Note: gcloud ne permet pas de renommer directement une base de données" -ForegroundColor Yellow
        Write-Host "   Vous devez:" -ForegroundColor Yellow
        Write-Host "   1. Créer une nouvelle base avec le nouveau nom" -ForegroundColor Gray
        Write-Host "   2. Copier les données (si nécessaire)" -ForegroundColor Gray
        Write-Host "   3. Supprimer l'ancienne base" -ForegroundColor Gray
        Write-Host "   Ou simplement laisser $OldDatabaseName telle quelle" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠️  Base $OldDatabaseName existe toujours" -ForegroundColor Yellow
        Write-Host "   Recommandation: Vérifier si elle est encore utilisée" -ForegroundColor Yellow
        Write-Host "   Pour la renommer, utilisez: -RenameOldDatabase" -ForegroundColor Gray
    }
} else {
    Write-Host "   ℹ️  Base $OldDatabaseName n'existe pas (peut être obsolète)" -ForegroundColor Gray
}

Write-Host ""

# Étape 5: Vérifier/Créer l'utilisateur
Write-Host "[ÉTAPE 5/6] Vérification de l'utilisateur $UserName..." -ForegroundColor Yellow

$users = gcloud sql users list --instance=$InstanceName --project=$ProjectId --format="value(name)" 2>&1

if ($users -contains $UserName) {
    Write-Host "   ✅ Utilisateur $UserName existe" -ForegroundColor Green
    
    if ($UserPassword) {
        Write-Host "   Mise à jour du mot de passe..." -ForegroundColor Yellow
        gcloud sql users set-password $UserName --instance=$InstanceName --password=$UserPassword --project=$ProjectId 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Mot de passe mis à jour" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Erreur lors de la mise à jour du mot de passe" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "   Création de l'utilisateur $UserName..." -ForegroundColor Yellow
    
    if (-not $UserPassword) {
        Write-Host "   ❌ Mot de passe requis pour créer l'utilisateur" -ForegroundColor Red
        Write-Host "   Utilisez: -UserPassword 'VOTRE_MOT_DE_PASSE'" -ForegroundColor Yellow
        exit 1
    }
    
    gcloud sql users create $UserName --instance=$InstanceName --password=$UserPassword --project=$ProjectId 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Utilisateur $UserName créé" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Erreur lors de la création de l'utilisateur" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Étape 6: Générer la DATABASE_URL
Write-Host "[ÉTAPE 6/6] Génération de la DATABASE_URL..." -ForegroundColor Yellow

$instanceIp = gcloud sql instances describe $InstanceName --format="value(ipAddresses[0].ipAddress)" --project=$ProjectId
$connectionName = gcloud sql instances describe $InstanceName --format="value(connectionName)" --project=$ProjectId

if ($UserPassword) {
    $passwordMasked = "***"
} else {
    $passwordMasked = "[MOT_DE_PASSE_REQUIS]"
}

Write-Host ""
Write-Host "✅ Configuration terminée!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 DATABASE_URL à utiliser:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Format IP Publique:" -ForegroundColor Yellow
Write-Host "  postgresql://${UserName}:${passwordMasked}@${instanceIp}:5432/${DatabaseName}?sslmode=require" -ForegroundColor White
Write-Host ""
Write-Host "Format Unix Socket (recommandé pour Cloud Run):" -ForegroundColor Yellow
Write-Host "  postgresql://${UserName}:${passwordMasked}@/${DatabaseName}?host=/cloudsql/${connectionName}" -ForegroundColor White
Write-Host ""

# Optionnel: Appliquer les migrations
if (-not $SkipMigrations) {
    Write-Host "📦 Voulez-vous appliquer les migrations SQLx maintenant?" -ForegroundColor Cyan
    Write-Host "   Exécutez:" -ForegroundColor Yellow
    Write-Host "   cd backend" -ForegroundColor Gray
    Write-Host "   `$env:DATABASE_URL = 'postgresql://${UserName}:PASSWORD@${instanceIp}:5432/${DatabaseName}?sslmode=require'" -ForegroundColor Gray
    Write-Host "   cargo sqlx migrate run" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "   - CLARIFICATION_BASES_DONNEES_GCP.md" -ForegroundColor White
Write-Host "   - GUIDE_EVITER_CONFUSION_BD.md" -ForegroundColor White
Write-Host ""

