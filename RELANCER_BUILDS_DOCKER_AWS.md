# 🚀 Guide pour Relancer les Builds Docker et AWS

## 📋 Résumé des Fichiers de Build

### Fichiers Docker
1. **`backend/Dockerfile`** - Build standard pour développement/production
2. **`backend/Dockerfile.cloud`** - Build optimisé pour AWS ECS/Fargate
3. **`docker-compose.yml`** - Configuration locale de développement
4. **`docker-compose.aws.yml`** - Configuration pour simuler AWS en local

### Scripts de Build Docker
1. **`scripts/build-backend-docker.ps1`** - Script PowerShell complet avec vérifications
2. **`backend/build-docker.sh`** - Script Bash pour Linux/Mac
3. **`backend/build-docker.ps1`** - Script PowerShell simple

### Scripts de Déploiement AWS
1. **`scripts/deploy-aws.ps1`** - Script PowerShell principal (Terraform + Docker + ECS)
2. **`backend/aws/deploy-aws.sh`** - Script Bash pour déploiement AWS
3. **`backend/aws/build-and-push.sh`** - Script Bash pour build et push ECR uniquement

## 🔨 Commandes pour Relancer les Builds

### 1. Build Docker Local (Standard)

#### Option A : Script PowerShell (Recommandé)
```powershell
# Depuis la racine du projet
.\scripts\build-backend-docker.ps1

# Avec test de l'image
.\scripts\build-backend-docker.ps1 -Test

# Sans cache Docker
.\scripts\build-backend-docker.ps1 -SkipCache
```

#### Option B : Script PowerShell simple
```powershell
cd backend
.\build-docker.ps1
```

#### Option C : Script Bash
```bash
cd backend
./build-docker.sh
```

#### Option D : Commande Docker directe
```powershell
cd backend
docker build -f Dockerfile -t yukpomnang-backend:latest .
```

### 2. Build Docker pour AWS (Cloud)

#### Option A : Script PowerShell
```powershell
# Le script deploy-aws.ps1 fait le build automatiquement
.\scripts\deploy-aws.ps1 -Action build-only
```

#### Option B : Script Bash
```bash
cd backend/aws
./build-and-push.sh v1.0.0 us-east-1
```

#### Option C : Commande Docker directe
```powershell
cd backend
docker build -f Dockerfile.cloud -t yukpomnang-backend:aws .
```

### 3. Déploiement Complet AWS

#### Option A : Déploiement complet (Terraform + Docker + ECS)
```powershell
# Depuis la racine du projet
.\scripts\deploy-aws.ps1

# Avec options
.\scripts\deploy-aws.ps1 -Action deploy -SkipBuild:$false -SkipMigration:$false
```

#### Option B : Mise à jour uniquement (après modifications)
```powershell
.\scripts\deploy-aws.ps1 -Action update
```

#### Option C : Build uniquement (sans déploiement)
```powershell
.\scripts\deploy-aws.ps1 -Action build-only
```

#### Option D : Script Bash
```bash
cd backend/aws
./deploy-aws.sh production v1.0.0
```

### 4. Docker Compose Local

#### Développement local
```powershell
docker-compose up --build
```

#### Simulation AWS en local
```powershell
docker-compose -f docker-compose.aws.yml up --build
```

## ✅ Prérequis Avant de Relancer

### 1. Vérifier Docker
```powershell
docker --version
docker ps
```

### 2. Vérifier le cache SQLx
```powershell
# Vérifier que le dossier existe
Test-Path backend\.sqlx

# Si absent, le générer
cd backend
$env:SQLX_OFFLINE = "false"
cargo sqlx prepare -- --lib
```

### 3. Vérifier Blender (pour Dockerfile standard)
```powershell
# Vérifier que Blender est téléchargé
Test-Path backend\blender\blender-4.0.0-linux-x64.tar.xz

# Si absent, le télécharger
.\scripts\download-blender.ps1
```

### 4. Vérifier AWS CLI (pour déploiement AWS)
```powershell
aws --version
aws sts get-caller-identity
```

### 5. Vérifier Terraform (pour déploiement AWS complet)
```powershell
terraform version
```

## 🔍 Vérifications Post-Build

### 1. Vérifier l'image Docker
```powershell
docker images yukpomnang-backend
docker images yukpo-backend
```

### 2. Tester l'image localement
```powershell
docker run --rm -p 8080:8080 `
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" `
  yukpomnang-backend:latest
```

### 3. Vérifier le déploiement AWS
```powershell
# Voir les services ECS
aws ecs list-services --cluster yukpomnang-cluster --region us-east-1

# Voir les logs
aws logs tail /ecs/yukpomnang-backend --follow --region us-east-1
```

## 🐛 Problèmes Courants

### 1. Cache SQLx manquant
**Erreur**: `❌ ERREUR: Répertoire .sqlx non trouvé!`

**Solution**:
```powershell
cd backend
$env:SQLX_OFFLINE = "false"
cargo sqlx prepare -- --lib
```

### 2. Blender manquant
**Erreur**: `❌ ERREUR: Blender non trouvé dans le contexte Docker!`

**Solution**:
```powershell
.\scripts\download-blender.ps1
```

### 3. Docker Desktop non démarré
**Erreur**: `Cannot connect to the Docker daemon`

**Solution**: Démarrer Docker Desktop depuis le menu Démarrer

### 4. AWS credentials non configurés
**Erreur**: `AWS credentials non configurés`

**Solution**:
```powershell
aws configure
```

### 5. ECR non authentifié
**Erreur**: `no basic auth credentials`

**Solution**:
```powershell
$region = "us-east-1"
$accountId = aws sts get-caller-identity --query Account --output text
aws ecr get-login-password --region $region | docker login --username AWS --password-stdin "$accountId.dkr.ecr.$region.amazonaws.com"
```

## 📝 Notes Importantes

1. **Dockerfile vs Dockerfile.cloud**:
   - `Dockerfile` : Pour développement et production standard
   - `Dockerfile.cloud` : Optimisé pour AWS ECS/Fargate (télécharge Blender automatiquement)

2. **Cache SQLx**:
   - Obligatoire pour les builds Docker (mode offline)
   - Générer avec `cargo sqlx prepare -- --lib` avant le build

3. **Blender**:
   - Requis pour `Dockerfile` (doit être dans `backend/blender/`)
   - Téléchargé automatiquement dans `Dockerfile.cloud`

4. **Variables d'environnement AWS**:
   - `AWS_REGION` : Région AWS (défaut: us-east-1)
   - `AWS_ACCOUNT_ID` : ID du compte AWS
   - Configurées dans `infra/aws/terraform.tfvars`

## 🚀 Workflow Recommandé

### Pour développement local:
```powershell
# 1. Vérifier les prérequis
.\scripts\build-backend-docker.ps1 -Test

# 2. Lancer avec docker-compose
docker-compose up --build
```

### Pour déploiement AWS:
```powershell
# 1. Build local d'abord (recommandé)
.\scripts\build-backend-docker.ps1 -Test

# 2. Déployer sur AWS
.\scripts\deploy-aws.ps1 -Action deploy

# Ou mettre à jour uniquement
.\scripts\deploy-aws.ps1 -Action update
```

