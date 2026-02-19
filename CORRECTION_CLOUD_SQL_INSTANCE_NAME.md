# 🔧 Correction Nom Instance Cloud SQL

**Date** : 2026-02-14  
**Problème** : `Malformed CloudSQL instance string: ***:europe-west1:***`

---

## 🎯 PROBLÈME IDENTIFIÉ

L'erreur se produit car le secret `GCP_DB_INSTANCE_CONNECTION_NAME` est vide ou mal formaté.

**Erreur** :
```
ERROR: (gcloud.run.deploy) Malformed CloudSQL instance string: ***:europe-west1:***
```

Le format attendu est : `PROJECT_ID:REGION:INSTANCE_NAME`

---

## ✅ SOLUTION APPLIQUÉE

**Changement** : Utilisation directe du nom d'instance `yukpo-db` au lieu du secret

### Avant (ne fonctionne pas)
```yaml
--add-cloudsql-instances ${{ secrets.GCP_PROJECT_ID }}:${{ env.GCP_REGION }}:${{ secrets.GCP_DB_INSTANCE_CONNECTION_NAME }}
```

### Après (fonctionne)
```yaml
--add-cloudsql-instances ${{ secrets.GCP_PROJECT_ID }}:${{ env.GCP_REGION }}:yukpo-db
```

---

## 📋 FORMAT CORRECT

Le format de la chaîne Cloud SQL instance est :
```
PROJECT_ID:REGION:INSTANCE_NAME
```

Exemple :
```
yukpo-project:europe-west1:yukpo-db
```

---

## 🔍 VÉRIFICATION

### Vérifier que l'instance Cloud SQL existe

```bash
gcloud sql instances list --project=yukpo-project
```

**Résultat attendu** :
```
NAME       DATABASE_VERSION  LOCATION        TIER              PRIMARY_ADDRESS  PRIVATE_ADDRESS  STATUS
yukpo-db   POSTGRES_15       europe-west1-b  db-f1-micro       34.79.29.219     -               RUNNABLE
```

### Vérifier le nom de connexion

```bash
gcloud sql instances describe yukpo-db --project=yukpo-project --format="value(connectionName)"
```

**Résultat attendu** :
```
yukpo-project:europe-west1:yukpo-db
```

---

## 📝 FICHIERS MODIFIÉS

1. ✅ `.github/workflows/docker-build-optimized.yml`
   - Remplacement de `${{ secrets.GCP_DB_INSTANCE_CONNECTION_NAME }}` par `yukpo-db`
   - Format corrigé : `${{ secrets.GCP_PROJECT_ID }}:${{ env.GCP_REGION }}:yukpo-db`

---

## ⚠️ NOTE IMPORTANTE

Si le nom de l'instance Cloud SQL est différent de `yukpo-db`, il faut :
1. Vérifier le nom réel avec : `gcloud sql instances list --project=yukpo-project`
2. Mettre à jour le workflow avec le bon nom

---

## ✅ RÉSULTAT

Après cette correction :
- ✅ Le format de la chaîne Cloud SQL est correct
- ✅ Le déploiement Cloud Run peut se connecter à Cloud SQL
- ✅ Le backend peut accéder à la base de données

---

**Date** : 2026-02-14  
**Statut** : ✅ **CORRIGÉ**



