# ✅ Vérification Workflow - Configuration Cloud SQL

**Date** : 17 Février 2026  
**Question** : Le problème doit-il être réglé au niveau du build Git/Docker ?

---

## 🔍 Analyse du Workflow GitHub Actions

### Workflow `gcp-deploy.yml`

**Ligne 177** : Configuration de l'instance Cloud SQL
```yaml
CLOUD_SQL_INSTANCE="${{ secrets.GCP_PROJECT_ID }}:${{ env.REGION }}:yukpo-postgres"
```

**Lignes 246, 265, 291** : Utilisation de `--add-cloudsql-instances`
```bash
--add-cloudsql-instances "$CLOUD_SQL_INSTANCE"
```

**Problème identifié** : ⚠️ `--add-cloudsql-instances` **ajoute** une instance sans retirer les instances existantes.

**Conséquence** : Si Cloud Run avait déjà `yukpo-db` configuré, le workflow ajoute `yukpo-postgres` mais ne retire pas `yukpo-db`, ce qui fait que les deux instances restent configurées.

### Workflow `docker-build-optimized.yml`

**Ligne 550** : Utilise uniquement `yukpo-postgres`
```bash
--add-cloudsql-instances ${{ secrets.GCP_PROJECT_ID }}:${{ env.GCP_REGION }}:yukpo-postgres
```

**Même problème** : Utilise `--add-cloudsql-instances` qui ajoute sans retirer.

---

## ✅ Correction Appliquée

### Modification du Workflow `gcp-deploy.yml`

**Ajout d'une étape** : Suppression de toutes les instances Cloud SQL avant d'ajouter la bonne

**Nouvelle étape 4/5** :
```bash
# Étape 4: Supprimer TOUTES les instances Cloud SQL pour repartir à zéro
echo "Étape 4/5: Suppression de toutes les instances Cloud SQL..."
gcloud run services update ${{ env.SERVICE_NAME }} \
  --region ${{ env.REGION }} \
  --clear-cloudsql-instances \
  --project ${{ secrets.GCP_PROJECT_ID }}
```

**Résultat** : Le workflow nettoie maintenant toutes les instances Cloud SQL avant d'ajouter uniquement `yukpo-postgres`.

---

## 📊 État Actuel

| Élément | Statut | Détails |
|---------|--------|---------|
| **Workflow gcp-deploy.yml** | ✅ | Corrigé - Nettoie les instances avant d'ajouter |
| **Workflow docker-build-optimized.yml** | ⚠️ | Utilise encore `--add-cloudsql-instances` (peut être corrigé aussi) |
| **Dockerfile** | ✅ | Aucune référence aux instances Cloud SQL |
| **Code source** | ✅ | Aucune référence hardcodée aux instances |

---

## 🔧 Recommandations

### 1. Workflow `gcp-deploy.yml` ✅

**Statut** : ✅ Corrigé - Le workflow nettoie maintenant les instances avant d'ajouter.

### 2. Workflow `docker-build-optimized.yml` ⚠️

**Recommandation** : Appliquer la même correction si ce workflow est utilisé.

### 3. Dockerfile ✅

**Statut** : ✅ Aucun problème - Les Dockerfiles ne référencent pas les instances Cloud SQL.

---

## 🎯 Conclusion

### Le Problème Vient du Workflow

**Cause** : Le workflow utilisait `--add-cloudsql-instances` qui ajoute sans retirer, permettant l'accumulation d'instances.

**Solution** : ✅ Ajout de `--clear-cloudsql-instances` avant `--add-cloudsql-instances` pour garantir une seule instance.

### Aucun Problème au Niveau Docker

- ✅ Les Dockerfiles ne référencent pas les instances Cloud SQL
- ✅ Le build Docker ne configure pas les instances
- ✅ La configuration Cloud SQL se fait uniquement au déploiement Cloud Run

---

**Date** : 17 Février 2026  
**Statut** : ✅ Workflow corrigé pour éviter l'accumulation d'instances Cloud SQL

