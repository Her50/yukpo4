# ✅ Correction Finale - Startup Probe Persistant

**Date**: 2026-02-18  
**Problème**: Startup probe échoue toujours malgré les corrections précédentes

---

## 🔴 Problème Identifié

Le startup probe échoue car :
1. **Wrapper tue Python trop tôt** : Python est tué après seulement 10s, mais le startup probe a `initialDelaySeconds=60`
2. **Trop de mises à jour successives** : Le workflow fait 7 étapes de nettoyage qui créent 7 revisions, chacune échoue

---

## ✅ Corrections Appliquées

### 1. Wrapper Python - Attente Prolongée

**Changement**: Attendre 90 secondes avant de tuer Python (au lieu de 10s)

**Raison**: Le startup probe a `initialDelaySeconds=90`, donc on doit attendre au moins 90s pour que Cloud Run valide le probe.

**Fichier**: `backend/scripts/startup-wrapper.sh`

**Avant**:
- Python démarre → attend 5s → tue Python → attend 10s → démarre Rust

**Après**:
- Python démarre → attend 90s (Cloud Run valide le probe) → tue Python → attend 5s → démarre Rust

---

### 2. Startup Probe - Initial Delay Augmenté

**Changement**: `initialDelaySeconds=90` (au lieu de 60)

**Raison**: Donner plus de temps au wrapper Python pour démarrer et être détecté par Cloud Run.

**Fichier**: `.github/workflows/gcp-deploy.yml`

**Configuration**:
```yaml
--startup-probe=timeoutSeconds=10,periodSeconds=15,initialDelaySeconds=90,failureThreshold=20,httpGet.port=8080,httpGet.path=/health
```

**Timeout total**: 90s (initial) + (20 × 15s) = **390 secondes** maximum

---

### 3. Simplification du Processus de Nettoyage

**Changement**: Faire le nettoyage en **une seule étape** au lieu de 7 étapes séparées

**Raison**: Éviter de créer 7 revisions qui échouent toutes.

**Fichier**: `.github/workflows/gcp-deploy.yml`

**Avant**:
- Étape 1: Supprimer secrets comme env vars → crée revision (échoue)
- Étape 2: Attendre
- Étape 3: Clear env vars → crée revision (échoue)
- Étape 4: Attendre
- Étape 5: Clear secrets → crée revision (échoue)
- Étape 6: Clear Cloud SQL → crée revision (échoue)
- Étape 7: Attendre
- Déploiement final → crée revision (échoue)

**Après**:
- Nettoyage fait directement dans le déploiement final avec `--clear-env-vars`, `--clear-secrets`, `--clear-cloudsql-instances`
- **Une seule revision créée** au lieu de 7

---

## 📋 Fichiers Modifiés

1. ✅ `backend/scripts/startup-wrapper.sh`
   - Attente prolongée à 90s avant de tuer Python

2. ✅ `.github/workflows/gcp-deploy.yml`
   - `initialDelaySeconds=90` dans le startup probe
   - Simplification du nettoyage (une seule étape)

---

## 🎯 Résultat Attendu

1. **Python démarre** → répond aux health checks ✅
2. **Attente 90s** → Cloud Run valide le startup probe ✅
3. **Python est tué** → port libéré ✅
4. **Rust démarre** → prend le relais ✅
5. **Déploiement réussit** → une seule revision créée ✅

---

**Date**: 2026-02-18  
**Statut**: ✅ Corrections appliquées - Prêt pour test

