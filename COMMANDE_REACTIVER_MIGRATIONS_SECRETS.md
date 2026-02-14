# ✅ Réactiver les Migrations - Modifier dans Secrets

## ✅ **Commande Corrigée (Modifie dans Secrets au lieu d'Environment)**

Le problème est que `ENABLE_AUTO_MIGRATIONS` existe dans `secrets`, pas dans `environment`. Il faut modifier la valeur dans Secrets Manager :

```powershell
# Option 1 : Modifier directement dans Secrets Manager
aws secretsmanager update-secret `
    --secret-id "yukpo/backend/secrets" `
    --region eu-west-1 `
    --secret-string '{"ENABLE_AUTO_MIGRATIONS":"true"}' `
    --merge-secret-string

# Puis redémarrer le service
aws ecs update-service `
    --cluster yukpo-cluster `
    --service yukpo-backend-service `
    --region eu-west-1 `
    --force-new-deployment

Write-Host "✅ Secret mis à jour et service redémarré"
```

---

## ✅ **Option 2 : Récupérer, Modifier, puis Mettre à Jour le Secret**

Si vous voulez préserver les autres secrets :

```powershell
# Récupérer le secret actuel
$secret = aws secretsmanager get-secret-value --secret-id "yukpo/backend/secrets" --region eu-west-1 --query 'SecretString' --output text

# Convertir en JSON, modifier, puis mettre à jour
python -c @"
import json
import subprocess

# Récupérer le secret
result = subprocess.run(['aws', 'secretsmanager', 'get-secret-value', '--secret-id', 'yukpo/backend/secrets', '--region', 'eu-west-1', '--query', 'SecretString', '--output', 'text'], capture_output=True, text=True, shell=True)
secret_json = json.loads(result.stdout)

# Modifier ENABLE_AUTO_MIGRATIONS
secret_json['ENABLE_AUTO_MIGRATIONS'] = 'true'

# Mettre à jour
import tempfile
import os
json_path = os.path.join(os.environ['TEMP'], 'secret-updated.json')
with open(json_path, 'w') as f:
    json.dump(secret_json, f)

subprocess.run(['aws', 'secretsmanager', 'update-secret', '--secret-id', 'yukpo/backend/secrets', '--region', 'eu-west-1', '--secret-string', f'file://{json_path}'], shell=True)
print('✅ Secret mis à jour')
"@

# Redémarrer le service
aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --region eu-west-1 --force-new-deployment

Write-Host "✅ Service redémarré"
```

---

## ✅ **Option 3 : Modifier la Task Definition pour Retirer des Secrets**

Si vous préférez mettre la variable dans `environment` au lieu de `secrets` :

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

# Retirer ENABLE_AUTO_MIGRATIONS des secrets
if 'secrets' in container:
    container['secrets'] = [s for s in container['secrets'] if s.get('name') != 'ENABLE_AUTO_MIGRATIONS']

# Ajouter dans environment
if 'environment' not in container:
    container['environment'] = []

container['environment'].append({'name': 'ENABLE_AUTO_MIGRATIONS', 'value': 'true'})
print('✅ Variable déplacée de secrets vers environment')

for f in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'compatibilities', 'registeredAt', 'registeredBy']:
    task_def_json.pop(f, None)

json_path = os.path.join(os.environ['TEMP'], 'task-def-final.json')
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(task_def_json, f, indent=2)

json_path_aws = 'file://' + json_path.replace('\\', '/')
register_cmd = ['aws', 'ecs', 'register-task-definition', '--cli-input-json', json_path_aws, '--region', 'eu-west-1', '--query', 'taskDefinition.taskDefinitionArn', '--output', 'text']
result_register = subprocess.run(register_cmd, capture_output=True, text=True, shell=True)

if result_register.returncode == 0:
    new_task_def = result_register.stdout.strip()
    print(f'✅ Nouvelle Task Definition: {new_task_def}')
    update_cmd = ['aws', 'ecs', 'update-service', '--cluster', 'yukpo-cluster', '--service', 'yukpo-backend-service', '--task-definition', new_task_def, '--region', 'eu-west-1', '--force-new-deployment']
    subprocess.run(update_cmd, shell=True)
    print('✅ Service mis à jour')
else:
    print(f'❌ Erreur: {result_register.stderr}')
"@
```

