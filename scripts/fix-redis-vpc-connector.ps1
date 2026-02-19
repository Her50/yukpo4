# Script pour configurer le VPC Connector pour Redis
# Usage: .\scripts\fix-redis-vpc-connector.ps1

param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpRegion = "europe-west1",
    [string]$GcpServiceName = "yukpo-backend",
    [string]$ConnectorName = "yukpo-connector",
    [switch]$DryRun = $false
)

Write-Host ""
Write-Host "CONFIGURATION VPC CONNECTOR POUR REDIS" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Projet: $GcpProjectId" -ForegroundColor Yellow
Write-Host "Region: $GcpRegion" -ForegroundColor Yellow
Write-Host "Service: $GcpServiceName" -ForegroundColor Yellow
Write-Host "Connector: $ConnectorName" -ForegroundColor Yellow
if ($DryRun) {
    Write-Host "MODE: DRY RUN (aucune modification)" -ForegroundColor Yellow
}
Write-Host ""

gcloud config set project $GcpProjectId | Out-Null

# 1. Verifier si le VPC Connector existe
Write-Host "1. Verification du VPC Connector..." -ForegroundColor Yellow
$connectorCheck = gcloud compute networks vpc-access connectors describe $ConnectorName --region=$GcpRegion --project=$GcpProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] VPC Connector existe deja" -ForegroundColor Green
    $connectorExists = $true
} else {
    Write-Host "   [INFO] VPC Connector n'existe pas" -ForegroundColor Gray
    $connectorExists = $false
}

# 2. Creer le VPC Connector si necessaire
if (-not $connectorExists) {
    Write-Host ""
    Write-Host "2. Creation du VPC Connector..." -ForegroundColor Yellow
    
    if ($DryRun) {
        Write-Host "   [DRY RUN] Commande qui serait executee:" -ForegroundColor Gray
        Write-Host "   gcloud compute networks vpc-access connectors create $ConnectorName --region=$GcpRegion --network=default --range=10.8.0.0/28 --project=$GcpProjectId" -ForegroundColor Cyan
    } else {
        Write-Host "   Creation du connector (peut prendre 5-10 minutes)..." -ForegroundColor Gray
        $createResult = gcloud compute networks vpc-access connectors create $ConnectorName --region=$GcpRegion --network=default --range=10.8.0.0/28 --project=$GcpProjectId 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   [OK] VPC Connector cree avec succes" -ForegroundColor Green
            Write-Host "   Attente de la disponibilite (30 secondes)..." -ForegroundColor Gray
            Start-Sleep -Seconds 30
        } else {
            Write-Host "   [ERREUR] Impossible de creer le VPC Connector" -ForegroundColor Red
            Write-Host "   $createResult" -ForegroundColor Red
            exit 1
        }
    }
} else {
    Write-Host ""
    Write-Host "2. VPC Connector existe deja, pas besoin de le creer" -ForegroundColor Green
}

# 3. Configurer Cloud Run pour utiliser le VPC Connector
Write-Host ""
Write-Host "3. Configuration de Cloud Run..." -ForegroundColor Yellow

if ($DryRun) {
    Write-Host "   [DRY RUN] Commande qui serait executee:" -ForegroundColor Gray
    Write-Host "   gcloud run services update $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --vpc-connector=$ConnectorName --vpc-egress=all-traffic" -ForegroundColor Cyan
} else {
    Write-Host "   Mise a jour du service Cloud Run..." -ForegroundColor Gray
    $updateResult = gcloud run services update $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --vpc-connector=$ConnectorName --vpc-egress=all-traffic 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Service Cloud Run mis a jour avec succes" -ForegroundColor Green
        Write-Host "   Le service va etre redeploye automatiquement..." -ForegroundColor Gray
    } else {
        Write-Host "   [ERREUR] Impossible de mettre a jour le service" -ForegroundColor Red
        Write-Host "   $updateResult" -ForegroundColor Red
        exit 1
    }
}

# 4. Verification finale
Write-Host ""
Write-Host "4. Verification finale..." -ForegroundColor Yellow

if (-not $DryRun) {
    Start-Sleep -Seconds 10
    
    $serviceConfig = gcloud run services describe $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --format=json 2>&1
    if ($LASTEXITCODE -eq 0) {
        $serviceJson = $serviceConfig | ConvertFrom-Json
        $vpcAccess = $serviceJson.spec.template.spec.vpcAccess
        
        if ($vpcAccess -and $vpcAccess.connector -eq $ConnectorName) {
            Write-Host "   [OK] VPC Connector configure dans Cloud Run" -ForegroundColor Green
            Write-Host "      Connector: $($vpcAccess.connector)" -ForegroundColor Gray
            Write-Host "      Egress: $($vpcAccess.egress)" -ForegroundColor Gray
        } else {
            Write-Host "   [WARN] VPC Connector peut-etre en cours de configuration" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "DRY RUN TERMINE - Aucune modification effectuee" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pour appliquer les corrections, relancez sans -DryRun:" -ForegroundColor Cyan
    Write-Host "   .\scripts\fix-redis-vpc-connector.ps1" -ForegroundColor White
} else {
    Write-Host "CONFIGURATION APPLIQUEE AVEC SUCCES" -ForegroundColor Green
    Write-Host ""
    Write-Host "Prochaines etapes:" -ForegroundColor Yellow
    Write-Host "   1. Attendre que le service Cloud Run soit redeploye (1-2 minutes)" -ForegroundColor White
    Write-Host "   2. Verifier les logs pour confirmer que Redis se connecte" -ForegroundColor White
    Write-Host "   3. Tester la connexion a l'application" -ForegroundColor White
    Write-Host ""
    Write-Host "Pour voir les logs en temps reel:" -ForegroundColor Cyan
    $logCommand = "gcloud logging tail `"resource.type=cloud_run_revision AND resource.labels.service_name=$GcpServiceName`" --project=$GcpProjectId"
    Write-Host "   $logCommand" -ForegroundColor Gray
}
Write-Host ""

