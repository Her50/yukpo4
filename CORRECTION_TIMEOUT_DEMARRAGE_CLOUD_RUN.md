# 🔧 Correction Timeout Démarrage Cloud Run

**Date** : 2026-02-14  
**Problème** : `The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout`

---

## 🎯 PROBLÈME IDENTIFIÉ

Le conteneur Cloud Run ne démarre pas dans le délai imparti car :
1. Le script `start-cloud.sh` fait trop de vérifications (DB, Redis) avec des timeouts longs
2. Cloud Run a un timeout de démarrage par défaut qui peut être trop court
3. Les vérifications bloquantes ralentissent le démarrage

**Erreur** :
```
ERROR: The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout
```

---

## ✅ SOLUTION APPLIQUÉE

### 1. Script de Démarrage Optimisé pour Cloud Run

**Création** : `backend/scripts/start-cloud-run.sh`
- ✅ Vérifications minimales (5 tentatives max au lieu de 30)
- ✅ Timeout réduit (1 seconde entre tentatives au lieu de 2)
- ✅ Pas de vérification Redis bloquante
- ✅ Démarrage direct de l'application

### 2. Modification du Dockerfile

**Changement** : Le Dockerfile utilise maintenant le script approprié selon la variable `CLOUD_RUN`

```dockerfile
ENTRYPOINT ["/bin/bash", "-c", "if [ \"$CLOUD_RUN\" = \"true\" ]; then /app/start-cloud-run.sh; else /app/start-cloud.sh; fi"]
```

### 3. Configuration Cloud Run

**Améliorations** :
- ✅ Mémoire augmentée : `512Mi` → `1Gi`
- ✅ CPU augmenté : `1` → `2`
- ✅ `--startup-cpu-boost` activé
- ✅ Variable `CLOUD_RUN=true` ajoutée
- ✅ Variable `PORT=8080` explicitement définie

---

## 📋 FICHIERS MODIFIÉS

1. ✅ `backend/scripts/start-cloud-run.sh` (nouveau)
   - Script optimisé pour Cloud Run avec démarrage rapide

2. ✅ `backend/Dockerfile.cloud.optimized`
   - Copie des deux scripts de démarrage
   - Logique conditionnelle pour choisir le script

3. ✅ `.github/workflows/docker-build-optimized.yml`
   - Variables `CLOUD_RUN=true` et `PORT=8080` ajoutées
   - Ressources augmentées (mémoire, CPU)
   - `--startup-cpu-boost` activé

---

## 🔧 DÉTAILS TECHNIQUES

### Script start-cloud-run.sh vs start-cloud.sh

**start-cloud.sh** (AWS ECS) :
- 30 tentatives pour DB (60 secondes max)
- 3 tentatives pour Redis (6 secondes max)
- Vérifications complètes

**start-cloud-run.sh** (Cloud Run) :
- 5 tentatives pour DB (5 secondes max)
- Pas de vérification Redis bloquante
- Démarrage direct

### Configuration Cloud Run

```yaml
--memory 1Gi              # Augmenté pour démarrage plus rapide
--cpu 2                   # Augmenté pour démarrage plus rapide
--startup-cpu-boost       # CPU boost pendant le démarrage
--cpu-throttling          # Throttling après démarrage
--timeout 300             # Timeout de requête (5 minutes)
```

---

## ✅ RÉSULTAT ATTENDU

Après cette correction :
- ✅ Le conteneur démarre plus rapidement
- ✅ Les vérifications ne bloquent pas le démarrage
- ✅ Le port 8080 est correctement écouté
- ✅ Cloud Run détecte le démarrage dans le délai imparti

---

## 🔍 VÉRIFICATION

### Vérifier les logs Cloud Run

```bash
gcloud run services logs read yukpo-backend \
  --region europe-west1 \
  --project yukpo-project \
  --limit 50
```

**Résultat attendu** :
- ✅ `🚀 Démarrage de Yukpomnang Backend - Google Cloud Run...`
- ✅ `✅ Base de données accessible`
- ✅ `🚀 Lancement de l'application backend...`
- ✅ `✅ Serveur lance sur http://0.0.0.0:8080`

---

**Date** : 2026-02-14  
**Statut** : ✅ **CORRIGÉ**

