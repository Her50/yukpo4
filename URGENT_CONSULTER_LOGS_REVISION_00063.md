# 🚨 URGENT - Consulter les Logs Revision 00063

**Date**: 2026-02-16  
**Revision**: `yukpo-backend-00063-wml`  
**Problème**: Startup probe échoue malgré serveur HTTP minimal

---

## 🔍 ACTION IMMÉDIATE : Consulter les Logs

**URL des logs** (remplacer `***` par votre project ID) :
```
https://console.cloud.google.com/logs/viewer?project=***&resource=cloud_run_revision/service_name=yukpo-backend/revision_name=yukpo-backend-00063-wml
```

**OU via Console GCP** :
1. Aller sur https://console.cloud.google.com/run
2. Sélectionner le projet
3. Cliquer sur `yukpo-backend`
4. Onglet "Logs"
5. Filtrer par revision : `yukpo-backend-00063-wml`

---

## 📊 Messages Critiques à Rechercher

### ✅ Séquence Attendue (Si Tout Fonctionne)

Dans l'ordre chronologique, vous devriez voir :

1. `🚀 Démarrage Yukpomnang Backend - Cloud Run...` (script bash)
2. `[MAIN] 🚀 Application Rust démarre` (début Rust)
3. `[MAIN] 🔧 Initialisation dotenv...`
4. `[MAIN] ✅ Logging initialisé`
5. **`[MAIN] 🔍 CLOUD_RUN détecté: true`** ← CRITIQUE
6. **`[MAIN] 🔍 Port configuré: 8080`** ← CRITIQUE
7. **`[MAIN] 🚀 Cloud Run: Démarrage serveur HTTP minimal...`** ← CRITIQUE
8. **`[MAIN] 🔍 Tentative de bind sur 0.0.0.0:8080...`** ← CRITIQUE
9. **`[MAIN] ✅ Serveur HTTP minimal bind réussi sur port 8080`** ← CRITIQUE
10. **`[HEALTH_SERVER] 🚀 Serveur minimal démarré, en attente de requêtes...`** ← CRITIQUE
11. `[HEALTH] ✅ Requête /health reçue` (quand le startup probe teste)

---

### ❌ Si le Problème est Avant le Serveur Minimal

**Si vous ne voyez PAS les messages 5-10** :

**A. Le script bash ne démarre pas** :
```
❌ ERREUR: Exécutable non trouvé
exec format error
```

**B. Rust ne démarre pas** :
```
panic
thread panicked
PANIC détecté
```

**C. CLOUD_RUN n'est pas détecté** :
```
[MAIN] 🔍 CLOUD_RUN détecté: false
```

**Solution** : Vérifier que `CLOUD_RUN=true` est bien défini dans les variables d'environnement Cloud Run.

---

### ❌ Si le Problème est le Bind

**Si vous voyez** :
```
[MAIN] 🔍 Tentative de bind sur 0.0.0.0:8080...
[MAIN] ❌ ERREUR CRITIQUE: Impossible de bind serveur minimal
Address already in use
Permission denied
```

**Solutions** :
1. Vérifier que `PORT=8080` est défini
2. Vérifier les permissions du conteneur
3. Cloud Run devrait gérer cela automatiquement

---

### ❌ Si le Serveur Minimal Démarre Mais Ne Répond Pas

**Si vous voyez** :
```
[HEALTH_SERVER] 🚀 Serveur minimal démarré, en attente de requêtes...
```

**Mais le startup probe échoue toujours** :

**Problèmes possibles** :
1. Le serveur écoute sur le mauvais port
2. Le serveur ne répond pas aux requêtes HTTP
3. Le routing Axum ne fonctionne pas correctement

**Solution** : Vérifier que le serveur répond vraiment en testant manuellement (si possible).

---

## 🔧 Solutions Selon les Logs

### Solution A: CLOUD_RUN Non Détecté

**Si vous voyez** : `[MAIN] 🔍 CLOUD_RUN détecté: false`

**Problème** : La variable `CLOUD_RUN=true` n'est pas définie.

**Solution** : Vérifier le workflow `.github/workflows/gcp-deploy.yml` ligne 90 :
```yaml
"CLOUD_RUN": "true",
```

S'assurer que cette variable est bien dans le fichier `env-vars.json` créé.

---

### Solution B: Erreur de Bind

**Si vous voyez** : `Impossible de bind serveur minimal`

**Solution** : 
1. Vérifier que le port 8080 est libre
2. Vérifier les permissions
3. Peut-être utiliser un autre port (non recommandé pour Cloud Run)

---

### Solution C: Serveur Minimal Ne Démarre Pas

**Si le serveur minimal ne démarre jamais** :

**Solution** : Vérifier les imports Axum et la compilation :
```rust
use axum::{routing::get, Router};
```

S'assurer que `axum` est bien dans les dépendances.

---

### Solution D: Désactiver Temporairement le Startup Probe Strict

**Solution de contournement** : Utiliser les valeurs par défaut de Cloud Run (comme dans `docker-build-optimized.yml`).

**Fichier** : `.github/workflows/gcp-deploy.yml` (ligne 143)

**Modification** : Supprimer la ligne `--startup-probe=...` pour utiliser les valeurs par défaut.

**⚠️ Note** : Cette solution permet au déploiement de réussir, mais ne résout pas le problème de fond.

---

## 📋 Checklist d'Analyse

- [ ] **Logs Cloud Run consultés** (PRIORITÉ 1)
- [ ] Dernière ligne de log identifiée
- [ ] Messages critiques recherchés (liste ci-dessus)
- [ ] Problème identifié selon les messages trouvés
- [ ] Solution appropriée appliquée

---

## 🎯 Plan d'Action

### Étape 1: Consulter les Logs (IMMÉDIAT)
1. Accéder aux logs via l'URL ci-dessus
2. Identifier la dernière ligne de log
3. Rechercher les messages critiques listés

### Étape 2: Identifier le Problème
- Si CLOUD_RUN=false → Solution A
- Si erreur de bind → Solution B
- Si serveur ne démarre pas → Solution C
- Si serveur démarre mais probe échoue → Solution D (temporaire)

### Étape 3: Appliquer la Solution
- Corriger le code si nécessaire
- Commiter et pousser
- Surveiller le nouveau déploiement

---

## 💡 Hypothèses

### Hypothèse 1: CLOUD_RUN Non Détecté
- La variable `CLOUD_RUN=true` n'est pas définie dans Cloud Run
- Le serveur minimal ne démarre jamais
- Le code continue avec les initialisations normales (bloquantes)

### Hypothèse 2: Erreur de Compilation
- Le code ne compile pas correctement
- L'exécutable n'existe pas ou est corrompu
- Le conteneur crash avant même de démarrer

### Hypothèse 3: Problème avec Axum
- Les imports Axum ne fonctionnent pas
- Le serveur minimal ne peut pas être créé
- Erreur de compilation à l'exécution

---

## 🔗 Références

- **Logs Cloud Run** : URL fournie dans l'erreur
- **Code serveur minimal** : `backend/src/main.rs` lignes 94-150
- **Workflow GCP** : `.github/workflows/gcp-deploy.yml`
- **Documentation complète** : `ANALYSE_LOGS_CLOUD_RUN_STARTUP.md`

---

**🚨 IMPORTANT** : Les logs Cloud Run contiennent la réponse exacte. Consultez-les en priorité pour identifier la cause spécifique de l'échec. Sans les logs, il est impossible de savoir exactement ce qui se passe.

