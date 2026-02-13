# Script pour créer le Service ECS manuellement (sans Load Balancer)
# Utilise les ressources déjà créées par Terraform

$Region = "eu-west-1"
$ClusterName = "yukpo-cluster"
$ServiceName = "yukpo-backend-service"
$TaskFamily = "yukpo-backend"

Write-Host "🚀 Création du Service ECS Manuellement" -ForegroundColor Cyan
Write-Host "Région: $Region" -ForegroundColor Yellow
Write-Host ""

# 1. Récupérer les IDs nécessaires
Write-Host "📋 Étape 1: Récupération des IDs..." -ForegroundColor Cyan

$VPC_ID = aws ec2 describe-vpcs --filters "Name=tag:Name,Values=yukpo-vpc" --region $Region --query "Vpcs[0].VpcId" --output text
$SUBNET_1 = aws ec2 describe-subnets --filters "Name=tag:Name,Values=yukpo-private-subnet-1" --region $Region --query "Subnets[0].SubnetId" --output text
$SUBNET_2 = aws ec2 describe-subnets --filters "Name=tag:Name,Values=yukpo-private-subnet-2" --region $Region --query "Subnets[0].SubnetId" --output text
$SG_ID = aws ec2 describe-security-groups --filters "Name=tag:Name,Values=yukpo-ecs-sg" --region $Region --query "SecurityGroups[0].GroupId" --output text
$ECR_URI = aws ecr describe-repositories --repository-names yukpo-backend --region $Region --query "repositories[0].repositoryUri" --output text
$EXECUTION_ROLE = aws iam get-role --role-name yukpo-ecs-execution-role --region $Region --query "Role.Arn" --output text
$TASK_ROLE = aws iam get-role --role-name yukpo-ecs-task-role --region $Region --query "Role.Arn" --output text
$LOG_GROUP = "/ecs/yukpo-backend"

Write-Host "   VPC: $VPC_ID" -ForegroundColor Green
Write-Host "   Subnets: $SUBNET_1, $SUBNET_2" -ForegroundColor Green
Write-Host "   Security Group: $SG_ID" -ForegroundColor Green
Write-Host "   ECR URI: $ECR_URI" -ForegroundColor Green
Write-Host ""

# 2. Récupérer les valeurs depuis SSM
Write-Host "📋 Étape 2: Récupération des secrets depuis SSM..." -ForegroundColor Cyan

$DATABASE_URL = aws ssm get-parameter --name "/yukpo/production/DATABASE_URL" --region $Region --with-decryption --query "Parameter.Value" --output text
$REDIS_URL = aws ssm get-parameter --name "/yukpo/production/REDIS_URL" --region $Region --with-decryption --query "Parameter.Value" --output text
$JWT_SECRET = aws ssm get-parameter --name "/yukpo/production/JWT_SECRET" --region $Region --with-decryption --query "Parameter.Value" --output text

if (-not $DATABASE_URL -or -not $REDIS_URL -or -not $JWT_SECRET) {
    Write-Host "❌ Erreur: Certains secrets manquent dans SSM" -ForegroundColor Red
    Write-Host "   DATABASE_URL: $(if ($DATABASE_URL) {'✅'} else {'❌'})" -ForegroundColor $(if ($DATABASE_URL) {'Green'} else {'Red'})
    Write-Host "   REDIS_URL: $(if ($REDIS_URL) {'✅'} else {'❌'})" -ForegroundColor $(if ($REDIS_URL) {'Green'} else {'Red'})
    Write-Host "   JWT_SECRET: $(if ($JWT_SECRET) {'✅'} else {'❌'})" -ForegroundColor $(if ($JWT_SECRET) {'Green'} else {'Red'})
    exit 1
}

Write-Host "   Secrets récupérés ✅" -ForegroundColor Green
Write-Host ""

# 3. Créer Secrets Manager Secret (si n'existe pas)
Write-Host "📋 Étape 3: Vérification/Création de Secrets Manager..." -ForegroundColor Cyan

$SECRET_LIST = aws secretsmanager list-secrets --region $Region --output json | ConvertFrom-Json
$SECRET_ARN = ($SECRET_LIST.SecretList | Where-Object { $_.Name -like "yukpo/backend/secrets*" }).ARN

if (-not $SECRET_ARN) {
    Write-Host "   Création du secret dans Secrets Manager..." -ForegroundColor Yellow
    
    $SECRET_JSON = @{
        DATABASE_URL = $DATABASE_URL
        REDIS_URL = $REDIS_URL
        JWT_SECRET = $JWT_SECRET
        ENABLE_AUTO_MIGRATIONS = "true"
    } | ConvertTo-Json -Compress
    
    $SECRET_ARN = aws secretsmanager create-secret `
        --name "yukpo/backend/secrets" `
        --description "Secrets for yukpo backend" `
        --secret-string $SECRET_JSON `
        --region $Region `
        --query "ARN" `
        --output text
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   Secret créé: $SECRET_ARN ✅" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ Erreur lors de la création du secret, utilisation de SSM directement" -ForegroundColor Yellow
        $SECRET_ARN = $null
    }
} else {
    Write-Host "   Secret existe déjà: $SECRET_ARN ✅" -ForegroundColor Green
}
Write-Host ""

# 4. Créer la Task Definition
Write-Host "📋 Étape 4: Création de la Task Definition..." -ForegroundColor Cyan

# Construire les secrets pour la Task Definition
$SECRETS_ARRAY = @()

if ($SECRET_ARN) {
    # Utiliser Secrets Manager
    $SECRETS_ARRAY = @(
        @{ name = "DATABASE_URL"; valueFrom = "$SECRET_ARN:DATABASE_URL::" },
        @{ name = "REDIS_URL"; valueFrom = "$SECRET_ARN:REDIS_URL::" },
        @{ name = "JWT_SECRET"; valueFrom = "$SECRET_ARN:JWT_SECRET::" },
        @{ name = "ENABLE_AUTO_MIGRATIONS"; valueFrom = "$SECRET_ARN:ENABLE_AUTO_MIGRATIONS::" }
    )
} else {
    # Utiliser SSM directement (si Secrets Manager n'existe pas)
    $ACCOUNT_ID = "108964700972"
    $SECRETS_ARRAY = @(
        @{ name = "DATABASE_URL"; valueFrom = "arn:aws:ssm:$Region`:$ACCOUNT_ID`:parameter/yukpo/production/DATABASE_URL" },
        @{ name = "REDIS_URL"; valueFrom = "arn:aws:ssm:$Region`:$ACCOUNT_ID`:parameter/yukpo/production/REDIS_URL" },
        @{ name = "JWT_SECRET"; valueFrom = "arn:aws:ssm:$Region`:$ACCOUNT_ID`:parameter/yukpo/production/JWT_SECRET" }
    )
}

# Ajouter les autres secrets depuis SSM
$SSM_SECRETS = @(
    @{ name = "S3_BUCKET"; valueFrom = "arn:aws:ssm:$Region`:$ACCOUNT_ID`:parameter/yukpo/production/S3_BUCKET" },
    @{ name = "S3_REGION"; valueFrom = "arn:aws:ssm:$Region`:$ACCOUNT_ID`:parameter/yukpo/production/S3_REGION" },
    @{ name = "S3_ACCESS_KEY"; valueFrom = "arn:aws:ssm:$Region`:$ACCOUNT_ID`:parameter/yukpo/production/S3_ACCESS_KEY" },
    @{ name = "S3_SECRET_KEY"; valueFrom = "arn:aws:ssm:$Region`:$ACCOUNT_ID`:parameter/yukpo/production/S3_SECRET_KEY" },
    @{ name = "UPLOAD_BASE_URL"; valueFrom = "arn:aws:ssm:$Region`:$ACCOUNT_ID`:parameter/yukpo/production/UPLOAD_BASE_URL" },
    @{ name = "LAUNCH_PHASE_START_DATE"; valueFrom = "arn:aws:ssm:$Region`:$ACCOUNT_ID`:parameter/yukpo/production/LAUNCH_PHASE_START_DATE" }
)

$ALL_SECRETS = $SECRETS_ARRAY + $SSM_SECRETS

# Créer la définition du conteneur
$CONTAINER_DEF = @{
    name = "backend"
    image = "$ECR_URI`:latest"
    essential = $true
    portMappings = @(
        @{
            containerPort = 8080
            protocol = "tcp"
        }
    )
    environment = @(
        @{ name = "RUST_LOG"; value = "info" },
        @{ name = "APP_ENV"; value = "production" }
    )
    secrets = $ALL_SECRETS
    logConfiguration = @{
        logDriver = "awslogs"
        options = @{
            "awslogs-group" = $LOG_GROUP
            "awslogs-region" = $Region
            "awslogs-stream-prefix" = "backend"
        }
    }
    healthCheck = @{
        command = @("CMD-SHELL", "curl -f http://localhost:8080/health || exit 1")
        interval = 30
        timeout = 10
        retries = 3
        startPeriod = 60
    }
}

$TASK_DEF_JSON = @{
    family = $TaskFamily
    networkMode = "awsvpc"
    requiresCompatibilities = @("FARGATE")
    cpu = "1024"
    memory = "2048"
    executionRoleArn = $EXECUTION_ROLE
    taskRoleArn = $TASK_ROLE
    containerDefinitions = @($CONTAINER_DEF)
} | ConvertTo-Json -Depth 10

# Sauvegarder dans un fichier temporaire
$TEMP_FILE = "task-def-temp.json"
$TASK_DEF_JSON | Out-File -FilePath $TEMP_FILE -Encoding UTF8

# Enregistrer la Task Definition
Write-Host "   Enregistrement de la Task Definition..." -ForegroundColor Yellow
aws ecs register-task-definition --cli-input-json "file://$TEMP_FILE" --region $Region | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "   Task Definition créée ✅" -ForegroundColor Green
    Remove-Item $TEMP_FILE -ErrorAction SilentlyContinue
} else {
    Write-Host "   ❌ Erreur lors de la création de la Task Definition" -ForegroundColor Red
    Remove-Item $TEMP_FILE -ErrorAction SilentlyContinue
    exit 1
}
Write-Host ""

# 5. Créer le Service ECS (SANS Load Balancer)
Write-Host "📋 Étape 5: Création du Service ECS (sans Load Balancer)..." -ForegroundColor Cyan

$SERVICE_JSON = @{
    serviceName = $ServiceName
    cluster = $ClusterName
    taskDefinition = $TaskFamily
    desiredCount = 1
    launchType = "FARGATE"
    networkConfiguration = @{
        awsvpcConfiguration = @{
            subnets = @($SUBNET_1, $SUBNET_2)
            securityGroups = @($SG_ID)
            assignPublicIp = "DISABLED"
        }
    }
    deploymentConfiguration = @{
        maximumPercent = 200
        minimumHealthyPercent = 100
    }
} | ConvertTo-Json -Depth 10

$SERVICE_TEMP_FILE = "service-temp.json"
$SERVICE_JSON | Out-File -FilePath $SERVICE_TEMP_FILE -Encoding UTF8

Write-Host "   Création du service..." -ForegroundColor Yellow
aws ecs create-service --cli-input-json "file://$SERVICE_TEMP_FILE" --region $Region | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "   Service ECS créé ✅" -ForegroundColor Green
    Remove-Item $SERVICE_TEMP_FILE -ErrorAction SilentlyContinue
} else {
    Write-Host "   ❌ Erreur lors de la création du service" -ForegroundColor Red
    Remove-Item $SERVICE_TEMP_FILE -ErrorAction SilentlyContinue
    exit 1
}
Write-Host ""

Write-Host "✅ Service ECS créé avec succès !" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Vérification:" -ForegroundColor Cyan
Write-Host "   Cluster: $ClusterName" -ForegroundColor Yellow
Write-Host "   Service: $ServiceName" -ForegroundColor Yellow
Write-Host "   Task Definition: $TaskFamily" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔍 Pour voir les logs:" -ForegroundColor Cyan
Write-Host "   aws logs tail $LOG_GROUP --region $Region --follow" -ForegroundColor Yellow
Write-Host ""
Write-Host "Note: Le service est cree SANS Load Balancer." -ForegroundColor Yellow
Write-Host "   Une fois le Load Balancer active, vous pourrez l ajouter au service." -ForegroundColor Yellow
