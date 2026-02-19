# 🔧 Correction Permissions Artifact Registry GCP

**Date** : 2026-02-14  
**Problème** : `Permission 'artifactregistry.repositories.uploadArtifacts' denied`

---

## 🎯 PROBLÈME IDENTIFIÉ

L'erreur se produit car :
1. **GCP a migré de GCR vers Artifact Registry** (GCR est déprécié)
2. Le workflow utilise encore `gcr.io` au lieu d'Artifact Registry
3. Le Service Account n'a pas les permissions nécessaires pour Artifact Registry

---

## ✅ SOLUTION

### 1. Exécuter le Script de Correction

```powershell
.\scripts\fix-gcp-artifact-registry-permissions.ps1
```

Le script va :
- ✅ Activer l'API Artifact Registry
- ✅ Créer le repository Artifact Registry s'il n'existe pas
- ✅ Donner les permissions nécessaires au Service Account :
  - `roles/artifactregistry.writer` (upload d'images)
  - `roles/artifactregistry.reader` (lecture d'images)
  - `roles/storage.objectAdmin` (compatibilité)

### 2. Workflows Mis à Jour

Les workflows ont été mis à jour pour utiliser **Artifact Registry** :

**Avant** :
```yaml
IMAGE_NAME: gcr.io/yukpo-project/yukpo-backend
```

**Après** :
```yaml
IMAGE_NAME: europe-west1-docker.pkg.dev/yukpo-project/yukpo-backend/yukpo-backend
```

### 3. Configuration Docker

Le workflow configure maintenant Docker pour Artifact Registry :
```yaml
- name: Configure Docker for Artifact Registry
  run: |
    gcloud auth configure-docker europe-west1-docker.pkg.dev
    gcloud auth configure-docker gcr.io
```

---

## 📋 FICHIERS MODIFIÉS

1. ✅ `.github/workflows/gcp-deploy.yml`
   - `IMAGE_NAME` mis à jour vers Artifact Registry
   - Configuration Docker mise à jour

2. ✅ `.github/workflows/docker-build-optimized.yml`
   - Variables GCP mises à jour
   - Configuration Docker mise à jour
   - Metadata action mise à jour

3. ✅ `scripts/fix-gcp-artifact-registry-permissions.ps1` (nouveau)
   - Script pour corriger les permissions automatiquement

---

## 🚀 PROCHAINES ÉTAPES

1. **Exécuter le script** :
   ```powershell
   .\scripts\fix-gcp-artifact-registry-permissions.ps1
   ```

2. **Vérifier les permissions** :
   ```bash
   gcloud projects get-iam-policy yukpo-project \
     --flatten="bindings[].members" \
     --filter="bindings.members:serviceAccount:VOTRE_SERVICE_ACCOUNT_EMAIL" \
     --format="table(bindings.role)"
   ```

3. **Tester le workflow** :
   - Push sur `master` ou `main`
   - Ou déclencher manuellement avec `workflow_dispatch`

---

## 📝 NOTES IMPORTANTES

### Artifact Registry vs GCR

- **GCR (Google Container Registry)** : Déprécié, utilise `gcr.io`
- **Artifact Registry** : Recommandé, utilise `REGION-docker.pkg.dev`

### Format URL Artifact Registry

```
REGION-docker.pkg.dev/PROJECT_ID/REPOSITORY_NAME/IMAGE_NAME:TAG
```

Exemple :
```
europe-west1-docker.pkg.dev/yukpo-project/yukpo-backend/yukpo-backend:latest
```

### Permissions Requises

Le Service Account a besoin de :
- `roles/artifactregistry.writer` : Pour pousser des images
- `roles/artifactregistry.reader` : Pour lire les images
- `roles/storage.objectAdmin` : Pour compatibilité avec GCR (si encore utilisé)

---

## ✅ RÉSULTAT ATTENDU

Après correction :
- ✅ Le build Docker fonctionne
- ✅ Le push vers Artifact Registry fonctionne
- ✅ Le déploiement Cloud Run fonctionne
- ✅ Plus d'erreur de permissions

---

**Date** : 2026-02-14  
**Statut** : ✅ **CORRECTION APPLIQUÉE**



