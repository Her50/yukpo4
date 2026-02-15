# 🔧 Désactiver les Migrations Automatiques dans ECS - Commande Finale

## ✅ **Méthode 1 : Mettre à Jour le Secret dans Secrets Manager (Recommandé)**

D'après votre configuration Terraform, `ENABLE_AUTO_MIGRATIONS` est stocké dans Secrets Manager.

```bash
# Mettre à jour la valeur dans Secrets Manager
aws secretsmanager update-secret \
  --secret-id "yukpo/backend/secrets" \
  --secret-string '{"ENABLE_AUTO_MIGRATIONS":"false"}' \
  --region eu-west-1

# OU si le secret contient d'autres valeurs, récupérer, modifier, puis mettre à jour
SECRET_VALUE=$(aws secretsmanager get-secret-value \
  --secret-id "yukpo/backend/secrets" \
  --region eu-west-1 \
  --query 'SecretString' \
  --output text)

# Modifier avec jq
echo "$SECRET_VALUE" | jq '.ENABLE_AUTO_MIGRATIONS = "false"' > /tmp/secret-updated.json

# Mettre à jour
aws secretsmanager update-secret \
  --secret-id "yukpo/backend/secrets" \
  --secret-string file:///tmp/secret-updated.json \
  --region eu-west-1

# Redémarrer le service pour prendre en compte le changement
aws ecs update-service \
  --cluster yukpo-cluster \
  --service yukpo-backend-service \
  --region eu-west-1 \
  --force-new-deployment

echo "✅ ENABLE_AUTO_MIGRATIONS=false mis à jour dans Secrets Manager"
echo "🔄 Service redémarre..."
```

---

## ✅ **Méthode 2 : Ajouter comme Variable d'Environnement Directe (Plus Simple)**

Si vous préférez ne pas modifier Secrets Manager :

```bash
# 1. Récupérer la task definition
TASK_DEF=$(aws ecs describe-services \
  --cluster yukpo-cluster \
  --services yukpo-backend-service \
  --region eu-west-1 \
  --query 'services[0].taskDefinition' \
  --output text)

# 2. Récupérer la définition complète
aws ecs describe-task-definition \
  --task-definition "$TASK_DEF" \
  --region eu-west-1 \
  --query 'taskDefinition' > /tmp/task-def.json

# 3. Modifier avec Python
python3 << 'PYTHON'
import json

with open('/tmp/task-def.json', 'r') as f:
    task_def = json.load(f)

container = task_def['containerDefinitions'][0]

# Ajouter dans environment (pas secrets)
if 'environment' not in container:
    container['environment'] = []

# Vérifier si existe déjà
found = False
for env in container['environment']:
    if env.get('name') == 'ENABLE_AUTO_MIGRATIONS':
        env['value'] = 'false'
        found = True
        break

if not found:
    container['environment'].append({
        'name': 'ENABLE_AUTO_MIGRATIONS',
        'value': 'false'
    })

# Nettoyer
for f in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'compatibilities', 'registeredAt', 'registeredBy']:
    task_def.pop(f, None)

with open('/tmp/task-def-final.json', 'w') as f:
    json.dump(task_def, f, indent=2)

print("✅ Modifié")
PYTHON

# 4. Enregistrer et mettre à jour
NEW_TASK_DEF=$(aws ecs register-task-definition \
  --cli-input-json file:///tmp/task-def-final.json \
  --region eu-west-1 \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

aws ecs update-service \
  --cluster yukpo-cluster \
  --service yukpo-backend-service \
  --task-definition "$NEW_TASK_DEF" \
  --region eu-west-1 \
  --force-new-deployment

echo "✅ ENABLE_AUTO_MIGRATIONS=false ajouté"
echo "🔄 Service redémarre..."
```

---

## ✅ **Méthode 3 : Script Automatique**

```bash
# Rendre exécutable
chmod +x scripts/desactiver_migrations_auto_ecs.sh

# Exécuter
./scripts/desactiver_migrations_auto_ecs.sh
```

---

## 🔍 **Vérification**

Après quelques minutes, vérifier dans les logs :

```bash
aws logs tail /ecs/yukpo-backend --follow --region eu-west-1 | grep -i "migration"
```

**Résultat attendu** :
```
⏭️ Migrations automatiques désactivées (ENABLE_AUTO_MIGRATIONS=false)
```

**Ne doit plus contenir** :
```
🚀 Démarrage des migrations automatiques...
execute_migration_sql_safe
syntax error at end of input
```

---

## 📝 **Note**

- Le service va **redémarrer automatiquement** avec la nouvelle configuration
- Les migrations **SQLx standard** continueront de s'exécuter (elles fonctionnent)
- Seules les **migrations automatiques** seront désactivées


