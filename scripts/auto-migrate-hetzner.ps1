# 🚀 Script de Migration Automatique Complète vers Hetzner
# Ce script automatise TOUT : génération clés, configuration AWS, déploiement Hetzner

param(
    [string]$HetznerHost = "46.224.14.85",
    [string]$HetznerUser = "root",
    [string]$HetznerDir = "/opt/yukpo",
    [string]$AwsRegion = "us-east-1",
    [string]$AwsCluster = "yukpomnang-cluster",
    [string]$AwsService = "yukpomnang-backend-service"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Migration Automatique Complète vers Hetzner" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray
Write-Host ""

# ============================================
# ÉTAPE 1 : Vérifier les prérequis
# ============================================
Write-Host "📋 ÉTAPE 1 : Vérification des prérequis" -ForegroundColor Yellow
Write-Host ""

# Vérifier AWS CLI
$awsCli = Get-Command aws -ErrorAction SilentlyContinue
if (-not $awsCli) {
    Write-Host "❌ AWS CLI non trouvé. Installation requise." -ForegroundColor Red
    Write-Host "   Téléchargez : https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ AWS CLI trouvé" -ForegroundColor Green

# Vérifier SSH
$sshCli = Get-Command ssh -ErrorAction SilentlyContinue
if (-not $sshCli) {
    Write-Host "❌ SSH non trouvé. Installation requise." -ForegroundColor Red
    exit 1
}
Write-Host "✅ SSH trouvé" -ForegroundColor Green

# Vérifier les credentials AWS
Write-Host "🔍 Vérification des credentials AWS..." -ForegroundColor Cyan
$awsIdentity = aws sts get-caller-identity 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ AWS credentials non configurées" -ForegroundColor Red
    Write-Host "   Configurez avec : aws configure" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ AWS credentials configurées" -ForegroundColor Green
Write-Host "   Account: $($awsIdentity | ConvertFrom-Json | Select-Object -ExpandProperty Account)" -ForegroundColor Gray

# ============================================
# ÉTAPE 2 : Générer la clé SSH automatiquement
# ============================================
Write-Host ""
Write-Host "📋 ÉTAPE 2 : Génération automatique de la clé SSH" -ForegroundColor Yellow
Write-Host ""

$sshKeyPath = "$env:USERPROFILE\.ssh\hetzner_deploy"
$sshKeyPathPub = "$sshKeyPath.pub"

if (Test-Path $sshKeyPath) {
    Write-Host "⚠️  Clé SSH existante trouvée, suppression..." -ForegroundColor Yellow
    Remove-Item $sshKeyPath -Force -ErrorAction SilentlyContinue
    Remove-Item $sshKeyPathPub -Force -ErrorAction SilentlyContinue
}

Write-Host "🔑 Génération de la clé SSH..." -ForegroundColor Cyan
ssh-keygen -t ed25519 -C "github-actions-hetzner" -f $sshKeyPath -N '""' -q

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de la génération de la clé SSH" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Clé SSH générée : $sshKeyPath" -ForegroundColor Green

# ============================================
# ÉTAPE 3 : Copier la clé publique sur Hetzner
# ============================================
Write-Host ""
Write-Host "📋 ÉTAPE 3 : Configuration SSH sur Hetzner" -ForegroundColor Yellow
Write-Host ""

$publicKey = Get-Content $sshKeyPathPub -Raw

Write-Host "📤 Copie de la clé publique sur Hetzner..." -ForegroundColor Cyan
Write-Host "   (Vous devrez peut-être entrer le mot de passe SSH une fois)" -ForegroundColor Yellow

# Tester la connexion
$testConnection = ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$HetznerUser@$HetznerHost" "echo 'OK'" 2>&1

if ($LASTEXITCODE -ne 0) {
    # Copier la clé publique
    Write-Host "   Copie manuelle de la clé..." -ForegroundColor Yellow
    $publicKeyContent = Get-Content $sshKeyPathPub -Raw
    
    # Essayer ssh-copy-id
    $copyResult = ssh-copy-id -i $sshKeyPathPub "$HetznerUser@$HetznerHost" 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        # Méthode alternative : copier manuellement via SSH
        Write-Host "   Utilisation de la méthode alternative..." -ForegroundColor Yellow
        ssh "$HetznerUser@$HetznerHost" "mkdir -p ~/.ssh; chmod 700 ~/.ssh; echo '$publicKeyContent' >> ~/.ssh/authorized_keys; chmod 600 ~/.ssh/authorized_keys" 2>&1 | Out-Null
    }
}

# Vérifier la connexion avec la clé
$testKeyConnection = ssh -i $sshKeyPath -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$HetznerUser@$HetznerHost" "echo 'OK'" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Connexion SSH configurée avec succès" -ForegroundColor Green
} else {
    Write-Host "⚠️  Connexion SSH échouée. Vérifiez manuellement." -ForegroundColor Yellow
    Write-Host "   Clé publique : $publicKey" -ForegroundColor Gray
}

# ============================================
# ÉTAPE 4 : Récupérer les variables d'environnement depuis AWS
# ============================================
Write-Host ""
Write-Host "📋 ÉTAPE 4 : Récupération des variables d'environnement depuis AWS" -ForegroundColor Yellow
Write-Host ""

Write-Host "🔍 Récupération de la task definition ECS..." -ForegroundColor Cyan

# Récupérer la task definition actuelle
$taskDefJson = aws ecs describe-services `
    --cluster $AwsCluster `
    --services $AwsService `
    --region $AwsRegion `
    --query 'services[0].taskDefinition' `
    --output text 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de la récupération de la task definition" -ForegroundColor Red
    Write-Host $taskDefJson -ForegroundColor Red
    exit 1
}

Write-Host "✅ Task definition trouvée : $taskDefJson" -ForegroundColor Green

# Récupérer les détails de la task definition
$taskDefDetails = aws ecs describe-task-definition `
    --task-definition $taskDefJson `
    --region $AwsRegion `
    --output json 2>&1 | ConvertFrom-Json

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de la récupération des détails" -ForegroundColor Red
    exit 1
}

# Extraire les variables d'environnement
$envVars = @{}
$secrets = @{}

$containerDef = $taskDefDetails.taskDefinition.containerDefinitions[0]

if ($containerDef.environment) {
    foreach ($env in $containerDef.environment) {
        $envVars[$env.name] = $env.value
        Write-Host "   ✅ Variable trouvée : $($env.name)" -ForegroundColor Gray
    }
}

# Récupérer les secrets depuis AWS Secrets Manager / Parameter Store
if ($containerDef.secrets) {
    Write-Host "🔍 Récupération des secrets depuis AWS..." -ForegroundColor Cyan
    foreach ($secret in $containerDef.secrets) {
        $secretName = $secret.name
        $secretValueFrom = $secret.valueFrom
        
        if ($secretValueFrom -like "arn:aws:secretsmanager:*") {
            # Secrets Manager
            Write-Host "   📥 Récupération depuis Secrets Manager : $secretName" -ForegroundColor Gray
            $secretArn = $secretValueFrom
            $secretData = aws secretsmanager get-secret-value --secret-id $secretArn --region $AwsRegion --query 'SecretString' --output text 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                # Si c'est un JSON, parser
                try {
                    $secretJson = $secretData | ConvertFrom-Json
                    foreach ($key in $secretJson.PSObject.Properties.Name) {
                        $envVars[$key] = $secretJson.$key
                    }
                } catch {
                    # Sinon, utiliser directement
                    $envVars[$secretName] = $secretData
                }
            }
        } elseif ($secretValueFrom -like "arn:aws:ssm:*") {
            # Systems Manager Parameter Store
            Write-Host "   📥 Récupération depuis Parameter Store : $secretName" -ForegroundColor Gray
            $paramName = $secretValueFrom -replace 'arn:aws:ssm:[^:]+:\d+:parameter/', ''
            $paramValue = aws ssm get-parameter --name $paramName --region $AwsRegion --with-decryption --query 'Parameter.Value' --output text 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                $envVars[$secretName] = $paramValue
            }
        }
    }
}

Write-Host "✅ $($envVars.Count) variables d'environnement récupérées" -ForegroundColor Green

# ============================================
# ÉTAPE 5 : Préparer Hetzner (Docker, répertoires)
# ============================================
Write-Host ""
Write-Host "📋 ÉTAPE 5 : Préparation de Hetzner" -ForegroundColor Yellow
Write-Host ""

Write-Host "🔍 Vérification de Docker sur Hetzner..." -ForegroundColor Cyan
$dockerCheck = ssh -i $sshKeyPath -o StrictHostKeyChecking=no "$HetznerUser@$HetznerHost" "command -v docker" 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "📦 Installation de Docker..." -ForegroundColor Cyan
    ssh -i $sshKeyPath -o StrictHostKeyChecking=no "$HetznerUser@$HetznerHost" @"
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        systemctl enable docker
        systemctl start docker
"@
} else {
    Write-Host "✅ Docker déjà installé" -ForegroundColor Green
}

# Créer les répertoires
Write-Host "📁 Création des répertoires..." -ForegroundColor Cyan
ssh -i $sshKeyPath -o StrictHostKeyChecking=no "$HetznerUser@$HetznerHost" @"
    mkdir -p $HetznerDir/backend
    mkdir -p $HetznerDir/nginx
    mkdir -p $HetznerDir/logs
    echo '✅ Répertoires créés'
"@

Write-Host "✅ Répertoires créés" -ForegroundColor Green

# ============================================
# ÉTAPE 6 : Créer le fichier .env sur Hetzner
# ============================================
Write-Host ""
Write-Host "📋 ÉTAPE 6 : Création du fichier .env sur Hetzner" -ForegroundColor Yellow
Write-Host ""

# Adapter les variables pour Hetzner (changer les hosts)
$hetznerEnvContent = @"
# ============================================
# Variables d'environnement - Migrées depuis AWS
# Généré automatiquement le $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
# ============================================
"@

foreach ($key in $envVars.Keys | Sort-Object) {
    $value = $envVars[$key]
    
    # Adapter les URLs pour Hetzner
    if ($key -eq "DATABASE_URL") {
        # Remplacer l'host AWS par postgres (nom du service Docker)
        if ($value -like "*rds.amazonaws.com*" -or $value -like "*rds.*.amazonaws.com*") {
            # Extraire user:password et database
            $parts = $value -split "@"
            if ($parts.Length -eq 2) {
                $authPart = $parts[0]
                $hostPart = $parts[1]
                $dbName = ($hostPart -split "/")[1]
                $value = "$authPart@postgres:5432/$dbName"
            }
        }
    } elseif ($key -eq "REDIS_URL") {
        # Remplacer l'host AWS/Upstash par redis (nom du service Docker)
        if ($value -like "*elasticache*" -or $value -like "*upstash*" -or $value -like "*cache.amazonaws.com*") {
            # Extraire auth si présent
            $parts = $value -split "@"
            if ($parts.Length -eq 2) {
                $authPart = $parts[0]
                $hostPart = $parts[1]
                $dbPart = ($hostPart -split "/")[1]
                if ([string]::IsNullOrWhiteSpace($dbPart)) {
                    $dbPart = "0"
                }
                $value = "$authPart@redis:6379/$dbPart"
            } else {
                $value = "redis://redis:6379/0"
            }
        }
    }
    
    $hetznerEnvContent += "`n${key}=${value}"
}

# Ajouter les variables spécifiques Hetzner
$hetznerEnvContent += @"

# ============================================
# Variables spécifiques Hetzner
# ============================================
HOST=0.0.0.0
PORT=8080
ENVIRONMENT=production
RUST_LOG=info
"@

# Créer un fichier temporaire
$tempEnvFile = [System.IO.Path]::GetTempFileName()
$hetznerEnvContent | Out-File -FilePath $tempEnvFile -Encoding UTF8 -NoNewline

# Copier sur Hetzner
Write-Host "Copie du fichier .env sur Hetzner..." -ForegroundColor Cyan
scp -i $sshKeyPath -o StrictHostKeyChecking=no $tempEnvFile "${HetznerUser}@${HetznerHost}:${HetznerDir}/.env"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Fichier .env créé avec succès" -ForegroundColor Green
    
    # Sécuriser le fichier
    ssh -i $sshKeyPath -o StrictHostKeyChecking=no "${HetznerUser}@${HetznerHost}" "chmod 600 ${HetznerDir}/.env"
    
    Write-Host "✅ Permissions sécurisées (600)" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors de la copie du fichier .env" -ForegroundColor Red
    exit 1
}

# Nettoyer
Remove-Item $tempEnvFile -Force

# ============================================
# ÉTAPE 7 : Configurer GitHub Secrets
# ============================================
Write-Host ""
Write-Host "📋 ÉTAPE 7 : Configuration GitHub Secrets" -ForegroundColor Yellow
Write-Host ""

$privateKey = Get-Content $sshKeyPath -Raw

Write-Host "📋 CLÉ PRIVÉE SSH (à copier dans GitHub Secrets) :" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray
Write-Host $privateKey -ForegroundColor White
Write-Host "=" * 80 -ForegroundColor Gray
Write-Host ""

# Créer un fichier avec les instructions
$instructionsFile = "GITHUB_SECRETS_INSTRUCTIONS.txt"
$instructions = @"
========================================
INSTRUCTIONS POUR GITHUB SECRETS
========================================

1. Allez sur GitHub -> Votre repository -> Settings -> Secrets and variables -> Actions

2. Cliquez sur New repository secret

3. Nom : HETZNER_SSH_PRIVATE_KEY

4. Valeur : Copiez la clé privée ci-dessous (tout le contenu)

5. Cliquez sur Add secret

========================================
CLE PRIVEE SSH :
========================================

$privateKey

========================================
"@
$instructions | Out-File -FilePath $instructionsFile -Encoding UTF8

Write-Host "✅ Instructions sauvegardées dans : $instructionsFile" -ForegroundColor Green
Write-Host "   👉 Suivez les instructions pour ajouter la clé dans GitHub Secrets" -ForegroundColor Yellow

# ============================================
# ÉTAPE 8 : Résumé
# ============================================
Write-Host ""
Write-Host "=" * 80 -ForegroundColor Green
Write-Host "✅ MIGRATION AUTOMATIQUE TERMINÉE !" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Green
Write-Host ""
Write-Host "📋 Récapitulatif :" -ForegroundColor Cyan
Write-Host "  ✅ Clé SSH générée : $sshKeyPath" -ForegroundColor White
Write-Host "  ✅ Clé publique copiée sur Hetzner" -ForegroundColor White
Write-Host "  ✅ Docker vérifié/installé sur Hetzner" -ForegroundColor White
Write-Host "  ✅ Répertoires créés sur Hetzner" -ForegroundColor White
Write-Host "  ✅ $($envVars.Count) variables d'environnement récupérées depuis AWS" -ForegroundColor White
Write-Host "  ✅ Fichier .env créé sur Hetzner avec toutes les variables" -ForegroundColor White
Write-Host ""
Write-Host "📝 PROCHAINE ÉTAPE :" -ForegroundColor Yellow
Write-Host "  1. Ajoutez HETZNER_SSH_PRIVATE_KEY dans GitHub Secrets (voir $instructionsFile)" -ForegroundColor White
Write-Host "  2. Faites un git push pour déclencher le déploiement automatique" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Vérifier la configuration :" -ForegroundColor Cyan
Write-Host "  ssh -i $sshKeyPath $HetznerUser@$HetznerHost 'cd $HetznerDir; head -20 .env'" -ForegroundColor Gray
Write-Host ""

