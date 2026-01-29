# 🔧 Configuration Git et GitHub Actions - Guide Complet

## 🎯 Clarification : Rôles de chaque outil

### Git
- **Rôle** : Gestionnaire de versions
- **Fait** : Stocke votre code, track les modifications
- **Déclenche** : GitHub Actions (quand vous faites `git push`)

### GitHub Actions
- **Rôle** : Automatisation CI/CD
- **Fait** : 
  - Build l'image Docker automatiquement
  - Push vers GitHub Container Registry
  - Push vers AWS ECR
  - **NOUVEAU** : Déploie automatiquement sur AWS ECS
- **Déclenché par** : `git push` sur `main`

### AWS ECS
- **Rôle** : Exécution de l'application
- **Fait** : Lance les conteneurs avec votre image Docker
- **Utilise** : L'image poussée dans ECR par GitHub Actions

---

## 🔄 Workflow Complet Automatisé

```
1. Vous codez
   ↓
2. git add .
   git commit -m "Nouvelle fonctionnalité"
   git push origin main
   ↓
3. GitHub détecte le push
   ↓
4. GitHub Actions s'exécute automatiquement :
   ├─ Build l'image Docker (Dockerfile.cloud.optimized)
   ├─ Push vers ghcr.io
   ├─ Push vers AWS ECR
   └─ ✅ NOUVEAU : Update service ECS (déploiement automatique)
   ↓
5. ✅ Application mise à jour automatiquement sur AWS !
```

**Résultat** : Vous n'avez plus qu'à faire `git push`, tout le reste est automatique ! 🎉

---

## 📋 Configuration Étape par Étape

### Étape 1 : Vérifier Git

```powershell
# Vérifier que Git est installé
git --version

# Vérifier la configuration
git config --list
```

Si Git n'est pas configuré :
```powershell
git config --global user.name "Votre Nom"
git config --global user.email "votre.email@example.com"
```

---

### Étape 2 : Configurer les Secrets GitHub

**C'est LA partie la plus importante !** Sans ces secrets, GitHub Actions ne pourra pas push vers AWS ECR.

#### 2.1. Créer un utilisateur IAM AWS (si pas déjà fait)

1. Allez dans AWS Console > IAM > Users
2. Créez un utilisateur : `github-actions-ecr-push`
3. Attachez la politique : `AmazonEC2ContainerRegistryPowerUser`
4. Créez des Access Keys
5. **Notez** : Access Key ID et Secret Access Key

#### 2.2. Ajouter les secrets dans GitHub

1. Allez dans votre repository GitHub
2. **Settings** > **Secrets and variables** > **Actions**
3. Cliquez sur **New repository secret**

**Secret 1** :
- **Name** : `AWS_ACCESS_KEY_ID`
- **Value** : Votre Access Key ID

**Secret 2** :
- **Name** : `AWS_SECRET_ACCESS_KEY`
- **Value** : Votre Secret Access Key

✅ **Vérification** : Vous devriez voir ces 2 secrets dans la liste

---

### Étape 3 : Vérifier le Workflow GitHub Actions

Le workflow est déjà configuré dans `.github/workflows/docker-build-optimized.yml`

**Ce qu'il fait automatiquement :**
- ✅ Build l'image Docker optimisée
- ✅ Push vers GitHub Container Registry
- ✅ Push vers AWS ECR (si secrets configurés)
- ✅ **NOUVEAU** : Mise à jour automatique du service ECS

**Déclencheurs :**
- Push sur `main` → Build + Push ECR + Deploy ECS
- Push sur `develop` → Build + Push ECR uniquement
- Pull Request → Build uniquement (test)

---

### Étape 4 : Tester le Workflow

#### Test 1 : Vérifier que les secrets sont configurés

1. Allez dans GitHub > Settings > Secrets and variables > Actions
2. Vérifiez que `AWS_ACCESS_KEY_ID` et `AWS_SECRET_ACCESS_KEY` sont présents

#### Test 2 : Faire un test push

```powershell
# Faire un petit changement
echo "# Test GitHub Actions" >> README.md

# Commit et push
git add README.md
git commit -m "test: vérification GitHub Actions"
git push origin main
```

#### Test 3 : Vérifier l'exécution

1. Allez dans GitHub > **Actions**
2. Vous devriez voir "Docker Build Optimized" en cours
3. Cliquez dessus pour voir les logs
4. Vérifiez que tous les jobs passent :
   - ✅ build-and-push
   - ✅ push-to-aws
   - ✅ deploy-to-ecs (NOUVEAU)

---

## 🔍 Vérification Post-Déploiement

### Vérifier que l'image a été poussée

```powershell
aws ecr list-images --repository-name yukpomnang-backend --region eu-west-1
```

Vous devriez voir une nouvelle image avec le tag `main-<sha>` et `latest`.

### Vérifier que le service ECS a été mis à jour

```powershell
aws ecs describe-services `
  --cluster yukpomnang-cluster `
  --services yukpomnang-backend-service `
  --region eu-west-1 `
  --query 'services[0].{Status:status,DesiredCount:desiredCount,RunningCount:runningCount,Deployments:deployments[0].{Status:status,TaskDefinition:taskDefinition}}' `
  --output json
```

Vous devriez voir un nouveau déploiement en cours.

---

## 🎯 Résumé : Ce qui est Automatique

### ✅ Automatique (après configuration)

1. **Build Docker** : Automatique après `git push`
2. **Push ECR** : Automatique après `git push` sur `main`
3. **Déploiement ECS** : **NOUVEAU** - Automatique après push ECR
4. **Tests** : Automatiques (si configurés)

### ❌ Manuel (une seule fois)

1. **Configuration initiale** : Secrets GitHub, infrastructure AWS
2. **Premier déploiement** : Infrastructure AWS (Terraform)

---

## 🚀 Workflow Quotidien

### Avant (sans automatisation)

```powershell
# 1. Coder
vim backend/src/main.rs

# 2. Build Docker manuellement
docker build -f Dockerfile.cloud.optimized -t test .

# 3. Push vers ECR manuellement
.\scripts\build-push-ecr.ps1

# 4. Update service ECS manuellement
aws ecs update-service --cluster yukpomnang-cluster --service yukpomnang-backend-service --force-new-deployment --region eu-west-1

# ⏱️ Total : ~45 minutes + travail manuel
```

### Maintenant (avec automatisation)

```powershell
# 1. Coder
vim backend/src/main.rs

# 2. Push
git add .
git commit -m "Nouvelle fonctionnalité"
git push origin main

# 3. C'est tout ! 🎉
# GitHub Actions fait le reste automatiquement

# ⏱️ Total : 0 minute de votre temps (GitHub Actions travaille en arrière-plan)
```

---

## 🔧 Dépannage

### Le workflow ne s'exécute pas

**Vérifier :**
1. Avez-vous fait un `git push` ?
2. Le workflow est-il dans `.github/workflows/` ?
3. Y a-t-il des erreurs de syntaxe YAML ?

**Solution :**
```powershell
# Vérifier la syntaxe YAML
# (utiliser un validateur YAML en ligne)
```

### Le push vers ECR échoue

**Vérifier :**
1. Les secrets AWS sont-ils configurés dans GitHub ?
2. Les noms des secrets sont-ils exacts : `AWS_ACCESS_KEY_ID` et `AWS_SECRET_ACCESS_KEY` ?
3. L'utilisateur IAM a-t-il les bonnes permissions ?

**Solution :**
- Vérifier les secrets dans GitHub Settings
- Vérifier les permissions IAM de l'utilisateur

### Le déploiement ECS échoue

**Vérifier :**
1. Le cluster ECS existe-t-il ? (`yukpomnang-cluster`)
2. Le service ECS existe-t-il ? (`yukpomnang-backend-service`)
3. L'image existe-t-elle dans ECR ?

**Solution :**
```powershell
# Vérifier le cluster
aws ecs list-clusters --region eu-west-1

# Vérifier le service
aws ecs list-services --cluster yukpomnang-cluster --region eu-west-1
```

---

## 📝 Checklist de Configuration

### ✅ Configuration Git
- [ ] Git installé et configuré
- [ ] Repository GitHub configuré
- [ ] Remote `origin` pointant vers GitHub

### ✅ Configuration GitHub Actions
- [ ] Workflow `.github/workflows/docker-build-optimized.yml` présent
- [ ] Secrets `AWS_ACCESS_KEY_ID` configuré
- [ ] Secrets `AWS_SECRET_ACCESS_KEY` configuré
- [ ] Workflow testé avec un push

### ✅ Configuration AWS
- [ ] Utilisateur IAM créé avec permissions ECR
- [ ] Repository ECR existe
- [ ] Cluster ECS existe
- [ ] Service ECS existe

---

## 🎉 Résultat Final

**Avant** :
- Build manuel : 40 minutes
- Push manuel : 5 minutes
- Deploy manuel : 5 minutes
- **Total** : ~50 minutes de travail manuel

**Maintenant** :
- `git push` : 10 secondes
- GitHub Actions : Automatique (en arrière-plan)
- **Total** : 10 secondes de votre temps ! 🚀

**Vous codez, vous push, c'est tout ! Le reste est automatique.**



