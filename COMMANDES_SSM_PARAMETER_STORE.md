# 🔧 Commandes SSM Parameter Store

## Vérifier si ENABLE_AUTO_MIGRATIONS existe dans SSM

```bash
aws ssm get-parameter --name "/yukpomnang/production/ENABLE_AUTO_MIGRATIONS" --region eu-west-1
```

---

## Lister tous les paramètres SSM

```bash
aws ssm describe-parameters --region eu-west-1 --query 'Parameters[*].[Name,Type]' --output table
```

---

## Créer/Mettre à jour ENABLE_AUTO_MIGRATIONS dans SSM

```bash
aws ssm put-parameter --name "/yukpomnang/production/ENABLE_AUTO_MIGRATIONS" --value "true" --type "String" --overwrite --region eu-west-1
```

---

## Redémarrer le Service ECS (si vous avez les permissions)

```bash
aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --force-new-deployment --region eu-west-1
```

---

## Vérifier les Variables d'Environnement dans les Logs

```bash
aws logs tail /ecs/yukpo-backend-service --since 10m --region eu-west-1 --filter-pattern "ENABLE_AUTO_MIGRATIONS" --format short
```

