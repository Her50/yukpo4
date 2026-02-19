# 🔧 Solution de Contournement - Startup Probe

**Date**: 2026-02-16  
**Problème**: Startup probe échoue même avec serveur HTTP minimal

---

## 🎯 Solution Temporaire : Utiliser les Valeurs par Défaut

Le workflow `docker-build-optimized.yml` réussit car il n'a **PAS** de startup probe explicite configuré, donc Cloud Run utilise les valeurs par défaut (plus permissives).

### Option 1: Supprimer le Startup Probe Explicite (RECOMMANDÉ TEMPORAIREMENT)

**Fichier** : `.github/workflows/gcp-deploy.yml` (ligne 143)

**Modification** : Commenter ou supprimer la ligne `--startup-probe=...`

**Avant** :
```yaml
--startup-probe=timeoutSeconds=10,periodSeconds=15,initialDelaySeconds=30,failureThreshold=20,httpGet.port=8080,httpGet.path=/health \
```

**Après** :
```yaml
# --startup-probe=timeoutSeconds=10,periodSeconds=15,initialDelaySeconds=30,failureThreshold=20,httpGet.port=8080,httpGet.path=/health \
```

**Résultat** : Cloud Run utilisera les valeurs par défaut (plus permissives), comme dans `docker-build-optimized.yml`.

---

### Option 2: Utiliser un Startup Probe Plus Permissif

**Modification** : Utiliser des valeurs plus permissives

**Avant** :
```yaml
--startup-probe=timeoutSeconds=10,periodSeconds=15,initialDelaySeconds=30,failureThreshold=20,httpGet.port=8080,httpGet.path=/health
```

**Après** :
```yaml
--startup-probe=timeoutSeconds=1,periodSeconds=10,initialDelaySeconds=60,failureThreshold=30,httpGet.port=8080,httpGet.path=/health
```

**Explication** :
- `timeoutSeconds=1` : Timeout court par tentative
- `periodSeconds=10` : Intervalle de 10s entre tentatives
- `initialDelaySeconds=60` : Attendre 60s avant la première tentative
- `failureThreshold=30` : 30 tentatives (30 × 10s = 300s supplémentaires)
- **Timeout total** : 60s + (30 × 10s) = 360 secondes

---

## 🔍 Analyse des Logs (PRIORITÉ 1)

**AVANT d'appliquer la solution de contournement**, consultez les logs pour comprendre le problème :

**URL des logs** :
```
https://console.cloud.google.com/logs/viewer?project=***&resource=cloud_run_revision/service_name=yukpo-backend/revision_name=yukpo-backend-00063-wml
```

**Rechercher** :
- `[MAIN] 🔍 CLOUD_RUN détecté: true` ou `false`
- `[MAIN] ✅ Serveur HTTP minimal bind réussi`
- `[HEALTH_SERVER] 🚀 Serveur minimal démarré`
- `[HEALTH] ✅ Requête /health reçue`

**Voir** : `URGENT_CONSULTER_LOGS_REVISION_00063.md` pour guide complet.

---

## 📋 Plan d'Action Recommandé

### Étape 1: Consulter les Logs (IMMÉDIAT)
1. Accéder aux logs Cloud Run
2. Identifier la dernière ligne de log
3. Rechercher les messages critiques

### Étape 2: Appliquer la Solution de Contournement (TEMPORAIRE)
1. Supprimer le startup probe explicite (Option 1)
2. Commiter et pousser
3. Vérifier que le déploiement réussit

### Étape 3: Analyser le Problème (LONG TERME)
1. Une fois le déploiement réussi, analyser les logs
2. Identifier pourquoi le serveur minimal ne répond pas assez vite
3. Corriger le problème de fond
4. Réactiver le startup probe strict une fois corrigé

---

## ⚠️ Important

**Cette solution est TEMPORAIRE**. Elle permet au déploiement de réussir, mais ne résout pas le problème de fond. Il faut :

1. ✅ Consulter les logs pour comprendre le problème
2. ✅ Corriger le problème de fond (serveur minimal, CLOUD_RUN, etc.)
3. ✅ Réactiver le startup probe strict une fois corrigé

---

## 🔗 Références

- **Guide d'analyse des logs** : `URGENT_CONSULTER_LOGS_REVISION_00063.md`
- **Workflow GCP** : `.github/workflows/gcp-deploy.yml`
- **Workflow Docker Build** : `.github/workflows/docker-build-optimized.yml` (référence - pas de startup probe)

---

**💡 Recommandation** : Appliquer l'Option 1 (supprimer le startup probe explicite) pour permettre au déploiement de réussir, puis analyser les logs pour comprendre le problème et le corriger.


