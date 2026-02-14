# 🔧 Commande Simple pour Désactiver les Migrations Auto dans ECS

## ✅ **Commande Complète (Copier-Coller)**

```bash
# Récupérer la task definition actuelle
TASK_DEF=$(aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].taskDefinition' --output text)

# Récupérer et modifier avec Python
python3 << 'PYTHON'
import json
import subprocess

# Récupérer
result = subprocess.run(['aws', 'ecs', 'describe-task-definition', '--task-definition', '$TASK_DEF', '--region', 'eu-west-1', '--query', 'taskDefinition'], capture_output=True, text=True)
task_def = json.loads(result.stdout)

# Ajouter/modifier ENABLE_AUTO_MIGRATIONS
if 'environment' not in task_def['containerDefinitions'][0]:
    task_def['containerDefinitions'][0]['environment'] = []

env_vars = task_def['containerDefinitions'][0]['environment']
found = False
for env in env_vars:
    if env.get('name') == 'ENABLE_AUTO_MIGRATIONS':
        env['value'] = 'false'
        found = True
        break
if not found:
    env_vars.append({'name': 'ENABLE_AUTO_MIGRATIONS', 'value': 'false'})

# Nettoyer
for f in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'compatibilities', 'registeredAt', 'registeredBy']:
    task_def.pop(f, None)

# Sauvegarder
with open('/tmp/task-def.json', 'w') as f:
    json.dump(task_def, f, indent=2)
print("✅ Modifié")
PYTHON

# Enregistrer et mettre à jour
NEW_TASK_DEF=$(aws ecs register-task-definition --cli-input-json file:///tmp/task-def.json --region eu-west-1 --query 'taskDefinition.taskDefinitionArn' --output text)
aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --task-definition "$NEW_TASK_DEF" --region eu-west-1 --force-new-deployment

echo "✅ ENABLE_AUTO_MIGRATIONS=false ajouté - Service redémarre..."
```

---

## ✅ **Version avec Script (Recommandé)**

```bash
# Rendre exécutable
chmod +x scripts/desactiver_migrations_auto_ecs.sh

# Exécuter
./scripts/desactiver_migrations_auto_ecs.sh
```

---

## 🔍 **Vérification**

Après quelques minutes, vérifier dans les logs CloudWatch :

```bash
aws logs tail /ecs/yukpo-backend --follow --region eu-west-1 | grep -i "migration"
```

Vous devriez voir :
```
⏭️ Migrations automatiques désactivées (ENABLE_AUTO_MIGRATIONS=false)
```

Et ne plus voir :
```
🚀 Démarrage des migrations automatiques...
```

