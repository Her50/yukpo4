# 🔧 Désactiver les Migrations Automatiques dans ECS

## ⚠️ **Pourquoi Désactiver ?**

Pour éviter que le backend essaie d'exécuter les migrations automatiques au démarrage (qui échouent à cause du parsing SQL défaillant).

---

## ✅ **Méthode 1 : Variable d'Environnement ECS**

### **Via AWS Console**

1. Allez dans **ECS** → **Clusters** → **yukpo-cluster**
2. Sélectionnez le **Service** → **yukpo-backend-service**
3. Cliquez sur **Update**
4. Dans **Container Definitions**, sélectionnez le conteneur
5. Dans **Environment**, ajoutez :
   - **Key**: `ENABLE_AUTO_MIGRATIONS`
   - **Value**: `false`
6. Cliquez sur **Update**

### **Via AWS CLI**

```bash
# Récupérer la définition actuelle du service
aws ecs describe-services \
  --cluster yukpo-cluster \
  --services yukpo-backend-service \
  --region eu-west-1 \
  --query 'services[0].taskDefinition' \
  --output text > current-task-def.json

# Modifier le fichier pour ajouter ENABLE_AUTO_MIGRATIONS=false
# (ajouter dans containerDefinitions[0].environment)

# Créer une nouvelle révision de la task definition
aws ecs register-task-definition \
  --cli-input-json file://current-task-def.json \
  --region eu-west-1

# Mettre à jour le service
aws ecs update-service \
  --cluster yukpo-cluster \
  --service yukpo-backend-service \
  --task-definition <nouvelle-revision> \
  --region eu-west-1
```

---

## ✅ **Méthode 2 : Terraform**

Si vous utilisez Terraform, ajoutez dans votre configuration :

```hcl
resource "aws_ecs_task_definition" "backend" {
  # ... autres configurations ...
  
  container_definitions = jsonencode([{
    name  = "yukpo-backend"
    image = "your-image"
    
    environment = [
      {
        name  = "ENABLE_AUTO_MIGRATIONS"
        value = "false"
      }
      # ... autres variables d'environnement ...
    ]
  }])
}
```

---

## ✅ **Méthode 3 : Dockerfile / docker-compose**

Si vous utilisez Docker directement :

```dockerfile
# Dans Dockerfile
ENV ENABLE_AUTO_MIGRATIONS=false
```

Ou dans `docker-compose.yml` :

```yaml
services:
  backend:
    environment:
      - ENABLE_AUTO_MIGRATIONS=false
```

---

## 🔍 **Vérification**

Après avoir désactivé les migrations automatiques, vérifiez dans les logs :

```bash
# Les logs ne doivent plus contenir :
# "🚀 Démarrage des migrations automatiques..."
# "execute_migration_sql_safe"
# "syntax error at end of input"

# Mais doivent contenir :
# "⏭️ Migrations automatiques désactivées (ENABLE_AUTO_MIGRATIONS=false)"
```

---

## 📝 **Note**

- Les migrations **SQLx standard** (`sqlx::migrate!()`) continueront de s'exécuter (elles fonctionnent correctement)
- Seules les **migrations automatiques** (`run_auto_migrations()`) seront désactivées
- Vous pourrez exécuter les migrations manuellement depuis EC2 sans conflit


