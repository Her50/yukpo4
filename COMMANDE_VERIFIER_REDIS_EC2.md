# 🔴 Vérifier et Configurer Redis depuis EC2

## ✅ **1. Vérifier le statut et l'endpoint Redis**

```bash
aws elasticache describe-replication-groups --replication-group-id yukpo-redis --region eu-west-1 --query 'ReplicationGroups[0].[Status,PrimaryEndpoint.Address]' --output table
```

---

## ✅ **2. Si l'endpoint est disponible, mettre à jour REDIS_URL**

```bash
# Récupérer l'endpoint
REDIS_ENDPOINT=$(aws elasticache describe-replication-groups --replication-group-id yukpo-redis --region eu-west-1 --query 'ReplicationGroups[0].PrimaryEndpoint.Address' --output text)

# Vérifier que l'endpoint n'est pas vide
if [ -n "$REDIS_ENDPOINT" ] && [ "$REDIS_ENDPOINT" != "None" ]; then
    echo "Endpoint Redis: $REDIS_ENDPOINT"
    
    # Récupérer le secret actuel
    SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --query 'SecretString' --output text)
    
    # Mettre à jour REDIS_URL (nécessite jq)
    NEW_REDIS_URL="redis://$REDIS_ENDPOINT:6379/0"
    UPDATED_SECRET=$(echo "$SECRET_JSON" | jq ".REDIS_URL = \"$NEW_REDIS_URL\"")
    
    # Mettre à jour le secret
    aws secretsmanager put-secret-value \
      --secret-id yukpo/backend/secrets \
      --region eu-west-1 \
      --secret-string "$UPDATED_SECRET"
    
    echo "✅ REDIS_URL mis à jour: $NEW_REDIS_URL"
    
    # Redémarrer ECS
    aws ecs update-service \
      --cluster yukpo-cluster \
      --service yukpo-backend-service \
      --region eu-west-1 \
      --force-new-deployment
    
    echo "✅ Service ECS redémarré"
else
    echo "⚠️  Endpoint Redis non disponible. Statut du cluster:"
    aws elasticache describe-replication-groups --replication-group-id yukpo-redis --region eu-west-1 --query 'ReplicationGroups[0].Status' --output text
fi
```

---

## ✅ **3. Version simplifiée (si jq n'est pas installé)**

```bash
# Récupérer l'endpoint
REDIS_ENDPOINT=$(aws elasticache describe-replication-groups --replication-group-id yukpo-redis --region eu-west-1 --query 'ReplicationGroups[0].PrimaryEndpoint.Address' --output text)

if [ -n "$REDIS_ENDPOINT" ] && [ "$REDIS_ENDPOINT" != "None" ]; then
    echo "Endpoint Redis: $REDIS_ENDPOINT"
    echo "REDIS_URL à mettre à jour: redis://$REDIS_ENDPOINT:6379/0"
    echo ""
    echo "Mettez à jour manuellement via PowerShell ou AWS Console:"
    echo "  - Secrets Manager > yukpo/backend/secrets"
    echo "  - Modifiez REDIS_URL = redis://$REDIS_ENDPOINT:6379/0"
else
    echo "⚠️  Endpoint Redis non disponible"
    aws elasticache describe-replication-groups --replication-group-id yukpo-redis --region eu-west-1 --query 'ReplicationGroups[0].[Status,PrimaryEndpoint.Address]' --output table
fi
```
