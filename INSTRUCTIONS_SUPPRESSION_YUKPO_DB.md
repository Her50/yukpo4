# 🗑️ Instructions Suppression Instance yukpo-db

**Date** : 17 Février 2026  
**Instance à supprimer** : `yukpo-db`

---

## ✅ Vérifications Effectuées

### 1. Configuration Cloud Run

**Avant** : Cloud Run configuré avec les deux instances
```
yukpo-project:europe-west1:yukpo-db,yukpo-project:europe-west1:yukpo-postgres
```

**Après** : Cloud Run configuré uniquement avec `yukpo-postgres`
```
yukpo-project:europe-west1:yukpo-postgres
```

**Nouvelle révision** : `yukpo-backend-00192-7vj`

### 2. Utilisation des Instances

| Instance | Utilisée par | Base de données yukpo_db |
|----------|--------------|--------------------------|
| **yukpo-postgres** | ✅ Cloud Run, GitHub Actions | ✅ Oui |
| **yukpo-db** | ❌ Aucune | ✅ Oui (dupliquée) |

### 3. Workflow GitHub Actions

**Configuration** : Utilise uniquement `yukpo-postgres`
```yaml
CLOUD_SQL_INSTANCE="${{ secrets.GCP_PROJECT_ID }}:${{ env.REGION }}:yukpo-postgres"
```

---

## 🗑️ Suppression de l'Instance yukpo-db

### Informations sur l'Instance

- **Nom** : `yukpo-db`
- **IP** : 34.79.29.219
- **Tier** : db-f1-micro
- **État** : RUNNABLE
- **Région** : europe-west1-d

### ⚠️ ATTENTION

**La suppression est IRRÉVERSIBLE !**

Avant de supprimer, s'assurer que :
- ✅ Aucune application ne l'utilise (vérifié)
- ✅ Cloud Run ne l'utilise plus (vérifié)
- ✅ GitHub Actions ne l'utilise pas (vérifié)
- ❓ Pas de données importantes à sauvegarder (à vérifier)

### Commande de Suppression

```bash
gcloud sql instances delete yukpo-db \
  --project=yukpo-project
```

**Note** : Cette commande peut prendre quelques minutes.

---

## 🔧 Recommandations

### Option 1 : Supprimer Immédiatement

Si vous êtes sûr qu'aucune donnée importante n'est sur `yukpo-db`, vous pouvez la supprimer maintenant.

### Option 2 : Attendre et Surveiller (Recommandé)

**Recommandation** : Attendre 24-48 heures pour :
1. Vérifier que tout fonctionne correctement avec seulement `yukpo-postgres`
2. Surveiller les logs pour s'assurer qu'il n'y a pas d'erreurs
3. Vérifier qu'aucune application ne dépend de `yukpo-db`

Ensuite, supprimer l'instance.

---

## 📊 État Actuel

| Élément | Statut |
|---------|--------|
| **Cloud Run** | ✅ Utilise uniquement `yukpo-postgres` |
| **GitHub Actions** | ✅ Utilise uniquement `yukpo-postgres` |
| **Instance yukpo-db** | ⚠️ Prête pour suppression |
| **Base de données yukpo_db** | ✅ Existe sur `yukpo-postgres` (instance principale) |

---

**Date** : 17 Février 2026  
**Statut** : ✅ Instance `yukpo-db` retirée de Cloud Run, prête pour suppression

