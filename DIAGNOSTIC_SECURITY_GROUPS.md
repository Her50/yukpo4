# Diagnostic des Security Groups et Connectivité Réseau

**Date**: 2026-02-13  
**Problème**: Vérification de l'impact des Security Groups et de l'instance EC2 sur les problèmes ECS

---

## 🔍 ÉLÉMENTS VÉRIFIÉS

### 1. Instance EC2 Temporaire
- **Instance ID**: `i-0b9ad404f8d738d04`
- **Nom**: `yukpo-temp-db-creator`
- **État**: Running
- **Security Group**: `sg-0301d013c4430f23b` (yukpo-temp-ec2-sg)
- **Subnet**: `subnet-057847d0ffb68ac1f` (publique)
- **VPC**: `vpc-07f588a0ad1ccc420`
- **Purpose**: Création temporaire de la base de données

**Configuration**:
- ✅ Accès SSH (port 22) depuis 0.0.0.0/0
- ✅ Egress complet (0.0.0.0/0)
- ✅ Autorisation dans RDS SG pour port 5432

---

### 2. Security Groups Identifiés

#### A. ECS Security Group (`sg-0d910f6cca6bac2e5`)
- **Nom**: `yukpo-ecs-sg`
- **Description**: Security group for ECS tasks

**Inbound Rules**:
- ✅ Port 8080 depuis ALB SG (`sg-08bda1da5a09c6cf4`)

**Outbound Rules**:
- ✅ Tous les ports vers 0.0.0.0/0 (egress complet)

**Vérifications**:
- ✅ Egress complet autorisé
- ⚠️ **À vérifier**: Accès à RDS (port 5432)
- ⚠️ **À vérifier**: Accès à Redis (port 6379)

---

#### B. RDS Security Group (`sg-04cd0425becd2d850`)
- **Nom**: `yukpo-rds-sg`
- **Description**: Security group for RDS PostgreSQL

**Inbound Rules** (selon Terraform):
- ✅ Port 5432 depuis ECS SG (`sg-0d910f6cca6bac2e5`)
- ✅ Port 5432 depuis EC2 Temp SG (`sg-0301d013c4430f23b`)

**Vérifications**:
- ⚠️ **CRITIQUE**: Vérifier que ECS SG est bien autorisé dans les règles réelles

---

#### C. Redis Security Group
- **Nom**: `yukpo-redis-sg` (à confirmer)
- **Description**: Security group for ElastiCache Redis

**Inbound Rules** (selon Terraform):
- ✅ Port 6379 depuis ECS SG (`sg-0d910f6cca6bac2e5`)

**Vérifications**:
- ⚠️ **CRITIQUE**: Vérifier que ECS SG est bien autorisé dans les règles réelles

---

### 3. Configuration Réseau

#### Subnets ECS
- `subnet-0670f81dbde94e86d`
- `subnet-0bdead65f27d8039c`
- **Type**: Privées (assign_public_ip = DISABLED)

#### Subnets RDS
- `subnet-00be97877b8855248`
- `subnet-00ef5af173b6292d9`
- **Type**: Privées (RDS subnets)

#### VPC
- **VPC ID**: `vpc-07f588a0ad1ccc420`
- ✅ ECS et RDS dans le même VPC

---

## 🚨 PROBLÈMES POTENTIELS IDENTIFIÉS

### 1. Connectivité ECS -> RDS (CRITIQUE)

**Problème possible**:
- Les règles de sécurité peuvent ne pas être correctement appliquées
- Les subnets ECS et RDS sont différents (normal, mais à vérifier le routage)

**Vérifications nécessaires**:
```bash
# Vérifier les règles réelles de RDS SG
aws ec2 describe-security-groups --group-ids sg-04cd0425becd2d850 --region eu-west-1

# Vérifier que ECS SG est bien dans les règles
aws ec2 describe-security-groups --group-ids sg-04cd0425becd2d850 --region eu-west-1 --query 'SecurityGroups[0].IpPermissions[?FromPort==`5432`]'
```

---

### 2. Connectivité ECS -> Redis (CRITIQUE)

**Problème possible**:
- Les règles de sécurité peuvent ne pas être correctement appliquées
- Redis peut être dans un subnet différent

**Vérifications nécessaires**:
```bash
# Récupérer l'ID du cluster Redis
aws elasticache describe-replication-groups --replication-group-id yukpo-redis --region eu-west-1

# Vérifier les Security Groups de Redis
aws elasticache describe-cache-clusters --cache-cluster-id <cluster-id> --show-cache-node-info --region eu-west-1
```

---

### 3. NAT Gateway / Internet Gateway (CRITIQUE)

**Problème possible**:
- ECS est dans des subnets privées
- `assign_public_ip = DISABLED`
- Si pas de NAT Gateway, ECS ne peut pas accéder à Internet

**Impact**:
- ❌ Impossible de télécharger des images Docker depuis ECR
- ❌ Impossible d'accéder à des APIs externes
- ❌ Impossible de se connecter à certains services AWS

**Vérifications nécessaires**:
```bash
# Vérifier les NAT Gateways
aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=vpc-07f588a0ad1ccc420" --region eu-west-1

# Vérifier les Route Tables
aws ec2 describe-route-tables --filters "Name=vpc-id,Values=vpc-07f588a0ad1ccc420" --region eu-west-1
```

---

## 🔧 ACTIONS RECOMMANDÉES

### 1. Vérifier les Règles de Sécurité Réelles

Les règles dans Terraform peuvent différer de celles réellement appliquées. Vérifier:

```bash
# RDS
aws ec2 describe-security-groups --group-ids sg-04cd0425becd2d850 --region eu-west-1 --query 'SecurityGroups[0].IpPermissions'

# Redis
aws elasticache describe-replication-groups --replication-group-id yukpo-redis --region eu-west-1
```

### 2. Vérifier le NAT Gateway

Si ECS est dans des subnets privées sans NAT Gateway, activer `assign_public_ip` ou créer un NAT Gateway:

```bash
# Option 1: Activer assign_public_ip (plus simple)
aws ecs update-service \
  --cluster yukpo-cluster \
  --service yukpo-backend-service \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-0670f81dbde94e86d,subnet-0bdead65f27d8039c],securityGroups=[sg-0d910f6cca6bac2e5],assignPublicIp=ENABLED}" \
  --region eu-west-1

# Option 2: Créer NAT Gateway (plus sécurisé mais coûteux)
```

### 3. Tester la Connectivité depuis ECS

Créer une tâche ECS de test pour vérifier la connectivité:

```bash
# Tester la connexion à RDS
aws ecs run-task \
  --cluster yukpo-cluster \
  --task-definition yukpo-backend \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-0670f81dbde94e86d],securityGroups=[sg-0d910f6cca6bac2e5],assignPublicIp=ENABLED}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["sh","-c","pg_isready -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432"]}]}' \
  --region eu-west-1
```

---

## 📊 CONCLUSION

**Problèmes potentiels identifiés**:

1. ⚠️ **NAT Gateway manquant** - ECS dans subnets privées sans accès Internet
2. ⚠️ **Règles de sécurité** - À vérifier que les règles Terraform sont bien appliquées
3. ⚠️ **Connectivité réseau** - Subnets ECS et RDS différents (normal mais routage à vérifier)

**Action immédiate**: Vérifier si un NAT Gateway existe et si les règles de sécurité sont correctement appliquées.

