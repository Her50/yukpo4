# 🚀 Guide de Déploiement AWS ECS/Fargate

Ce guide explique comment déployer le backend Yukpomnang sur AWS ECS/Fargate.

## 📋 Prérequis

1. **AWS CLI** installé et configuré
   ```bash
   aws --version
   aws configure
   ```

2. **Docker** installé et fonctionnel
   ```bash
   docker --version
   ```

3. **jq** installé (pour le script de déploiement)
   ```bash
   jq --version
   ```

4. **Compte AWS** avec les permissions suivantes:
   - ECS (Full Access)
   - ECR (Full Access)
   - Secrets Manager (Read)
   - CloudWatch Logs (Write)
   - IAM (pour créer les rôles)

## 🏗️ Architecture AWS

```
Internet
   ↓
AWS ALB (Application Load Balancer)
   ↓
ECS Fargate Service (2+ tasks)
   ↓
AWS RDS PostgreSQL (avec pgvector)
   ↓
AWS ElastiCache Redis
```

## 📦 Étapes de Déploiement

### 1. Créer le Repository ECR

```bash
aws ecr create-repository \
    --repository-name yukpomnang-backend \
    --region us-east-1 \
    --image-scanning-configuration scanOnPush=true
```

### 2. Créer les Secrets AWS Secrets Manager

```bash
# Database URL
aws secretsmanager create-secret \
    --name yukpomnang/database-url \
    --secret-string "postgresql://user:pass@rds-endpoint:5432/yukpomnang" \
    --region us-east-1

# JWT Secret
aws secretsmanager create-secret \
    --name yukpomnang/jwt-secret \
    --secret-string "your-super-secret-jwt-key-64-chars-minimum" \
    --region us-east-1

# Redis URL
aws secretsmanager create-secret \
    --name yukpomnang/redis-url \
    --secret-string "redis://elasticache-endpoint:6379" \
    --region us-east-1

# OpenAI API Key
aws secretsmanager create-secret \
    --name yukpomnang/openai-api-key \
    --secret-string "sk-proj-..." \
    --region us-east-1

# Google Maps API Key
aws secretsmanager create-secret \
    --name yukpomnang/google-maps-api-key \
    --secret-string "AIzaSy..." \
    --region us-east-1
```

### 3. Créer les Rôles IAM

#### Execution Role (pour ECS)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "*"
    }
  ]
}
```

#### Task Role (pour l'application)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "*"
    }
  ]
}
```

### 4. Créer le Cluster ECS

```bash
aws ecs create-cluster \
    --cluster-name yukpomnang-cluster \
    --capacity-providers FARGATE FARGATE_SPOT \
    --default-capacity-provider-strategy \
        capacityProvider=FARGATE,weight=1 \
        capacityProvider=FARGATE_SPOT,weight=1 \
    --region us-east-1
```

### 5. Créer le CloudWatch Log Group

```bash
aws logs create-log-group \
    --log-group-name /ecs/yukpomnang-backend \
    --region us-east-1
```

### 6. Créer l'Application Load Balancer (ALB)

```bash
# Créer le target group
aws elbv2 create-target-group \
    --name yukpomnang-backend-tg \
    --protocol HTTP \
    --port 8080 \
    --vpc-id vpc-xxxxxxxxx \
    --target-type ip \
    --health-check-path /health \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 10 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --region us-east-1

# Créer le load balancer
aws elbv2 create-load-balancer \
    --name yukpomnang-alb \
    --subnets subnet-xxx subnet-yyy \
    --security-groups sg-xxxxxxxxx \
    --region us-east-1

# Créer la listener rule
aws elbv2 create-listener \
    --load-balancer-arn arn:aws:elasticloadbalancing:... \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:... \
    --region us-east-1
```

### 7. Enregistrer la Task Definition

```bash
cd backend/aws
# Modifier ecs-task-definition.json avec vos ARNs
aws ecs register-task-definition \
    --cli-input-json file://ecs-task-definition.json \
    --region us-east-1
```

### 8. Créer le Service ECS

```bash
aws ecs create-service \
    --cli-input-json file://ecs-service-definition.json \
    --region us-east-1
```

### 9. Déployer avec le Script Automatique

```bash
cd backend/aws
chmod +x deploy-aws.sh
./deploy-aws.sh production v1.0.0
```

## 🔄 Déploiement Continu

### Option 1: Script de Déploiement

```bash
# Déploiement manuel
./backend/aws/deploy-aws.sh production latest
```

### Option 2: GitHub Actions / CI/CD

Créer `.github/workflows/deploy-aws.yml`:

```yaml
name: Deploy to AWS ECS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - name: Deploy to ECS
        run: |
          cd backend/aws
          chmod +x deploy-aws.sh
          ./deploy-aws.sh production ${{ github.sha }}
```

## 🔍 Monitoring

### CloudWatch Logs

```bash
# Voir les logs en temps réel
aws logs tail /ecs/yukpomnang-backend --follow --region us-east-1
```

### Métriques ECS

- CPU Utilization
- Memory Utilization
- Task Count
- HTTP 5xx Errors

## 🛠️ Maintenance

### Mettre à jour le service

```bash
./backend/aws/deploy-aws.sh production v1.1.0
```

### Rollback

```bash
# Lister les révisions de task definition
aws ecs list-task-definitions \
    --family-prefix yukpomnang-backend \
    --region us-east-1

# Mettre à jour le service avec une ancienne révision
aws ecs update-service \
    --cluster yukpomnang-cluster \
    --service yukpomnang-backend-service \
    --task-definition yukpomnang-backend:REVISION \
    --region us-east-1
```

### Scaling

```bash
# Augmenter le nombre de tasks
aws ecs update-service \
    --cluster yukpomnang-cluster \
    --service yukpomnang-backend-service \
    --desired-count 5 \
    --region us-east-1
```

## 🔐 Sécurité

1. **Secrets**: Utiliser AWS Secrets Manager (jamais hardcoder)
2. **Network**: Utiliser des subnets privés pour les tasks
3. **IAM**: Principe du moindre privilège
4. **SSL/TLS**: Configurer HTTPS sur l'ALB
5. **Security Groups**: Restreindre les accès au minimum

## 📊 Coûts Estimés (us-east-1)

- **ECS Fargate** (2 tasks, 2 vCPU, 4GB RAM): ~$60/mois
- **RDS PostgreSQL** (db.t3.medium): ~$50/mois
- **ElastiCache Redis** (cache.t3.micro): ~$15/mois
- **ALB**: ~$20/mois
- **CloudWatch Logs**: ~$5/mois
- **Total**: ~$150/mois

## 🆘 Troubleshooting

### Les tasks ne démarrent pas

```bash
# Vérifier les événements du service
aws ecs describe-services \
    --cluster yukpomnang-cluster \
    --services yukpomnang-backend-service \
    --region us-east-1 \
    --query 'services[0].events[:5]'
```

### Erreurs de connexion à la base de données

- Vérifier les Security Groups
- Vérifier que RDS est dans le même VPC
- Vérifier le DATABASE_URL dans Secrets Manager

### Health checks échouent

- Vérifier que le port 8080 est exposé
- Vérifier que `/health` endpoint fonctionne
- Augmenter `healthCheckGracePeriodSeconds`

## 📚 Ressources

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [AWS Fargate Pricing](https://aws.amazon.com/fargate/pricing/)
- [ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)

