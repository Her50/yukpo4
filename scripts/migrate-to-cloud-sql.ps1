# Script de Migration vers Cloud SQL (GCP)
# Date: 2026-02-15
# Objectif: Migrer la base de donnees PostgreSQL d'AWS RDS vers Cloud SQL

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$UserName = "yukpo_user",
    [string]$Password = "",
    [string]$Tier = "db-f1-micro",
    [string]$AwsRdsHost = "34.79.29.219",
    [string]$AwsRdsPort = "5432",
    [string]$AwsRdsUser = "yukpo_admin",
    [string]$AwsRdsPassword = "",
    [string]$AwsRdsDatabase = "yukpo_db"
)

Write-Host "Migration Base de Donnees vers Cloud SQL (GCP)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Verifier que gcloud est installe
$gcloudPath = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"
if (Test-Path "$gcloudPath\gcloud.cmd") {
    $env:Path += ";$gcloudPath"
    Write-Host "[OK] gcloud ajoute au PATH" -ForegroundColor Green
} else {
    Write-Host "[ERREUR] gcloud non trouve" -ForegroundColor Red
    exit 1
}

# Demander le mot de passe si non fourni
if ([string]::IsNullOrEmpty($Password)) {
    Write-Host "[INFO] Mot de passe Cloud SQL non fourni - sera genere automatiquement" -ForegroundColor Yellow
    # Generer un mot de passe aleatoire
    $Password = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    Write-Host "[INFO] Mot de passe genere: $Password" -ForegroundColor Cyan
}

if ([string]::IsNullOrEmpty($AwsRdsPassword)) {
    Write-Host "[WARNING] Mot de passe AWS RDS non fourni - migration des donnees sera sautee" -ForegroundColor Yellow
    Write-Host "[INFO] Vous pouvez migrer manuellement avec pg_dump/psql" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "   Projet GCP: $ProjectId"
Write-Host "   Region: $Region"
Write-Host "   Instance Cloud SQL: $InstanceName"
Write-Host "   Base de donnees: $DatabaseName"
Write-Host "   Utilisateur: $UserName"
Write-Host "   AWS RDS Source: ${AwsRdsHost}:${AwsRdsPort}"
Write-Host ""

# Etape 1: Creer l'instance Cloud SQL
Write-Host "[ETAPE 1/6] Creation instance Cloud SQL..." -ForegroundColor Yellow

$instanceExists = gcloud sql instances describe $InstanceName --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] Instance Cloud SQL existe deja: $InstanceName" -ForegroundColor Green
} else {
    Write-Host "   Creation de l'instance Cloud SQL..." -ForegroundColor Yellow
    
    gcloud sql instances create $InstanceName `
        --database-version=POSTGRES_15 `
        --tier=$Tier `
        --region=$Region `
        --root-password=$Password `
        --backup-start-time=03:00 `
        --project=$ProjectId
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Instance Cloud SQL creee: $InstanceName" -ForegroundColor Green
        Write-Host "   [INFO] Attente 2 minutes pour que l'instance soit prete..." -ForegroundColor Yellow
        Start-Sleep -Seconds 120
    } else {
        Write-Host "   [ERREUR] Impossible de creer l'instance Cloud SQL" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Etape 2: Creer la base de donnees et l'utilisateur
Write-Host "[ETAPE 2/6] Creation base de donnees et utilisateur..." -ForegroundColor Yellow

# Verifier si la base existe
$dbExists = gcloud sql databases describe $DatabaseName --instance=$InstanceName --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] Base de donnees existe deja: $DatabaseName" -ForegroundColor Green
} else {
    Write-Host "   Creation de la base de donnees..." -ForegroundColor Yellow
    gcloud sql databases create $DatabaseName `
        --instance=$InstanceName `
        --project=$ProjectId
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Base de donnees creee: $DatabaseName" -ForegroundColor Green
    } else {
        Write-Host "   [ERREUR] Impossible de creer la base de donnees" -ForegroundColor Red
        exit 1
    }
}

# Verifier si l'utilisateur existe
$userExists = gcloud sql users describe $UserName --instance=$InstanceName --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] Utilisateur existe deja: $UserName" -ForegroundColor Green
    Write-Host "   [INFO] Mise a jour du mot de passe..." -ForegroundColor Yellow
    gcloud sql users set-password $UserName `
        --instance=$InstanceName `
        --password=$Password `
        --project=$ProjectId
} else {
    Write-Host "   Creation de l'utilisateur..." -ForegroundColor Yellow
    gcloud sql users create $UserName `
        --instance=$InstanceName `
        --password=$Password `
        --project=$ProjectId
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Utilisateur cree: $UserName" -ForegroundColor Green
    } else {
        Write-Host "   [ERREUR] Impossible de creer l'utilisateur" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Etape 3: Recuperer les informations de connexion
Write-Host "[ETAPE 3/6] Recuperation informations connexion Cloud SQL..." -ForegroundColor Yellow

$connectionName = gcloud sql instances describe $InstanceName --format="value(connectionName)" --project=$ProjectId
$publicIp = gcloud sql instances describe $InstanceName --format="value(ipAddresses[0].ipAddress)" --project=$ProjectId

if ($LASTEXITCODE -eq 0 -and $connectionName) {
    Write-Host "   [OK] Connection Name: $connectionName" -ForegroundColor Green
    Write-Host "   [OK] IP Publique: $publicIp" -ForegroundColor Green
} else {
    Write-Host "   [ERREUR] Impossible de recuperer les informations" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Etape 4: Migrer les donnees (necessite pg_dump et psql)
Write-Host "[ETAPE 4/6] Migration des donnees..." -ForegroundColor Yellow
Write-Host "   [INFO] Cette etape necessite pg_dump et psql installes" -ForegroundColor Cyan
Write-Host "   [INFO] Si non installes, installez PostgreSQL client" -ForegroundColor Cyan
Write-Host ""

$pgDumpPath = Get-Command pg_dump -ErrorAction SilentlyContinue
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue

if ($pgDumpPath -and $psqlPath) {
    Write-Host "   [OK] pg_dump et psql trouves" -ForegroundColor Green
    
    $backupFile = "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
    Write-Host "   Export depuis AWS RDS vers $backupFile..." -ForegroundColor Yellow
    
    $env:PGPASSWORD = $AwsRdsPassword
    & pg_dump -h $AwsRdsHost -p $AwsRdsPort -U $AwsRdsUser -d $AwsRdsDatabase -F p -f $backupFile 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Export reussi: $backupFile" -ForegroundColor Green
        
        Write-Host "   Import vers Cloud SQL..." -ForegroundColor Yellow
        $env:PGPASSWORD = $Password
        & psql -h $publicIp -U $UserName -d $DatabaseName -f $backupFile 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   [OK] Import reussi vers Cloud SQL" -ForegroundColor Green
        } else {
            Write-Host "   [ERREUR] Echec import vers Cloud SQL" -ForegroundColor Red
            Write-Host "   [INFO] Vous pouvez importer manuellement: psql -h $publicIp -U $UserName -d $DatabaseName -f $backupFile" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   [ERREUR] Echec export depuis AWS RDS" -ForegroundColor Red
        Write-Host "   [INFO] Vous pouvez exporter manuellement: pg_dump -h $AwsRdsHost -U $AwsRdsUser -d $AwsRdsDatabase > backup.sql" -ForegroundColor Yellow
    }
    
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
} else {
    Write-Host "   [WARNING] pg_dump/psql non trouves - Migration manuelle necessaire" -ForegroundColor Yellow
    Write-Host "   [INFO] Commandes manuelles:" -ForegroundColor Cyan
    Write-Host "   1. Export: pg_dump -h $AwsRdsHost -U $AwsRdsUser -d $AwsRdsDatabase > backup.sql" -ForegroundColor White
    Write-Host "   2. Import: psql -h $publicIp -U $UserName -d $DatabaseName < backup.sql" -ForegroundColor White
}

Write-Host ""

# Etape 5: Configurer Cloud Run
Write-Host "[ETAPE 5/6] Configuration Cloud Run pour Cloud SQL..." -ForegroundColor Yellow

Write-Host "   Ajout Cloud SQL instance a Cloud Run..." -ForegroundColor Yellow
gcloud run services update yukpo-backend `
    --region=$Region `
    --add-cloudsql-instances=$connectionName `
    --project=$ProjectId

if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] Cloud SQL instance ajoutee a Cloud Run" -ForegroundColor Green
} else {
    Write-Host "   [ERREUR] Impossible d'ajouter Cloud SQL instance" -ForegroundColor Red
}

Write-Host ""
Write-Host "   Mise a jour DATABASE_URL..." -ForegroundColor Yellow

# Construire la nouvelle DATABASE_URL pour Cloud SQL
$newDatabaseUrl = "postgresql://${UserName}:${Password}@/${DatabaseName}?host=/cloudsql/${connectionName}"

gcloud run services update yukpo-backend `
    --region=$Region `
    --update-env-vars="DATABASE_URL=$newDatabaseUrl" `
    --project=$ProjectId

if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] DATABASE_URL mise a jour" -ForegroundColor Green
} else {
    Write-Host "   [ERREUR] Impossible de mettre a jour DATABASE_URL" -ForegroundColor Red
}

Write-Host ""

# Etape 6: Supprimer VPC Connector (plus necessaire)
Write-Host "[ETAPE 6/6] Suppression VPC Connector (plus necessaire)..." -ForegroundColor Yellow

$confirm = Read-Host "   Supprimer le VPC Connector? (o/N)"
if ($confirm -eq "o" -or $confirm -eq "O") {
    gcloud run services update yukpo-backend `
        --region=$Region `
        --clear-vpc-connector `
        --project=$ProjectId
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] VPC Connector supprime" -ForegroundColor Green
    } else {
        Write-Host "   [ERREUR] Impossible de supprimer VPC Connector" -ForegroundColor Red
    }
} else {
    Write-Host "   [INFO] VPC Connector conserve (peut etre supprime manuellement plus tard)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[OK] Migration terminee!" -ForegroundColor Green
Write-Host ""
Write-Host "Informations importantes:" -ForegroundColor Cyan
Write-Host "   Connection Name: $connectionName" -ForegroundColor White
Write-Host "   IP Publique: $publicIp" -ForegroundColor White
Write-Host "   DATABASE_URL: postgresql://${UserName}:***@/${DatabaseName}?host=/cloudsql/${connectionName}" -ForegroundColor White
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Yellow
Write-Host "   1. Verifier les logs Cloud Run" -ForegroundColor White
Write-Host "   2. Tester le service: curl https://yukpo-backend-376093909298.europe-west1.run.app/health" -ForegroundColor White
Write-Host "   3. Verifier la connexion base de donnees dans les logs" -ForegroundColor White
Write-Host ""

