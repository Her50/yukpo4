# Script simplifie pour creer le Service ECS manuellement
$Region = "eu-west-1"

Write-Host "Creation du Service ECS manuellement" -ForegroundColor Cyan
Write-Host ""

# Recuperer les IDs
$VPC_ID = aws ec2 describe-vpcs --filters "Name=tag:Name,Values=yukpo-vpc" --region $Region --query "Vpcs[0].VpcId" --output text
$SUBNET_1 = aws ec2 describe-subnets --filters "Name=tag:Name,Values=yukpo-private-subnet-1" --region $Region --query "Subnets[0].SubnetId" --output text
$SUBNET_2 = aws ec2 describe-subnets --filters "Name=tag:Name,Values=yukpo-private-subnet-2" --region $Region --query "Subnets[0].SubnetId" --output text
$SG_ID = aws ec2 describe-security-groups --filters "Name=tag:Name,Values=yukpo-ecs-sg" --region $Region --query "SecurityGroups[0].GroupId" --output text
$ECR_URI = aws ecr describe-repositories --repository-names yukpo-backend --region $Region --query "repositories[0].repositoryUri" --output text
$EXECUTION_ROLE = "arn:aws:iam::108964700972:role/yukpo-ecs-execution-role"
$TASK_ROLE = "arn:aws:iam::108964700972:role/yukpo-ecs-task-role"

Write-Host "IDs recuperes:" -ForegroundColor Green
Write-Host "  Subnets: $SUBNET_1, $SUBNET_2"
Write-Host "  Security Group: $SG_ID"
Write-Host "  ECR URI: $ECR_URI"
Write-Host ""

# Creer la Task Definition JSON
$TASK_DEF = @"
{
  "family": "yukpo-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "$EXECUTION_ROLE",
  "taskRoleArn": "$TASK_ROLE",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "$ECR_URI:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "RUST_LOG",
          "value": "info"
        },
        {
          "name": "APP_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:ssm:$Region:108964700972:parameter/yukpo/production/DATABASE_URL"
        },
        {
          "name": "REDIS_URL",
          "valueFrom": "arn:aws:ssm:$Region:108964700972:parameter/yukpo/production/REDIS_URL"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:ssm:$Region:108964700972:parameter/yukpo/production/JWT_SECRET"
        },
        {
          "name": "S3_BUCKET",
          "valueFrom": "arn:aws:ssm:$Region:108964700972:parameter/yukpo/production/S3_BUCKET"
        },
        {
          "name": "S3_REGION",
          "valueFrom": "arn:aws:ssm:$Region:108964700972:parameter/yukpo/production/S3_REGION"
        },
        {
          "name": "S3_ACCESS_KEY",
          "valueFrom": "arn:aws:ssm:$Region:108964700972:parameter/yukpo/production/S3_ACCESS_KEY"
        },
        {
          "name": "S3_SECRET_KEY",
          "valueFrom": "arn:aws:ssm:$Region:108964700972:parameter/yukpo/production/S3_SECRET_KEY"
        },
        {
          "name": "UPLOAD_BASE_URL",
          "valueFrom": "arn:aws:ssm:$Region:108964700972:parameter/yukpo/production/UPLOAD_BASE_URL"
        },
        {
          "name": "LAUNCH_PHASE_START_DATE",
          "valueFrom": "arn:aws:ssm:$Region:108964700972:parameter/yukpo/production/LAUNCH_PHASE_START_DATE"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/yukpo-backend",
          "awslogs-region": "$Region",
          "awslogs-stream-prefix": "backend"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
"@

# Sauvegarder dans un fichier
$TASK_FILE = "task-def.json"
$TASK_DEF | Out-File -FilePath $TASK_FILE -Encoding UTF8 -NoNewline

Write-Host "Enregistrement de la Task Definition..." -ForegroundColor Yellow
aws ecs register-task-definition --cli-input-json "file://$TASK_FILE" --region $Region

if ($LASTEXITCODE -eq 0) {
    Write-Host "Task Definition creee avec succes!" -ForegroundColor Green
    Remove-Item $TASK_FILE -ErrorAction SilentlyContinue
} else {
    Write-Host "Erreur lors de la creation de la Task Definition" -ForegroundColor Red
    Remove-Item $TASK_FILE -ErrorAction SilentlyContinue
    exit 1
}
Write-Host ""

# Creer le Service ECS
Write-Host "Creation du Service ECS (sans Load Balancer)..." -ForegroundColor Yellow

aws ecs create-service `
  --cluster yukpo-cluster `
  --service-name yukpo-backend-service `
  --task-definition yukpo-backend `
  --desired-count 1 `
  --launch-type FARGATE `
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2],securityGroups=[$SG_ID],assignPublicIp=DISABLED}" `
  --region $Region

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Service ECS cree avec succes!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Pour voir les logs:" -ForegroundColor Cyan
    Write-Host "  aws logs tail /ecs/yukpo-backend --region $Region --follow" -ForegroundColor Yellow
} else {
    Write-Host "Erreur lors de la creation du service" -ForegroundColor Red
    exit 1
}

