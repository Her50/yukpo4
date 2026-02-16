# 🔍 Diagnostic Final - Startup Probe Cloud Run

**Date**: 2026-02-16  
**Revision**: `yukpo-backend-00064-9k9`  
**Statut**: ❌ Problème persiste même sans startup probe explicite

---

## 🚨 Situation Actuelle

- ✅ Serveur HTTP minimal implémenté dans le code
- ✅ Logs de débogage ajoutés
- ✅ Startup probe strict supprimé (utilise valeurs par défaut)
- ❌ **Le déploiement échoue toujours**

**Conclusion** : Le problème n'est PAS la configuration du startup probe, mais probablement :
1. Le conteneur ne démarre jamais
2. Le code Rust crash avant d'atteindre le serveur minimal
3. Le serveur minimal ne démarre pas correctement
4. Une erreur fatale avant même le démarrage

---

## 🔍 ACTION CRITIQUE : Consulter les Logs

**URL des logs** (remplacer `***` par votre project ID) :
```
https://console.cloud.google.com/logs/viewer?project=***&resource=cloud_run_revision/service_name=yukpo-backend/revision_name=yukpo-backend-00064-9k9
```

**OU via Console GCP** :
1. Aller sur https://console.cloud.google.com/run
2. Sélectionner le projet
3. Cliquer sur `yukpo-backend`
4. Onglet "Logs"
5. Filtrer par revision : `yukpo-backend-00064-9k9`

---

## 📊 Messages à Rechercher dans les Logs

### ✅ Si Tout Fonctionne (Séquence Attendue)

1. `🚀 Démarrage Yukpomnang Backend - Cloud Run...` (script bash)
2. `[MAIN] 🚀 Application Rust démarre - Point d'entrée atteint` (Rust démarre)
3. `[MAIN] 🔧 Initialisation dotenv...`
4. `[MAIN] ✅ Logging initialisé`
5. **`[MAIN] 🔍 CLOUD_RUN détecté: true`** ← CRITIQUE
6. **`[MAIN] 🔍 Port configuré: 8080`** ← CRITIQUE
7. **`[MAIN] 🚀 Cloud Run: Démarrage serveur HTTP minimal...`** ← CRITIQUE
8. **`[MAIN] ✅ Serveur HTTP minimal bind réussi sur port 8080`** ← CRITIQUE
9. **`[HEALTH_SERVER] 🚀 Serveur minimal démarré, en attente de requêtes...`** ← CRITIQUE

---

### ❌ Scénarios d'Échec Possibles

#### Scénario A: Le Script Bash Ne Démarre Pas

**Si vous ne voyez PAS** : `🚀 Démarrage Yukpomnang Backend - Cloud Run...`

**Causes possibles** :
- L'exécutable n'existe pas
- Erreur de format d'exécutable
- Permissions insuffisantes

**Logs à rechercher** :
```
❌ ERREUR: Exécutable non trouvé!
exec format error
```

---

#### Scénario B: Rust Ne Démarre Pas

**Si vous voyez** : `🚀 Démarrage Yukpomnang Backend - Cloud Run...`

**Mais PAS** : `[MAIN] 🚀 Application Rust démarre`

**Causes possibles** :
- Panic Rust au démarrage
- Erreur de compilation
- Dépendances manquantes

**Logs à rechercher** :
```
panic
thread panicked
PANIC détecté
error: could not compile
```

---

#### Scénario C: CLOUD_RUN Non Détecté

**Si vous voyez** : `[MAIN] 🔍 CLOUD_RUN détecté: false`

**Problème** : La variable `CLOUD_RUN=true` n'est pas définie dans Cloud Run.

**Solution** : Vérifier le workflow `.github/workflows/gcp-deploy.yml` ligne 90.

---

#### Scénario D: Erreur de Bind

**Si vous voyez** :
```
[MAIN] 🔍 Tentative de bind sur 0.0.0.0:8080...
[MAIN] ❌ ERREUR CRITIQUE: Impossible de bind serveur minimal
```

**Problème** : Le port 8080 est déjà utilisé ou permissions insuffisantes.

**Solution** : Vérifier les permissions et le port.

---

#### Scénario E: Aucun Log (Conteneur Crash Immédiatement)

**Si vous ne voyez AUCUN log** :

**Problème** : Le conteneur crash avant même d'exécuter le script bash.

**Causes possibles** :
- Image Docker corrompue
- Exécutable incompatible (architecture)
- Erreur de runtime système

**Solution** : Vérifier l'image Docker et l'architecture (linux/amd64).

---

## 🔧 Solutions Selon les Scénarios

### Solution A: Vérifier l'Exécutable

**Vérifier dans le Dockerfile** :
```dockerfile
COPY --from=builder --chown=appuser:appuser /app/bin/yukpomnang_backend /app/yukpomnang_backend
```

**Vérifier que l'exécutable existe et est exécutable** :
```bash
ls -la /app/yukpomnang_backend
file /app/yukpomnang_backend
```

---

### Solution B: Vérifier CLOUD_RUN

**Vérifier dans le workflow** : `.github/workflows/gcp-deploy.yml` ligne 90

**S'assurer que** :
```yaml
"CLOUD_RUN": "true",
```

**Est bien dans le fichier `env-vars.json` créé.**

---

### Solution C: Vérifier les Permissions

**Vérifier dans le Dockerfile** :
```dockerfile
USER appuser
```

**S'assurer que l'utilisateur `appuser` peut bind sur le port 8080.**

---

### Solution D: Désactiver Temporairement le Serveur Minimal

**Si le serveur minimal cause des problèmes**, le désactiver temporairement :

**Fichier** : `backend/src/main.rs` (ligne 108)

**Modification** :
```rust
let health_server_handle = if false && is_cloud_run {  // Désactiver temporairement
    // ... code serveur minimal ...
} else {
    None
};
```

**⚠️ Note** : Cela ne résout pas le problème, mais permet de voir si c'est le serveur minimal qui cause l'échec.

---

## 📋 Checklist de Diagnostic

- [ ] **Logs Cloud Run consultés** (PRIORITÉ ABSOLUE)
- [ ] Dernière ligne de log identifiée
- [ ] Scénario d'échec identifié (A, B, C, D, ou E)
- [ ] Solution appropriée appliquée
- [ ] Nouveau déploiement testé

---

## 🎯 Plan d'Action Immédiat

### Étape 1: Consulter les Logs (IMMÉDIAT - PRIORITÉ 1)
1. Accéder aux logs via l'URL ci-dessus
2. Copier TOUS les logs de la revision 00064-9k9
3. Identifier la dernière ligne de log
4. Rechercher les messages critiques listés ci-dessus

### Étape 2: Identifier le Scénario
- Scénario A → Vérifier l'exécutable
- Scénario B → Vérifier Rust/compilation
- Scénario C → Vérifier CLOUD_RUN
- Scénario D → Vérifier bind/permissions
- Scénario E → Vérifier l'image Docker

### Étape 3: Appliquer la Solution
- Corriger le problème identifié
- Commiter et pousser
- Surveiller le nouveau déploiement

---

## 💡 Hypothèses Principales

### Hypothèse 1: CLOUD_RUN Non Détecté (Plus Probable)
- La variable `CLOUD_RUN=true` n'est pas définie dans Cloud Run
- Le serveur minimal ne démarre jamais
- Le code continue avec les initialisations normales (bloquantes)
- Le startup probe échoue car le serveur ne démarre pas assez vite

### Hypothèse 2: Erreur de Compilation/Exécution
- Le code ne compile pas correctement
- L'exécutable est corrompu ou incompatible
- Le conteneur crash avant même d'atteindre le serveur minimal

### Hypothèse 3: Problème avec Axum
- Les imports Axum ne fonctionnent pas
- Le serveur minimal ne peut pas être créé
- Erreur de compilation à l'exécution

---

## 🔗 Références

- **Logs Cloud Run** : URL fournie dans l'erreur
- **Code serveur minimal** : `backend/src/main.rs` lignes 94-180
- **Script de démarrage** : `backend/scripts/start-cloud-run.sh`
- **Dockerfile** : `backend/Dockerfile.cloud.optimized`
- **Workflow GCP** : `.github/workflows/gcp-deploy.yml`

---

## 🚨 ACTION REQUISE

**SANS les logs Cloud Run, il est IMPOSSIBLE de diagnostiquer le problème.**

**PRIORITÉ ABSOLUE** : Consulter les logs de la revision 00064-9k9 et identifier :
1. La dernière ligne de log
2. Le scénario d'échec (A, B, C, D, ou E)
3. L'erreur exacte

**Une fois les logs consultés, partagez-les pour un diagnostic précis.**

---

**💡 Note** : Si vous ne pouvez pas accéder aux logs, essayez de déployer manuellement avec `gcloud run deploy` et observez les logs en temps réel.

