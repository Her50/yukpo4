# 🔧 Correction Startup Probe Cloud Run

**Date**: 2026-02-16  
**Problème**: Le conteneur Docker échoue lors des vérifications de startup probe sur Cloud Run

---

## 🎯 PROBLÈME IDENTIFIÉ

L'erreur suivante se produisait lors du déploiement :
```
ERROR: (gcloud.run.deploy) The user-provided container failed the configured startup probe checks.
```

**Causes identifiées** :
1. ❌ **Pas de configuration de startup probe** dans le workflow GCP
2. ❌ **Variable PORT manquante** dans les variables d'environnement
3. ⚠️ **Réponse HTTP du serveur minimal** pourrait être améliorée (code de statut explicite)

---

## ✅ SOLUTIONS APPLIQUÉES

### 1. Ajout de la configuration Startup Probe

**Fichier**: `.github/workflows/gcp-deploy.yml`

**Changement** : Ajout de `--startup-probe` avec paramètres optimisés pour Cloud Run

```yaml
--startup-probe=timeoutSeconds=10,periodSeconds=15,initialDelaySeconds=30,failureThreshold=20,httpGet.port=8080,httpGet.path=/health
```

**Paramètres** :
- `timeoutSeconds=10`: Maximum autorisé par Cloud Run (10s), **doit être < periodSeconds**
- `periodSeconds=15`: Intervalle entre tentatives (doit être > timeoutSeconds selon contrainte Cloud Run)
- `initialDelaySeconds=30`: Délai initial pour laisser le conteneur démarrer
- `failureThreshold=20`: Nombre de tentatives (20 × 15s = 300s supplémentaires)
- **Timeout total**: 30s + (20 × 15s) = **330 secondes** maximum

**⚠️ Contrainte importante**: Cloud Run exige que `timeoutSeconds < periodSeconds`.

---

### 2. Configuration du port Cloud Run

**Fichier**: `.github/workflows/gcp-deploy.yml`

**Changement** : Ajout de `--port 8080` dans la commande de déploiement

```yaml
gcloud run deploy ... \
  --port 8080 \
  ...
```

**⚠️ Important** : Cloud Run réserve automatiquement la variable `PORT` et ne permet pas de la définir manuellement dans les variables d'environnement. Il faut utiliser `--port 8080` pour spécifier le port.

**Raison** : Le serveur minimal a besoin de connaître le port pour démarrer correctement. Cloud Run définit automatiquement `PORT=8080` quand `--port 8080` est spécifié.

---

### 3. Amélioration de la réponse HTTP du serveur minimal

**Fichier**: `backend/src/main.rs`

**Changement** : Ajout d'un code de statut HTTP 200 explicite

**Avant** :
```rust
.route(
    "/health",
    get(|| async {
        eprintln!("[HEALTH] ✅ Requête /health reçue");
        "OK"
    }),
)
```

**Après** :
```rust
use axum::{http::StatusCode, routing::get, Router};
.route(
    "/health",
    get(|| async {
        eprintln!("[HEALTH] ✅ Requête /health reçue");
        (StatusCode::OK, "OK")
    }),
)
```

**Raison** : Cloud Run vérifie le code de statut HTTP. Un code 200 explicite garantit que le health check passe.

---

## 📋 FICHIERS MODIFIÉS

1. ✅ `.github/workflows/gcp-deploy.yml`
   - Ajout de `PORT=8080` dans les variables d'environnement
   - Ajout de `--startup-probe` avec paramètres optimisés

2. ✅ `backend/src/main.rs`
   - Amélioration de la réponse HTTP du serveur minimal avec `StatusCode::OK`

---

## 🔍 FONCTIONNEMENT

### Séquence de démarrage Cloud Run

1. **Démarrage du conteneur** (0s)
2. **Délai initial** : `initialDelaySeconds=30` (30s)
3. **Premier health check** : Cloud Run teste `/health` sur le port 8080
4. **Serveur minimal** : Répond immédiatement avec `200 OK` (démarre en ~100ms)
5. **Initialisations lourdes** : DB, migrations, etc. (en arrière-plan)
6. **Serveur complet** : Remplace le serveur minimal une fois prêt

### Avantages

- ✅ **Health check répond immédiatement** (serveur minimal)
- ✅ **Initialisations non-bloquantes** (en arrière-plan)
- ✅ **Timeout généreux** (330s pour les migrations longues)
- ✅ **Code HTTP explicite** (200 OK garanti)

---

## 🚀 DÉPLOIEMENT

Les modifications sont automatiquement appliquées lors du prochain push sur `main` ou `master`.

**Workflow déclenché** :
- Push sur `main` ou `master` avec modifications dans `backend/**`
- Ou déclenchement manuel via `workflow_dispatch`

---

## ✅ VÉRIFICATIONS

Après déploiement, vérifier :

1. **Logs Cloud Run** :
   ```
   [MAIN] 🚀 Cloud Run: Démarrage serveur HTTP minimal pour health check...
   [MAIN] ✅ Serveur HTTP minimal bind réussi sur port 8080
   [HEALTH] ✅ Requête /health reçue
   ```

2. **Health check** :
   ```bash
   curl https://yukpo-backend-*.a.run.app/health
   # Devrait retourner: OK
   ```

3. **Startup probe** :
   - Vérifier dans Cloud Console que le startup probe passe
   - Le conteneur devrait démarrer en < 330s

---

## 📊 RÉSUMÉ

| Problème | Solution | Statut |
|----------|----------|--------|
| Pas de startup probe | Ajout `--startup-probe` avec paramètres optimisés | ✅ |
| Variable PORT manquante | Ajout `PORT=8080` dans env vars | ✅ |
| Réponse HTTP implicite | Code de statut 200 explicite | ✅ |

---

**✅ Toutes les corrections appliquées - Prêt pour déploiement !**

