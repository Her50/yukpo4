# ⚡ Configuration Rapide - 5 Minutes

## 🎯 Objectif

Configurer GitHub Actions pour qu'il build et déploie automatiquement sur AWS après chaque `git push`.

---

## 📋 Checklist Rapide

### ✅ Étape 1 : Secrets GitHub (2 minutes)

1. Allez dans votre repository GitHub
2. **Settings** > **Secrets and variables** > **Actions**
3. Cliquez sur **New repository secret**

**Ajoutez ces 2 secrets :**

| Nom | Valeur |
|-----|--------|
| `AWS_ACCESS_KEY_ID` | Votre Access Key ID AWS |
| `AWS_SECRET_ACCESS_KEY` | Votre Secret Access Key AWS |

**Où trouver les credentials AWS ?**
- Si vous avez déjà un utilisateur IAM : AWS Console > IAM > Users > Votre utilisateur > Security credentials
- Si vous n'avez pas d'utilisateur : Voir `.github/SETUP-AWS-ECR.md`

---

### ✅ Étape 2 : Vérifier le Workflow (30 secondes)

Le workflow est déjà configuré dans :
- `.github/workflows/docker-build-optimized.yml`

**Il fait automatiquement :**
- ✅ Build l'image Docker
- ✅ Push vers ECR
- ✅ **NOUVEAU** : Déploie sur ECS

---

### ✅ Étape 3 : Test (2 minutes)

```powershell
# Faire un petit changement
echo "# Test" >> README.md

# Commit et push
git add README.md
git commit -m "test: vérification GitHub Actions"
git push origin main
```

**Vérifier :**
1. Allez dans GitHub > **Actions**
2. Vous devriez voir "Docker Build Optimized" en cours
3. Attendez la fin (10-20 minutes)
4. Vérifiez que tous les jobs passent :
   - ✅ build-and-push
   - ✅ push-to-aws
   - ✅ deploy-to-ecs (NOUVEAU)

---

## 🎉 C'est Tout !

**Maintenant, à chaque fois que vous faites `git push` sur `main` :**
- ✅ GitHub Actions build automatiquement
- ✅ Push vers ECR automatiquement
- ✅ Déploie sur ECS automatiquement

**Vous n'avez plus qu'à coder et push !** 🚀

---

## 🔍 Vérification

### Vérifier que les secrets sont configurés

GitHub > Settings > Secrets and variables > Actions

Vous devriez voir :
- ✅ `AWS_ACCESS_KEY_ID`
- ✅ `AWS_SECRET_ACCESS_KEY`

### Vérifier que le workflow s'exécute

GitHub > Actions > Docker Build Optimized

Vous devriez voir :
- ✅ build-and-push (Build Docker)
- ✅ push-to-aws (Push vers ECR)
- ✅ deploy-to-ecs (Déploiement ECS)

---

## 🚨 Problèmes Courants

### "AWS_ACCESS_KEY_ID not found"

→ Les secrets ne sont pas configurés dans GitHub
→ Solution : Voir Étape 1 ci-dessus

### "Repository does not exist"

→ Le repository ECR n'existe pas
→ Solution : `aws ecr create-repository --repository-name yukpomnang-backend --region eu-west-1`

### "Service does not exist"

→ Le service ECS n'existe pas
→ Solution : Voir `scripts/deploy-aws.ps1` pour créer l'infrastructure

---

## 📚 Documentation Complète

- `.github/CONFIGURATION-GIT-GITHUB-ACTIONS.md` : Guide complet
- `.github/SETUP-AWS-ECR.md` : Configuration AWS détaillée
- `.github/workflows/README-DOCKER-BUILD.md` : Documentation du workflow

---

## 💡 Résumé

**Avant** : Build manuel (40 min) + Push manuel (5 min) + Deploy manuel (5 min) = **50 minutes**

**Maintenant** : `git push` (10 sec) = **10 secondes** 🎉
