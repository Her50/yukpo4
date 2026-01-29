# 🔍 Vérification des Tables via Backend AWS

## 🎯 Méthodes de Vérification

### Méthode 1: Via l'endpoint du backend (si accessible)

L'URL du backend AWS ALB est :
```
https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com
```

**Test de connexion :**
```powershell
# Test health check
Invoke-WebRequest -Uri "https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/health"

# Si un endpoint de debug existe
Invoke-WebRequest -Uri "https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/debug/tables"
```

### Méthode 2: Via AWS CLI - Exécuter une commande dans le conteneur ECS

Si le service ECS est en cours d'exécution, vous pouvez exécuter une commande directement dans le conteneur :

```powershell
# 1. Obtenir l'ARN d'une tâche en cours
$taskArn = aws ecs list-tasks --cluster yukpomnang-cluster --service-name yukpomnang-backend-service --region us-east-1 --desired-status RUNNING --query 'taskArns[0]' --output text

# 2. Exécuter une commande SQL dans le conteneur
aws ecs execute-command `
    --cluster yukpomnang-cluster `
    --task $taskArn `
    --container backend `
    --command "psql $env:DATABASE_URL -c \"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;\"" `
    --interactive `
    --region us-east-1
```

### Méthode 3: Via AWS Systems Manager Session Manager

Si Session Manager est configuré :

```powershell
# Se connecter au conteneur ECS
aws ecs execute-command `
    --cluster yukpomnang-cluster `
    --task <TASK_ARN> `
    --container backend `
    --command "/bin/bash" `
    --interactive `
    --region us-east-1
```

Puis dans le conteneur :
```bash
psql $DATABASE_URL -f /app/backend/scripts/check_migration_status.sql
```

### Méthode 4: Via CloudWatch Logs

Vérifier les logs de démarrage pour voir les messages de migration :

```powershell
# Voir les logs récents
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1

# Filtrer les messages de migration
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1 | Select-String "MIGRATION|table|Table"
```

### Méthode 5: Vérification directe de la base de données RDS

Si vous avez accès à la base de données RDS directement :

```powershell
# Obtenir l'endpoint RDS
$rdsEndpoint = aws rds describe-db-instances --region us-east-1 --query 'DBInstances[?contains(DBInstanceIdentifier, `yukpomnang`)].Endpoint.Address' --output text

# Se connecter (nécessite psql et les credentials)
psql -h $rdsEndpoint -U <username> -d yukpomnang -f backend/scripts/check_migration_status.sql
```

## 📋 Commandes AWS CLI Utiles

### Vérifier l'état du service ECS
```powershell
aws ecs describe-services `
    --cluster yukpomnang-cluster `
    --services yukpomnang-backend-service `
    --region us-east-1 `
    --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}'
```

### Lister les tâches en cours
```powershell
aws ecs list-tasks `
    --cluster yukpomnang-cluster `
    --service-name yukpomnang-backend-service `
    --desired-status RUNNING `
    --region us-east-1
```

### Voir les événements récents du service
```powershell
aws ecs describe-services `
    --cluster yukpomnang-cluster `
    --services yukpomnang-backend-service `
    --region us-east-1 `
    --query 'services[0].events[0:10]'
```

### Voir les logs CloudWatch
```powershell
aws logs tail /ecs/yukpomnang-backend --follow --region us-east-1
```

## 🔍 Ce qu'il faut vérifier

1. **Service ECS actif** : Au moins 1 tâche en cours d'exécution
2. **Health check ALB** : Le backend répond aux health checks
3. **Tables dans la base** : Toutes les tables critiques existent
4. **Migrations appliquées** : La table `_sqlx_migrations` contient les migrations

## ✅ Résultat Attendu

Si tout est OK, vous devriez voir :
- ✅ Service ECS avec tâches RUNNING
- ✅ ALB accessible et health checks OK
- ✅ Toutes les tables critiques avec statut "✅ EXISTE"
- ✅ Migrations appliquées avec `success = true`

## 🚨 Si le backend n'est pas accessible

1. **Vérifier l'état ECS** : Le service peut être arrêté ou en erreur
2. **Vérifier les logs CloudWatch** : Identifier les erreurs de démarrage
3. **Vérifier les Security Groups** : L'ALB doit pouvoir communiquer avec ECS
4. **Vérifier les Target Groups** : Les health checks doivent passer

## 💡 Alternative : Vérification via la Console AWS

1. Allez dans **ECS Console** → **Clusters** → `yukpomnang-cluster`
2. Cliquez sur **Services** → `yukpomnang-backend-service`
3. Vérifiez le nombre de tâches en cours
4. Cliquez sur une tâche pour voir les logs CloudWatch
5. Recherchez les messages de migration dans les logs

