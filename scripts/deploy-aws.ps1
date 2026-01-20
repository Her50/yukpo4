#  Script d'Automatisation du Déploiement AWS pour Yukpomnang
# Ce script automatise la création de toute l'infrastructure AWS

param(
    [Parameter(Mandatory = $false)]
    [string]$Action = "deploy",  # deploy, destroy, update, build-only
    
    [Parameter(Mandatory = $false)]
    [switch]$SkipBuild = $false,
    
    [Parameter(Mandatory = $false)]
    [switch]$SkipMigration = $false,
    
    [Parameter(Mandatory = $false)]
    [switch]$NonInteractive = $false  # Mode non-interactif (pour CI/CD)
)

$ErrorActionPreference = "Stop"

# Couleurs pour les messages
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Error { Write-Host $args -ForegroundColor Red }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Info { Write-Host $args -ForegroundColor Cyan }

# Fonction pour vérifier les prérequis
function Test-Prerequisites {
    Write-Info " Vérification des prérequis..."
    
    $missing = @()
    
    # Vérifier AWS CLI
    try {
        $awsVersion = aws --version 2>&1
        Write-Success " AWS CLI: $awsVersion"
    }
    catch {
        $missing += "AWS CLI (https://awscli.amazonaws.com/AWSCLIV2.msi)"
    }
    
    # Vérifier Terraform
    try {
        $tfVersion = terraform version 2>&1 | Select-Object -First 1
        Write-Success " Terraform: $tfVersion"
    }
    catch {
        $missing += "Terraform (choco install terraform)"
    }
    
    # Vérifier Docker
    try {
        $dockerVersion = docker --version 2>&1
        Write-Success " Docker: $dockerVersion"
    }
    catch {
        $missing += "Docker Desktop (https://www.docker.com/products/docker-desktop)"
    }
    
    # Vérifier AWS credentials
    try {
        $identity = aws sts get-caller-identity 2>&1 | ConvertFrom-Json
        Write-Success " AWS Credentials: Connecté en tant que $($identity.Arn)"
        $script:awsAccountId = $identity.Account
        $script:awsRegion = (aws configure get region)
        if (-not $script:awsRegion) {
            $script:awsRegion = "eu-west-1"
            Write-Warning "  Région AWS non configurée, utilisation de eu-west-1 par défaut"
        }
    }
    catch {
        Write-Error " AWS credentials non configurés. Exécutez 'aws configure'"
        exit 1
    }
    
    if ($missing.Count -gt 0) {
        Write-Error " Prérequis manquants:"
        $missing | ForEach-Object { Write-Error "   - $_" }
        exit 1
    }
    
    Write-Success " Tous les prérequis sont installés"
}

# Fonction pour charger la configuration
function Get-Configuration {
    Write-Info " Chargement de la configuration..."
    
    $tfvarsPath = "infra/aws/terraform.tfvars"
    $tfvarsExamplePath = "infra/aws/terraform.tfvars.example"
    
    if (-not (Test-Path $tfvarsPath)) {
        Write-Warning "  Fichier terraform.tfvars non trouvé, création depuis l'exemple..."
        
        if (-not (Test-Path $tfvarsExamplePath)) {
            Write-Error " Fichier terraform.tfvars.example non trouvé"
            exit 1
        }
        
        Copy-Item $tfvarsExamplePath $tfvarsPath
        Write-Warning "  Veuillez éditer infra/aws/terraform.tfvars avec vos valeurs"
        Write-Warning "  Notamment: rds_password, jwt_secret"
        
        # Demander les valeurs critiques
        $rdsPassword = Read-Host "Entrez le mot de passe RDS (minimum 8 caract�res)" -AsSecureString
        $jwtSecret = Read-Host "Entrez le JWT secret (ou appuyez sur Entrée pour générer)"
        
        if ([string]::IsNullOrEmpty($jwtSecret)) {
            $jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
            Write-Success " JWT secret généré automatiquement"
        }
        
        # Mettre � jour le fichier
        $content = Get-Content $tfvarsPath -Raw
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($rdsPassword)
        $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
        
        $content = $content -replace "rds_password\s*=\s*.*", "rds_password = `"$plainPassword`""
        $content = $content -replace "jwt_secret\s*=\s*.*", "jwt_secret = `"$jwtSecret`""
        $content = $content -replace "aws_region\s*=\s*.*", "aws_region = `"$script:awsRegion`""
        
        Set-Content -Path $tfvarsPath -Value $content -NoNewline
        
        Write-Success " Configuration sauvegardée dans $tfvarsPath"
    }
    
    # Charger les variables depuis terraform.tfvars
    $tfvars = Get-Content $tfvarsPath -Raw
    if ($tfvars -match 'project_name\s*=\s*"([^"]+)"') {
        $script:projectName = $matches[1]
    }
    else {
        $script:projectName = "yukpomnang"
    }
    
    # R�cup�rer l'URL ECR depuis les outputs Terraform si l'infrastructure existe d�j�
    Push-Location "infra/aws"
    try {
        $hasState = Test-Path "terraform.tfstate"
        if ($hasState) {
            terraform output -json 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                $outputs = terraform output -json 2>&1 | ConvertFrom-Json
                if ($outputs.ecr_repository_url) {
                    $script:ecrUrl = $outputs.ecr_repository_url.value
                    Write-Info "   ECR Repository: $script:ecrUrl"
                }
            }
        }
    }
    catch {
        # Si Terraform n'est pas initialis� ou l'infrastructure n'existe pas, on utilisera la valeur par d�faut
        Write-Info "   Infrastructure non deployee, ECR sera cree lors du deploiement"
    }
    finally {
        Pop-Location
    }
    
    # Si ECR URL n'est pas d�finie, construire l'URL par d�faut
    if ([string]::IsNullOrEmpty($script:ecrUrl)) {
        $script:ecrUrl = "$script:awsAccountId.dkr.ecr.$script:awsRegion.amazonaws.com/$script:projectName-backend"
    }
    
    Write-Success " Configuration charg�e: Projet=$script:projectName, R�gion=$script:awsRegion, Account=$script:awsAccountId"
}

# Fonction pour initialiser Terraform
function Initialize-Terraform {
    Write-Info "� Initialisation de Terraform..."
    
    Push-Location "infra/aws"
    
    try {
        terraform init
        if ($LASTEXITCODE -ne 0) {
            throw "Échec de l'initialisation Terraform"
        }
        Write-Success " Terraform initialisé"
    }
    catch {
        Write-Error " Erreur lors de l'initialisation Terraform: $_"
        Pop-Location
        exit 1
    }
    finally {
        Pop-Location
    }
}

# Fonction pour créer l'infrastructure avec Terraform
function Deploy-Infrastructure {
    Write-Info "  Création de l'infrastructure AWS avec Terraform..."
    
    Push-Location "infra/aws"
    
    try {
        # Plan Terraform
        Write-Info " Génération du plan Terraform..."
        terraform plan -out=tfplan
        
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "  Plan Terraform a échoué ou aucune modification nécessaire"
            # Vérifier si l'infrastructure existe déjà
            $hasState = Test-Path "terraform.tfstate"
            if ($hasState) {
                Write-Info "  Infrastructure existe déjà, récupération des outputs..."
                try {
                    $outputs = terraform output -json 2>&1 | ConvertFrom-Json
                    if ($outputs.ecr_repository_url) {
                        $script:ecrUrl = $outputs.ecr_repository_url.value
                        $script:albDns = $outputs.alb_dns_name.value
                        $script:rdsEndpoint = $outputs.rds_endpoint.value
                        $script:redisEndpoint = $outputs.redis_endpoint.value
                        Write-Success "  Outputs récupérés depuis l'infrastructure existante"
                        Pop-Location
                        return $true
                    }
                }
                catch {
                    Write-Warning "  Impossible de récupérer les outputs, continuation sans Terraform"
                }
            }
            Pop-Location
            return $false
        }
        
        # Demander confirmation seulement en mode interactif
        $shouldApply = $true
        if (-not $NonInteractive) {
            try {
                $confirm = Read-Host "Voulez-vous créer cette infrastructure ? (oui/non)"
                if ($confirm -ne "oui" -and $confirm -ne "o" -and $confirm -ne "y" -and $confirm -ne "yes") {
                    Write-Warning "  Déploiement annulé"
                    Pop-Location
                    return $false
                }
            }
            catch {
                # Mode non-interactif détecté automatiquement
                Write-Info "  Mode non-interactif détecté, application automatique du plan"
                $NonInteractive = $true
            }
        }
        
        if ($shouldApply) {
            # Appliquer
            Write-Info " Création de l'infrastructure..."
            if ($NonInteractive) {
                terraform apply -auto-approve tfplan
            }
            else {
                terraform apply tfplan
            }
            
            if ($LASTEXITCODE -ne 0) {
                throw "Échec du déploiement Terraform"
            }
            
            # Récupérer les outputs
            $outputs = terraform output -json | ConvertFrom-Json
            $script:ecrUrl = $outputs.ecr_repository_url.value
            $script:albDns = $outputs.alb_dns_name.value
            $script:rdsEndpoint = $outputs.rds_endpoint.value
            $script:redisEndpoint = $outputs.redis_endpoint.value
            
            Write-Success " Infrastructure créée avec succès"
            Write-Info "   ECR Repository: $script:ecrUrl"
            Write-Info "   ALB DNS: $script:albDns"
            Write-Info "   RDS Endpoint: $script:rdsEndpoint"
            Write-Info "   Redis Endpoint: $script:redisEndpoint"
        }
        
        return $true
    }
    catch {
        Write-Error " Erreur lors du déploiement Terraform: $_"
        # En cas d'erreur, essayer de continuer si l'infrastructure existe déjà
        Write-Info "  Tentative de récupération des outputs depuis l'infrastructure existante..."
        try {
            $outputs = terraform output -json 2>&1 | ConvertFrom-Json
            if ($outputs.ecr_repository_url) {
                $script:ecrUrl = $outputs.ecr_repository_url.value
                Write-Info "  ECR URL récupérée: $script:ecrUrl"
                Pop-Location
                return $true
            }
        }
        catch {
            Write-Warning "  Impossible de récupérer les outputs"
        }
        Pop-Location
        return $false
    }
    finally {
        Pop-Location
    }
}

# Fonction pour build et push l'image Docker
function Build-And-Push-Image {
    # Authentifier Docker avec ECR (nécessaire dans tous les cas)
    Write-Info "Authentification ECR..."
    $ecrRegistry = $script:ecrUrl.Replace("/$script:projectName-backend", "")
    
    try {
        # Récupérer le mot de passe ECR
        $ecrPassword = aws ecr get-login-password --region $script:awsRegion 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Échec de la récupération du mot de passe ECR: $ecrPassword"
        }
        
        # Authentifier Docker avec ECR
        $ecrPassword | docker login --username AWS --password-stdin $ecrRegistry 2>&1 | Out-Null
        
        if ($LASTEXITCODE -ne 0) {
            throw "Échec de l'authentification Docker avec ECR"
        }
        
        Write-Success "Authentification ECR réussie"
    }
    catch {
        Write-Error "Erreur lors de l'authentification ECR: $_"
        return $false
    }
    
    if ($SkipBuild) {
        Write-Warning "Build Docker ignore (SkipBuild parameter)"
        # V�rifier si l'image locale existe
        $localImage = "$script:projectName-backend:latest"
        docker image inspect $localImage 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Image locale $localImage introuvable. Lancez le build d'abord."
            return $false
        }
        Write-Info "Utilisation de l'image locale existante: $localImage"
    }
    else {
        # Build l'image
        Write-Info "Build de l'image Docker..."
        Push-Location "backend"
        
        try {
            docker build -t "$script:projectName-backend:latest" -f Dockerfile.cloud .
            
            if ($LASTEXITCODE -ne 0) {
                throw "Echec du build Docker"
            }
            
            Write-Success "Image Docker build�e avec succ�s"
        }
        catch {
            Write-Error "Erreur lors du build Docker: $_"
            Pop-Location
            return $false
        }
        finally {
            Pop-Location
        }
    }
    
    # Tag et push vers ECR (dans tous les cas)
    Write-Info "Tag de l'image pour ECR..."
    # PowerShell: "$script:ecrUrl:latest" est interprété comme une variable invalide (à cause du ':').
    # Utiliser ${} pour concaténer correctement le tag.
    docker tag "$script:projectName-backend:latest" "${script:ecrUrl}:latest"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Echec du tag Docker"
        return $false
    }
    
    # Push vers ECR
    Write-Info "Push de l'image vers ECR..."
    docker push "${script:ecrUrl}:latest"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Echec du push Docker"
        return $false
    }
    
    Write-Success "Image Docker push�e avec succ�s vers ECR"
    return $true
}

# Fonction pour mettre � jour le service ECS
function Update-ECSService {
    Write-Info "� Mise � jour du service ECS..."
    
    $clusterName = "$script:projectName-cluster"
    $serviceName = "$script:projectName-backend-service"
    
    try {
        aws ecs update-service `
            --cluster $clusterName `
            --service $serviceName `
            --force-new-deployment `
            --region $script:awsRegion | Out-Null
        
        Write-Success " Service ECS mis � jour, nouveau déploiement en cours..."
        Write-Info "   Surveillez le déploiement avec:"
        Write-Info "   aws ecs describe-services --cluster $clusterName --services $serviceName --region $script:awsRegion"
        
        return $true
    } catch {
        Write-Error " Erreur lors de la mise � jour du service ECS: $_"
        return $false
    }
}

# Fonction pour migrer les données depuis Render
function Migrate-DataFromRender {
    param([bool]$SkipMigration = $false)
    if ($SkipMigration) {
        Write-Warning "Migration des donnees ignoree (SkipMigration parameter)"
        return $true
    }
    
    Write-Info "� Migration des données depuis Render..."
    
    $renderDbUrl = Read-Host "Entrez l'URL de connexion Render DB (ou appuyez sur Entrée pour ignorer)"
    
    if ([string]::IsNullOrEmpty($renderDbUrl)) {
        Write-Warning "  Migration ignorée"
        return $true
    }
    
    Write-Info "� Export des données depuis Render..."
    
    # Vérifier que pg_dump est disponible
    try {
        pg_dump --version | Out-Null
    } catch {
        Write-Error " pg_dump non trouvé. Installez PostgreSQL client tools"
        return $false
    }
    
    $backupFile = "backup_render_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
    
    try {
        # Export
        $env:PGPASSWORD = ($renderDbUrl -split ':')[2] -replace '@.*', ''
        pg_dump $renderDbUrl -F c -f $backupFile
        
        Write-Success " Données exportées vers $backupFile"
        
        # Import vers RDS
        Write-Info " Import des données vers RDS..."
        
        $rdsUrl = Read-Host "Entrez l'URL de connexion RDS (format: postgresql://user:pass@host:port/db)"
        
        if (-not [string]::IsNullOrEmpty($rdsUrl)) {
            $env:PGPASSWORD = ($rdsUrl -split ':')[2] -replace '@.*', ''
            pg_restore -d $rdsUrl -F c $backupFile --no-owner --no-acl
            
            Write-Success " Données importées vers RDS"
        } else {
            Write-Warning "  Import ignoré, vous pouvez le faire manuellement plus tard"
        }
        
        return $true
    } catch {
        Write-Error " Erreur lors de la migration: $_"
        return $false
    }
}

# Fonction pour afficher les informations finales
function Show-FinalInfo {
    Write-Success "�� Déploiement terminé avec succ�s !"
    Write-Host ""
    Write-Info " Informations importantes:"
    Write-Host "   ALB URL: http://$script:albDns"
    Write-Host "   Health Check: http://$script:albDns/health"
    Write-Host ""
    Write-Info " Commandes utiles:"
    Write-Host "   # Voir les logs ECS"
    Write-Host "   aws logs tail /ecs/$script:projectName-backend --follow --region $script:awsRegion"
    Write-Host ""
    Write-Host "   # Voir le statut du service"
    Write-Host "   aws ecs describe-services --cluster $script:projectName-cluster --services $script:projectName-backend-service --region $script:awsRegion"
    Write-Host ""
    Write-Host "   # Mettre � jour le service apr�s un nouveau build"
    Write-Host "   aws ecs update-service --cluster $script:projectName-cluster --service $script:projectName-backend-service --force-new-deployment --region $script:awsRegion"
    Write-Host ""
    Write-Warning "  N'oubliez pas de:"
    Write-Host "   1. Configurer un certificat SSL dans ACM pour HTTPS"
    Write-Host "   2. Configurer un domaine DNS pointant vers l'ALB"
    Write-Host "   3. Appliquer les extensions PostgreSQL (pgvector, imgsmlr) sur RDS"
}

# Fonction pour détruire l'infrastructure
function Destroy-Infrastructure {
    Write-Warning "  ATTENTION: Vous allez détruire toute l'infrastructure AWS !"
    $confirm = Read-Host "Tapez 'DESTROY' pour confirmer"
    
    if ($confirm -ne "DESTROY") {
        Write-Info " Destruction annulée"
        return
    }
    
    Push-Location "infra/aws"
    
    try {
        terraform destroy -auto-approve
        Write-Success " Infrastructure détruite"
    }
    catch {
        Write-Error " Erreur lors de la destruction: $_"
    }
    finally {
        Pop-Location
    }
}

# Fonction principale
function Main {
    Write-Host " Déploiement AWS Automatisé - Yukpomnang" -ForegroundColor Cyan
    Write-Host "===========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Vérifier les prérequis
    Test-Prerequisites
    
    # Charger la configuration
    Get-Configuration
    
    # Actions
    switch ($Action.ToLower()) {
        "deploy" {
            Initialize-Terraform
            if (Deploy-Infrastructure) {
                Build-And-Push-Image
                Update-ECSService
                if (-not $SkipMigration) {
                    Migrate-DataFromRender -SkipMigration $SkipMigration
                }
                Show-FinalInfo
            }
            else {
                # Même si Terraform échoue, essayer de continuer avec le build si l'infrastructure existe
                Write-Info "Tentative de continuation avec le build Docker..."
                if (-not [string]::IsNullOrEmpty($script:ecrUrl)) {
                    Build-And-Push-Image
                    Update-ECSService
                }
            }
        }
        "update" {
            Build-And-Push-Image
            Update-ECSService
        }
        "build-only" {
            Build-And-Push-Image
            Update-ECSService
        }
        "destroy" {
            Destroy-Infrastructure
        }
        default {
            Write-Error " Action inconnue: $Action (utilisez: deploy, update, build-only, destroy)"
            exit 1
        }
    }
}

# Exécution
try {
    Main
}
catch {
    Write-Error " Erreur fatale: $_"
    exit 1
}
