# 🔐 Permissions Service Account GitHub Actions

**Date** : 2026-02-14  
**Service Account** : `github-actions@yukpo-project.iam.gserviceaccount.com`

---

## ✅ PERMISSIONS CONFIGURÉES

### 1. Artifact Registry
- ✅ `roles/artifactregistry.writer` - Upload d'images Docker
- ✅ `roles/artifactregistry.reader` - Lecture d'images Docker

### 2. Cloud Run
- ✅ `roles/run.admin` - Gestion complète des services Cloud Run (déploiement, mise à jour, etc.)

### 3. Cloud Storage (si nécessaire)
- ✅ `roles/storage.objectAdmin` - Gestion des objets Cloud Storage

---

## 📋 COMMANDES DE CONFIGURATION

### Toutes les permissions en une fois

```bash
# Artifact Registry
gcloud projects add-iam-policy-binding yukpo-project \
  --member="serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding yukpo-project \
  --member="serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.reader"

# Cloud Run
gcloud projects add-iam-policy-binding yukpo-project \
  --member="serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" \
  --role="roles/run.admin"
```

---

## 🔍 VÉRIFICATION

### Vérifier toutes les permissions

```bash
gcloud projects get-iam-policy yukpo-project \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" \
  --format="table(bindings.role)"
```

**Résultat attendu** :
```
ROLE
roles/artifactregistry.reader
roles/artifactregistry.writer
roles/run.admin
```

---

## 🎯 PERMISSIONS NÉCESSAIRES PAR FONCTIONNALITÉ

### Build et Push Docker
- ✅ `roles/artifactregistry.writer` - Pour pousser les images

### Déploiement Cloud Run
- ✅ `roles/run.admin` - Pour créer/mettre à jour les services Cloud Run
  - Inclut : `run.services.get`, `run.services.create`, `run.services.update`, etc.

### Lecture d'images
- ✅ `roles/artifactregistry.reader` - Pour lire les images existantes

---

## ⚠️ PERMISSIONS MANQUANTES (si erreurs)

Si vous rencontrez des erreurs de permissions, vérifiez :

1. **Cloud Run** :
   ```
   ERROR: PERMISSION_DENIED: Permission 'run.services.get' denied
   ```
   → Ajouter `roles/run.admin`

2. **Artifact Registry** :
   ```
   ERROR: Permission 'artifactregistry.repositories.uploadArtifacts' denied
   ```
   → Ajouter `roles/artifactregistry.writer`

3. **Cloud SQL** (si utilisé) :
   ```
   ERROR: Permission 'cloudsql.instances.connect' denied
   ```
   → Ajouter `roles/cloudsql.client`

---

## 📝 NOTES

- **Service Account** : `github-actions@yukpo-project.iam.gserviceaccount.com`
- **Projet** : `yukpo-project`
- **Région** : `europe-west1`

Les permissions sont configurées au niveau du projet, donc elles s'appliquent à toutes les ressources du projet.

---

**Date** : 2026-02-14  
**Statut** : ✅ **PERMISSIONS CONFIGURÉES**

