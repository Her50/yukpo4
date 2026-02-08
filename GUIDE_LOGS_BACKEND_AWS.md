# 🔍 Guide : Consulter les Logs du Backend AWS

## 📍 Où sont les logs ?

Les logs du backend sont dans **AWS CloudWatch Logs** :
- **Log Group** : `/ecs/yukpomnang-backend`
- **Région** : `us-east-1` (ou votre région AWS configurée)

## 🎯 Méthode 1 : Via AWS Console (Le plus simple)

### Étape 1 : Accéder à CloudWatch Logs

1. Connectez-vous à [AWS Console](https://console.aws.amazon.com)
2. Allez dans **CloudWatch** → **Logs** → **Log groups**
3. Recherchez le log group : `/ecs/yukpomnang-backend`

### Étape 2 : Voir les logs en temps réel

1. Cliquez sur le log group `/ecs/yukpomnang-backend`
2. Vous verrez les **log streams** (un par conteneur/tâche ECS)
3. Cliquez sur le stream le plus récent (celui avec la date/heure la plus récente)
4. Les logs s'affichent en temps réel avec auto-refresh

### Étape 3 : Filtrer les logs

Dans la barre de recherche des logs, utilisez ces filtres :

**Voir les erreurs :**
```
ERROR
```

**Voir les requêtes HTTP :**
```
GET POST PUT DELETE
```

**Voir les logs d'une route spécifique :**
```
/api/users
```

**Voir les logs de connexion :**
```
Redis Database
```

## 🎯 Méthode 2 : Via AWS CLI (En ligne de commande)

### Prérequis

```powershell
# Vérifier que AWS CLI est installé
aws --version

# Vérifier que vous êtes connecté
aws sts get-caller-identity
```

### Voir les logs récents (dernière heure)

```powershell
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1
```

### Voir les logs en temps réel (streaming)

```powershell
aws logs tail /ecs/yukpomnang-backend --follow --region us-east-1
```

### Filtrer les logs

```powershell
# Voir uniquement les erreurs
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1 --filter-pattern "ERROR"

# Voir les logs de Redis
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1 --filter-pattern "Redis"

# Voir les requêtes HTTP
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1 --filter-pattern "GET POST PUT DELETE"
```

### Voir les logs d'une période spécifique

```powershell
# Dernières 30 minutes
aws logs tail /ecs/yukpomnang-backend --since 30m --region us-east-1

# Dernières 24 heures
aws logs tail /ecs/yukpomnang-backend --since 24h --region us-east-1

# Depuis une date/heure spécifique
aws logs tail /ecs/yukpomnang-backend --since "2024-01-15T10:00:00" --region us-east-1
```

### Lister les log streams disponibles

```powershell
aws logs describe-log-streams `
    --log-group-name /ecs/yukpomnang-backend `
    --order-by LastEventTime `
    --descending `
    --max-items 5 `
    --region us-east-1
```

### Voir les logs d'un stream spécifique

```powershell
# Remplacer STREAM_NAME par le nom du stream
aws logs get-log-events `
    --log-group-name /ecs/yukpomnang-backend `
    --log-stream-name "ecs/yukpomnang-backend/STREAM_NAME" `
    --limit 100 `
    --region us-east-1
```

## 🎯 Méthode 3 : Utiliser les scripts existants

### Script PowerShell pour logs récents

```powershell
# Utiliser le script existant
.\scripts\get-recent-logs.ps1 -Limit 100
```

### Script pour logs ECS complets

```powershell
# Utiliser le script existant
.\scripts\get-ecs-logs.ps1 -Limit 50
```

### Script pour logs de création de compte

```powershell
# Utiliser le script existant
.\backend\scripts\view_register_logs.ps1 -Minutes 30
```

## 🎯 Méthode 4 : Via AWS CLI avec PowerShell (Filtrage avancé)

### Voir les erreurs avec contexte

```powershell
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1 | 
    Select-String -Pattern "ERROR|❌|panic|failed" -Context 2,2
```

### Exporter les logs dans un fichier

```powershell
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1 > logs_backend_$(Get-Date -Format "yyyyMMdd_HHmmss").txt
```

### Compter les erreurs

```powershell
$logs = aws logs tail /ecs/yukpomnang-backend --since 24h --region us-east-1
($logs | Select-String -Pattern "ERROR").Count
```

## 🔧 Dépannage

### Problème : "Log group not found"

```powershell
# Lister tous les log groups disponibles
aws logs describe-log-groups --region us-east-1 --query "logGroups[?contains(logGroupName, 'yukpomnang') || contains(logGroupName, 'backend') || contains(logGroupName, 'ecs')].logGroupName" --output table
```

### Problème : "Access Denied"

Vérifiez vos permissions AWS :
```powershell
# Vérifier votre identité
aws sts get-caller-identity

# Vérifier vos permissions
aws iam get-user
```

### Problème : Région incorrecte

```powershell
# Vérifier la région configurée
aws configure get region

# Changer la région si nécessaire
aws configure set region us-east-1
```

### Problème : Aucun log stream

Si aucun log stream n'apparaît, vérifiez que le service ECS est actif :

```powershell
# Vérifier le statut du service ECS
aws ecs describe-services `
    --cluster yukpomnang-cluster `
    --services yukpomnang-backend-service `
    --region us-east-1 `
    --query "services[0].{Status:status,Running:runningCount,Desired:desiredCount}"
```

## 📊 Commandes utiles rapides

```powershell
# Logs en temps réel (le plus utilisé)
aws logs tail /ecs/yukpomnang-backend --follow --region us-east-1

# Dernières erreurs
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1 --filter-pattern "ERROR"

# Logs des 30 dernières minutes
aws logs tail /ecs/yukpomnang-backend --since 30m --region us-east-1

# Exporter les logs
aws logs tail /ecs/yukpomnang-backend --since 24h --region us-east-1 > logs.txt
```

## 🎨 Astuces

1. **Utilisez `--follow` pour le streaming en temps réel** (comme `tail -f`)
2. **Utilisez `--filter-pattern` pour filtrer** (plus rapide que grep)
3. **Utilisez `--since` avec des unités** : `1h`, `30m`, `24h`, `7d`
4. **Dans AWS Console**, utilisez la recherche pour filtrer rapidement
5. **Exportez les logs** si vous avez besoin de les analyser plus tard

## 📝 Notes

- Les logs sont conservés selon la rétention configurée (généralement 7-30 jours)
- Chaque tâche ECS crée son propre log stream
- Les logs peuvent avoir un léger délai (quelques secondes)
- Les logs sont facturés selon le volume (généralement ~$0.50/GB)



