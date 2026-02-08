# Exécuter le Script SQL via ECS Exec

## ✅ Session Manager Plugin Installé

Le plugin a été installé avec succès. Vous pouvez maintenant utiliser ECS Exec.

## 🚀 Exécution du Script SQL

### Option 1 : Via Script Automatique (Recommandé)

Exécutez ce script PowerShell qui vous guidera :

```powershell
powershell -ExecutionPolicy Bypass -File backend/scripts/executer_sql_via_ecs_exec.ps1
```

### Option 2 : Manuellement

1. **Récupérer une tâche ECS en cours d'exécution :**

```powershell
$taskArn = aws ecs list-tasks `
    --cluster yukpomnang-cluster `
    --service-name yukpomnang-backend-service `
    --region us-east-1 `
    --desired-status RUNNING `
    --query 'taskArns[0]' `
    --output text
```

2. **Se connecter à la tâche :**

```powershell
aws ecs execute-command `
    --cluster yukpomnang-cluster `
    --task $taskArn `
    --container backend `
    --command "bash" `
    --interactive `
    --region us-east-1
```

3. **Dans le shell ECS, exécuter le script SQL :**

Le script SQL complet est dans `backend/migrations/20260207_fix_all_missing_tables_and_functions.sql`

Copiez-collez le contenu du fichier dans le shell ECS avec cette commande :

```bash
psql $DATABASE_URL << 'EOFSQL'
[coller ici le contenu complet du fichier backend/migrations/20260207_fix_all_missing_tables_and_functions.sql]
EOFSQL
```

**OU** si le fichier est déjà dans le conteneur :

```bash
psql $DATABASE_URL -f /app/backend/migrations/20260207_fix_all_missing_tables_and_functions.sql
```



