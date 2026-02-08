# Installer Session Manager Plugin et Exécuter le Script SQL

## Problème Identifié

Les tâches ECS one-shot échouent car elles tentent de récupérer les secrets SSM au démarrage, même si nous ne les utilisons pas. La seule solution qui fonctionne est d'utiliser ECS Exec pour exécuter le script SQL directement dans une tâche ECS en cours d'exécution.

## Solution : Installer Session Manager Plugin

### Étape 1 : Installer le Plugin (Windows)

```powershell
# Option 1 : Via winget
winget install Amazon.SessionManagerPlugin

# Option 2 : Télécharger manuellement
# https://s3.amazonaws.com/session-manager-downloads/plugin/latest/windows/SessionManagerPluginSetup.exe
```

### Étape 2 : Vérifier l'Installation

```powershell
session-manager-plugin
```

### Étape 3 : Exécuter le Script SQL via ECS Exec

Une fois le plugin installé, exécutez ce script PowerShell :

```powershell
# Récupérer une tâche ECS en cours d'exécution
$taskArn = aws ecs list-tasks `
    --cluster yukpomnang-cluster `
    --service-name yukpomnang-backend-service `
    --region us-east-1 `
    --desired-status RUNNING `
    --query 'taskArns[0]' `
    --output text

# Se connecter à la tâche
aws ecs execute-command `
    --cluster yukpomnang-cluster `
    --task $taskArn `
    --container backend `
    --command "psql \$DATABASE_URL -f /app/backend/migrations/20260207_fix_all_missing_tables_and_functions.sql" `
    --interactive `
    --region us-east-1
```

## Alternative : Exécuter le Script SQL Directement

Si le script SQL n'est pas dans le conteneur, vous pouvez l'exécuter directement via ECS Exec :

```powershell
aws ecs execute-command `
    --cluster yukpomnang-cluster `
    --task $taskArn `
    --container backend `
    --command "bash" `
    --interactive `
    --region us-east-1
```

Puis dans le shell ECS, exécutez :

```bash
# Le script SQL complet (copier-coller depuis backend/migrations/20260207_fix_all_missing_tables_and_functions.sql)
psql $DATABASE_URL << 'EOFSQL'
[contenu du script SQL]
EOFSQL
```



