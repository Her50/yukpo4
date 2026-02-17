# Explication : Pourquoi les Builds ne se Déclenchent pas

**Date**: 2026-02-17

---

## 🔍 Problème Identifié

Les builds GitHub Actions ne se déclenchent pas pour tous les commits car le workflow est configuré pour ne se déclencher que sur certains chemins.

---

## 📋 Configuration Actuelle

Le workflow `Deploy to Google Cloud Platform` se déclenche uniquement sur :

```yaml
on:
  push:
    branches:
      - main
      - master
    paths:
      - 'backend/**'      # ✅ Changements dans le backend
      - '.github/workflows/gcp-deploy.yml'  # ✅ Changements du workflow lui-même
  workflow_dispatch:     # ✅ Déclenchement manuel
```

---

## ✅ Comportement Normal

**Le workflow se déclenche** :
- ✅ Sur les changements dans `backend/**` (code Rust, migrations, etc.)
- ✅ Sur les changements dans `.github/workflows/gcp-deploy.yml`
- ✅ Sur déclenchement manuel (`workflow_dispatch`)

**Le workflow ne se déclenche PAS** :
- ❌ Sur les changements de documentation (`.md`)
- ❌ Sur les changements de scripts (`scripts/**`)
- ❌ Sur les changements dans d'autres dossiers

**C'est normal !** On ne veut pas déployer à chaque changement de documentation.

---

## 🚀 Comment Déclencher un Build

### Méthode 1 : Déclenchement Automatique

Faire un changement dans `backend/` :
```bash
# Exemple : Modifier un fichier Rust
echo "// Commentaire" >> backend/src/main.rs
git add backend/src/main.rs
git commit -m "test: Trigger build"
git push origin master
```

### Méthode 2 : Déclenchement Manuel (workflow_dispatch)

1. Aller sur GitHub : https://github.com/Her50/yukpo4/actions
2. Sélectionner le workflow "Deploy to Google Cloud Platform"
3. Cliquer sur "Run workflow"
4. Sélectionner la branche (master)
5. Cliquer sur "Run workflow"

### Méthode 3 : Via GitHub CLI

```bash
gh workflow run "Deploy to Google Cloud Platform" --repo Her50/yukpo4 --ref master
```

---

## 📊 Vérification des Builds

### Voir tous les builds

```bash
gh run list --repo Her50/yukpo4 --workflow "Deploy to Google Cloud Platform" --limit 10
```

### Voir le statut du dernier build

```bash
gh run list --repo Her50/yukpo4 --workflow "Deploy to Google Cloud Platform" --limit 1
```

### Voir les logs d'un build

```bash
gh run view <RUN_ID> --repo Her50/yukpo4 --log
```

---

## 🔧 Si vous voulez Déclencher sur Plus de Chemins

Si vous voulez que le workflow se déclenche aussi sur les changements de scripts ou documentation (non recommandé), modifiez `.github/workflows/gcp-deploy.yml` :

```yaml
paths:
  - 'backend/**'
  - '.github/workflows/gcp-deploy.yml'
  - 'scripts/**'      # ⚠️ Déclenchera sur changements scripts
  - '*.md'            # ⚠️ Déclenchera sur changements documentation
```

**⚠️ Attention** : Cela déclenchera des builds à chaque changement de documentation, ce qui peut être coûteux et inutile.

---

## ✅ Résumé

- ✅ Le workflow fonctionne correctement
- ✅ Il se déclenche uniquement sur les changements pertinents (backend)
- ✅ Vous pouvez déclencher manuellement si nécessaire
- ✅ C'est le comportement attendu et optimal

**Pour déclencher un build maintenant** : Utilisez `workflow_dispatch` dans GitHub Actions ou faites un changement dans `backend/`.

