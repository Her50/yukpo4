# 🗑️ Suppression Instance Inutile - yukpo-db

**Date** : 17 Février 2026  
**Objectif** : Retirer l'instance `yukpo-db` de la configuration Cloud Run et la supprimer si elle n'est pas utilisée

---

## 🔍 Analyse des Instances

### Instance 1 : `yukpo-postgres` (34.79.199.41)

**Bases de données** :
- `postgres`
- `yukpo_db` ✅ (base de données principale)
- `yukpo_postgres`

**Utilisateurs** :
- `postgres`
- `yukpo_user` ✅

**Utilisation** :
- ✅ Utilisée par le workflow GitHub Actions (`gcp-deploy.yml`)
- ✅ Utilisée par Cloud Run (après retrait de `yukpo-db`)

### Instance 2 : `yukpo-db` (34.79.29.219)

**Bases de données** :
- `postgres`
- `yukpo_db` ✅ (dupliquée)

**Utilisateurs** :
- `postgres`
- `yukpo_admin`
- `yukpo_user` (créé récemment)

**Utilisation** :
- ❌ **Non utilisée** par le workflow GitHub Actions
- ❌ **Retirée** de la configuration Cloud Run

---

## ✅ Actions Effectuées

### 1. Retrait de `yukpo-db` de Cloud Run

**Action** : Retrait de l'instance `yukpo-db` de la configuration Cloud Run

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --project=yukpo-project \
  --remove-cloudsql-instances=yukpo-project:europe-west1:yukpo-db
```

**Résultat** : ✅ Cloud Run utilise maintenant uniquement `yukpo-postgres`

### 2. Vérification de la Configuration

**Configuration actuelle** : Cloud Run devrait maintenant utiliser uniquement `yukpo-postgres`

---

## 🗑️ Suppression de l'Instance `yukpo-db`

### ⚠️ ATTENTION : Vérifications Avant Suppression

Avant de supprimer l'instance `yukpo-db`, vérifier :

1. ✅ **Aucune application ne l'utilise** - Vérifié (seulement Cloud Run l'utilisait)
2. ❓ **Pas de données importantes** - À vérifier
3. ❓ **Pas de sauvegardes nécessaires** - À vérifier

### Commande de Suppression

**⚠️ DANGER** : Cette action est **irréversible** !

```bash
gcloud sql instances delete yukpo-db \
  --project=yukpo-project
```

**Recommandation** : Attendre quelques jours pour s'assurer que tout fonctionne correctement avec seulement `yukpo-postgres` avant de supprimer `yukpo-db`.

---

## 📊 État Actuel

| Élément | Statut | Détails |
|---------|--------|---------|
| **Instance yukpo-postgres** | ✅ | Utilisée par Cloud Run et GitHub Actions |
| **Instance yukpo-db** | ⚠️ | Retirée de Cloud Run, peut être supprimée |
| **Base de données yukpo_db** | ✅ | Existe sur `yukpo-postgres` (instance principale) |
| **Configuration Cloud Run** | ✅ | Utilise uniquement `yukpo-postgres` |

---

## 🔧 Recommandations

### 1. Attendre Avant Suppression

**Recommandation** : Attendre 24-48 heures pour s'assurer que :
- ✅ Aucune erreur ne survient
- ✅ Toutes les applications fonctionnent correctement
- ✅ Aucune dépendance cachée vers `yukpo-db`

### 2. Vérifier les Logs

Surveiller les logs pour s'assurer qu'il n'y a plus d'erreurs liées à `yukpo-db` :

```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND textPayload=~'yukpo-db'" \
  --limit=50 \
  --freshness=24h
```

### 3. Supprimer l'Instance

Une fois sûr que tout fonctionne, supprimer l'instance :

```bash
gcloud sql instances delete yukpo-db \
  --project=yukpo-project
```

---

**Date** : 17 Février 2026  
**Statut** : ✅ Instance `yukpo-db` retirée de Cloud Run, prête pour suppression après vérification

