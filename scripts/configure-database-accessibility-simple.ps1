# Script de Configuration Accessibilite Base de Donnees Cloud Run
# Date: 2026-02-15
# Objectif: Configurer Cloud NAT + VPC Connector pour acceder a AWS RDS depuis Cloud Run

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$ServiceName = "yukpo-backend",
    [string]$Network = "default",
    [string]$Subnet = "default",
    [string]$DbHost = "34.79.29.219",
    [string]$DbPort = "5432"
)

Write-Host "Configuration Accessibilite Base de Donnees Cloud Run" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Verifier que gcloud est installe
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "[ERREUR] gcloud CLI n'est pas installe ou pas dans le PATH" -ForegroundColor Red
    Write-Host "   Installez Google Cloud SDK: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Verifier l'authentification
Write-Host "[INFO] Verification de l'authentification GCP..." -ForegroundColor Yellow
$currentProject = gcloud config get-value project 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERREUR] Non authentifie avec GCP" -ForegroundColor Red
    Write-Host "   Executez: gcloud auth login" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Projet actuel: $currentProject" -ForegroundColor Green
if ($currentProject -ne $ProjectId) {
    Write-Host "[ATTENTION] Le projet actuel ($currentProject) ne correspond pas au projet specifie ($ProjectId)" -ForegroundColor Yellow
    $confirm = Read-Host "   Continuer quand meme? (o/N)"
    if ($confirm -ne "o" -and $confirm -ne "O") {
        exit 1
    }
}

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "   Projet: $ProjectId"
Write-Host "   Region: $Region"
Write-Host "   Service: $ServiceName"
Write-Host "   Reseau: $Network"
Write-Host "   Subnet: $Subnet"
Write-Host "   DB Host: ${DbHost}:${DbPort}"
Write-Host ""

# Etape 1: Creer IP statique pour Cloud NAT
Write-Host "[ETAPE 1/5] Creation IP statique pour Cloud NAT..." -ForegroundColor Yellow
$natIpName = "cloud-run-nat-ip"
$natIpExists = gcloud compute addresses describe $natIpName --region=$Region --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] IP statique existe deja: $natIpName" -ForegroundColor Green
    $natIpOutput = gcloud compute addresses describe $natIpName --region=$Region --format="value(address)" --project=$ProjectId 2>&1
    if ($LASTEXITCODE -eq 0) {
        $natIp = $natIpOutput.ToString().Trim()
        Write-Host "   IP: $natIp" -ForegroundColor Cyan
    } else {
        Write-Host "   [WARNING] Impossible de recuperer l'IP" -ForegroundColor Yellow
        $natIp = ""
    }
} else {
    Write-Host "   Creation de l'IP statique..." -ForegroundColor Yellow
    gcloud compute addresses create $natIpName `
        --region=$Region `
        --project=$ProjectId
    
    if ($LASTEXITCODE -eq 0) {
        Start-Sleep -Seconds 2
        $natIpOutput = gcloud compute addresses describe $natIpName --region=$Region --format="value(address)" --project=$ProjectId 2>&1
        if ($LASTEXITCODE -eq 0) {
            $natIp = $natIpOutput.ToString().Trim()
            Write-Host "   [OK] IP statique creee: $natIp" -ForegroundColor Green
        } else {
            Write-Host "   [WARNING] IP creee mais impossible de recuperer l'adresse" -ForegroundColor Yellow
            $natIp = ""
        }
    } else {
        Write-Host "   [ERREUR] Impossible de creer l'IP statique" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Etape 2: Creer routeur Cloud
Write-Host "[ETAPE 2/5] Creation routeur Cloud..." -ForegroundColor Yellow
$routerName = "cloud-run-router"
$routerExists = gcloud compute routers describe $routerName --region=$Region --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] Routeur existe deja: $routerName" -ForegroundColor Green
} else {
    Write-Host "   Creation du routeur..." -ForegroundColor Yellow
    gcloud compute routers create $routerName `
        --region=$Region `
        --network=$Network `
        --project=$ProjectId
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Routeur cree: $routerName" -ForegroundColor Green
    } else {
        Write-Host "   [ERREUR] Impossible de creer le routeur" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Etape 3: Creer Cloud NAT
Write-Host "[ETAPE 3/5] Creation Cloud NAT..." -ForegroundColor Yellow
$natName = "cloud-run-nat"
$natExists = gcloud compute routers nats describe $natName --router=$routerName --region=$Region --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] Cloud NAT existe deja: $natName" -ForegroundColor Green
} else {
    Write-Host "   Creation du Cloud NAT..." -ForegroundColor Yellow
    gcloud compute routers nats create $natName `
        --router=$routerName `
        --region=$Region `
        --nat-external-ip-pool=$natIpName `
        --nat-all-subnet-ip-ranges `
        --project=$ProjectId
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Cloud NAT cree: $natName" -ForegroundColor Green
    } else {
        Write-Host "   [ERREUR] Impossible de creer le Cloud NAT" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Etape 4: Creer VPC Connector
Write-Host "[ETAPE 4/5] Creation VPC Connector..." -ForegroundColor Yellow
$connectorName = "yukpo-connector"
$connectorExists = gcloud compute networks vpc-access connectors describe $connectorName --region=$Region --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] VPC Connector existe deja: $connectorName" -ForegroundColor Green
} else {
    Write-Host "   Creation du VPC Connector..." -ForegroundColor Yellow
    gcloud compute networks vpc-access connectors create $connectorName `
        --region=$Region `
        --subnet=$Subnet `
        --subnet-project=$ProjectId `
        --min-instances=2 `
        --max-instances=3 `
        --machine-type=e2-micro `
        --project=$ProjectId
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] VPC Connector cree: $connectorName" -ForegroundColor Green
    } else {
        Write-Host "   [ERREUR] Impossible de creer le VPC Connector" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Etape 5: Attacher VPC Connector a Cloud Run
Write-Host "[ETAPE 5/5] Attachement VPC Connector a Cloud Run..." -ForegroundColor Yellow
Write-Host "   Mise a jour du service Cloud Run..." -ForegroundColor Yellow

gcloud run services update $ServiceName `
    --region=$Region `
    --vpc-connector=$connectorName `
    --vpc-egress=all-traffic `
    --project=$ProjectId

if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] VPC Connector attache au service Cloud Run" -ForegroundColor Green
} else {
    Write-Host "   [ERREUR] Impossible d'attacher le VPC Connector" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[OK] Configuration terminee avec succes!" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines Etapes:" -ForegroundColor Cyan
Write-Host ""
if ($natIp) {
    Write-Host "1. Autoriser l'IP NAT dans AWS RDS Security Group:" -ForegroundColor Yellow
    Write-Host "   IP NAT: $natIp" -ForegroundColor Cyan
    Write-Host "   Port: $DbPort" -ForegroundColor Cyan
    Write-Host "   Type: PostgreSQL" -ForegroundColor Cyan
} else {
    Write-Host "1. Recuperer l'IP NAT manuellement:" -ForegroundColor Yellow
    Write-Host "   gcloud compute addresses describe cloud-run-nat-ip --region=$Region --format='value(address)' --project=$ProjectId" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "   Instructions AWS:" -ForegroundColor Yellow
Write-Host "   - AWS Console -> RDS -> Security Groups" -ForegroundColor White
Write-Host "   - Selectionner le Security Group de votre instance RDS" -ForegroundColor White
Write-Host "   - Inbound Rules -> Edit inbound rules" -ForegroundColor White
if ($natIp) {
    Write-Host "   - Add rule: Type=PostgreSQL, Port=$DbPort, Source=$natIp/32" -ForegroundColor White
} else {
    Write-Host "   - Add rule: Type=PostgreSQL, Port=$DbPort, Source=<IP_NAT>/32" -ForegroundColor White
}
Write-Host ""
Write-Host "2. Verifier la connectivite:" -ForegroundColor Yellow
Write-Host "   gcloud logging read `"resource.type=cloud_run_revision AND resource.labels.service_name=$ServiceName`" --limit=20" -ForegroundColor White
Write-Host ""
Write-Host "3. Tester le service:" -ForegroundColor Yellow
Write-Host "   curl https://${ServiceName}-376093909298.${Region}.run.app/health" -ForegroundColor White
Write-Host ""
Write-Host "[IMPORTANT] L'IP NAT doit etre autorisee dans AWS RDS Security Group pour que la connexion fonctionne!" -ForegroundColor Red
Write-Host ""

