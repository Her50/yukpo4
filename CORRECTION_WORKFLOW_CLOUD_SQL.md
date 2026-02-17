# ✅ Correction Workflow - Problème des Deux Instances Cloud SQL

**Date** : 17 Février 2026  
**Problème** : Le workflow ajoutait `yukpo-postgres` sans retirer `yukpo-db`, causant l'accumulation d'instances

---

## 🔍 Problème Identifié

### Cause Racine

Le workflow GitHub Actions utilisait `--add-cloudsql-instances` qui **ajoute** une instance sans retirer les instances existantes.

**Conséquence** :
- Si Cloud Run avait déjà `yukpo-db` configuré
- Le workflow ajoutait `yukpo-postgres`
- Les deux instances restaient configurées → Problèmes d'authentification

### Workflows Affectés

1. **`.github/workflows/gcp-deploy.yml`** - Workflow principal de déploiement
2. **`.github/workflows/docker-build-optimized.yml`** - Workflow de build Docker optimisé

---

## ✅ Corrections Appliquées

### 1. Workflow `gcp-deploy.yml`

**Modification** : Ajout d'une étape pour nettoyer les instances Cloud SQL avant d'ajouter

**Nouvelle étape 4/5** :
```bash
# Étape 4: Supprimer TOUTES les instances Cloud SQL pour repartir à zéro
echo "Étape 4/5: Suppression de toutes les instances Cloud SQL..."
gcloud run services update ${{ env.SERVICE_NAME }} \
  --region ${{ env.REGION }} \
  --clear-cloudsql-instances \
  --project ${{ secrets.GCP_PROJECT_ID }}
```

**Résultat** : Le workflow nettoie maintenant toutes les instances avant d'ajouter uniquement `yukpo-postgres`.

### 2. Workflow `docker-build-optimized.yml`

**Modification** : Ajout d'une étape de nettoyage avant le déploiement

**Ajout** :
```bash
# Nettoyer les instances Cloud SQL existantes
gcloud run services update ${{ env.GCP_SERVICE_NAME }} \
  --region ${{ env.GCP_REGION }} \
  --clear-cloudsql-instances \
  --project ${{ secrets.GCP_PROJECT_ID }}
```

**Résultat** : Le workflow nettoie maintenant les instances avant d'ajouter uniquement `yukpo-postgres`.

---

## 📊 État Avant/Après

### Avant

```bash
# Workflow ajoutait yukpo-postgres
--add-cloudsql-instances "yukpo-postgres"

# Résultat si yukpo-db était déjà configuré :
# Cloud Run avait : yukpo-db + yukpo-postgres ❌
```

### Après

```bash
# Workflow nettoie d'abord
--clear-cloudsql-instances

# Puis ajoute uniquement yukpo-postgres
--add-cloudsql-instances "yukpo-postgres"

# Résultat :
# Cloud Run a : yukpo-postgres uniquement ✅
```

---

## 🔧 Vérifications

### Dockerfile ✅

**Résultat** : Aucun problème
- Les Dockerfiles ne référencent pas les instances Cloud SQL
- Le build Docker ne configure pas les instances
- La configuration se fait uniquement au déploiement Cloud Run

### Code Source ✅

**Résultat** : Aucun problème
- Aucune référence hardcodée aux instances Cloud SQL
- La configuration vient uniquement de `DATABASE_URL` (secret)

---

## 🎯 Conclusion

### Le Problème Vient du Workflow ✅

**Cause** : `--add-cloudsql-instances` ajoute sans retirer, permettant l'accumulation.

**Solution** : ✅ Ajout de `--clear-cloudsql-instances` avant `--add-cloudsql-instances`.

### Aucun Problème au Niveau Docker ✅

- ✅ Dockerfiles ne référencent pas les instances
- ✅ Build Docker ne configure pas les instances
- ✅ Configuration uniquement au déploiement Cloud Run

### Prochain Déploiement

Lors du prochain déploiement via GitHub Actions, le workflow :
1. ✅ Nettoiera toutes les instances Cloud SQL existantes
2. ✅ Ajoutera uniquement `yukpo-postgres`
3. ✅ Garantira qu'une seule instance est configurée

---

**Date** : 17 Février 2026  
**Statut** : ✅ Workflows corrigés pour éviter l'accumulation d'instances Cloud SQL

