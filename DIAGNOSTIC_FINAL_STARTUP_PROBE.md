# 🔍 Diagnostic Final - Startup Probe Cloud Run

**Date**: 2026-02-16  
**Statut**: ❌ Problème persiste malgré multiples tentatives

---

## 📊 Solutions Tentées

### 1. ✅ Configuration Startup Probe
- Ajout de `--startup-probe` avec timeout 330s
- Retiré (comme commit a7ef4db qui fonctionnait)

### 2. ✅ Serveur Minimal Rust
- Démarrage AVANT dotenv/logging
- Réponse HTTP 200 explicite
- Délai d'attente augmenté à 1000ms
- Test health check ajouté

### 3. ✅ Serveur Minimal Shell (socat/netcat)
- Script shell avec socat
- Script shell avec netcat
- **Résultat**: Non testé (remplacé par Python)

### 4. ✅ Serveur Minimal Python
- Script Python avec http.server
- Démarrage en arrière-plan avant Rust
- **Résultat**: Problème persiste

### 5. ✅ Simplification Script Shell
- Retrait du serveur Python
- Lancement direct de Rust
- **Résultat**: Problème persiste

---

## 🎯 Problème Identifié

**Erreur constante** :
```
ERROR: (gcloud.run.deploy) The user-provided container failed the configured startup probe checks.
```

**Hypothèses** :
1. Le conteneur ne démarre même pas (erreur avant l'exécution du code)
2. Le serveur minimal ne répond pas assez vite
3. Cloud Run a un startup probe par défaut très strict
4. Il y a une erreur qui empêche le serveur minimal de démarrer

---

## 🔍 Actions Requises (PRIORITÉ 1)

### 1. Consulter les Logs Cloud Run

**URL des logs** (depuis la dernière erreur) :
```
https://console.cloud.google.com/logs/viewer?project=***&resource=cloud_run_revision/service_name/yukpo-backend/revision_name=yukpo-backend-00075-fqx
```

**Rechercher** :
- `[MAIN] 🚀 Application Rust démarre` → Le conteneur démarre-t-il ?
- `[MAIN] 🔍 CLOUD_RUN détecté: true` → La variable est-elle définie ?
- `[MAIN] ✅ Serveur HTTP minimal bind réussi` → Le serveur minimal démarre-t-il ?
- `[HEALTH] ✅ Requête /health reçue` → Le serveur répond-il aux health checks ?
- Erreurs de compilation Rust
- Erreurs de permissions
- Erreurs de connexion réseau

**Action** : Partager les 50 dernières lignes de logs avant l'échec

---

### 2. Vérifier les Variables d'Environnement

**Dans le workflow** `.github/workflows/gcp-deploy.yml` :
- ✅ `CLOUD_RUN=true` est défini
- ✅ `PORT` n'est PAS défini (réservé par Cloud Run)
- ✅ `--port 8080` est utilisé dans gcloud run deploy

**Vérifier dans Cloud Console** :
- Aller dans Cloud Run → yukpo-backend → Variables d'environnement
- Vérifier que `CLOUD_RUN=true` est présent
- Vérifier que `PORT` n'est PAS défini manuellement

---

### 3. Tester Localement

**Commande** :
```bash
docker build -f backend/Dockerfile.cloud.optimized -t yukpo-test .
docker run -e CLOUD_RUN=true -e DATABASE_URL="..." -e PORT=8080 -p 8080:8080 yukpo-test
```

**Tester** :
```bash
curl http://localhost:8080/health
# Devrait retourner: OK
```

**Vérifier les logs** :
- Le serveur minimal démarre-t-il ?
- Répond-il aux requêtes ?

---

## 💡 Solutions Alternatives à Tester

### Option A: Désactiver Complètement le Startup Probe

**Modification** `.github/workflows/gcp-deploy.yml` :
```yaml
--startup-probe=timeoutSeconds=1,periodSeconds=1,initialDelaySeconds=0,failureThreshold=999999,httpGet.port=8080,httpGet.path=/health
```

**Résultat** : Startup probe très permissif (ne devrait jamais échouer)

---

### Option B: Utiliser un Script d'Entrée Différent

**Créer** `backend/scripts/entrypoint-cloud-run.sh` :
```bash
#!/bin/bash
# Démarrer le serveur minimal Python en premier plan
python3 /app/health-server-python.py &
HEALTH_PID=$!
sleep 2

# Démarrer Rust en arrière-plan
/app/yukpomnang_backend &
RUST_PID=$!

# Attendre que Rust démarre
sleep 5

# Tuer le serveur Python (Rust prend le relais)
kill $HEALTH_PID

# Attendre Rust
wait $RUST_PID
```

---

### Option C: Retirer Toutes les Optimisations

**Revenir à la configuration de base** :
- Pas de serveur minimal
- Pas de startup probe
- Laisser Cloud Run utiliser ses valeurs par défaut
- Attendre que Rust démarre complètement

---

## 📋 Checklist de Diagnostic

- [ ] Logs Cloud Run consultés
- [ ] Variables d'environnement vérifiées
- [ ] Test local effectué
- [ ] Serveur minimal démarre-t-il ? (d'après les logs)
- [ ] Serveur minimal répond-il ? (d'après les logs)
- [ ] Y a-t-il des erreurs avant le démarrage du serveur minimal ?

---

## 🚨 Prochaines Étapes

1. **CONSULTER LES LOGS CLOUD RUN** (priorité absolue)
2. Partager les logs pour analyse
3. Tester localement si possible
4. Appliquer la solution appropriée selon les logs

---

**Le problème ne peut être résolu sans consulter les logs Cloud Run pour identifier la cause exacte.**
