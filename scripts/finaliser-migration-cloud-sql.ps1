# Script de finalisation de la migration vers Cloud SQL
# Date: 2026-02-15
# Objectif: Supprimer VPC Connector et mettre à jour DATABASE_URL pour Cloud SQL

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$ServiceName = "yukpo-backend",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$UserName = "yukpo_user",
    [string]$Password = ""
)

Write-Host "Finalisation Migration vers Cloud SQL" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que gcloud est installé
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
    Write-Host "[INFO] Mot de passe Cloud SQL non fourni" -ForegroundColor Yellow
    Write-Host "[INFO] Utilisation du mot de passe existant dans les secrets GitHub" -ForegroundColor Yellow
    Write-Host "[INFO] Si vous voulez changer le mot de passe, utilisez:" -ForegroundColor Cyan
    Write-Host "   gcloud sql users set-password $UserName --instance=$InstanceName --password=VOTRE_MOT_DE_PASSE --project=$ProjectId" -ForegroundColor White
}

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "   Projet GCP: $ProjectId"
Write-Host "   Region: $Region"
Write-Host "   Service Cloud Run: $ServiceName"
Write-Host "   Instance Cloud SQL: $InstanceName"
Write-Host "   Base de donnees: $DatabaseName"
Write-Host "   Utilisateur: $UserName"
Write-Host ""

# Étape 1: Récupérer le connection name
Write-Host "[ETAPE 1/4] Recuperation connection name Cloud SQL..." -ForegroundColor Yellow

$connectionName = gcloud sql instances describe $InstanceName --format="value(connectionName)" --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0 -and $connectionName) {
    Write-Host "   [OK] Connection Name: $connectionName" -ForegroundColor Green
} else {
    Write-Host "   [ERREUR] Impossible de recuperer le connection name" -ForegroundColor Red
    Write-Host "   [INFO] Verifiez que l'instance Cloud SQL existe: $InstanceName" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Étape 2: Vérifier et supprimer VPC Connector
Write-Host "[ETAPE 2/4] Suppression VPC Connector de Cloud Run..." -ForegroundColor Yellow

# Vérifier si VPC Connector est attaché
$vpcConfig = gcloud run services describe $ServiceName --region=$Region --format="get(spec.template.spec.vpcAccess)" --project=$ProjectId 2>&1

if ($vpcConfig -and $vpcConfig -notmatch "None" -and $vpcConfig -notmatch "ERROR") {
    Write-Host "   [INFO] VPC Connector detecte, suppression..." -ForegroundColor Yellow
    
    # D'abord changer vpc-egress si nécessaire
    gcloud run services update $ServiceName `
        --region=$Region `
        --vpc-egress=private-ranges-only `
        --project=$ProjectId 2>&1 | Out-Null
    
    Start-Sleep -Seconds 5
    
    # Ensuite supprimer le VPC Connector
    gcloud run services update $ServiceName `
        --region=$Region `
        --clear-vpc-connector `
        --project=$ProjectId 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] VPC Connector supprime" -ForegroundColor Green
    } else {
        Write-Host "   [ATTENTION] Impossible de supprimer VPC Connector (peut-etre deja supprime)" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [OK] VPC Connector non attache (deja supprime ou jamais attache)" -ForegroundColor Green
}

Write-Host ""

# Étape 3: Vérifier que Cloud SQL instance est ajoutée
Write-Host "[ETAPE 3/4] Verification Cloud SQL instance dans Cloud Run..." -ForegroundColor Yellow

$cloudSqlInstances = gcloud run services describe $ServiceName --region=$Region --format="get(spec.template.spec.containers[0].cloudSqlInstances)" --project=$ProjectId 2>&1

if ($cloudSqlInstances -and $cloudSqlInstances -match $connectionName) {
    Write-Host "   [OK] Cloud SQL instance deja ajoutee: $connectionName" -ForegroundColor Green
} else {
    Write-Host "   [INFO] Ajout Cloud SQL instance a Cloud Run..." -ForegroundColor Yellow
    
    gcloud run services update $ServiceName `
        --region=$Region `
        --add-cloudsql-instances=$connectionName `
        --project=$ProjectId 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Cloud SQL instance ajoutee" -ForegroundColor Green
    } else {
        Write-Host "   [ERREUR] Impossible d'ajouter Cloud SQL instance" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Étape 4: Construire et mettre à jour DATABASE_URL
Write-Host "[ETAPE 4/4] Mise a jour DATABASE_URL pour Cloud SQL..." -ForegroundColor Yellow

if ([string]::IsNullOrEmpty($Password)) {
    Write-Host "   [INFO] Mot de passe non fourni - DATABASE_URL ne sera pas mise a jour automatiquement" -ForegroundColor Yellow
    Write-Host "   [INFO] Format DATABASE_URL pour Cloud SQL (Unix socket):" -ForegroundColor Cyan
    Write-Host "   postgresql://${UserName}:MOT_DE_PASSE@/${DatabaseName}?host=/cloudsql/${connectionName}" -ForegroundColor White
    Write-Host ""
    Write-Host "   [ACTION] Mettez a jour manuellement le secret GitHub GCP_DATABASE_URL avec ce format" -ForegroundColor Yellow
} else {
    $newDatabaseUrl = "postgresql://${UserName}:${Password}@/${DatabaseName}?host=/cloudsql/${connectionName}"
    
    Write-Host "   [INFO] Mise a jour DATABASE_URL..." -ForegroundColor Yellow
    
    gcloud run services update $ServiceName `
        --region=$Region `
        --update-env-vars="DATABASE_URL=$newDatabaseUrl" `
        --project=$ProjectId 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] DATABASE_URL mise a jour" -ForegroundColor Green
    } else {
        Write-Host "   [ERREUR] Impossible de mettre a jour DATABASE_URL" -ForegroundColor Red
        Write-Host "   [INFO] Mettez a jour manuellement le secret GitHub GCP_DATABASE_URL" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "[OK] Finalisation terminee!" -ForegroundColor Green
Write-Host ""
Write-Host "Informations importantes:" -ForegroundColor Cyan
Write-Host "   Connection Name: $connectionName" -ForegroundColor White
Write-Host "   Format DATABASE_URL: postgresql://${UserName}:***@/${DatabaseName}?host=/cloudsql/${connectionName}" -ForegroundColor White
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Yellow
Write-Host "   1. Mettre a jour le secret GitHub GCP_DATABASE_URL avec le format Unix socket" -ForegroundColor White
Write-Host "   2. Verifier les permissions Cloud SQL Client pour le service account" -ForegroundColor White
Write-Host "   3. Tester le service: curl https://yukpo-backend-376093909298.europe-west1.run.app/health" -ForegroundColor White
Write-Host "   4. Verifier les logs Cloud Run pour confirmer la connexion" -ForegroundColor White
Write-Host ""


