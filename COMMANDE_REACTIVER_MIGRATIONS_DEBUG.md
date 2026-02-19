# ✅ Réactiver les Migrations - Version avec Debug

## ✅ **Commande avec Affichage des Erreurs**

```powershell
python -c @"
import json
import subprocess
import sys
import os

# Récupérer la task definition
task_def_cmd = ['aws', 'ecs', 'describe-services', '--cluster', 'yukpo-cluster', '--services', 'yukpo-backend-service', '--region', 'eu-west-1', '--query', 'services[0].taskDefinition', '--output', 'text']
task_def = subprocess.run(task_def_cmd, capture_output=True, text=True, shell=True).stdout.strip()
print(f'Task Definition: {task_def}')

# Récupérer la définition complète
desc_cmd = ['aws', 'ecs', 'describe-task-definition', '--task-definition', task_def, '--region', 'eu-west-1', '--query', 'taskDefinition']
result = subprocess.run(desc_cmd, capture_output=True, text=True, shell=True)

if result.returncode != 0:
    print(f'❌ Erreur récupération: {result.stderr}')
    sys.exit(1)

try:
    task_def_json = json.loads(result.stdout)
except json.JSONDecodeError as e:
    print(f'❌ Erreur JSON: {e}')
    print(f'Réponse: {result.stdout[:200]}')
    sys.exit(1)

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

# Convertir le chemin Windows en format AWS CLI
json_path_aws = json_path.replace('\\', '/')
if json_path_aws[1] == ':':
    json_path_aws = '/' + json_path_aws[0].lower() + json_path_aws[2:]

register_cmd = ['aws', 'ecs', 'register-task-definition', '--cli-input-json', f'file://{json_path_aws}', '--region', 'eu-west-1', '--query', 'taskDefinition.taskDefinitionArn', '--output', 'text']
result_register = subprocess.run(register_cmd, capture_output=True, text=True, shell=True)

if result_register.returncode != 0:
    print(f'❌ Erreur enregistrement: {result_register.stderr}')
    print(f'Commande: {" ".join(register_cmd)}')
    sys.exit(1)

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
    print(f'Sortie: {result_register.stdout}')
    print(f'Erreur: {result_register.stderr}')
"@
```

---

## ✅ **Alternative : Utiliser le Chemin Absolu Windows**

Si le problème persiste, essayez avec le chemin absolu :

```powershell
python -c @"
import json
import subprocess
import os

task_def_cmd = ['aws', 'ecs', 'describe-services', '--cluster', 'yukpo-cluster', '--services', 'yukpo-backend-service', '--region', 'eu-west-1', '--query', 'services[0].taskDefinition', '--output', 'text']
task_def = subprocess.run(task_def_cmd, capture_output=True, text=True, shell=True).stdout.strip()

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
        break

if not found:
    env_vars.append({'name': 'ENABLE_AUTO_MIGRATIONS', 'value': 'true'})

for f in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'compatibilities', 'registeredAt', 'registeredBy']:
    task_def_json.pop(f, None)

json_path = os.path.join(os.environ['TEMP'], 'task-def-final.json')
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(task_def_json, f, indent=2)

# Utiliser le chemin absolu Windows
json_path_abs = os.path.abspath(json_path).replace('\\', '/')
if json_path_abs[1] == ':':
    json_path_abs = '/' + json_path_abs[0].lower() + json_path_abs[2:]

print(f'Chemin JSON: file://{json_path_abs}')

register_cmd = ['aws', 'ecs', 'register-task-definition', '--cli-input-json', f'file://{json_path_abs}', '--region', 'eu-west-1']
result_register = subprocess.run(register_cmd, capture_output=True, text=True, shell=True)

if result_register.returncode == 0:
    import re
    new_task_def = re.search(r'arn:aws:ecs:[^"]+', result_register.stdout)
    if new_task_def:
        new_task_def = new_task_def.group(0)
        print(f'✅ Nouvelle Task Definition: {new_task_def}')
        update_cmd = ['aws', 'ecs', 'update-service', '--cluster', 'yukpo-cluster', '--service', 'yukpo-backend-service', '--task-definition', new_task_def, '--region', 'eu-west-1', '--force-new-deployment']
        subprocess.run(update_cmd, shell=True)
        print('✅ Service mis à jour')
    else:
        print('❌ Impossible de trouver ARN dans la réponse')
        print(result_register.stdout)
else:
    print(f'❌ Erreur: {result_register.stderr}')
"@
```



