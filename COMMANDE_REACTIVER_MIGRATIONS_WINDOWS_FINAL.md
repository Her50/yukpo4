# ✅ Réactiver les Migrations - Version Finale Windows

## ✅ **Commande Corrigée (Utilise le Chemin Windows Direct)**

```powershell
python -c @"
import json
import subprocess
import os

task_def_cmd = ['aws', 'ecs', 'describe-services', '--cluster', 'yukpo-cluster', '--services', 'yukpo-backend-service', '--region', 'eu-west-1', '--query', 'services[0].taskDefinition', '--output', 'text']
task_def = subprocess.run(task_def_cmd, capture_output=True, text=True, shell=True).stdout.strip()
print(f'Task Definition: {task_def}')

desc_cmd = ['aws', 'ecs', 'describe-task-definition', '--task-definition', task_def, '--region', 'eu-west-1', '--query', 'taskDefinition']
result = subprocess.run(desc_cmd, capture_output=True, text=True, shell=True)

if result.returncode != 0:
    print(f'❌ Erreur récupération: {result.stderr}')
    exit(1)

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
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(task_def_json, f, indent=2)

print(f'✅ JSON sauvegardé dans: {json_path}')

# Utiliser le chemin Windows directement avec file://
json_path_aws = json_path.replace('\\', '/')
json_path_aws = 'file://' + json_path_aws

print(f'Chemin AWS: {json_path_aws}')

register_cmd = ['aws', 'ecs', 'register-task-definition', '--cli-input-json', json_path_aws, '--region', 'eu-west-1', '--query', 'taskDefinition.taskDefinitionArn', '--output', 'text']
result_register = subprocess.run(register_cmd, capture_output=True, text=True, shell=True)

if result_register.returncode != 0:
    print(f'❌ Erreur enregistrement: {result_register.stderr}')
    print(f'Sortie: {result_register.stdout}')
    exit(1)

new_task_def = result_register.stdout.strip()

if new_task_def:
    print(f'✅ Nouvelle Task Definition: {new_task_def}')
    update_cmd = ['aws', 'ecs', 'update-service', '--cluster', 'yukpo-cluster', '--service', 'yukpo-backend-service', '--task-definition', new_task_def, '--region', 'eu-west-1', '--force-new-deployment']
    result_update = subprocess.run(update_cmd, capture_output=True, text=True, shell=True)
    
    if result_update.returncode == 0:
        print('✅ Service mis à jour - Redémarrage en cours...')
    else:
        print(f'❌ Erreur mise à jour: {result_update.stderr}')
else:
    print('❌ Erreur: Nouvelle task definition vide')
"@
```



