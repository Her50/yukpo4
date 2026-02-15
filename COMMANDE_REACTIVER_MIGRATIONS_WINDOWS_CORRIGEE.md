# ✅ Réactiver les Migrations Automatiques - Windows PowerShell (Corrigé)

## ✅ **Commande Corrigée (PowerShell)**

```powershell
# 1. Récupérer la task definition actuelle
$TASK_DEF = aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].taskDefinition' --output text

Write-Host "📋 Task Definition actuelle: $TASK_DEF"

# 2. Récupérer la définition complète
aws ecs describe-task-definition --task-definition $TASK_DEF --region eu-west-1 --query 'taskDefinition' | Out-File -FilePath "$env:TEMP\task-def.json" -Encoding utf8

# 3. Modifier avec PowerShell
$taskDef = Get-Content "$env:TEMP\task-def.json" | ConvertFrom-Json

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
    $newEnv = New-Object PSObject
    $newEnv | Add-Member -MemberType NoteProperty -Name "name" -Value "ENABLE_AUTO_MIGRATIONS"
    $newEnv | Add-Member -MemberType NoteProperty -Name "value" -Value "true"
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

# Sauvegarder en JSON valide
$jsonContent = $taskDef | ConvertTo-Json -Depth 10 -Compress
$jsonContent | Out-File -FilePath "$env:TEMP\task-def-final.json" -Encoding utf8 -NoNewline

Write-Host "✅ Task Definition modifiée"

# 4. Enregistrer la nouvelle task definition (utiliser le chemin Windows)
$jsonPath = "$env:TEMP\task-def-final.json"
$NEW_TASK_DEF = aws ecs register-task-definition --cli-input-json "file://$jsonPath" --region eu-west-1 --query 'taskDefinition.taskDefinitionArn' --output text

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Nouvelle Task Definition: $NEW_TASK_DEF"
    
    # 5. Mettre à jour le service
    aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --task-definition $NEW_TASK_DEF --region eu-west-1 --force-new-deployment
    
    Write-Host "✅ Service mis à jour - Redémarrage en cours..."
    Write-Host "⏱️  Attendez 2-3 minutes puis vérifiez les logs"
} else {
    Write-Host "❌ Erreur lors de l'enregistrement de la task definition"
    Write-Host "Vérifiez le contenu du fichier JSON:"
    Get-Content "$env:TEMP\task-def-final.json" | Select-Object -First 20
}
```

---

## ✅ **Alternative : Utiliser Python (Plus Fiable)**

Si PowerShell continue à avoir des problèmes, utilisez Python :

```powershell
python -c @"
import json
import subprocess
import sys
import os

# Récupérer la task definition
task_def_cmd = ['aws', 'ecs', 'describe-services', '--cluster', 'yukpo-cluster', '--services', 'yukpo-backend-service', '--region', 'eu-west-1', '--query', 'services[0].taskDefinition', '--output', 'text']
task_def = subprocess.run(task_def_cmd, capture_output=True, text=True, shell=True).stdout.strip()

# Récupérer la définition complète
desc_cmd = ['aws', 'ecs', 'describe-task-definition', '--task-definition', task_def, '--region', 'eu-west-1', '--query', 'taskDefinition']
result = subprocess.run(desc_cmd, capture_output=True, text=True, shell=True)
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
        print('✅ Variable ENABLE_AUTO_MIGRATIONS mise à jour à true')
        break

if not found:
    env_vars.append({'name': 'ENABLE_AUTO_MIGRATIONS', 'value': 'true'})
    print('✅ Variable ENABLE_AUTO_MIGRATIONS ajoutée avec valeur true')

for f in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'compatibilities', 'registeredAt', 'registeredBy']:
    task_def_json.pop(f, None)

json_path = os.path.join(os.environ['TEMP'], 'task-def-final.json')
with open(json_path, 'w') as f:
    json.dump(task_def_json, f, indent=2)

register_cmd = ['aws', 'ecs', 'register-task-definition', '--cli-input-json', f'file://{json_path}', '--region', 'eu-west-1', '--query', 'taskDefinition.taskDefinitionArn', '--output', 'text']
new_task_def = subprocess.run(register_cmd, capture_output=True, text=True, shell=True).stdout.strip()

if new_task_def:
    print(f'✅ Nouvelle Task Definition: {new_task_def}')
    update_cmd = ['aws', 'ecs', 'update-service', '--cluster', 'yukpo-cluster', '--service', 'yukpo-backend-service', '--task-definition', new_task_def, '--region', 'eu-west-1', '--force-new-deployment']
    subprocess.run(update_cmd, shell=True)
    print('✅ Service mis à jour - Redémarrage en cours...')
else:
    print('❌ Erreur lors de l enregistrement')
"@
```


