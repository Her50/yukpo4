# 🔧 Désactiver les Migrations Automatiques dans ECS - AWS CLI

## ✅ **Commande Complète (Copier-Coller)**

```bash
# 1. Récupérer la task definition actuelle
TASK_DEF=$(aws ecs describe-services \
  --cluster yukpo-cluster \
  --services yukpo-backend-service \
  --region eu-west-1 \
  --query 'services[0].taskDefinition' \
  --output text)

echo "📋 Task Definition actuelle: $TASK_DEF"

# 2. Récupérer la définition complète
aws ecs describe-task-definition \
  --task-definition "$TASK_DEF" \
  --region eu-west-1 \
  --query 'taskDefinition' > /tmp/task-def.json

echo "✅ Task Definition récupérée"

# 3. Ajouter ENABLE_AUTO_MIGRATIONS=false dans les variables d'environnement
# Utiliser jq pour modifier le JSON
jq '.containerDefinitions[0].environment += [{"name": "ENABLE_AUTO_MIGRATIONS", "value": "false"}]' /tmp/task-def.json > /tmp/task-def-updated.json

# 4. Supprimer les champs non modifiables
jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)' /tmp/task-def-updated.json > /tmp/task-def-final.json

# 5. Enregistrer la nouvelle task definition
NEW_TASK_DEF=$(aws ecs register-task-definition \
  --cli-input-json file:///tmp/task-def-final.json \
  --region eu-west-1 \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo "✅ Nouvelle Task Definition créée: $NEW_TASK_DEF"

# 6. Mettre à jour le service ECS
aws ecs update-service \
  --cluster yukpo-cluster \
  --service yukpo-backend-service \
  --task-definition "$NEW_TASK_DEF" \
  --region eu-west-1 \
  --force-new-deployment

echo "✅ Service ECS mis à jour avec ENABLE_AUTO_MIGRATIONS=false"
echo "🔄 Le service va redémarrer avec la nouvelle configuration"
```

---

## ✅ **Version Simplifiée (Sans jq)**

Si `jq` n'est pas installé, utiliser cette version :

```bash
# 1. Récupérer la task definition actuelle
TASK_DEF=$(aws ecs describe-services \
  --cluster yukpo-cluster \
  --services yukpo-backend-service \
  --region eu-west-1 \
  --query 'services[0].taskDefinition' \
  --output text)

# 2. Récupérer et modifier avec Python
python3 << 'PYTHON_SCRIPT'
import json
import subprocess
import sys

# Récupérer la task definition
task_def = sys.argv[1]
result = subprocess.run(
    ['aws', 'ecs', 'describe-task-definition', '--task-definition', task_def, '--region', 'eu-west-1', '--query', 'taskDefinition'],
    capture_output=True,
    text=True
)

task_def_json = json.loads(result.stdout)

# Ajouter ENABLE_AUTO_MIGRATIONS=false
if 'environment' not in task_def_json['containerDefinitions'][0]:
    task_def_json['containerDefinitions'][0]['environment'] = []

# Vérifier si la variable existe déjà
env_vars = task_def_json['containerDefinitions'][0]['environment']
env_names = [e.get('name') for e in env_vars if 'name' in e]

if 'ENABLE_AUTO_MIGRATIONS' not in env_names:
    env_vars.append({'name': 'ENABLE_AUTO_MIGRATIONS', 'value': 'false'})
else:
    # Mettre à jour si existe déjà
    for env in env_vars:
        if env.get('name') == 'ENABLE_AUTO_MIGRATIONS':
            env['value'] = 'false'

# Supprimer les champs non modifiables
for field in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'compatibilities', 'registeredAt', 'registeredBy']:
    task_def_json.pop(field, None)

# Sauvegarder
with open('/tmp/task-def-final.json', 'w') as f:
    json.dump(task_def_json, f, indent=2)

print("✅ Task Definition modifiée et sauvegardée")
PYTHON_SCRIPT "$TASK_DEF"

# 3. Enregistrer la nouvelle task definition
NEW_TASK_DEF=$(aws ecs register-task-definition \
  --cli-input-json file:///tmp/task-def-final.json \
  --region eu-west-1 \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo "✅ Nouvelle Task Definition: $NEW_TASK_DEF"

# 4. Mettre à jour le service
aws ecs update-service \
  --cluster yukpo-cluster \
  --service yukpo-backend-service \
  --task-definition "$NEW_TASK_DEF" \
  --region eu-west-1 \
  --force-new-deployment

echo "✅ Service mis à jour - Redémarrage en cours..."
```

---

## ✅ **Version Terraform (Si vous utilisez Terraform)**

Modifier `infra/aws/main.tf` :

```hcl
# Dans la section container_definitions, ajouter :
environment = [
  # ... autres variables existantes ...
  {
    name  = "ENABLE_AUTO_MIGRATIONS"
    value = "false"
  }
]
```

Puis appliquer :
```bash
cd infra/aws
terraform plan
terraform apply
```

---

## 🔍 **Vérification**

Après la mise à jour, vérifier dans les logs CloudWatch :

```bash
# Les logs doivent contenir :
# "⏭️ Migrations automatiques désactivées (ENABLE_AUTO_MIGRATIONS=false)"

# Et ne doivent PAS contenir :
# "🚀 Démarrage des migrations automatiques..."
# "execute_migration_sql_safe"
```

---

## 📝 **Note**

- Le service ECS va **redémarrer automatiquement** avec la nouvelle configuration
- Les migrations **SQLx standard** continueront de s'exécuter (elles fonctionnent correctement)
- Seules les **migrations automatiques** (`run_auto_migrations()`) seront désactivées



