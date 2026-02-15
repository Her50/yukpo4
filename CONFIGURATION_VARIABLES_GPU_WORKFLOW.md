# 🔧 Configuration Variables GPU dans Workflow GitHub Actions

**Date**: 2026-02-15  
**Objectif**: Ajouter les variables GPU directement dans le workflow pour éviter qu'elles soient écrasées

---

## ✅ Modifications Appliquées

### Fichier Modifié

**`.github/workflows/docker-build-optimized.yml`**

### Variables GPU Ajoutées

Les variables GPU suivantes ont été ajoutées directement dans le workflow :

```yaml
"GPU_ENABLED": "true"
"GPU_ENDPOINT": "http://yukpo-gpu-workers:8080"
"GPU_ZONE": "europe-west1-b"
"GPU_INSTANCE_NAME": "yukpo-gpu-worker"
"GCP_PROJECT_ID": "${{ secrets.GCP_PROJECT_ID }}"
"GPU_MONTHLY_BUDGET": "100.0"
"GPU_SCALE_UP_THRESHOLD": "70.0"
"GPU_SCALE_DOWN_THRESHOLD": "20.0"
"GPU_MAX_INSTANCES": "3"
"GPU_MIN_INSTANCES": "0"
```

### Emplacement dans le Workflow

Les variables sont ajoutées dans deux endroits :

1. **Section avec jq** (lignes 471-490) : Si `jq` est disponible
2. **Section fallback** (lignes 483-505) : Si `jq` n'est pas disponible

---

## 📋 Variables GPU Configurées

| Variable | Valeur | Description |
|----------|--------|-------------|
| `GPU_ENABLED` | `true` | Active le service GPU |
| `GPU_ENDPOINT` | `http://yukpo-gpu-workers:8080` | Endpoint des workers GPU |
| `GPU_ZONE` | `europe-west1-b` | Zone GCP pour les instances GPU |
| `GPU_INSTANCE_NAME` | `yukpo-gpu-worker` | Nom de base des instances GPU |
| `GCP_PROJECT_ID` | `${{ secrets.GCP_PROJECT_ID }}` | ID du projet GCP (depuis secrets) |
| `GPU_MONTHLY_BUDGET` | `100.0` | Budget mensuel maximum ($) |
| `GPU_SCALE_UP_THRESHOLD` | `70.0` | Seuil d'utilisation pour scale-up (%) |
| `GPU_SCALE_DOWN_THRESHOLD` | `20.0` | Seuil d'utilisation pour scale-down (%) |
| `GPU_MAX_INSTANCES` | `3` | Nombre maximum d'instances GPU |
| `GPU_MIN_INSTANCES` | `0` | Nombre minimum d'instances GPU |

---

## 🔄 Priorité des Variables

Le workflow utilise maintenant cette priorité :

1. **Variables définies directement dans le workflow** (priorité la plus haute)
   - `CLOUD_RUN=true`
   - Variables GPU (ajoutées maintenant)

2. **Variables depuis secrets GitHub avec préfixe `GCP_ENV_`**
   - Le workflow cherche automatiquement les secrets `GCP_ENV_*`
   - Exemple : `GCP_ENV_GPU_ENABLED` → `GPU_ENABLED`

3. **Variables définies manuellement via `gcloud run services update`**
   - Écrasées par le workflow à chaque déploiement

---

## 📝 Comment Modifier les Variables GPU

### Option 1: Modifier le Workflow (Recommandé)

Éditer directement `.github/workflows/docker-build-optimized.yml` :

```yaml
"GPU_MONTHLY_BUDGET": "150.0",  # Modifier ici
"GPU_MAX_INSTANCES": "5",       # Modifier ici
```

### Option 2: Utiliser Secrets GitHub (Alternative)

Si vous préférez utiliser des secrets GitHub :

1. **Créer les secrets** dans GitHub :
   - `GCP_ENV_GPU_MONTHLY_BUDGET` = `150.0`
   - `GCP_ENV_GPU_MAX_INSTANCES` = `5`

2. **Le workflow les ajoutera automatiquement** (le préfixe `GCP_ENV_` est supprimé)

3. **Les valeurs des secrets écrasent celles du workflow** si elles existent

---

## ✅ Vérification

### Après le Prochain Déploiement

Vérifier que les variables GPU sont bien définies :

```bash
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="get(spec.template.spec.containers[0].env)" \
  --project=yukpo-project | grep GPU
```

**Résultat attendu** :
```
GPU_ENABLED=true
GPU_ENDPOINT=http://yukpo-gpu-workers:8080
GPU_ZONE=europe-west1-b
GPU_INSTANCE_NAME=yukpo-gpu-worker
GCP_PROJECT_ID=yukpo-project
GPU_MONTHLY_BUDGET=100.0
GPU_SCALE_UP_THRESHOLD=70.0
GPU_SCALE_DOWN_THRESHOLD=20.0
GPU_MAX_INSTANCES=3
GPU_MIN_INSTANCES=0
```

### Vérifier les Logs

Après le déploiement, vérifier les logs pour confirmer l'initialisation GPU :

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND textPayload=~'GPU'" --limit=20 --project=yukpo-project
```

**Logs attendus** :
```
✅ Service GPU initialisé
[GpuService] ✅ Initialisé - Endpoint: http://yukpo-gpu-workers:8080, Budget: $100.0/mois
```

---

## 🔧 Dépannage

### Si les Variables GPU Ne Sont Pas Définies

1. **Vérifier que le workflow a été exécuté** :
   - Aller sur GitHub Actions
   - Vérifier le dernier workflow "Docker Build Optimized"
   - Vérifier que le step "Prepare Environment Variables" a réussi

2. **Vérifier la syntaxe JSON** :
   - Le fichier `env-vars.json` doit être valide
   - Vérifier les logs du workflow pour les erreurs

3. **Vérifier les secrets** :
   - `GCP_PROJECT_ID` doit être défini dans GitHub Secrets
   - Vérifier : Settings → Secrets and variables → Actions

### Si les Variables Sont Écrasées

Si vous avez défini des variables manuellement via `gcloud run services update`, elles seront écrasées à chaque déploiement du workflow.

**Solution** : Utiliser les secrets GitHub avec préfixe `GCP_ENV_` ou modifier directement le workflow.

---

## 📋 Checklist

- [x] Variables GPU ajoutées dans le workflow (section jq)
- [x] Variables GPU ajoutées dans le workflow (section fallback)
- [x] `GCP_PROJECT_ID` utilise le secret GitHub
- [ ] **Vérifier que `GCP_PROJECT_ID` est défini dans GitHub Secrets**
- [ ] **Tester le workflow après commit**
- [ ] **Vérifier les variables après déploiement**

---

## 🚀 Prochaines Étapes

1. **Vérifier le secret `GCP_PROJECT_ID`** :
   - GitHub → Settings → Secrets and variables → Actions
   - Vérifier que `GCP_PROJECT_ID` existe et contient `yukpo-project`

2. **Commit et Push** :
   ```bash
   git add .github/workflows/docker-build-optimized.yml
   git commit -m "feat: Ajouter variables GPU dans workflow GitHub Actions"
   git push
   ```

3. **Vérifier le déploiement** :
   - Attendre que le workflow GitHub Actions se termine
   - Vérifier les variables dans Cloud Run
   - Vérifier les logs pour l'initialisation GPU

---

**✅ Les variables GPU sont maintenant définies directement dans le workflow et ne seront plus écrasées !**

