# 🚀 Guide : Créer le Service ECS Manuellement dans la Console AWS

## ✅ Excellente Idée !

Vous pouvez créer le service ECS **manuellement dans la console AWS**, comme vous l'avez fait avec le premier compte. Cela permet de démarrer l'application **immédiatement** sans attendre le Load Balancer !

## 📋 Informations Nécessaires (Déjà Récupérées)

### ✅ Ressources Créées par Terraform

- **Cluster ECS** : `yukpo-cluster` ✅
- **VPC** : `vpc-07f588a0ad1ccc420` (yukpo-vpc) ✅
- **Subnets Privés** :
  - `subnet-0bdead65f27d8039c` (yukpo-private-subnet-1, eu-west-1a) ✅
  - `subnet-0670f81dbde94e86d` (yukpo-private-subnet-2, eu-west-1b) ✅
- **Security Group ECS** : `sg-0d910f6cca6bac2e5` (yukpo-ecs-sg) ✅
- **ECR Repository** : `108964700972.dkr.ecr.eu-west-1.amazonaws.com/yukpo-backend` ✅
- **CloudWatch Logs** : `/ecs/yukpo-backend` ✅
- **IAM Roles** :
  - Execution Role : `yukpo-ecs-execution-role` ✅
  - Task Role : `yukpo-ecs-task-role` ✅

### ⚠️ À Créer

- **Task Definition** : `yukpo-backend` (n'existe pas encore)
- **Service ECS** : `yukpo-backend-service` (n'existe pas encore)

## 🎯 Option 1 : Créer via Script PowerShell (Recommandé)

Un script existe déjà : `scripts/create-ecs-service-manual.ps1`

**Exécutez-le :**
```powershell
cd scripts
.\create-ecs-service-manual.ps1
```

Le script va :
1. ✅ Créer la Task Definition
2. ✅ Créer le Service ECS (sans Load Balancer)
3. ✅ Configurer les secrets depuis SSM

## 🎯 Option 2 : Créer Manuellement dans la Console AWS

### Étape 1 : Créer la Task Definition

1. **Console AWS** → **ECS** → **Task Definitions** → **"Create new Task Definition"**

2. **Task definition family** : `yukpo-backend`

3. **Launch type** : **Fargate**

4. **Task size** :
   - **CPU** : `1 vCPU` (1024)
   - **Memory** : `2 GB` (2048)

5. **Task execution role** : `yukpo-ecs-execution-role`

6. **Task role** : `yukpo-ecs-task-role`

7. **Container** :
   - **Container name** : `backend`
   - **Image URI** : `108964700972.dkr.ecr.eu-west-1.amazonaws.com/yukpo-backend:latest`
   - **Port mappings** : `8080` (TCP)
   - **Environment variables** :
     - `RUST_LOG` = `info`
     - `APP_ENV` = `production`
   - **Secrets** (depuis Secrets Manager et SSM) :
     - `DATABASE_URL` → `arn:aws:secretsmanager:eu-west-1:108964700972:secret:yukpo/backend/secrets-XXXXX:DATABASE_URL::`
     - `REDIS_URL` → `arn:aws:secretsmanager:eu-west-1:108964700972:secret:yukpo/backend/secrets-XXXXX:REDIS_URL::`
     - `JWT_SECRET` → `arn:aws:secretsmanager:eu-west-1:108964700972:secret:yukpo/backend/secrets-XXXXX:JWT_SECRET::`
     - `S3_BUCKET` → `arn:aws:ssm:eu-west-1:108964700972:parameter/yukpo/production/S3_BUCKET`
     - `S3_REGION` → `arn:aws:ssm:eu-west-1:108964700972:parameter/yukpo/production/S3_REGION`
     - `S3_ACCESS_KEY` → `arn:aws:ssm:eu-west-1:108964700972:parameter/yukpo/production/S3_ACCESS_KEY`
     - `S3_SECRET_KEY` → `arn:aws:ssm:eu-west-1:108964700972:parameter/yukpo/production/S3_SECRET_KEY`
     - `UPLOAD_BASE_URL` → `arn:aws:ssm:eu-west-1:108964700972:parameter/yukpo/production/UPLOAD_BASE_URL`
   - **Logging** :
     - **Log driver** : `awslogs`
     - **Log group** : `/ecs/yukpo-backend`
     - **Region** : `eu-west-1`
     - **Stream prefix** : `backend`
   - **Health check** :
     - **Command** : `CMD-SHELL,curl -f http://localhost:8080/health || exit 1`
     - **Interval** : `30`
     - **Timeout** : `10`
     - **Retries** : `3`
     - **Start period** : `60`

8. **Create**

### Étape 2 : Créer le Service ECS

1. **Console AWS** → **ECS** → **Clusters** → `yukpo-cluster` → **"Services"** → **"Create"**

2. **Compute configuration** :
   - **Launch type** : **Fargate**
   - **Platform version** : **LATEST**

3. **Task definition** :
   - **Family** : `yukpo-backend`
   - **Revision** : `1` (ou latest)

4. **Service name** : `yukpo-backend-service`

5. **Desired tasks** : `1`

6. **Deployment configuration** :
   - **Minimum healthy percent** : `100`
   - **Maximum percent** : `200`

7. **Networking** :
   - **VPC** : `vpc-07f588a0ad1ccc420` (yukpo-vpc)
   - **Subnets** : 
     - `subnet-0bdead65f27d8039c` (yukpo-private-subnet-1)
     - `subnet-0670f81dbde94e86d` (yukpo-private-subnet-2)
   - **Security groups** : `sg-0d910f6cca6bac2e5` (yukpo-ecs-sg)
   - **Auto-assign public IP** : **DISABLED** (subnets privés)

8. **Load balancing** : **SKIP** (on l'ajoutera plus tard)

9. **Service Auto Scaling** : Optionnel (on peut l'activer plus tard)

10. **Create**

## ⚡ Option 3 : Créer via Terraform (Sans Load Balancer)

On peut modifier Terraform pour créer le service ECS **sans Load Balancer** temporairement.

Souhaitez-vous que je modifie Terraform pour créer le service sans Load Balancer ?

## 📊 Après Création

Une fois le service créé :
1. ✅ Les tâches ECS démarreront
2. ✅ Le backend générera des logs
3. ✅ Les logs apparaîtront dans CloudWatch `/ecs/yukpo-backend`
4. ⚠️ Pas d'URL publique (accès via IP privée uniquement)

## 🔄 Ajouter le Load Balancer Plus Tard

Une fois AWS Support active le Load Balancer :
1. Créer le Load Balancer manuellement
2. Modifier le service ECS pour ajouter le Load Balancer
3. Ou relancer `terraform apply` (il mettra à jour le service

## 🎯 Recommandation

**Je recommande l'Option 1 (Script PowerShell)** car :
- ✅ Automatique
- ✅ Utilise les bonnes valeurs
- ✅ Moins d'erreurs

Souhaitez-vous que je lance le script maintenant ?

