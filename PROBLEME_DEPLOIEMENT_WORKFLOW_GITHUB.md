# 🔧 Problème Déploiement via GitHub Actions Workflow

**Date**: 2026-02-15  
**Problème**: Le workflow GitHub Actions déploie avec un timeout de 300s au lieu de 900s

---

## 🔍 Diagnostic

### Problème Identifié

Le workflow `.github/workflows/docker-build-optimized.yml` déploie sur Cloud Run avec :
- ✅ `CLOUD_RUN=true` (défini correctement)
- ❌ `--timeout 300` (5 minutes - **INSUFFISANT**)
- ❌ Pas de `--cpu-throttling` (recommandé)

### Impact

Même si le code Rust et les scripts sont corrigés pour un démarrage non-bloquant :
- Le timeout de 300s peut être dépassé si la DB prend du temps à répondre
- Le CPU throttling n'est pas activé (démarrage plus lent)

---

## ✅ Corrections Appliquées

### 1. Workflow GitHub Actions

**Fichier** : `.github/workflows/docker-build-optimized.yml`

**Changement** :
```yaml
# Avant
--timeout 300 \
--cpu-boost \

# Après
--timeout 900 \
--cpu-boost \
--cpu-throttling \
```

**Impact** :
- Timeout augmenté à 900s (15 minutes)
- CPU throttling activé (meilleure gestion des ressources)

---

## 📋 Vérifications

### 1. Variables d'Environnement dans le Workflow

Le workflow définit déjà `CLOUD_RUN=true` dans `env-vars.json` :
- ✅ Ligne 478 : `"CLOUD_RUN": "true"` (avec jq)
- ✅ Ligne 491 : `"CLOUD_RUN": "true"` (fallback)

### 2. Variables GPU

Les variables GPU doivent être définies via :
- **Secrets GitHub** avec préfixe `GCP_ENV_` (ex: `GCP_ENV_GPU_ENABLED=true`)
- **Ou** directement dans le workflow si nécessaire

**Exemple** :
```bash
# Ajouter dans GitHub Secrets :
GCP_ENV_GPU_ENABLED=true
GCP_ENV_GPU_ENDPOINT=http://yukpo-gpu-workers:8080
GCP_ENV_GPU_ZONE=europe-west1-b
# etc.
```

---

## 🚀 Prochaines Étapes

### 1. Commit et Push

Les corrections ont été appliquées au workflow. Il faut :
1. Commit les changements
2. Push sur GitHub
3. Le workflow se déclenchera automatiquement
4. L'image Docker sera reconstruite avec les dernières corrections
5. Le déploiement utilisera le timeout de 900s

### 2. Vérifier le Déploiement

Après le déploiement, vérifier :
```bash
# Vérifier le timeout
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="get(spec.template.spec.timeoutSeconds)"

# Devrait afficher : 900
```

### 3. Vérifier les Logs

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" --limit=50 --format=json
```

**Logs attendus** :
```
🚀 Cloud Run: Utilisation de connect_lazy pour démarrage rapide
🔧 Cloud Run: Pool configuré (max=50, min=0) - Démarrage non-bloquant
✅ Serveur lance sur http://0.0.0.0:8080
```

---

## ⚠️ Notes Importantes

### 1. Image Docker

Le workflow reconstruit l'image Docker à chaque push. Assurez-vous que :
- Les corrections dans `backend/src/main.rs` sont commitées
- Les corrections dans `backend/scripts/start-cloud.sh` sont commitées
- Le `Dockerfile.cloud.optimized` utilise bien les scripts corrigés

### 2. Variables d'Environnement

Le workflow utilise `--env-vars-file` qui peut **écraser** les variables définies manuellement via `gcloud run services update`.

**Solution** : Définir toutes les variables dans le workflow ou via secrets GitHub avec préfixe `GCP_ENV_`.

### 3. Cache Docker

Si le build Docker utilise un cache, l'image peut ne pas être à jour. Vérifier que :
- Le workflow force un rebuild complet si nécessaire
- Les layers Docker sont invalidés correctement

---

## 🔧 Dépannage

### Si le déploiement échoue toujours

1. **Vérifier que les corrections sont dans le code** :
   ```bash
   git log --oneline -10
   git show HEAD:backend/src/main.rs | grep -A 5 "cloud_run_min"
   ```

2. **Vérifier que l'image Docker est à jour** :
   ```bash
   gcloud container images list-tags gcr.io/yukpo-project/yukpo-backend --limit=5
   ```

3. **Forcer un rebuild sans cache** :
   - Modifier le workflow pour ajouter `--no-cache` au build Docker
   - Ou supprimer l'image existante et laisser le workflow la reconstruire

4. **Vérifier les logs du workflow** :
   - Aller sur GitHub Actions
   - Vérifier les logs du job "Deploy to Cloud Run"
   - Chercher les erreurs de déploiement

---

## 📝 Résumé

- ✅ **Workflow corrigé** : Timeout 900s, CPU throttling activé
- ✅ **CLOUD_RUN=true** : Défini dans le workflow
- ⏳ **Attendre** : Prochain push déclenchera le workflow avec les corrections
- ⏳ **Vérifier** : Logs après déploiement pour confirmer le démarrage

---

**⚠️ IMPORTANT** : Le workflow GitHub Actions peut écraser les variables définies manuellement. Il faut s'assurer que toutes les variables nécessaires (y compris GPU) sont définies dans le workflow ou via secrets GitHub.

