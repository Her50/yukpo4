# Script pour appliquer la migration delivery_proximity_suggestions via l'API REST Cloud SQL
# Usage: .\scripts\apply_migration_cloud_sql_api.ps1

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user",
    [string]$Password = ""
)

Write-Host "🔄 Application de la migration delivery_proximity_suggestions via API Cloud SQL..." -ForegroundColor Cyan
Write-Host ""

# Vérifier que gcloud est installé
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Erreur: gcloud CLI n'est pas installé ou pas dans le PATH" -ForegroundColor Red
    Write-Host "   Installez Google Cloud SDK: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Vérifier l'authentification
Write-Host "🔐 Vérification de l'authentification gcloud..." -ForegroundColor Yellow
$currentAccount = gcloud config get-value account 2>&1
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($currentAccount)) {
    Write-Host "❌ Erreur: Vous n'êtes pas authentifié avec gcloud" -ForegroundColor Red
    Write-Host "   Exécutez: gcloud auth login" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Authentifié en tant que: $currentAccount" -ForegroundColor Green
Write-Host ""

# Lire le fichier SQL
$sqlFile = "scripts\apply_delivery_proximity_migration_simple.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ Erreur: Fichier de migration non trouvé: $sqlFile" -ForegroundColor Red
    exit 1
}

Write-Host "📝 Lecture du fichier de migration..." -ForegroundColor Yellow
$sqlContent = Get-Content $sqlFile -Raw -Encoding UTF8
Write-Host "✅ Fichier lu (${sqlContent.Length} caractères)" -ForegroundColor Green
Write-Host ""

# Méthode 1: Utiliser psql via gcloud sql connect (si psql est disponible)
Write-Host "🔧 Tentative d'exécution via psql..." -ForegroundColor Cyan

# Vérifier si psql est disponible
if (Get-Command psql -ErrorAction SilentlyContinue) {
    Write-Host "✅ psql trouvé, tentative de connexion..." -ForegroundColor Green
    
    # Récupérer l'IP publique de l'instance
    Write-Host "📡 Récupération de l'IP publique de l'instance..." -ForegroundColor Yellow
    $instanceInfo = gcloud sql instances describe $InstanceName --project=$ProjectId --format=json 2>&1 | ConvertFrom-Json
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreur: Impossible de récupérer les informations de l'instance" -ForegroundColor Red
        Write-Host $instanceInfo
        exit 1
    }
    
    $publicIp = $instanceInfo.settings.ipConfiguration.ipAddresses | Where-Object { $_.type -eq "PRIMARY" } | Select-Object -ExpandProperty ipAddress
    
    if ([string]::IsNullOrWhiteSpace($publicIp)) {
        Write-Host "⚠️  Aucune IP publique trouvée. Tentative via Unix socket..." -ForegroundColor Yellow
    } else {
        Write-Host "✅ IP publique trouvée: $publicIp" -ForegroundColor Green
        
        # Demander le mot de passe si non fourni
        if ([string]::IsNullOrWhiteSpace($Password)) {
            $securePassword = Read-Host "🔐 Entrez le mot de passe pour $User" -AsSecureString
            $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
            $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        }
        
        # Créer la variable d'environnement PGPASSWORD
        $env:PGPASSWORD = $Password
        
        Write-Host "🔌 Connexion à Cloud SQL..." -ForegroundColor Yellow
        
        # Exécuter le SQL via psql
        $sqlContent | psql -h $publicIp -U $User -d $DatabaseName -p 5432 --set=sslmode=require 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Migration appliquée avec succès via psql!" -ForegroundColor Green
            
            # Nettoyer le mot de passe
            $env:PGPASSWORD = $null
            Remove-Variable -Name Password -ErrorAction SilentlyContinue
            
            exit 0
        } else {
            Write-Host "⚠️  Échec via psql, tentative alternative..." -ForegroundColor Yellow
            $env:PGPASSWORD = $null
        }
    }
} else {
    Write-Host "⚠️  psql non trouvé, utilisation de la méthode alternative..." -ForegroundColor Yellow
}

# Méthode 2: Utiliser gcloud sql connect avec un script temporaire
Write-Host ""
Write-Host "🔧 Méthode alternative: Utilisation de gcloud sql connect..." -ForegroundColor Cyan
Write-Host ""

# Créer un script SQL temporaire
$tempSqlFile = [System.IO.Path]::GetTempFileName() + ".sql"
$sqlContent | Out-File -FilePath $tempSqlFile -Encoding UTF8 -NoNewline

Write-Host "📝 Script SQL temporaire créé: $tempSqlFile" -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  ATTENTION: Cette méthode nécessite une connexion interactive." -ForegroundColor Yellow
Write-Host ""
Write-Host "Pour appliquer la migration manuellement:" -ForegroundColor Cyan
Write-Host "1. Exécutez: gcloud sql connect $InstanceName --user=$User --database=$DatabaseName --project=$ProjectId" -ForegroundColor White
Write-Host "2. Dans psql, exécutez: \i $tempSqlFile" -ForegroundColor White
Write-Host "   OU copiez-collez le contenu de: $sqlFile" -ForegroundColor White
Write-Host ""

# Méthode 3: Instructions pour la console Cloud SQL
Write-Host "🔧 Méthode recommandée: Via la console Cloud SQL" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Ouvrez: https://console.cloud.google.com/sql/instances/$InstanceName/overview?project=$ProjectId" -ForegroundColor White
Write-Host "2. Cliquez sur 'DATABASES' puis sélectionnez '$DatabaseName'" -ForegroundColor White
Write-Host "3. Cliquez sur 'Query' ou 'SQL Editor'" -ForegroundColor White
Write-Host "4. Copiez-collez le contenu de: $sqlFile" -ForegroundColor White
Write-Host "5. Exécutez la requête" -ForegroundColor White
Write-Host ""

# Vérification finale
Write-Host "🔍 Pour vérifier que la migration a été appliquée:" -ForegroundColor Cyan
Write-Host "   Exécutez cette requête SQL:" -ForegroundColor White
Write-Host ""
Write-Host "   SELECT EXISTS (" -ForegroundColor Gray
Write-Host "       SELECT FROM information_schema.tables" -ForegroundColor Gray
Write-Host "       WHERE table_schema = 'public'" -ForegroundColor Gray
Write-Host "       AND table_name = 'delivery_proximity_suggestions'" -ForegroundColor Gray
Write-Host "   );" -ForegroundColor Gray
Write-Host ""

Write-Host "✅ Script terminé. Le fichier SQL est prêt: $sqlFile" -ForegroundColor Green


