# 🚨 Actions Immédiates - Analyse des Logs Cloud Run

**Date**: 2026-02-16  
**Problème**: Startup probe échoue avec timeout de 330 secondes  
**Revision**: `yukpo-backend-00060-6wn`

---

## ⚠️ État Actuel

- ✅ Configuration startup probe corrigée (timeoutSeconds < periodSeconds)
- ✅ Timeout total : 330 secondes
- ✅ Route `/health` existe dans le code
- ✅ `connect_lazy()` déjà utilisé pour Cloud Run
- ❌ **Le startup probe échoue toujours**

**Conclusion** : Le problème n'est PAS la configuration du startup probe, mais probablement :
1. Le serveur HTTP ne démarre jamais
2. Une erreur fatale avant le démarrage du serveur
3. Les migrations ou autres initialisations prennent trop de temps

---

## 🔍 ACTION IMMÉDIATE : Analyser les Logs

**URL des logs** (remplacer `***` par votre project ID) :
```
https://console.cloud.google.com/logs/viewer?project=***&resource=cloud_run_revision/service_name/yukpo-backend/revision_name=yukpo-backend-00060-6wn
```

**OU via Console GCP** :
1. Aller sur https://console.cloud.google.com/run
2. Sélectionner le projet
3. Cliquer sur `yukpo-backend`
4. Onglet "Logs"
5. Filtrer par revision : `yukpo-backend-00060-6wn`

---

## 📊 Ce qu'il faut rechercher dans les logs

### ✅ Signes que le serveur démarre

Rechercher ces messages (dans l'ordre chronologique) :
1. `🚀 Démarrage Yukpomnang Backend - Cloud Run...`
2. `[MAIN] 🚀 Application Rust démarre`
3. `[MAIN] ✅ DATABASE_URL récupérée`
4. `[MAIN] ✅ Bind réussi, démarrage du serveur HTTP...`
5. `✅ Serveur lance sur http://0.0.0.0:8080`

**Si ces messages apparaissent** : Le serveur démarre, mais `/health` ne répond peut-être pas.

**Si ces messages n'apparaissent PAS** : Le serveur ne démarre jamais (erreur fatale avant).

---

### ❌ Erreurs critiques à identifier

**A. Erreur PostgreSQL** :
```
❌ ERREUR CRITIQUE: DATABASE_URL manquante
password authentication failed
connection refused
timeout
acquire timeout
```

**B. Erreur Migrations** :
```
❌ [MIGRATIONS] Erreur
migration failed
table does not exist
```

**C. Panic Rust** :
```
panic
thread panicked
PANIC détecté
```

**D. Erreur Port/Bind** :
```
❌ ERREUR CRITIQUE: Impossible de bind sur
Address already in use
Permission denied
```

**E. Erreur Exécutable** :
```
❌ ERREUR: Exécutable non trouvé
exec format error
```

---

## 🔧 Solutions selon l'erreur trouvée

### Si erreur PostgreSQL → Vérifier DATABASE_URL

1. Vérifier le secret GitHub `GCP_DATABASE_URL`
2. Vérifier le format Cloud SQL Unix socket
3. Vérifier les permissions Cloud SQL

**Voir** : `ANALYSE_LOGS_CLOUD_RUN_STARTUP.md` - Solution A

---

### Si erreur Migrations → Désactiver temporairement

**Fichier**: `.github/workflows/gcp-deploy.yml` (ligne 91)

```yaml
"ENABLE_AUTO_MIGRATIONS": "false",  # Désactiver temporairement
```

**Voir** : `ANALYSE_LOGS_CLOUD_RUN_STARTUP.md` - Solution B

---

### Si serveur ne démarre pas → Solution avancée

Si le serveur ne démarre jamais, il faudra peut-être :
1. Démarrer un serveur HTTP minimal AVANT les initialisations
2. Vérifier les permissions du conteneur
3. Vérifier que l'exécutable est correct

**Voir** : `SOLUTION_IMMEDIATE_STARTUP_PROBE.md` - Solution 3

---

## 📋 Checklist

- [ ] **Logs Cloud Run consultés** (PRIORITÉ 1)
- [ ] Dernière ligne de log identifiée
- [ ] Type d'erreur identifié
- [ ] Solution appropriée appliquée
- [ ] Nouveau déploiement testé

---

## 🎯 Prochaines Étapes

1. **IMMÉDIAT** : Consulter les logs Cloud Run (URL ci-dessus)
2. **Identifier** : La dernière ligne de log et le type d'erreur
3. **Appliquer** : La solution appropriée selon l'erreur
4. **Tester** : Nouveau déploiement

---

## 📚 Documentation Complète

- **Guide d'analyse des logs** : `ANALYSE_LOGS_CLOUD_RUN_STARTUP.md`
- **Solutions détaillées** : `SOLUTION_IMMEDIATE_STARTUP_PROBE.md`
- **Analyse complète** : `ANALYSE_PROBLEME_STARTUP_PROBE_CLOUD_RUN.md`

---

**💡 Important** : Les logs Cloud Run contiennent la réponse exacte. Consultez-les en priorité pour identifier la cause spécifique de l'échec avant d'appliquer des solutions.

