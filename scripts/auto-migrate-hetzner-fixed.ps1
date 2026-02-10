# Script de Migration Automatique Complete vers Hetzner
# Ce script automatise TOUT : generation cles, configuration AWS, deploiement Hetzner

param(
    [string]$HetznerHost = "46.224.14.85",
    [string]$HetznerUser = "root",
    [string]$HetznerDir = "/opt/yukpo",
    [string]$AwsRegion = "us-east-1",
    [string]$AwsCluster = "yukpomnang-cluster",
    [string]$AwsService = "yukpomnang-backend-service"
)

$ErrorActionPreference = "Stop"

Write-Host "Migration Automatique Complete vers Hetzner" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Gray
Write-Host ""

# ETAPE 1 : Verifier les prerequis
Write-Host "ETAPE 1 : Verification des prerequis" -ForegroundColor Yellow
Write-Host ""

$awsCli = Get-Command aws -ErrorAction SilentlyContinue
if (-not $awsCli) {
    Write-Host "ERREUR: AWS CLI non trouve" -ForegroundColor Red
    exit 1
}
Write-Host "OK: AWS CLI trouve" -ForegroundColor Green

$sshCli = Get-Command ssh -ErrorAction SilentlyContinue
if (-not $sshCli) {
    Write-Host "ERREUR: SSH non trouve" -ForegroundColor Red
    exit 1
}
Write-Host "OK: SSH trouve" -ForegroundColor Green

$awsIdentity = aws sts get-caller-identity 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: AWS credentials non configurees" -ForegroundColor Red
    exit 1
}
Write-Host "OK: AWS credentials configurees" -ForegroundColor Green

# ETAPE 2 : Generer la cle SSH
Write-Host ""
Write-Host "ETAPE 2 : Generation de la cle SSH" -ForegroundColor Yellow
Write-Host ""

$sshKeyPath = "$env:USERPROFILE\.ssh\hetzner_deploy"
$sshKeyPathPub = "$sshKeyPath.pub"

if (Test-Path $sshKeyPath) {
    Remove-Item $sshKeyPath -Force -ErrorAction SilentlyContinue
    Remove-Item $sshKeyPathPub -Force -ErrorAction SilentlyContinue
}

ssh-keygen -t ed25519 -C "github-actions-hetzner" -f $sshKeyPath -N '""' -q

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Generation de la cle SSH echouee" -ForegroundColor Red
    exit 1
}
Write-Host "OK: Cle SSH generee" -ForegroundColor Green

# ETAPE 3 : Copier la cle publique sur Hetzner
Write-Host ""
Write-Host "ETAPE 3 : Configuration SSH sur Hetzner" -ForegroundColor Yellow
Write-Host ""

$publicKey = Get-Content $sshKeyPathPub -Raw

$testConnection = ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$HetznerUser@$HetznerHost" "echo OK" 2>&1

if ($LASTEXITCODE -ne 0) {
    $publicKeyContent = Get-Content $sshKeyPathPub -Raw
    ssh "$HetznerUser@$HetznerHost" "mkdir -p ~/.ssh; chmod 700 ~/.ssh; echo '$publicKeyContent' >> ~/.ssh/authorized_keys; chmod 600 ~/.ssh/authorized_keys" 2>&1 | Out-Null
}

$testKeyConnection = ssh -i $sshKeyPath -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$HetznerUser@$HetznerHost" "echo OK" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "OK: Connexion SSH configuree" -ForegroundColor Green
} else {
    Write-Host "ATTENTION: Connexion SSH echouee" -ForegroundColor Yellow
}

# ETAPE 4 : Recuperer les variables d'environnement depuis AWS
Write-Host ""
Write-Host "ETAPE 4 : Recuperation des variables depuis AWS" -ForegroundColor Yellow
Write-Host ""

$taskDefJson = aws ecs describe-services --cluster $AwsCluster --services $AwsService --region $AwsRegion --query 'services[0].taskDefinition' --output text 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Impossible de recuperer la task definition" -ForegroundColor Red
    exit 1
}

$taskDefDetails = aws ecs describe-task-definition --task-definition $taskDefJson --region $AwsRegion --output json 2>&1 | ConvertFrom-Json

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Impossible de recuperer les details" -ForegroundColor Red
    exit 1
}

$envVars = @{}
$containerDef = $taskDefDetails.taskDefinition.containerDefinitions[0]

if ($containerDef.environment) {
    foreach ($env in $containerDef.environment) {
        $envVars[$env.name] = $env.value
    }
}

# Recuperer les secrets
if ($containerDef.secrets) {
    foreach ($secret in $containerDef.secrets) {
        $secretName = $secret.name
        $secretValueFrom = $secret.valueFrom
        
        if ($secretValueFrom -like "arn:aws:secretsmanager:*") {
            $secretArn = $secretValueFrom
            $secretData = aws secretsmanager get-secret-value --secret-id $secretArn --region $AwsRegion --query 'SecretString' --output text 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                try {
                    $secretJson = $secretData | ConvertFrom-Json
                    foreach ($key in $secretJson.PSObject.Properties.Name) {
                        $envVars[$key] = $secretJson.$key
                    }
                } catch {
                    $envVars[$secretName] = $secretData
                }
            }
        } elseif ($secretValueFrom -like "arn:aws:ssm:*") {
            $paramName = $secretValueFrom -replace 'arn:aws:ssm:[^:]+:\d+:parameter/', ''
            $paramValue = aws ssm get-parameter --name $paramName --region $AwsRegion --with-decryption --query 'Parameter.Value' --output text 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                $envVars[$secretName] = $paramValue
            }
        }
    }
}

Write-Host "OK: $($envVars.Count) variables recuperees" -ForegroundColor Green

# ETAPE 5 : Preparer Hetzner
Write-Host ""
Write-Host "ETAPE 5 : Preparation de Hetzner" -ForegroundColor Yellow
Write-Host ""

$dockerCheck = ssh -i $sshKeyPath -o StrictHostKeyChecking=no "$HetznerUser@$HetznerHost" "command -v docker" 2>&1

if ($LASTEXITCODE -ne 0) {
    ssh -i $sshKeyPath -o StrictHostKeyChecking=no "$HetznerUser@$HetznerHost" "curl -fsSL https://get.docker.com -o get-docker.sh; sh get-docker.sh; systemctl enable docker; systemctl start docker" 2>&1 | Out-Null
}

ssh -i $sshKeyPath -o StrictHostKeyChecking=no "$HetznerUser@$HetznerHost" "mkdir -p $HetznerDir/backend $HetznerDir/nginx $HetznerDir/logs" 2>&1 | Out-Null

Write-Host "OK: Hetzner prepare" -ForegroundColor Green

# ETAPE 6 : Creer le fichier .env
Write-Host ""
Write-Host "ETAPE 6 : Creation du fichier .env" -ForegroundColor Yellow
Write-Host ""

$hetznerEnvContent = "# Variables d'environnement - Migrees depuis AWS`n"
$hetznerEnvContent += "# Genere automatiquement le $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n`n"

foreach ($key in $envVars.Keys | Sort-Object) {
    $value = $envVars[$key]
    
    if ($key -eq "DATABASE_URL") {
        if ($value -like "*rds.amazonaws.com*") {
            $parts = $value -split "@"
            if ($parts.Length -eq 2) {
                $authPart = $parts[0]
                $hostPart = $parts[1]
                $dbName = ($hostPart -split "/")[1]
                $value = "$authPart@postgres:5432/$dbName"
            }
        }
    } elseif ($key -eq "REDIS_URL") {
        if ($value -like "*elasticache*" -or $value -like "*upstash*" -or $value -like "*cache.amazonaws.com*") {
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
    
    $hetznerEnvContent += "${key}=${value}`n"
}

$hetznerEnvContent += "`n# Variables specifiques Hetzner`n"
$hetznerEnvContent += "HOST=0.0.0.0`n"
$hetznerEnvContent += "PORT=8080`n"
$hetznerEnvContent += "ENVIRONMENT=production`n"
$hetznerEnvContent += "RUST_LOG=info`n"

$tempEnvFile = [System.IO.Path]::GetTempFileName()
$hetznerEnvContent | Out-File -FilePath $tempEnvFile -Encoding UTF8 -NoNewline

scp -i $sshKeyPath -o StrictHostKeyChecking=no $tempEnvFile "${HetznerUser}@${HetznerHost}:${HetznerDir}/.env" 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    ssh -i $sshKeyPath -o StrictHostKeyChecking=no "${HetznerUser}@${HetznerHost}" "chmod 600 ${HetznerDir}/.env" 2>&1 | Out-Null
    Write-Host "OK: Fichier .env cree" -ForegroundColor Green
} else {
    Write-Host "ERREUR: Impossible de copier le fichier .env" -ForegroundColor Red
    exit 1
}

Remove-Item $tempEnvFile -Force

# ETAPE 7 : Instructions GitHub Secrets
Write-Host ""
Write-Host "ETAPE 7 : Instructions GitHub Secrets" -ForegroundColor Yellow
Write-Host ""

$privateKey = Get-Content $sshKeyPath -Raw

$instructionsFile = "GITHUB_SECRETS_INSTRUCTIONS.txt"
$instructions = @"
========================================
INSTRUCTIONS POUR GITHUB SECRETS
========================================

1. Allez sur GitHub -> Votre repository -> Settings -> Secrets and variables -> Actions

2. Cliquez sur New repository secret

3. Nom : HETZNER_SSH_PRIVATE_KEY

4. Valeur : Copiez la cle privee ci-dessous (tout le contenu)

5. Cliquez sur Add secret

========================================
CLE PRIVEE SSH :
========================================

$privateKey

========================================
"@
$instructions | Out-File -FilePath $instructionsFile -Encoding UTF8

Write-Host "OK: Instructions sauvegardees dans $instructionsFile" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "MIGRATION AUTOMATIQUE TERMINEE !" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Recapitulatif:" -ForegroundColor Cyan
Write-Host "  - Cle SSH generee: $sshKeyPath" -ForegroundColor White
Write-Host "  - Variables recuperees: $($envVars.Count)" -ForegroundColor White
Write-Host "  - Fichier .env cree sur Hetzner" -ForegroundColor White
Write-Host ""
Write-Host "Prochaine etape:" -ForegroundColor Yellow
Write-Host "  1. Ajoutez HETZNER_SSH_PRIVATE_KEY dans GitHub Secrets (voir $instructionsFile)" -ForegroundColor White
Write-Host "  2. Faites un git push pour declencher le deploiement automatique" -ForegroundColor White
Write-Host ""

