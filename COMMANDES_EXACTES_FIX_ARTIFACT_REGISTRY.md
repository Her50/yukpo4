# 🔧 Commandes Exactes : Fix Permissions Artifact Registry

**⚠️ IMPORTANT** : Ces commandes doivent être exécutées depuis :
- **Google Cloud Shell** (recommandé) : https://shell.cloud.google.com
- **Ou une machine avec gcloud CLI installé**

---

## ✅ SOLUTION EN 4 ÉTAPES

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

**Note** : Si le repository existe déjà, cette commande échouera avec une erreur. C'est normal, continuez avec l'étape 3.

### 3. Donner la permission WRITER (upload d'images)

```bash
gcloud projects add-iam-policy-binding yukpo-project \
  --member="serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

### 4. Donner la permission READER (lecture d'images)

```bash
gcloud projects add-iam-policy-binding yukpo-project \
  --member="serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.reader"
```

---

## 🚀 COMMANDE UNIQUE (toutes les étapes)

Copiez-collez cette commande complète dans Cloud Shell :

```bash
gcloud services enable artifactregistry.googleapis.com --project=yukpo-project && \
gcloud artifacts repositories create yukpo-backend \
  --repository-format=docker \
  --location=europe-west1 \
  --description="Docker repository for yukpo-backend" \
  --project=yukpo-project 2>/dev/null || echo "✅ Repository already exists" && \
gcloud projects add-iam-policy-binding yukpo-project \
  --member="serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer" && \
gcloud projects add-iam-policy-binding yukpo-project \
  --member="serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.reader" && \
echo "✅ Permissions configurées avec succès!"
```

---

## 🔍 VÉRIFICATION

### Vérifier que le repository existe

```bash
gcloud artifacts repositories list --location=europe-west1 --project=yukpo-project
```

**Résultat attendu** :
```
REPOSITORY      FORMAT  LOCATION      DESCRIPTION
yukpo-backend   DOCKER  europe-west1  Docker repository for yukpo-backend
```

### Vérifier les permissions du Service Account

```bash
gcloud projects get-iam-policy yukpo-project \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" \
  --format="table(bindings.role)" | grep artifactregistry
```

**Résultat attendu** :
```
ROLE
roles/artifactregistry.writer
roles/artifactregistry.reader
```

---

## 📋 ACCÈS RAPIDE

### Option 1 : Google Cloud Shell (Recommandé)

1. **Ouvrez** : https://shell.cloud.google.com
2. **Sélectionnez le projet** : `yukpo-project`
3. **Copiez-collez** la commande unique ci-dessus
4. **Appuyez sur Entrée**

### Option 2 : Installer gcloud CLI localement

**Windows** :
```powershell
# Télécharger depuis : https://cloud.google.com/sdk/docs/install
# Ou via Chocolatey :
choco install gcloudsdk
```

**Après installation** :
```bash
gcloud auth login
gcloud config set project yukpo-project
```

Puis exécutez les commandes ci-dessus.

---

## ✅ APRÈS CORRECTION

Une fois les permissions configurées :

1. **Le prochain push** sur `master` ou `main` déclenchera automatiquement le workflow
2. **Le build Docker** pourra maintenant pousser vers Artifact Registry sans erreur
3. **Le déploiement Cloud Run** fonctionnera correctement

---

## 🎯 RÉSUMÉ

**Service Account** : `github-actions@yukpo-project.iam.gserviceaccount.com`  
**Repository** : `yukpo-backend`  
**Location** : `europe-west1`  
**Permissions nécessaires** :
- `roles/artifactregistry.writer`
- `roles/artifactregistry.reader`

---

**Date** : 2026-02-14  
**Statut** : ✅ **PRÊT À EXÉCUTER DANS CLOUD SHELL**

