# 🚀 Guide de Déploiement Blender - Production Complète

## ✅ Fichiers mis à jour

Tous les fichiers de configuration ont été mis à jour pour que Blender soit opérationnel en production:

### 📦 Docker
- ✅ `backend/Dockerfile` - Blender installé automatiquement
- ✅ `backend/Dockerfile.cloud` - Blender installé pour AWS/Azure
- ✅ `docker-compose.yml` - Variables Blender configurées

### ☁️ Render.com
- ✅ `render.yaml` - Installation Blender dans buildCommand
- ✅ Variables d'environnement Blender préconfigurées

### 🏢 AWS
- ✅ `backend/aws/ecs-task-definition.json` - Configuration ECS/Fargate complète

### 🔷 Azure
- ✅ `backend/azure/container-instance-deploy.json` - Configuration Container Instances complète

---

## 🎯 Configuration par plateforme

### 1. **Render.com** ✅

**Variables à ajouter dans Render Dashboard:**

```env
BLENDER_PATH=/usr/local/bin/blender
BLENDER_RENDER_SAMPLES=256
BLENDER_USE_GPU=true
AR_RENDER_OUTPUT_DIR=/tmp/ar_renders
```

**Installation automatique:**
- Blender est installé automatiquement via le `buildCommand` dans `render.yaml`
- Pas d'action manuelle nécessaire
- Vérifiez les logs de build pour confirmer: `blender --version`

---

### 2. **AWS (ECS/Fargate)** ✅

**Étapes de déploiement:**

1. **Build l'image avec Blender:**
   ```bash
   cd backend
   docker build -f Dockerfile.cloud -t yukpomnang-backend:latest .
   ```

2. **Tag et push vers ECR:**
   ```bash
   aws ecr get-login-password --region us-east-1 | \
     docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com
   
   docker tag yukpomnang-backend:latest \
     YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/yukpomnang-backend:latest
   
   docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/yukpomnang-backend:latest
   ```

3. **Mettre à jour le task definition:**
   - Utilisez `backend/aws/ecs-task-definition.json`
   - Remplacez `YOUR_ACCOUNT_ID`, `YOUR_ECR_REPO`, etc.
   - Les variables Blender sont déjà configurées

4. **Déployer:**
   ```bash
   aws ecs register-task-definition --cli-input-json file://backend/aws/ecs-task-definition.json
   aws ecs update-service --cluster YOUR_CLUSTER --service YOUR_SERVICE --force-new-deployment
   ```

**Variables configurées automatiquement:**
- `BLENDER_PATH=/usr/local/bin/blender`
- `BLENDER_RENDER_SAMPLES=256`
- `BLENDER_USE_GPU=true`
- `AR_RENDER_OUTPUT_DIR=/tmp/ar_renders`

---

### 3. **Azure (Container Instances)** ✅

**Étapes de déploiement:**

1. **Build l'image avec Blender:**
   ```bash
   cd backend
   docker build -f Dockerfile.cloud -t yukpomnang-backend:latest .
   ```

2. **Push vers Azure Container Registry:**
   ```bash
   az acr login --name YOUR_ACR_NAME
   docker tag yukpomnang-backend:latest YOUR_ACR_NAME.azurecr.io/yukpomnang-backend:latest
   docker push YOUR_ACR_NAME.azurecr.io/yukpomnang-backend:latest
   ```

3. **Déployer:**
   ```bash
   # Mettre à jour backend/azure/container-instance-deploy.json avec vos valeurs
   az container create \
     --resource-group YOUR_RESOURCE_GROUP \
     --file backend/azure/container-instance-deploy.json
   ```

**Variables configurées automatiquement:**
- `BLENDER_PATH=/usr/local/bin/blender`
- `BLENDER_RENDER_SAMPLES=256`
- `BLENDER_USE_GPU=true`
- `AR_RENDER_OUTPUT_DIR=/tmp/ar_renders`

---

### 4. **Docker Local** ✅

**Utilisation:**

```bash
docker-compose up --build
```

Les variables Blender sont déjà configurées dans `docker-compose.yml`.

---

## ✅ Vérification post-déploiement

### Test dans le container

```bash
# Se connecter au container
docker exec -it CONTAINER_ID bash

# Vérifier Blender
blender --version
# Devrait afficher: Blender 4.0.0

# Vérifier le chemin
which blender
# Devrait afficher: /usr/local/bin/blender
```

### Test via l'API

Si votre backend expose un endpoint pour tester Blender, appelez-le après déploiement.

---

## 🔧 Dépannage

### Blender non trouvé

1. **Vérifiez les logs de build:**
   - Render: Dashboard → Logs → Cherchez "blender --version"
   - AWS: CloudWatch Logs → Cherchez les logs de build
   - Azure: Container Logs → Cherchez les logs de build

2. **Vérifiez le chemin:**
   ```bash
   ls -la /usr/local/bin/blender
   ls -la /opt/blender/blender
   ```

3. **Réinstallez si nécessaire:**
   - Le build devrait installer Blender automatiquement
   - Si échec, vérifiez la connexion internet pendant le build

### GPU non détecté

**AWS:**
- Utilisez des instances avec GPU: `g4dn.xlarge`, `g4dn.2xlarge`
- Configurez dans le task definition: `"requiresCompatibilities": ["FARGATE"]` avec GPU

**Azure:**
- Utilisez des instances NC-series: `Standard_NC6`, `Standard_NC12`
- Configurez dans le container instance

**Render:**
- Render ne supporte pas GPU actuellement
- Utilisez `BLENDER_USE_GPU=false` ou laissez CPU

### Erreur de permissions

```bash
chmod +x /opt/blender/blender
chmod +x /usr/local/bin/blender
```

---

## 📊 Résumé des chemins

| Plateforme | BLENDER_PATH | Installation |
|------------|--------------|--------------|
| **Local (Windows)** | `C:\Program Files\Blender Foundation\Blender 4.0\blender.exe` | Script PowerShell |
| **Docker** | `/usr/local/bin/blender` | Dockerfile |
| **Render** | `/usr/local/bin/blender` | buildCommand |
| **AWS ECS** | `/usr/local/bin/blender` | Dockerfile.cloud |
| **Azure ACI** | `/usr/local/bin/blender` | Dockerfile.cloud |

---

## 🎉 Tous les fichiers sont prêts!

Tous les fichiers de configuration ont été mis à jour. Il suffit de:
1. **Push les changements** sur Git
2. **Configurer les variables d'environnement** sur chaque plateforme
3. **Déployer**

Blender sera automatiquement installé et configuré! 🚀

