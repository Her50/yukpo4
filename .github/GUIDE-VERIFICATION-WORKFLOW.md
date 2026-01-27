# ✅ Guide de Vérification du Workflow GitHub Actions

## 🎯 Après avoir configuré les secrets

Une fois que tu as ajouté les secrets `AWS_ACCESS_KEY_ID` et `AWS_SECRET_ACCESS_KEY` dans GitHub, voici comment vérifier que tout fonctionne.

---

## 📋 Étape 1 : Vérifier que le workflow s'est déclenché

1. **Va sur GitHub** : https://github.com/Her50/yukpo4
2. **Clique sur l'onglet "Actions"** (en haut de la page)
3. **Tu devrais voir** : "Docker Build Optimized" en cours ou terminé

---

## 📋 Étape 2 : Vérifier les jobs

Dans la page Actions, clique sur le workflow en cours (ou le plus récent).

Tu devrais voir **3 jobs** :

### ✅ Job 1 : `build-and-push`
- **Rôle** : Build l'image Docker optimisée
- **Durée** : ~10-20 minutes
- **Résultat attendu** : ✅ Vert (succès)

### ✅ Job 2 : `push-to-aws`
- **Rôle** : Push l'image vers AWS ECR
- **Dépend de** : `build-and-push`
- **Résultat attendu** : ✅ Vert (succès)
- **⚠️ Si échec** : Vérifie que les secrets AWS sont bien configurés

### ✅ Job 3 : `deploy-to-ecs`
- **Rôle** : Déploie automatiquement sur AWS ECS
- **Dépend de** : `push-to-aws`
- **Résultat attendu** : ✅ Vert (succès)
- **⚠️ Si échec** : Vérifie que le service ECS existe

---

## 📋 Étape 3 : Vérifier les logs

Si un job échoue, clique dessus pour voir les logs :

### Erreur : "AWS_ACCESS_KEY_ID not found"
→ Les secrets ne sont pas configurés dans GitHub
→ **Solution** : Voir `.github/SETUP-RAPIDE.md`

### Erreur : "Repository does not exist"
→ Le repository ECR n'existe pas
→ **Solution** : `aws ecr create-repository --repository-name yukpomnang-backend --region eu-west-1`

### Erreur : "Service does not exist"
→ Le service ECS n'existe pas
→ **Solution** : Voir `scripts/deploy-aws.ps1`

---

## 📋 Étape 4 : Vérifier le déploiement AWS

Une fois que tous les jobs sont verts, vérifie que le service ECS a été mis à jour :

```powershell
.\scripts\check-aws-deployment.ps1
```

Ou manuellement :

```powershell
aws ecs describe-services `
  --cluster yukpomnang-cluster `
  --services yukpomnang-backend-service `
  --region eu-west-1 `
  --query 'services[0].{Status:status,DesiredCount:desiredCount,RunningCount:runningCount,Deployments:deployments[0].{Status:status,TaskDefinition:taskDefinition}}' `
  --output json
```

Tu devrais voir un nouveau déploiement en cours ou terminé.

---

## 📋 Étape 5 : Tester l'application

Une fois le déploiement terminé, teste l'application :

```powershell
# Test du health check
curl http://yukpomnang-alb-738499545.eu-west-1.elb.amazonaws.com/health
```

Tu devrais voir une réponse JSON avec le statut de l'application.

---

## 🎉 Résultat Attendu

Si tout fonctionne :

1. ✅ **GitHub Actions** : Tous les jobs verts
2. ✅ **AWS ECR** : Nouvelle image disponible
3. ✅ **AWS ECS** : Service mis à jour avec la nouvelle image
4. ✅ **Application** : Accessible et fonctionnelle

---

## 🚨 Problèmes Courants

### Le workflow ne se déclenche pas

**Vérifier :**
- As-tu fait un `git push` ?
- Le workflow est-il dans `.github/workflows/` ?
- La branche est-elle `master` ou `main` ? (Vérifie dans le workflow)

**Solution :**
Le workflow se déclenche sur `main` par défaut. Si tu es sur `master`, modifie le workflow ou renomme ta branche.

### Le push vers ECR échoue

**Vérifier :**
- Les secrets AWS sont-ils configurés ?
- Les noms des secrets sont-ils exacts : `AWS_ACCESS_KEY_ID` et `AWS_SECRET_ACCESS_KEY` ?
- L'utilisateur IAM a-t-il les bonnes permissions ?

**Solution :**
- Vérifie les secrets dans GitHub Settings
- Vérifie les permissions IAM de l'utilisateur

### Le déploiement ECS échoue

**Vérifier :**
- Le cluster ECS existe-t-il ? (`yukpomnang-cluster`)
- Le service ECS existe-t-il ? (`yukpomnang-backend-service`)
- L'image existe-t-elle dans ECR ?

**Solution :**
```powershell
# Vérifier le cluster
aws ecs list-clusters --region eu-west-1

# Vérifier le service
aws ecs list-services --cluster yukpomnang-cluster --region eu-west-1
```

---

## 📚 Documentation Complète

- `.github/SETUP-RAPIDE.md` : Guide rapide (5 minutes)
- `.github/CONFIGURATION-GIT-GITHUB-ACTIONS.md` : Guide complet
- `.github/workflows/docker-build-optimized.yml` : Workflow GitHub Actions

---

## 💡 Prochaines Étapes

Une fois que tout fonctionne :

1. **À chaque `git push` sur `master`** : GitHub Actions build et déploie automatiquement
2. **Surveille les déploiements** : GitHub > Actions
3. **Vérifie les logs** : En cas de problème, regarde les logs dans GitHub Actions

**C'est tout ! Tu n'as plus qu'à coder et push, le reste est automatique.** 🚀

