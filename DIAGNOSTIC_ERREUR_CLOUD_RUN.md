# 🔍 Diagnostic Erreur Déploiement Cloud Run

**Date**: 2026-02-14  
**Service**: yukpo-backend  
**Région**: europe-west1

---

## ❌ Problèmes Identifiés

### 1. Variable CLOUD_RUN Non Définie

**Statut** : ❌ **NON DÉFINIE**

**Impact** : Le code utilise la connexion PostgreSQL **bloquante** au lieu de `connect_lazy` (non-bloquant).

**Solution** : Ajouter `CLOUD_RUN=true` dans les variables d'environnement.

### 2. Timeout Cloud Run Insuffisant

**Statut actuel** : 300s (5 minutes)

**Problème** : Si la base de données n'est pas accessible, 30 tentatives × 5s = 150s minimum, mais avec retries exponentiels, cela peut dépasser 300s.

**Solution** : Augmenter à 900s (15 minutes) avec CPU boost.

### 3. Base de Données Non Accessible

**Statut** : ❌ **NON ACCESSIBLE**

**Erreur** : `34.79.29.219:5432 - no response`

**Causes possibles** :
- Firewall bloque les connexions depuis Cloud Run
- Base de données dans un VPC non connecté
- IP whitelist ne contient pas les IPs Cloud Run
- Base de données arrêtée ou inaccessible

---

## ✅ Corrections Appliquées

### Commande Exécutée

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --update-env-vars="CLOUD_RUN=true" \
  --timeout=900 \
  --cpu-throttling \
  --startup-cpu-boost
```

**Résultat** :
- ✅ Variable `CLOUD_RUN=true` ajoutée
- ✅ Timeout augmenté à 900s
- ✅ CPU throttling activé
- ✅ Startup CPU boost activé

---

## 🔍 Vérifications à Effectuer

### 1. Vérifier Accessibilité Base de Données

La base de données PostgreSQL (34.79.29.219:5432) doit être accessible depuis Cloud Run.

**Si base de données est sur AWS RDS** :
- Vérifier Security Groups : Autoriser connexions depuis Cloud Run IPs
- Vérifier VPC : Configurer VPC connector si nécessaire
- Vérifier IP whitelist : Ajouter les IPs Cloud Run

**Si base de données est sur GCP** :
- Utiliser Cloud SQL Proxy (recommandé)
- Ou configurer VPC connector

### 2. Vérifier Logs après Redéploiement

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" --limit=50 --format=json
```

**Logs attendus** :
```
🚀 Cloud Run: Utilisation de connect_lazy pour démarrage rapide
✅ Pool PostgreSQL créé avec succès
✅ Serveur lance sur http://0.0.0.0:8080
```

### 3. Tester le Service

```bash
curl https://yukpo-backend-mkzqhoqhaq-ew.a.run.app/health
```

---

## 📋 Prochaines Étapes

1. ✅ **Correction appliquée** : CLOUD_RUN=true et timeout augmenté
2. ⏳ **Vérifier accessibilité DB** : Firewall, VPC, IP whitelist
3. ⏳ **Redéployer** : Le service devrait démarrer même si DB n'est pas immédiatement accessible
4. ⏳ **Vérifier logs** : Confirmer que le serveur démarre

---

## 💡 Explication Technique

### Avant Correction

Sans `CLOUD_RUN=true` :
- Code utilise `connect()` → connexion bloquante
- 30 tentatives de connexion
- Timeout Cloud Run (300s) dépassé
- Conteneur arrêté avant démarrage serveur HTTP

### Après Correction

Avec `CLOUD_RUN=true` :
- Code utilise `connect_lazy()` → connexion non-bloquante
- Pool créé immédiatement (connexions en arrière-plan)
- Serveur HTTP démarre rapidement
- Connexions DB établies quand disponibles

---

**⚠️ IMPORTANT** : Même avec `connect_lazy`, si la base de données n'est **jamais** accessible, certaines fonctionnalités ne fonctionneront pas. Il faut résoudre le problème d'accessibilité de la base de données.

