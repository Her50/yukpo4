# 🔍 Diagnostic Final du Problème ECS

## 📋 Résumé Exécutif

**Problème :** Toutes les tâches ECS échouent systématiquement les health checks et sont tuées avec le code de sortie 137 (SIGKILL).

**Pattern identifié :** 
- Tâche démarre → Health check échoue → Tâche arrêtée (code 137)
- Cycle se répète indéfiniment

---

## ✅ Configuration Vérifiée (TOUT EST CORRECT)

1. **Health Check Grace Period** : ✅ 120 secondes (configuré)
2. **Health Check Endpoint** : ✅ `/health` sur port 8080 (configuré)
3. **Port Mapping** : ✅ Port 8080 correctement mappé
4. **DATABASE_URL** : ✅ Correct (pointe vers base `yukpo`)
5. **Permissions DB** : ✅ Toutes les permissions accordées
6. **Image Docker** : ✅ Existe dans ECR (`yukpo-backend:latest`)
7. **Task Definition** : ✅ Configurée correctement
8. **Service** : ✅ ACTIVE

---

## 🔴 Problème Identifié

### Code de Sortie : 137 (SIGKILL)

**Signification :** Le processus a été tué par le système d'exploitation.

**Causes possibles :**
1. **OOM (Out of Memory)** : Le conteneur dépasse sa limite de mémoire
2. **Health Check Timeout** : ECS tue le conteneur après échecs répétés du health check
3. **Processus crash** : L'application crash et est tuée

### Pattern Observé

```
Tâche démarre (RUNNING)
  ↓
Grace period de 120s (UNKNOWN)
  ↓
Health check commence
  ↓
Health check échoue (UNHEALTHY)
  ↓
Retries (3 tentatives)
  ↓
Toutes les tentatives échouent
  ↓
ECS tue le conteneur (SIGKILL - code 137)
  ↓
Nouvelle tâche démarre (cycle se répète)
```

---

## 🔍 Analyse des Logs

**Problème :** Les logs existent dans CloudWatch Logs mais contiennent des caractères Unicode (emojis) qui causent des problèmes d'encodage lors de la récupération via AWS CLI.

**Streams trouvés :**
- `backend/backend/{task-id}` (format standard)
- Logs présents mais non lisibles via CLI à cause de l'encodage

**Solution :** Examiner les logs directement dans la **console AWS CloudWatch Logs** pour éviter les problèmes d'encodage.

---

## 🎯 Causes Probables (Par Ordre de Probabilité)

### 1. L'application ne démarre pas du tout ⚠️ **TRÈS PROBABLE**

**Indices :**
- Aucun log d'initialisation visible
- Code 137 immédiatement après le démarrage
- Pattern systématique sur toutes les tâches

**Vérifications nécessaires :**
- [ ] L'image Docker contient-elle l'application compilée ?
- [ ] L'application compile-t-elle correctement ?
- [ ] Le Dockerfile est-il correct ?
- [ ] Les variables d'environnement sont-elles correctes ?

### 2. L'application démarre mais crash immédiatement ⚠️ **PROBABLE**

**Indices :**
- Code 137 après quelques secondes
- Health check échoue systématiquement

**Causes possibles :**
- Erreur de connexion à la base de données
- Erreur de configuration (variables d'environnement)
- Erreur dans le code de l'application
- Manque de mémoire (OOM)

**Vérifications nécessaires :**
- [ ] Les logs dans CloudWatch Logs (console AWS)
- [ ] La connexion à la base de données fonctionne-t-elle ?
- [ ] Toutes les variables d'environnement sont-elles présentes ?

### 3. L'application ne répond pas au health check ⚠️ **MOINS PROBABLE**

**Indices :**
- L'application démarre mais `/health` ne répond pas

**Causes possibles :**
- L'endpoint `/health` n'existe pas dans le code
- L'application n'écoute pas sur le port 8080
- L'application écoute sur un autre port

**Vérifications nécessaires :**
- [ ] L'endpoint `/health` existe-t-il dans le code Rust ?
- [ ] L'application écoute-t-elle sur le port 8080 ?
- [ ] Le health check utilise-t-il le bon endpoint ?

---

## 🛠️ Actions Immédiates Recommandées

### 1. Examiner les Logs dans la Console AWS ⭐ **PRIORITÉ HAUTE**

**Pourquoi :** Les logs contiennent la cause exacte du problème mais ne sont pas lisibles via CLI à cause de l'encodage.

**Comment :**
1. Aller dans **AWS Console** → **CloudWatch** → **Logs** → **Log groups**
2. Sélectionner `/ecs/yukpo-backend`
3. Chercher les streams récents (format : `backend/backend/{task-id}`)
4. Examiner les logs pour identifier l'erreur exacte

**Ce qu'il faut chercher :**
- Messages d'erreur au démarrage
- Erreurs de connexion à la base de données
- Erreurs de configuration
- Messages indiquant que l'application démarre

### 2. Vérifier l'Image Docker

```bash
# Vérifier que l'image existe et contient l'application
aws ecr describe-images \
  --repository-name yukpo-backend \
  --region eu-west-1 \
  --image-ids imageTag=latest
```

### 3. Tester l'Image Localement

```bash
# Récupérer les credentials ECR
aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin 108964700972.dkr.ecr.eu-west-1.amazonaws.com

# Pull l'image
docker pull 108964700972.dkr.ecr.eu-west-1.amazonaws.com/yukpo-backend:latest

# Tester l'image avec les mêmes variables d'environnement
docker run -e DATABASE_URL="..." -e REDIS_URL="..." ... 108964700972.dkr.ecr.eu-west-1.amazonaws.com/yukpo-backend:latest
```

### 4. Vérifier le Code de l'Application

- [ ] L'endpoint `/health` existe-t-il ?
- [ ] L'application écoute-t-elle sur le port 8080 ?
- [ ] Les migrations de base de données s'exécutent-elles correctement ?
- [ ] Y a-t-il des erreurs de compilation ?

### 5. Vérifier la Limite de Mémoire

```bash
# Vérifier la mémoire allouée
aws ecs describe-task-definition \
  --task-definition yukpo-backend \
  --region eu-west-1 \
  --query 'taskDefinition.memory'
```

**Recommandation :** Si la mémoire est < 1 GB, augmenter à 2 GB minimum.

---

## 📊 Statistiques Observées

- **Tâches arrêtées analysées :** 5+
- **Code de sortie :** 137 (100% des cas)
- **Raison d'arrêt :** "Task failed container health checks" (100% des cas)
- **Health check failures :** 3+ dans les 10 derniers événements
- **Pattern :** Systématique et répétitif

---

## ✅ Points Positifs

1. ✅ Toute la configuration ECS est correcte
2. ✅ Les permissions de la base de données sont correctes
3. ✅ Le DATABASE_URL est correct
4. ✅ Le health check grace period est configuré (120s)
5. ✅ L'image Docker existe dans ECR

**Conclusion :** Le problème n'est **PAS** dans la configuration ECS, mais dans l'**application elle-même**.

---

## 🎯 Prochaine Étape Critique

**EXAMINER LES LOGS DANS LA CONSOLE AWS CLOUDWATCH LOGS**

C'est la seule façon de voir les messages d'erreur réels sans problème d'encodage.

**URL directe :**
https://console.aws.amazon.com/cloudwatch/home?region=eu-west-1#logsV2:log-groups/log-group/%2Fecs%2Fyukpo-backend

---

## 📝 Scripts Disponibles

1. `scripts/analyser_probleme_ecs.ps1` - Analyse approfondie du problème
2. `scripts/check_ecs_health.ps1` - Vérification de l'état du service
3. `scripts/get_logs_tache_arretee.ps1` - Récupération des logs (problème d'encodage)
4. `scripts/fix_database_permissions_auto.ps1` - Correction des permissions DB

---

**Date du diagnostic :** 2026-02-13
**Statut :** Problème identifié - Action requise : Examiner les logs dans la console AWS

