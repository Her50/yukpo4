# 🎨 Configuration Blender pour Production

## ✅ Fichiers mis à jour

Tous les fichiers de configuration ont été mis à jour pour inclure Blender:

### 1. **Docker (Local & Cloud)**
- ✅ `backend/Dockerfile` - Blender installé
- ✅ `backend/Dockerfile.cloud` - Blender installé pour AWS/Azure
- ✅ `docker-compose.yml` - Variables Blender ajoutées

### 2. **Render.com**
- ✅ `render.yaml` - Installation Blender dans buildCommand
- ✅ Variables d'environnement Blender configurées

### 3. **AWS**
- ✅ `backend/aws/ecs-task-definition.json` - Configuration ECS/Fargate avec Blender

### 4. **Azure**
- ✅ `backend/azure/container-instance-deploy.json` - Configuration Container Instances avec Blender

---

## 📋 Variables d'environnement à configurer

### **Render.com**

Dans le dashboard Render, ajoutez ces variables:

```env
BLENDER_PATH=/usr/local/bin/blender
BLENDER_RENDER_SAMPLES=256
BLENDER_USE_GPU=true
AR_RENDER_OUTPUT_DIR=/tmp/ar_renders
```

### **AWS (ECS/Fargate)**

Les variables sont déjà dans `ecs-task-definition.json`. Vérifiez que:
- Le Dockerfile.cloud est utilisé pour le build
- Les variables sont bien définies dans le task definition

### **Azure (Container Instances)**

Les variables sont déjà dans `container-instance-deploy.json`. Vérifiez que:
- Le Dockerfile.cloud est utilisé pour le build
- Les variables sont bien définies dans la configuration

---

## 🚀 Déploiement

### Render.com

1. **Push les changements** sur votre repo Git
2. **Render détectera automatiquement** le nouveau `render.yaml`
3. **Le build installera Blender** automatiquement
4. **Vérifiez les logs** pour confirmer: `blender --version`

### AWS ECS/Fargate

1. **Build l'image Docker:**
   ```bash
   docker build -f backend/Dockerfile.cloud -t yukpomnang-backend:latest .
   ```

2. **Push vers ECR:**
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ECR_REPO
   docker tag yukpomnang-backend:latest YOUR_ECR_REPO/yukpomnang-backend:latest
   docker push YOUR_ECR_REPO/yukpomnang-backend:latest
   ```

3. **Mettre à jour le task definition** avec `backend/aws/ecs-task-definition.json`

4. **Déployer le service ECS**

### Azure Container Instances

1. **Build l'image Docker:**
   ```bash
   docker build -f backend/Dockerfile.cloud -t yukpomnang-backend:latest .
   ```

2. **Push vers ACR:**
   ```bash
   az acr login --name YOUR_ACR
   docker tag yukpomnang-backend:latest YOUR_ACR.azurecr.io/yukpomnang-backend:latest
   docker push YOUR_ACR.azurecr.io/yukpomnang-backend:latest
   ```

3. **Déployer avec:**
   ```bash
   az container create --resource-group YOUR_RG --file backend/azure/container-instance-deploy.json
   ```

---

## ✅ Vérification

Après déploiement, vérifiez que Blender fonctionne:

```bash
# Dans les logs du container
blender --version

# Devrait afficher:
# Blender 4.0.0
```

---

## 📝 Notes importantes

- **Taille de l'image:** Blender ajoute ~300-400 MB à l'image Docker
- **Performance:** Le rendu Blender nécessite des ressources CPU/GPU importantes
- **GPU:** Pour utiliser le GPU, configurez les instances avec GPU support (AWS G4, Azure NC-series)
- **Stockage:** `/tmp/ar_renders` est temporaire, configurez un volume persistant pour la production

---

## 🔧 Dépannage

### Blender non trouvé

1. Vérifiez les logs de build pour confirmer l'installation
2. Vérifiez que `BLENDER_PATH=/usr/local/bin/blender` est configuré
3. Testez dans le container: `which blender`

### Erreur de permissions

```bash
chmod +x /opt/blender/blender
```

### GPU non détecté

- AWS: Utilisez des instances G4 (ex: g4dn.xlarge)
- Azure: Utilisez des instances NC-series (ex: Standard_NC6)
- Configurez `BLENDER_USE_GPU=true`

