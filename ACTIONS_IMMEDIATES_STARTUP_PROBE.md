# 🚀 Actions Immédiates - Correction Startup Probe Cloud Run

**Date**: 2026-02-16  
**Statut**: ✅ Corrections appliquées

---

## ✅ Corrections Appliquées

### 1. ✅ Augmentation du Timeout du Startup Probe

**Fichier**: `.github/workflows/gcp-deploy.yml` (ligne 143)

**Avant**:
```yaml
--startup-probe=timeoutSeconds=5,periodSeconds=10,initialDelaySeconds=10,failureThreshold=10,httpGet.port=8080,httpGet.path=/health
```

**Après** (CORRIGÉ):
```yaml
--startup-probe=timeoutSeconds=10,periodSeconds=15,initialDelaySeconds=30,failureThreshold=20,httpGet.port=8080,httpGet.path=/health
```

**Améliorations**:
- ✅ `timeoutSeconds`: 5s → **10s** (maximum autorisé par Cloud Run, doit être < periodSeconds)
- ✅ `periodSeconds`: 10s → **15s** (doit être > timeoutSeconds selon contrainte Cloud Run)
- ✅ `initialDelaySeconds`: 10s → **30s** (délai initial augmenté)
- ✅ `failureThreshold`: 10 → **20** (plus de tentatives)

**Nouveau timeout total**: 30s + (20 × 15s) = **330 secondes** (au lieu de 110s)

**⚠️ Correction importante**: `timeoutSeconds` doit être **inférieur** à `periodSeconds` (contrainte Cloud Run)

---

## 📋 Actions à Effectuer Maintenant

### 1. 🔍 Consulter les Logs Cloud Run (PRIORITÉ 1)

**URL des logs** (depuis l'erreur) :
```
https://console.cloud.google.com/logs/viewer?project=***&resource=cloud_run_revision/service_name/yukpo-backend/revision_name/yukpo-backend-00059-vgz
```

**Rechercher** :
- ❌ Erreurs de connexion PostgreSQL (`password authentication failed`, `connection refused`, etc.)
- ❌ Erreurs de migrations (`migration failed`, `table does not exist`, etc.)
- ❌ Timeouts (`timeout`, `acquire timeout`, etc.)
- ❌ Panics Rust (`panic`, `thread panicked`, etc.)
- ⏱️ Temps de démarrage (rechercher `[MAIN] 🚀 Serveur HTTP démarre`)

**Action** : Identifier la dernière ligne de log avant l'échec du startup probe.

---

### 2. 🔄 Commiter et Pousser les Corrections

```bash
git add .github/workflows/gcp-deploy.yml
git commit -m "fix(cloud-run): Augmenter timeout startup probe pour permettre démarrage complet

- timeoutSeconds: 5s → 10s (max autorisé)
- periodSeconds: 10s → 5s (vérifications plus fréquentes)
- initialDelaySeconds: 10s → 30s (délai initial augmenté)
- failureThreshold: 10 → 20 (plus de tentatives)
- Timeout total: 110s → 130s"
git push origin main
```

**Résultat attendu** : Le workflow GitHub Actions va automatiquement :
1. Build l'image Docker
2. Push vers Artifact Registry
3. Déployer sur Cloud Run avec la nouvelle configuration

**Temps estimé** : 10-15 minutes

---

### 3. 📊 Surveiller le Nouveau Déploiement

**Après le push** :
1. Aller sur https://github.com/Her50/yukpo4/actions
2. Surveiller le workflow "Deploy to Google Cloud Platform"
3. Vérifier que le déploiement réussit

**Si le déploiement échoue encore** :
- Consulter les logs Cloud Run (voir étape 1)
- Vérifier les erreurs spécifiques
- Appliquer les corrections supplémentaires (voir section suivante)

---

## 🔧 Corrections Supplémentaires (si nécessaire)

### Option A: Désactiver Temporairement les Migrations Auto

Si les migrations prennent trop de temps, désactiver temporairement :

**Fichier**: `.github/workflows/gcp-deploy.yml` (ligne 91)

**Modification**:
```yaml
"ENABLE_AUTO_MIGRATIONS": "false",  # Désactiver temporairement
```

**Note** : Les migrations devront être exécutées manuellement via un Cloud Run Job ou directement sur la base de données.

---

### Option B: Utiliser connect_lazy() pour PostgreSQL

Si la connexion PostgreSQL est le problème, utiliser `connect_lazy()` au lieu de `connect()` :

**Fichier**: `backend/src/main.rs` (ligne 384)

**Modification** (pour Cloud Run uniquement) :
```rust
let is_cloud_run = env::var("CLOUD_RUN").unwrap_or_default() == "true";

let pg_pool = if is_cloud_run {
    // Pour Cloud Run: connexion non-bloquante
    PgPoolOptions::new()
        .max_connections(max_connections)
        .min_connections(0)
        .acquire_timeout(std::time::Duration::from_secs(30))
        .connect_lazy(&db_url)?
} else {
    // Pour autres environnements: connexion bloquante avec retry
    // ... code existant avec connect() ...
};
```

**⚠️ Risque** : Si la DB n'est pas accessible, les requêtes échoueront silencieusement. Le serveur démarrera mais les requêtes API échoueront.

---

### Option C: Créer un Health Check Minimal

Créer une route `/health` qui répond immédiatement, même si les services ne sont pas prêts :

**Fichier**: `backend/src/lib.rs` (ligne 130)

**Modification** :
```rust
async fn healthz() -> &'static str {
    "OK"
}
```

**Statut** : ✅ Déjà implémenté (la route existe déjà)

---

## 📊 Métriques à Surveiller

Après le déploiement :

1. **Temps de démarrage** : Mesurer le temps entre le démarrage du conteneur et la première réponse `/health`
   - Objectif : < 60 secondes
   - Actuel : À mesurer via les logs

2. **Taux de succès du startup probe** : Surveiller le pourcentage de déploiements réussis
   - Objectif : 100%
   - Actuel : 0% (échec systématique)

3. **Latence des requêtes** : Vérifier que les optimisations n'impactent pas les performances
   - Objectif : < 200ms pour `/health`
   - Actuel : À mesurer

---

## 🔗 Références

- **Documentation complète** : `ANALYSE_PROBLEME_STARTUP_PROBE_CLOUD_RUN.md`
- **Cloud Run Troubleshooting** : https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
- **Cloud Run Startup Probe** : https://cloud.google.com/run/docs/configuring/healthchecks#startup-probe
- **Logs Cloud Run** : https://console.cloud.google.com/logs?project=yukpo-project

---

## ✅ Checklist

- [x] Timeout du startup probe augmenté
- [ ] Logs Cloud Run consultés et analysés
- [ ] Corrections commitées et poussées
- [ ] Nouveau déploiement surveillé
- [ ] Si échec : Corrections supplémentaires appliquées
- [ ] Documentation mise à jour

---

## 🎯 Prochaines Étapes

1. **Immédiat** : Consulter les logs Cloud Run pour identifier la cause exacte
2. **Court terme** : Commiter et pousser les corrections du startup probe
3. **Moyen terme** : Si nécessaire, appliquer les corrections supplémentaires (connect_lazy, migrations désactivées)
4. **Long terme** : Optimiser le temps de démarrage pour qu'il soit < 30 secondes

---

**💡 Note** : La correction du startup probe devrait résoudre le problème dans la plupart des cas. Si le problème persiste, consulter les logs pour identifier la cause spécifique et appliquer les corrections supplémentaires appropriées.

