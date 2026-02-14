# Vérification Manuelle des Logs

**Date**: 2026-02-13  
**Statut**: Extension uuid-ossp installée, service redémarré

---

## ✅ ACTIONS EFFECTUÉES

1. ✅ Extension `uuid-ossp` installée avec succès (version 1.1)
2. ✅ Service ECS redémarré avec `force-new-deployment`
3. ✅ 2 tâches en cours d'exécution (déploiement en cours)

---

## 🔍 VÉRIFICATION MANUELLE DES LOGS

### Option 1: Via AWS Console (RECOMMANDÉ)

1. **Ouvrir AWS Console** → **CloudWatch** → **Log groups**
2. **Sélectionner** `/ecs/yukpo-backend`
3. **Rechercher** les log streams récents (commençant par `backend/backend/`)
4. **Ouvrir** le log stream le plus récent (ex: `backend/backend/27064e0aaf4f466e8f25ab275bbfb175`)
5. **Rechercher** dans les logs: `[MAIN]`

**Logs attendus**:
```
[MAIN] 🚀 Application Rust démarre - Point d'entrée atteint
[MAIN] 🔍 Vérification des variables d'environnement critiques...
[MAIN] DATABASE_URL: ✅ Présente
[MAIN] MONGODB_URL: ✅ Présente
[MAIN] REDIS_URL: ✅ Présente
[MAIN] JWT_SECRET: ✅ Présente
[MAIN] 🔧 Initialisation dotenv...
[MAIN] 🔧 Initialisation du logging...
[MAIN] ✅ Logging initialisé
[MAIN] 🔍 Récupération de DATABASE_URL...
[MAIN] ✅ DATABASE_URL récupérée (longueur: XXX)
[MAIN] 🔌 Début de la connexion à PostgreSQL...
[MAIN] ✅ Connexion PostgreSQL établie (tentative 1/3)
[MAIN] ✅ Pool PostgreSQL créé avec succès
[MAIN] 🔌 Début de la connexion à MongoDB...
[MAIN] ✅ Client MongoDB créé avec succès
[MAIN] 🔌 Début du bind sur 0.0.0.0:8080...
[MAIN] ✅ Bind réussi, démarrage du serveur HTTP...
[MAIN] 🚀 Serveur HTTP démarre sur http://0.0.0.0:8080
```

---

### Option 2: Via AWS CLI (avec gestion d'encodage)

```bash
# Définir l'encodage UTF-8
$env:PYTHONIOENCODING = "utf-8"
$env:LANG = "en_US.UTF-8"

# Récupérer les logs de la nouvelle tâche
$taskId = "27064e0aaf4f466e8f25ab275bbfb175"
$streamName = "backend/backend/$taskId"

# Utiliser aws logs tail (meilleure gestion d'encodage)
aws logs tail "/ecs/yukpo-backend" `
  --log-stream-names $streamName `
  --region eu-west-1 `
  --since 10m `
  --format short `
  --filter-pattern "[MAIN]"
```

---

### Option 3: Via AWS CLI avec fichier temporaire

```powershell
# Récupérer les logs et sauvegarder dans un fichier
$taskId = "27064e0aaf4f466e8f25ab275bbfb175"
$streamName = "backend/backend/$taskId"

aws logs get-log-events `
  --log-group-name "/ecs/yukpo-backend" `
  --log-stream-name $streamName `
  --region eu-west-1 `
  --limit 100 `
  --output json > logs-temp.json

# Ouvrir le fichier avec un éditeur qui gère UTF-8 (VS Code, Notepad++)
# Rechercher "[MAIN]" dans le fichier
```

---

## 📊 ÉTAT ACTUEL DU SERVICE

**Dernière vérification**:
- **Desired Count**: 1
- **Running Count**: 2 (déploiement en cours)
- **Pending Count**: 0

**Tâches récentes**:
- `27064e0aaf4f466e8f25ab275bbfb175` - NOUVELLE (devrait avoir uuid-ossp)
- `fd88f2cef790434bbfe66bcb75b140b9` - Ancienne

---

## ✅ RÉSULTAT ATTENDU

### Si les logs [MAIN] apparaissent:
✅ **SUCCÈS** - L'application démarre correctement
- Les migrations s'exécutent sans erreur
- Le serveur HTTP démarre
- Les health checks devraient passer

### Si les logs [MAIN] n'apparaissent pas:
❌ **PROBLÈME PERSISTANT**
- L'application crash toujours avant `main()`
- Causes possibles:
  - L'image Docker n'a pas été mise à jour
  - Autre problème (dépendances système, etc.)

---

## 🔍 VÉRIFICATIONS SUPPLÉMENTAIRES

### Vérifier l'Image Docker Utilisée

```bash
aws ecs describe-tasks \
  --cluster yukpo-cluster \
  --tasks arn:aws:ecs:eu-west-1:108964700972:task/yukpo-cluster/27064e0aaf4f466e8f25ab275bbfb175 \
  --region eu-west-1 \
  --query 'tasks[0].containers[0].image'
```

**Résultat attendu**: Image récente avec le tag `latest` ou `master-fd55331`

### Vérifier les Health Checks

```bash
aws ecs describe-tasks \
  --cluster yukpo-cluster \
  --tasks arn:aws:ecs:eu-west-1:108964700972:task/yukpo-cluster/27064e0aaf4f466e8f25ab275bbfb175 \
  --region eu-west-1 \
  --query 'tasks[0].containers[0].healthStatus'
```

**Résultat attendu**: `HEALTHY` ou `UNKNOWN` (en cours de vérification)

---

## 📝 NOTES

- Les problèmes d'encodage avec PowerShell sont dus aux emojis dans les logs
- Utiliser AWS Console CloudWatch pour une meilleure visualisation
- Attendre 2-3 minutes après le redémarrage pour que les logs apparaissent

---

## ✅ CHECKLIST

- [x] Extension uuid-ossp installée
- [x] Service ECS redémarré
- [ ] Vérifier les logs [MAIN] via AWS Console
- [ ] Confirmer que l'application démarre
- [ ] Vérifier les health checks
- [ ] Tester les endpoints API

---

**Prochaine action**: Vérifier les logs via AWS Console CloudWatch pour confirmer le démarrage.

