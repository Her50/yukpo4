# Déploiement ECS : Activation ENABLE_AUTO_MIGRATIONS + S3 CDN

## ✅ Modifications Terraform effectuées

Les fichiers Terraform ont été mis à jour dans `infra/aws/main.tf` :
- ✅ Ajout de `ENABLE_AUTO_MIGRATIONS` dans les secrets de la task definition
- ✅ Ajout des paramètres S3 (`S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `UPLOAD_BASE_URL`) depuis SSM Parameter Store
- ✅ Ajout des permissions SSM dans la policy IAM pour ECS execution role

## 🚀 Déploiement immédiat (sans Terraform)

### Option 1 : Via AWS Console

1. **Aller dans ECS → Task Definitions → `yukpomnang-backend`**
2. **Créer une nouvelle révision**
3. **Dans la section "Container definitions" → "backend" → "Environment variables" → "Secrets"**
4. **Ajouter les secrets suivants** :

| Name | Value From (ARN) |
|------|------------------|
| `ENABLE_AUTO_MIGRATIONS` | `arn:aws:ssm:us-east-1:846505724644:parameter/yukpomnang/production/ENABLE_AUTO_MIGRATIONS` |
| `S3_BUCKET` | `arn:aws:ssm:us-east-1:846505724644:parameter/yukpomnang/production/S3_BUCKET` |
| `S3_REGION` | `arn:aws:ssm:us-east-1:846505724644:parameter/yukpomnang/production/S3_REGION` |
| `UPLOAD_BASE_URL` | `arn:aws:ssm:us-east-1:846505724644:parameter/yukpomnang/production/UPLOAD_BASE_URL` |

**Note** : `S3_ACCESS_KEY` et `S3_SECRET_KEY` existent déjà dans la task definition actuelle.

5. **Créer la nouvelle révision**
6. **Mettre à jour le service ECS** :
   - Aller dans ECS → Clusters → `yukpomnang-cluster` → Services → `yukpomnang-backend-service`
   - Cliquer sur "Update"
   - Sélectionner la nouvelle révision de task definition
   - Cocher "Force new deployment"
   - Cliquer sur "Update"

### Option 2 : Via AWS CLI (PowerShell)

```powershell
# 1. Exporter la task definition actuelle
aws ecs describe-task-definition `
    --task-definition yukpomnang-backend `
    --region us-east-1 `
    --query 'taskDefinition' `
    --output json > task-def.json

# 2. Modifier le fichier task-def.json manuellement pour ajouter ces secrets dans containerDefinitions[0].secrets :
# (Ouvrir task-def.json dans un éditeur JSON et ajouter ces entrées)

# 3. Supprimer les champs suivants du JSON :
# - taskDefinitionArn
# - revision
# - status
# - requiresAttributes
# - compatibilities
# - registeredAt
# - registeredBy

# 4. Enregistrer la nouvelle task definition
aws ecs register-task-definition `
    --cli-input-json file://task-def.json `
    --region us-east-1

# 5. Noter la nouvelle révision (ex: 3) et mettre à jour le service
aws ecs update-service `
    --cluster yukpomnang-cluster `
    --service yukpomnang-backend-service `
    --task-definition yukpomnang-backend:3 `
    --region us-east-1 `
    --force-new-deployment
```

### Option 3 : Script Python (si Python disponible)

```python
import json
import subprocess
import sys

REGION = "us-east-1"
PROJECT_NAME = "yukpomnang"
ENVIRONMENT = "production"
TASK_FAMILY = f"{PROJECT_NAME}-backend"
CLUSTER_NAME = f"{PROJECT_NAME}-cluster"
SERVICE_NAME = f"{PROJECT_NAME}-backend-service"

# Récupérer l'account ID
account_id = subprocess.check_output(
    ["aws", "sts", "get-caller-identity", "--region", REGION, "--query", "Account", "--output", "text"]
).decode().strip()

# Exporter la task definition
result = subprocess.run(
    ["aws", "ecs", "describe-task-definition", "--task-definition", TASK_FAMILY, "--region", REGION, "--query", "taskDefinition", "--output", "json"],
    capture_output=True, text=True
)

task_def = json.loads(result.stdout)

# Ajouter les secrets manquants
secrets = task_def["containerDefinitions"][0]["secrets"]
existing_names = {s["name"] for s in secrets}

secrets_to_add = [
    ("ENABLE_AUTO_MIGRATIONS", f"arn:aws:ssm:{REGION}:{account_id}:parameter/{PROJECT_NAME}/{ENVIRONMENT}/ENABLE_AUTO_MIGRATIONS"),
    ("S3_BUCKET", f"arn:aws:ssm:{REGION}:{account_id}:parameter/{PROJECT_NAME}/{ENVIRONMENT}/S3_BUCKET"),
    ("S3_REGION", f"arn:aws:ssm:{REGION}:{account_id}:parameter/{PROJECT_NAME}/{ENVIRONMENT}/S3_REGION"),
    ("UPLOAD_BASE_URL", f"arn:aws:ssm:{REGION}:{account_id}:parameter/{PROJECT_NAME}/{ENVIRONMENT}/UPLOAD_BASE_URL"),
]

for name, arn in secrets_to_add:
    if name not in existing_names:
        secrets.append({"name": name, "valueFrom": arn})
        print(f"Added: {name}")

# Supprimer les champs non nécessaires
for field in ["taskDefinitionArn", "revision", "status", "requiresAttributes", "compatibilities", "registeredAt", "registeredBy"]:
    task_def.pop(field, None)

# Sauvegarder
with open("task-def-new.json", "w") as f:
    json.dump(task_def, f, indent=2)

# Enregistrer
result = subprocess.run(
    ["aws", "ecs", "register-task-definition", "--cli-input-json", "file://task-def-new.json", "--region", REGION, "--output", "json"],
    capture_output=True, text=True
)

if result.returncode != 0:
    print(f"Error: {result.stderr}")
    sys.exit(1)

new_revision = json.loads(result.stdout)["taskDefinition"]["revision"]
print(f"New revision: {new_revision}")

# Mettre à jour le service
subprocess.run([
    "aws", "ecs", "update-service",
    "--cluster", CLUSTER_NAME,
    "--service", SERVICE_NAME,
    "--task-definition", f"{TASK_FAMILY}:{new_revision}",
    "--region", REGION,
    "--force-new-deployment"
])

print("Done!")
```

## ✅ Vérification après déploiement

1. **Vérifier les logs CloudWatch** :
   ```powershell
   aws logs tail /ecs/yukpomnang-backend --region us-east-1 --follow
   ```

2. **Rechercher dans les logs** :
   - `✅ ENABLE_AUTO_MIGRATIONS=true` (ou similaire)
   - `[MediaStorage] Stockage distant activé (bucket=yukpomnang-media-prod)` au lieu de `Stockage local utilisé`
   - `✅ Table product_creation_queue créée/appliquée`
   - `✅ Table cache_table créée/appliquée`
   - Plus d'erreurs `relation "services" does not exist` (une fois les migrations appliquées)

3. **Tester un upload de média** :
   - L'URL retournée devrait être `https://cdn.yukpomnang.com/uploads/...` au lieu d'un chemin local

## 📝 Notes

- Les paramètres S3 (`S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `UPLOAD_BASE_URL`) existent déjà dans SSM Parameter Store
- `ENABLE_AUTO_MIGRATIONS` existe aussi dans SSM avec la valeur `"true"`
- `S3_ACCESS_KEY` et `S3_SECRET_KEY` sont déjà présents dans la task definition actuelle (révision 2)
- Il faut seulement ajouter : `ENABLE_AUTO_MIGRATIONS`, `S3_BUCKET`, `S3_REGION`, `UPLOAD_BASE_URL`

## 🔄 Prochaines étapes après déploiement

1. **Vérifier que les migrations automatiques s'exécutent** :
   - Les logs devraient montrer la création des tables manquantes (`product_creation_queue`, `live_flash_sales`, `deliveries`, etc.)

2. **Vérifier que le CDN S3 fonctionne** :
   - Tester un upload de fichier via l'API
   - Vérifier que l'URL retournée pointe vers `https://cdn.yukpomnang.com/...`
   - Vérifier que CloudFront peut servir le fichier depuis S3

3. **Appliquer Terraform** (optionnel, pour synchroniser l'état) :
   ```bash
   cd infra/aws
   terraform plan
   terraform apply
   ```


