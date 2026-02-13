# 🔍 Diagnostic : Tâches ECS qui Redémarrent

## ⚠️ Problème Observé

Le service ECS redémarre continuellement les tâches :
- ✅ Service : `ACTIVE`
- ⚠️ Tâches : Démarrées puis arrêtées (ExitCode: 1)
- 🔄 Pattern : Redémarrage automatique toutes les ~1 minute

## 🔍 Causes Possibles

### 1. **Erreur de Configuration**
- Variables d'environnement manquantes
- Secrets Manager non accessible
- SSM Parameters non accessibles

### 2. **Erreur d'Application**
- Backend Rust qui crash au démarrage
- Erreur de connexion à la base de données
- Erreur de connexion à Redis

### 3. **Erreur de Health Check**
- Health check qui échoue
- Port 8080 non accessible
- Endpoint `/health` non disponible

### 4. **Erreur de Permissions**
- IAM Role sans permissions suffisantes
- Secrets Manager non accessible
- SSM Parameters non accessibles

## 🔧 Actions de Diagnostic

### 1. Vérifier les Logs

```powershell
# Récupérer les logs de la dernière tâche
aws logs get-log-events `
  --log-group-name /ecs/yukpo-backend `
  --log-stream-name backend/backend/<TASK_ID> `
  --region eu-west-1 `
  --limit 50
```

### 2. Vérifier les Variables d'Environnement

```powershell
# Vérifier que les secrets existent
aws secretsmanager get-secret-value `
  --secret-id yukpo/backend/secrets `
  --region eu-west-1

# Vérifier les SSM Parameters
aws ssm get-parameters-by-path `
  --path /yukpo/production `
  --region eu-west-1
```

### 3. Vérifier les Permissions IAM

```powershell
# Vérifier le rôle d'exécution
aws iam get-role --role-name yukpo-ecs-execution-role

# Vérifier les politiques attachées
aws iam list-role-policies --role-name yukpo-ecs-execution-role
aws iam list-attached-role-policies --role-name yukpo-ecs-execution-role
```

### 4. Vérifier la Configuration de la Task Definition

```powershell
# Vérifier la Task Definition
aws ecs describe-task-definition `
  --task-definition yukpo-backend:2 `
  --region eu-west-1
```

## 🎯 Solutions Probables

### Solution 1 : Vérifier les Secrets Manager

Les secrets doivent être dans le format JSON avec les clés :
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `ENABLE_AUTO_MIGRATIONS`

### Solution 2 : Vérifier les SSM Parameters

Les paramètres SSM doivent exister :
- `/yukpo/production/S3_BUCKET`
- `/yukpo/production/S3_REGION`
- `/yukpo/production/S3_ACCESS_KEY`
- `/yukpo/production/S3_SECRET_KEY`
- `/yukpo/production/UPLOAD_BASE_URL`
- `/yukpo/production/LAUNCH_PHASE_START_DATE`

### Solution 3 : Vérifier les Health Checks

Le health check doit être accessible :
- Endpoint : `http://localhost:8080/health`
- Timeout : 10 secondes
- Interval : 30 secondes
- Retries : 3

### Solution 4 : Désactiver Temporairement le Health Check

Si le health check est le problème, on peut le désactiver temporairement dans la Task Definition.

## 📋 Prochaines Étapes

1. ✅ Récupérer les logs de la tâche en cours
2. ✅ Identifier l'erreur exacte
3. ✅ Corriger la configuration
4. ✅ Redéployer

**Les logs sont la clé pour identifier le problème !**

