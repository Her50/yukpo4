# Script Final : Recuperer variables AWS et copier sur Hetzner

$ErrorActionPreference = "Continue"

$HetznerHost = "46.224.14.85"
$HetznerUser = "root"
$HetznerDir = "/opt/yukpo"
$AwsRegion = "us-east-1"
$AwsCluster = "yukpomnang-cluster"
$AwsService = "yukpomnang-backend-service"
$sshKeyPath = "$env:USERPROFILE\.ssh\hetzner_deploy"

Write-Host "Recuperation des variables depuis AWS..." -ForegroundColor Cyan

# Recuperer task definition
$taskDefJson = aws ecs describe-services --cluster $AwsCluster --services $AwsService --region $AwsRegion --query 'services[0].taskDefinition' --output text 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Impossible de recuperer la task definition" -ForegroundColor Red
    Write-Host $taskDefJson -ForegroundColor Red
    exit 1
}

Write-Host "Task definition: $taskDefJson" -ForegroundColor Green

# Recuperer details
$taskDefJsonContent = aws ecs describe-task-definition --task-definition $taskDefJson --region $AwsRegion --output json 2>&1
$taskDef = $taskDefJsonContent | ConvertFrom-Json

$envVars = @{}
$containerDef = $taskDef.taskDefinition.containerDefinitions[0]

# Variables d'environnement directes
if ($containerDef.environment) {
    foreach ($env in $containerDef.environment) {
        $envVars[$env.name] = $env.value
        Write-Host "Variable: $($env.name)" -ForegroundColor Gray
    }
}

# Secrets depuis Secrets Manager
if ($containerDef.secrets) {
    foreach ($secret in $containerDef.secrets) {
        $secretName = $secret.name
        $secretValueFrom = $secret.valueFrom
        
        if ($secretValueFrom -like "arn:aws:secretsmanager:*") {
            Write-Host "Recuperation secret: $secretName" -ForegroundColor Cyan
            $secretData = aws secretsmanager get-secret-value --secret-id $secretValueFrom --region $AwsRegion --query 'SecretString' --output text 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                try {
                    $secretJson = $secretData | ConvertFrom-Json
                    foreach ($key in $secretJson.PSObject.Properties.Name) {
                        $envVars[$key] = $secretJson.$key
                        Write-Host "  -> $key" -ForegroundColor Gray
                    }
                } catch {
                    $envVars[$secretName] = $secretData
                }
            }
        } elseif ($secretValueFrom -like "arn:aws:ssm:*") {
            Write-Host "Recuperation SSM: $secretName" -ForegroundColor Cyan
            $paramName = $secretValueFrom -replace 'arn:aws:ssm:[^:]+:\d+:parameter/', ''
            $paramValue = aws ssm get-parameter --name $paramName --region $AwsRegion --with-decryption --query 'Parameter.Value' --output text 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                $envVars[$secretName] = $paramValue
                Write-Host "  -> OK" -ForegroundColor Gray
            }
        }
    }
}

Write-Host "Total variables recuperees: $($envVars.Count)" -ForegroundColor Green

# Creer contenu .env
$envContent = "# Variables migrees depuis AWS`n# Genere le $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n`n"

foreach ($key in $envVars.Keys | Sort-Object) {
    $value = $envVars[$key]
    
    # Adapter pour Hetzner
    if ($key -eq "DATABASE_URL" -and $value -like "*rds.amazonaws.com*") {
        $parts = $value -split "@"
        if ($parts.Length -eq 2) {
            $authPart = $parts[0]
            $dbName = ($parts[1] -split "/")[1]
            $value = "$authPart@postgres:5432/$dbName"
        }
    } elseif ($key -eq "REDIS_URL") {
        if ($value -like "*elasticache*" -or $value -like "*upstash*" -or $value -like "*cache.amazonaws.com*") {
            $parts = $value -split "@"
            if ($parts.Length -eq 2) {
                $authPart = $parts[0]
                $dbPart = ($parts[1] -split "/")[1]
                if ([string]::IsNullOrWhiteSpace($dbPart)) { $dbPart = "0" }
                $value = "$authPart@redis:6379/$dbPart"
            } else {
                $value = "redis://redis:6379/0"
            }
        }
    }
    
    $envContent += "${key}=${value}`n"
}

$envContent += "`n# Variables Hetzner`n"
$envContent += "HOST=0.0.0.0`n"
$envContent += "PORT=8080`n"
$envContent += "ENVIRONMENT=production`n"
$envContent += "RUST_LOG=info`n"

# Sauvegarder localement
$localEnvFile = "hetzner.env"
$envContent | Out-File -FilePath $localEnvFile -Encoding UTF8 -NoNewline
Write-Host "Fichier .env cree localement: $localEnvFile" -ForegroundColor Green

# Copier sur Hetzner
Write-Host "Copie sur Hetzner..." -ForegroundColor Cyan
$knownHostsFile = "$env:USERPROFILE\.ssh\known_hosts_hetzner"
scp -i $sshKeyPath -o StrictHostKeyChecking=no -o UserKnownHostsFile=$knownHostsFile $localEnvFile "${HetznerUser}@${HetznerHost}:${HetznerDir}/.env" 2>&1

if ($LASTEXITCODE -eq 0) {
    ssh -i $sshKeyPath -o StrictHostKeyChecking=no -o UserKnownHostsFile=$knownHostsFile "${HetznerUser}@${HetznerHost}" "chmod 600 ${HetznerDir}/.env" 2>&1 | Out-Null
    Write-Host "OK: Fichier .env copie sur Hetzner" -ForegroundColor Green
} else {
    Write-Host "ATTENTION: Erreur lors de la copie" -ForegroundColor Yellow
    Write-Host "Copiez manuellement le fichier $localEnvFile sur Hetzner" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Migration terminee!" -ForegroundColor Green
Write-Host "Variables recuperees: $($envVars.Count)" -ForegroundColor Cyan
Write-Host "Fichier local: $localEnvFile" -ForegroundColor Cyan

