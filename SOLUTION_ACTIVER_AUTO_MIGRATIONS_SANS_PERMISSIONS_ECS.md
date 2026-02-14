# 🔧 Solution : Activer Auto-Migrations Sans Permissions ECS

**Problème** : Le rôle IAM n'a pas les permissions ECS nécessaires.

**Solutions** :

---

## ✅ SOLUTION 1 : Via AWS Console (Recommandé)

### Étapes :

1. **Aller dans AWS Console** → **ECS** → **Clusters** → **yukpo-cluster**
2. **Sélectionner** → **Services** → **yukpo-backend-service**
3. **Cliquer** sur **Update**
4. **Dans Container Definitions**, sélectionner le conteneur
5. **Dans Environment**, chercher ou ajouter :
   - **Key**: `ENABLE_AUTO_MIGRATIONS`
   - **Value**: `true`
6. **Cliquer** sur **Update**
7. **Attendre** le déploiement (5-10 minutes)

---

## ✅ SOLUTION 2 : Via SSM Parameter Store (Si utilisé)

Si votre task definition récupère `ENABLE_AUTO_MIGRATIONS` depuis SSM Parameter Store :

```bash
# Vérifier si le paramètre existe
aws ssm get-parameter --name "/yukpomnang/production/ENABLE_AUTO_MIGRATIONS" --region eu-west-1

# Mettre à jour le paramètre
aws ssm put-parameter \
  --name "/yukpomnang/production/ENABLE_AUTO_MIGRATIONS" \
  --value "true" \
  --type "String" \
  --overwrite \
  --region eu-west-1

# Redémarrer le service pour qu'il récupère la nouvelle valeur
aws ecs update-service \
  --cluster yukpo-cluster \
  --service yukpo-backend-service \
  --force-new-deployment \
  --region eu-west-1
```

---

## ✅ SOLUTION 3 : Ajouter les Permissions IAM

Si vous avez accès à IAM, ajouter ces permissions au rôle `yukpo-temp-ec2-ssm-role` :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition",
        "ecs:UpdateService"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## ✅ SOLUTION 4 : Via Terraform (Si utilisé)

Si vous utilisez Terraform, modifier le fichier de configuration :

```hcl
resource "aws_ecs_task_definition" "backend" {
  # ... autres configurations ...
  
  container_definitions = jsonencode([{
    name  = "yukpo-backend"
    image = "your-image"
    
    environment = [
      {
        name  = "ENABLE_AUTO_MIGRATIONS"
        value = "true"
      }
      # ... autres variables ...
    ]
  }])
}
```

Puis appliquer :
```bash
terraform apply
```

---

## 📋 VÉRIFICATION APRÈS ACTIVATION

Attendre 5-10 minutes, puis vérifier les logs :

```bash
# Vérifier que la variable est bien activée dans les logs
aws logs tail /ecs/yukpo-backend-service \
  --since 10m \
  --region eu-west-1 \
  --filter-pattern "ENABLE_AUTO_MIGRATIONS" \
  --format short

# Vérifier les erreurs PostgreSQL
aws logs filter-log-events \
  --log-group-name /aws/rds/instance/yukpo-db/postgresql \
  --start-time $(date -u -d '30 minutes ago' +%s)000 \
  --filter-pattern "syntax error at end of input" \
  --region eu-west-1 \
  --query 'events | length(@)' \
  --output text
```

---

## ⚠️ IMPORTANT

**Le déploiement Git ne met PAS automatiquement à jour les variables d'environnement ECS.**

Pour que cela soit automatique, il faudrait :
1. Un pipeline CI/CD (GitHub Actions, GitLab CI, etc.)
2. Qui après le push Git :
   - Build l'image Docker
   - Push vers ECR
   - Met à jour la task definition avec la nouvelle image
   - Redéploie le service ECS

**Pour l'instant, il faut activer manuellement via la console AWS.**

