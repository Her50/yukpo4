# 🚀 Commande Rapide : Fix Permissions Artifact Registry

**Problème** : `Permission 'artifactregistry.repositories.uploadArtifacts' denied`

---

## ✅ SOLUTION RAPIDE (1 commande)

Exécutez cette commande PowerShell :

```powershell
.\scripts\fix-gcp-artifact-registry-permissions.ps1 -ServiceAccountEmail "github-actions@yukpo-project.iam.gserviceaccount.com"
```

Le script va automatiquement :
1. ✅ Activer l'API Artifact Registry
2. ✅ Créer le repository `yukpo-backend` s'il n'existe pas
3. ✅ Donner les permissions nécessaires au Service Account

---

## 📋 VÉRIFICATION MANUELLE (si le script ne fonctionne pas)

### 1. Activer l'API Artifact Registry

```bash
gcloud services enable artifactregistry.googleapis.com --project=yukpo-project
```

### 2. Créer le repository Artifact Registry

```bash
gcloud artifacts repositories create yukpo-backend \
  --repository-format=docker \
  --location=europe-west1 \
  --description="Docker repository for yukpo-backend" \
  --project=yukpo-project
```

### 3. Donner les permissions au Service Account

```bash
# Permission pour uploader des images
gcloud projects add-iam-policy-binding yukpo-project \
  --member="serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# Permission pour lire les images
gcloud projects add-iam-policy-binding yukpo-project \
  --member="serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.reader"
```

---

## 🔍 VÉRIFIER QUE ÇA FONCTIONNE

### Vérifier que le repository existe

```bash
gcloud artifacts repositories list --location=europe-west1 --project=yukpo-project
```

Vous devriez voir :
```
REPOSITORY      FORMAT  LOCATION      DESCRIPTION
yukpo-backend   DOCKER  europe-west1  Docker repository for yukpo-backend
```

### Vérifier les permissions du Service Account

```bash
gcloud projects get-iam-policy yukpo-project \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" \
  --format="table(bindings.role)"
```

Vous devriez voir :
```
ROLE
roles/artifactregistry.writer
roles/artifactregistry.reader
roles/run.admin
roles/storage.admin
...
```

---

## ⚡ SOLUTION ULTRA-RAPIDE (toutes les commandes en une fois)

```bash
gcloud services enable artifactregistry.googleapis.com --project=yukpo-project && \
gcloud artifacts repositories create yukpo-backend \
  --repository-format=docker \
  --location=europe-west1 \
  --description="Docker repository for yukpo-backend" \
  --project=yukpo-project 2>/dev/null || echo "Repository already exists" && \
gcloud projects add-iam-policy-binding yukpo-project \
  --member="serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer" && \
gcloud projects add-iam-policy-binding yukpo-project \
  --member="serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.reader" && \
echo "✅ Permissions configurées avec succès!"
```

---

## 🎯 APRÈS CORRECTION

Une fois les permissions corrigées :

1. **Le prochain push** sur `master` ou `main` déclenchera automatiquement le workflow
2. **Ou déclencher manuellement** via GitHub Actions avec `workflow_dispatch` et `push_to_gcp: true`

Le build Docker devrait maintenant réussir le push vers Artifact Registry ! 🎉

---

**Date** : 2026-02-14  
**Statut** : ✅ **PRÊT À EXÉCUTER**

