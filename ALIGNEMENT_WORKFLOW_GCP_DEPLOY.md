# 🔧 Alignement Workflow gcp-deploy.yml sur docker-build-optimized.yml

**Date**: 2026-02-16  
**Objectif**: Aligner `gcp-deploy.yml` sur `docker-build-optimized.yml` qui fonctionne

---

## 📊 Différences Identifiées

### 1. ✅ Mémoire (CRITIQUE)
- **docker-build-optimized.yml** : `--memory 2Gi` ✅
- **gcp-deploy.yml** : `--memory 1Gi` ❌

**Impact** : Plus de mémoire peut aider au démarrage et éviter les timeouts.

---

### 2. ✅ Service Account
- **docker-build-optimized.yml** : `--service-account ${{ secrets.GCP_SERVICE_ACCOUNT_EMAIL }}` ✅
- **gcp-deploy.yml** : ❌ Manquant

**Impact** : Le service account peut être nécessaire pour certaines permissions Cloud SQL.

---

### 3. ⚠️ Ordre des Flags
- **docker-build-optimized.yml** : `--cpu-boost` puis `--cpu-throttling`
- **gcp-deploy.yml** : `--cpu-throttling` puis `--cpu-boost`

**Impact** : Probablement non critique, mais alignons pour cohérence.

---

### 4. ℹ️ Image Tag
- **docker-build-optimized.yml** : `:latest`
- **gcp-deploy.yml** : `:${{ github.sha }}`

**Impact** : Non critique pour le startup probe, mais `:latest` peut être plus stable.

---

## ✅ Corrections Appliquées

1. ✅ Mémoire : `1Gi` → `2Gi`
2. ✅ Service Account : Ajouté `--service-account ${{ secrets.GCP_SERVICE_ACCOUNT_EMAIL }}`
3. ✅ Ordre des flags : Aligné sur docker-build-optimized.yml

---

## 🎯 Résultat Attendu

Le workflow `gcp-deploy.yml` devrait maintenant fonctionner comme `docker-build-optimized.yml` car :
- ✅ Même configuration mémoire (2Gi)
- ✅ Même service account
- ✅ Même ordre de flags
- ✅ Pas de startup probe explicite (utilise valeurs par défaut)

---

## 📋 Vérifications

- [ ] Secret `GCP_SERVICE_ACCOUNT_EMAIL` existe dans GitHub
- [ ] Le workflow utilise maintenant 2Gi de mémoire
- [ ] Le service account est configuré
- [ ] Le déploiement réussit

---

**💡 Note** : Si le secret `GCP_SERVICE_ACCOUNT_EMAIL` n'existe pas, il faudra le créer ou retirer cette ligne.

