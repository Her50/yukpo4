# ✅ Réactiver les Migrations Automatiques - Windows PowerShell

## ✅ **Commande Complète (PowerShell)**

Exécutez cette commande depuis **Windows PowerShell** (pas depuis EC2) :

```powershell
# 1. Récupérer la task definition actuelle
$TASK_DEF = aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].taskDefinition' --output text

Write-Host "📋 Task Definition actuelle: $TASK_DEF"

# 2. Récupérer la définition complète
aws ecs describe-task-definition --task-definition $TASK_DEF --region eu-west-1 --query 'taskDefinition' | Out-File -FilePath $env:TEMP\task-def.json -Encoding utf8

# 3. Modifier avec PowerShell
$taskDef = Get-Content $env:TEMP\task-def.json | ConvertFrom-Json

# S'assurer que environment existe
if (-not $taskDef.containerDefinitions[0].environment) {
    $taskDef.containerDefinitions[0].environment = @()
}

# Vérifier si ENABLE_AUTO_MIGRATIONS existe
$found = $false
foreach ($env in $taskDef.containerDefinitions[0].environment) {
    if ($env.name -eq "ENABLE_AUTO_MIGRATIONS") {
        $env.value = "true"
        $found = $true
        Write-Host "✅ Variable ENABLE_AUTO_MIGRATIONS mise à jour à 'true'"
        break
    }
}

if (-not $found) {
    $newEnv = @{
        name = "ENABLE_AUTO_MIGRATIONS"
        value = "true"
    }
    $taskDef.containerDefinitions[0].environment += $newEnv
    Write-Host "✅ Variable ENABLE_AUTO_MIGRATIONS ajoutée avec valeur 'true'"
}

# Supprimer les champs non modifiables
$taskDef.PSObject.Properties.Remove('taskDefinitionArn')
$taskDef.PSObject.Properties.Remove('revision')
$taskDef.PSObject.Properties.Remove('status')
$taskDef.PSObject.Properties.Remove('requiresAttributes')
$taskDef.PSObject.Properties.Remove('compatibilities')
$taskDef.PSObject.Properties.Remove('registeredAt')
$taskDef.PSObject.Properties.Remove('registeredBy')

# Sauvegarder
$taskDef | ConvertTo-Json -Depth 10 | Out-File -FilePath $env:TEMP\task-def-final.json -Encoding utf8

Write-Host "✅ Task Definition modifiée"

# 4. Enregistrer la nouvelle task definition
$NEW_TASK_DEF = aws ecs register-task-definition --cli-input-json file://$env:TEMP\task-def-final.json --region eu-west-1 --query 'taskDefinition.taskDefinitionArn' --output text

Write-Host "✅ Nouvelle Task Definition: $NEW_TASK_DEF"

# 5. Mettre à jour le service
aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --task-definition $NEW_TASK_DEF --region eu-west-1 --force-new-deployment

Write-Host "✅ Service mis à jour - Redémarrage en cours..."
Write-Host "⏱️  Attendez 2-3 minutes puis vérifiez les logs"
```

---

## ✅ **Alternative : Version Simplifiée avec Python**

Si PowerShell ne fonctionne pas bien, utilisez Python :

```powershell
# Installer Python si nécessaire, puis :
python -c @"
import json
import subprocess
import sys
import os

# Récupérer la task definition
task_def = subprocess.run(['aws', 'ecs', 'describe-services', '--cluster', 'yukpo-cluster', '--services', 'yukpo-backend-service', '--region', 'eu-west-1', '--query', 'services[0].taskDefinition'], capture_output=True, text=True, shell=True).stdout.strip()

result = subprocess.run(['aws', 'ecs', 'describe-task-definition', '--task-definition', task_def, '--region', 'eu-west-1', '--query', 'taskDefinition'], capture_output=True, text=True, shell=True)
task_def_json = json.loads(result.stdout)

container = task_def_json['containerDefinitions'][0]
if 'environment' not in container:
    container['environment'] = []

env_vars = container['environment']
found = False
for env in env_vars:
    if env.get('name') == 'ENABLE_AUTO_MIGRATIONS':
        env['value'] = 'true'
        found = True
        break

if not found:
    env_vars.append({'name': 'ENABLE_AUTO_MIGRATIONS', 'value': 'true'})

for f in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'compatibilities', 'registeredAt', 'registeredBy']:
    task_def_json.pop(f, None)

with open(os.path.join(os.environ['TEMP'], 'task-def-final.json'), 'w') as f:
    json.dump(task_def_json, f, indent=2)

new_task_def = subprocess.run(['aws', 'ecs', 'register-task-definition', '--cli-input-json', f'file://{os.path.join(os.environ[\"TEMP\"], \"task-def-final.json\")}', '--region', 'eu-west-1', '--query', 'taskDefinition.taskDefinitionArn'], capture_output=True, text=True, shell=True).stdout.strip()

subprocess.run(['aws', 'ecs', 'update-service', '--cluster', 'yukpo-cluster', '--service', 'yukpo-backend-service', '--task-definition', new_task_def, '--region', 'eu-west-1', '--force-new-deployment'], shell=True)

print('✅ Service mis à jour')
"@
```

---

## ✅ **Vérification**

Après quelques minutes :

```powershell
aws logs tail /ecs/yukpo-backend --follow --region eu-west-1 | Select-String -Pattern "migration"
```



