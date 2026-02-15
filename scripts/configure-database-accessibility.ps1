# 🔧 Script de Configuration Accessibilité Base de Données Cloud Run
# Date: 2026-02-15
# Objectif: Configurer Cloud NAT + VPC Connector pour accéder à AWS RDS depuis Cloud Run

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$ServiceName = "yukpo-backend",
    [string]$Network = "default",
    [string]$Subnet = "default",
    [string]$DbHost = "34.79.29.219",
    [string]$DbPort = "5432"
)

Write-Host "🔧 Configuration Accessibilité Base de Données Cloud Run" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que gcloud est installé
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ERREUR: gcloud CLI n'est pas installé ou pas dans le PATH" -ForegroundColor Red
    Write-Host "   Installez Google Cloud SDK: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Vérifier l'authentification
Write-Host "🔍 Vérification de l'authentification GCP..." -ForegroundColor Yellow
$currentProject = gcloud config get-value project 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERREUR: Non authentifié avec GCP" -ForegroundColor Red
    Write-Host "   Exécutez: gcloud auth login" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Projet actuel: $currentProject" -ForegroundColor Green
if ($currentProject -ne $ProjectId) {
    Write-Host "⚠️  ATTENTION: Le projet actuel ($currentProject) ne correspond pas au projet spécifié ($ProjectId)" -ForegroundColor Yellow
    $confirm = Read-Host "   Continuer quand même? (o/N)"
    if ($confirm -ne "o" -and $confirm -ne "O") {
        exit 1
    }
}

Write-Host ""
Write-Host "📋 Configuration:" -ForegroundColor Cyan
Write-Host "   Projet: $ProjectId"
Write-Host "   Région: $Region"
Write-Host "   Service: $ServiceName"
Write-Host "   Réseau: $Network"
Write-Host "   Subnet: $Subnet"
Write-Host "   DB Host: $DbHost:$DbPort"
Write-Host ""

# Étape 1: Créer IP statique pour Cloud NAT
Write-Host "📌 Étape 1/5: Création IP statique pour Cloud NAT..." -ForegroundColor Yellow
$natIpName = "cloud-run-nat-ip"
$natIpExists = gcloud compute addresses describe $natIpName --region=$Region --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ IP statique existe déjà: $natIpName" -ForegroundColor Green
    $natIp = gcloud compute addresses describe $natIpName --region=$Region --format="value(address)" --project=$ProjectId
    Write-Host "   IP: $natIp" -ForegroundColor Cyan
} else {
    Write-Host "   Création de l'IP statique..." -ForegroundColor Yellow
    gcloud compute addresses create $natIpName `
        --region=$Region `
        --project=$ProjectId
    
    if ($LASTEXITCODE -eq 0) {
        $natIp = gcloud compute addresses describe $natIpName --region=$Region --format="value(address)" --project=$ProjectId
        Write-Host "   ✅ IP statique créée: $natIp" -ForegroundColor Green
    } else {
        Write-Host "   ❌ ERREUR: Impossible de créer l'IP statique" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Étape 2: Créer routeur Cloud
Write-Host "📌 Étape 2/5: Création routeur Cloud..." -ForegroundColor Yellow
$routerName = "cloud-run-router"
$routerExists = gcloud compute routers describe $routerName --region=$Region --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Routeur existe déjà: $routerName" -ForegroundColor Green
} else {
    Write-Host "   Création du routeur..." -ForegroundColor Yellow
    gcloud compute routers create $routerName `
        --region=$Region `
        --network=$Network `
        --project=$ProjectId
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Routeur créé: $routerName" -ForegroundColor Green
    } else {
        Write-Host "   ❌ ERREUR: Impossible de créer le routeur" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Étape 3: Créer Cloud NAT
Write-Host "📌 Étape 3/5: Création Cloud NAT..." -ForegroundColor Yellow
$natName = "cloud-run-nat"
$natExists = gcloud compute routers nats describe $natName --router=$routerName --region=$Region --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Cloud NAT existe déjà: $natName" -ForegroundColor Green
} else {
    Write-Host "   Création du Cloud NAT..." -ForegroundColor Yellow
    gcloud compute routers nats create $natName `
        --router=$routerName `
        --region=$Region `
        --nat-external-ip-pool=$natIpName `
        --nat-all-subnet-ip-ranges `
        --project=$ProjectId
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Cloud NAT créé: $natName" -ForegroundColor Green
    } else {
        Write-Host "   ❌ ERREUR: Impossible de créer le Cloud NAT" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Étape 4: Créer VPC Connector
Write-Host "📌 Étape 4/5: Création VPC Connector..." -ForegroundColor Yellow
$connectorName = "yukpo-connector"
$connectorExists = gcloud compute networks vpc-access connectors describe $connectorName --region=$Region --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ VPC Connector existe déjà: $connectorName" -ForegroundColor Green
} else {
    Write-Host "   Création du VPC Connector..." -ForegroundColor Yellow
    gcloud compute networks vpc-access connectors create $connectorName `
        --region=$Region `
        --subnet=$Subnet `
        --subnet-project=$ProjectId `
        --min-instances=2 `
        --max-instances=3 `
        --machine-type=e2-micro `
        --project=$ProjectId
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ VPC Connector créé: $connectorName" -ForegroundColor Green
    } else {
        Write-Host "   ❌ ERREUR: Impossible de créer le VPC Connector" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Étape 5: Attacher VPC Connector à Cloud Run
Write-Host "📌 Étape 5/5: Attachement VPC Connector à Cloud Run..." -ForegroundColor Yellow
Write-Host "   Mise à jour du service Cloud Run..." -ForegroundColor Yellow

gcloud run services update $ServiceName `
    --region=$Region `
    --vpc-connector=$connectorName `
    --vpc-egress=all-traffic `
    --project=$ProjectId

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ VPC Connector attaché au service Cloud Run" -ForegroundColor Green
} else {
    Write-Host "   ❌ ERREUR: Impossible d'attacher le VPC Connector" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Configuration terminée avec succès!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Prochaines Étapes:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Autoriser l'IP NAT dans AWS RDS Security Group:" -ForegroundColor Yellow
Write-Host "   IP NAT: $natIp" -ForegroundColor Cyan
Write-Host "   Port: $DbPort" -ForegroundColor Cyan
Write-Host "   Type: PostgreSQL" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Instructions AWS:" -ForegroundColor Yellow
Write-Host "   - AWS Console → RDS → Security Groups" -ForegroundColor White
Write-Host "   - Sélectionner le Security Group de votre instance RDS" -ForegroundColor White
Write-Host "   - Inbound Rules → Edit inbound rules" -ForegroundColor White
Write-Host "   - Add rule: Type=PostgreSQL, Port=$DbPort, Source=$natIp/32" -ForegroundColor White
Write-Host ""
Write-Host "2. Vérifier la connectivité:" -ForegroundColor Yellow
Write-Host "   gcloud logging read `"resource.type=cloud_run_revision AND resource.labels.service_name=$ServiceName`" --limit=20" -ForegroundColor White
Write-Host ""
Write-Host "3. Tester le service:" -ForegroundColor Yellow
Write-Host "   curl https://$ServiceName-376093909298.$Region.run.app/health" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  IMPORTANT: L'IP NAT doit être autorisée dans AWS RDS Security Group pour que la connexion fonctionne!" -ForegroundColor Red
Write-Host ""

