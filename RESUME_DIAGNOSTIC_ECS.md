# 📋 Résumé du Diagnostic ECS

## ✅ Vérifications Effectuées

### 1. Configuration du Health Check ✅

**Statut :** ✅ **CORRECT**

- **Command :** `CMD-SHELL curl -f http://localhost:8080/health || exit 1`
- **Interval :** 30 secondes
- **Timeout :** 10 secondes
- **Retries :** 3
- **Start Period :** 60 secondes
- **Port :** 8080 ✅

**Conclusion :** Le health check est correctement configuré et utilise le port 8080.

---

### 2. Configuration du Port ✅

**Statut :** ✅ **CORRECT**

- **Container Port :** 8080 ✅
- **Protocol :** tcp
- **Host Port :** 8080

**Conclusion :** Le port 8080 est correctement mappé.

---

### 3. Variables d'Environnement ✅

**Statut :** ✅ **CORRECT**

#### DATABASE_URL
- **Source :** AWS Secrets Manager (`yukpo/backend/secrets`)
- **Valeur :** `postgresql://yukpo_admin:...@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo`
- **Base de données :** ✅ `yukpo` (correct, pas `postgres`)

**Conclusion :** Le DATABASE_URL est correct et pointe vers la base `yukpo`.

#### Autres Variables
- `REDIS_URL` : Configuré depuis Secrets Manager
- `JWT_SECRET` : Configuré depuis Secrets Manager
- `ENABLE_AUTO_MIGRATIONS` : Configuré depuis Secrets Manager
- `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` : Configurés depuis SSM Parameter Store

---

### 4. Logs des Tâches Arrêtées ⚠️

**Statut :** ⚠️ **LOGS PRÉSENTS MAIS PROBLÈME D'ENCODAGE**

#### Dernière Tâche Arrêtée
- **Task ID :** `880366d06af046ba84d38b3c732a4030`
- **Stopped Reason :** `Task failed container health checks`
- **Exit Code :** `137` ⚠️

**Analyse du Code de Sortie 137 :**
- Le code 137 (128 + 9) indique que le processus a été tué par le signal SIGKILL (9)
- Causes possibles :
  1. **OOM (Out of Memory)** : Le conteneur a dépassé sa limite de mémoire
  2. **Timeout** : Le conteneur a été tué après un timeout
  3. **Health check failure** : Le health check a échoué trop de fois

#### Logs
- **Stream :** `backend/backend/880366d06af046ba84d38b3c732a4030`
- **Statut :** Des logs existent mais contiennent des caractères Unicode (emojis) qui causent des problèmes d'encodage lors de l'affichage
- **Solution :** Utiliser le script `get_logs_tache_arretee.ps1` qui sauvegarde les logs dans un fichier

---

## 🔍 Problèmes Identifiés

### 1. Health Check Grace Period ⚠️

**Problème :** Le health check grace period est à **0 secondes**

**Impact :** Le health check commence immédiatement au démarrage du conteneur, ce qui peut causer des échecs si l'application met du temps à démarrer.

**Recommandation :** Augmenter le grace period à **60-120 secondes** pour laisser le temps à l'application de démarrer complètement.

**Comment corriger :**
```bash
aws ecs update-service \
  --cluster yukpo-cluster \
  --service yukpo-backend-service \
  --health-check-grace-period-seconds 120 \
  --region eu-west-1
```

---

### 2. Code de Sortie 137 ⚠️

**Problème :** Les tâches se terminent avec le code 137 (SIGKILL)

**Causes possibles :**
1. **Manque de mémoire** : Le conteneur dépasse sa limite de mémoire
2. **Timeout du health check** : Le health check échoue et ECS tue le conteneur
3. **Application qui ne démarre pas** : L'application crash avant de répondre au health check

**Actions recommandées :**
1. Vérifier la limite de mémoire de la task definition
2. Augmenter le health check grace period (voir ci-dessus)
3. Examiner les logs pour identifier l'erreur exacte

---

## 📝 Recommandations

### Actions Immédiates

1. **Augmenter le Health Check Grace Period**
   ```powershell
   aws ecs update-service `
     --cluster yukpo-cluster `
     --service yukpo-backend-service `
     --health-check-grace-period-seconds 120 `
     --region eu-west-1
   ```

2. **Vérifier les Logs Complets**
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/get_logs_tache_arretee.ps1
   ```
   Les logs seront sauvegardés dans un fichier pour éviter les problèmes d'encodage.

3. **Vérifier la Limite de Mémoire**
   ```powershell
   aws ecs describe-task-definition `
     --task-definition yukpo-backend `
     --region eu-west-1 `
     --query 'taskDefinition.containerDefinitions[0].memory'
   ```

### Actions à Long Terme

1. **Améliorer les Logs**
   - S'assurer que l'application logue correctement les erreurs
   - Configurer des niveaux de log appropriés (RUST_LOG)

2. **Monitoring**
   - Configurer CloudWatch Alarms pour les health check failures
   - Surveiller l'utilisation de la mémoire

3. **Tests**
   - Tester le démarrage de l'application localement
   - Vérifier que le health check endpoint `/health` fonctionne

---

## 🛠️ Scripts Disponibles

1. **`diagnostic_ecs_complet.ps1`** : Diagnostic complet de la configuration ECS
2. **`get_logs_tache_arretee.ps1`** : Récupération des logs d'une tâche arrêtée
3. **`check_ecs_health.ps1`** : Vérification de l'état de santé du service
4. **`get_ecs_logs_final.ps1`** : Récupération des logs depuis CloudWatch
5. **`get_ecs_logs_insights.ps1`** : Récupération via CloudWatch Logs Insights

---

## ✅ Points Positifs

1. ✅ Health check correctement configuré
2. ✅ Port 8080 correctement mappé
3. ✅ DATABASE_URL correct (pointe vers `yukpo`)
4. ✅ Permissions de la base de données configurées
5. ✅ Configuration de logging correcte

---

## ❌ Points à Améliorer

1. ⚠️ Health check grace period à 0 (devrait être 60-120 secondes)
2. ⚠️ Code de sortie 137 (nécessite investigation)
3. ⚠️ Logs avec problèmes d'encodage (résolu avec les scripts de sauvegarde)

---

## 🎯 Prochaine Étape

**Action prioritaire :** Augmenter le health check grace period et redémarrer le service, puis examiner les logs complets pour identifier la cause exacte du code 137.

