# ✅ Réactiver les Migrations Automatiques dans ECS

## ✅ **Commande Complète (Copier-Coller)**

```bash
# 1. Récupérer la task definition actuelle
TASK_DEF=$(aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].taskDefinition' --output text)

echo "📋 Task Definition actuelle: $TASK_DEF"

# 2. Récupérer et modifier avec Python
python3 << 'PYTHON'
import json
import subprocess
import sys

task_def = sys.argv[1]
result = subprocess.run(['aws', 'ecs', 'describe-task-definition', '--task-definition', task_def, '--region', 'eu-west-1', '--query', 'taskDefinition'], capture_output=True, text=True)
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
        print("✅ Variable ENABLE_AUTO_MIGRATIONS mise à jour à 'true'")
        break

if not found:
    env_vars.append({'name': 'ENABLE_AUTO_MIGRATIONS', 'value': 'true'})
    print("✅ Variable ENABLE_AUTO_MIGRATIONS ajoutée avec valeur 'true'")

for f in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'compatibilities', 'registeredAt', 'registeredBy']:
    task_def_json.pop(f, None)

with open('/tmp/task-def-final.json', 'w') as f:
    json.dump(task_def_json, f, indent=2)

print("✅ Task Definition modifiée")
PYTHON "$TASK_DEF"

# 3. Enregistrer la nouvelle task definition
NEW_TASK_DEF=$(aws ecs register-task-definition --cli-input-json file:///tmp/task-def-final.json --region eu-west-1 --query 'taskDefinition.taskDefinitionArn' --output text)

echo "✅ Nouvelle Task Definition: $NEW_TASK_DEF"

# 4. Mettre à jour le service
aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --task-definition "$NEW_TASK_DEF" --region eu-west-1 --force-new-deployment

echo "✅ Service mis à jour - Redémarrage en cours..."
echo "⏱️  Attendez 2-3 minutes puis vérifiez les logs"
```

---

## ✅ **Vérification après Redémarrage**

Après quelques minutes, vérifiez les logs CloudWatch :

```bash
aws logs tail /ecs/yukpo-backend --follow --region eu-west-1 | grep -i "migration"
```

**Résultat attendu** :
```
✅ Tables de base (users, services) vérifiées
🚀 Démarrage des migrations automatiques...
✅ Table existe déjà
✅ Colonne existe déjà
```

**Ne doit plus contenir** :
```
❌ ERREUR CRITIQUE
syntax error at end of input
```

---

## 📝 **Note**

Les migrations automatiques vont maintenant :
1. ✅ Vérifier l'existence des tables/colonnes/fonctions
2. ✅ Si elles existent déjà → passer sans erreur
3. ✅ Si elles n'existent pas → créer avec `IF NOT EXISTS`
4. ✅ Résultat : Aucune erreur, aucun doublon

