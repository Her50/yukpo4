# ✅ Résumé : Activation IP Publique Directe pour Backend AWS

**Date**: 2026-02-13  
**Statut**: ✅ **Modifications appliquées**

---

## 🔍 **Problème Identifié**

### Références à l'Ancien Compte

J'ai trouvé plusieurs références à l'ancien compte AWS dans les fichiers:
- ❌ `https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com` (us-east-1)
- ❌ `https://yukpomnang.onrender.com` (Render.com - ancien backend)

### Configuration Actuelle

- ❌ Service ECS dans **sous-réseaux privés**
- ❌ `assign_public_ip = false` (car `enable_nat_gateway = true`)
- ❌ Security Group n'autorise que le trafic depuis ALB
- ❌ Backend **non accessible** depuis Internet

---

## ✅ **Modifications Appliquées**

### 1. **Modification `infra/aws/main.tf`** - Utiliser Subnets Publics

**Ligne 756-760** - Changé de:
```hcl
network_configuration {
  subnets          = aws_subnet.private[*].id
  security_groups  = [aws_security_group.ecs.id]
  assign_public_ip = !var.enable_nat_gateway
}
```

**Vers**:
```hcl
network_configuration {
  # ✅ 2026-02-13: Utiliser subnets publics pour accès direct (comme ancien compte)
  subnets          = aws_subnet.public[*].id
  security_groups  = [aws_security_group.ecs.id]
  assign_public_ip = true  # ✅ Toujours activer IP publique
}
```

### 2. **Modification Security Group** - Autoriser Trafic Internet

**Ligne 203-208** - Ajouté règle pour autoriser le trafic depuis Internet:
```hcl
# ✅ 2026-02-13: Autoriser le trafic direct depuis Internet
ingress {
  from_port   = 8080
  to_port     = 8080
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"]
  description = "Allow direct access from Internet (for public IP access)"
}
```

---

## 🚀 **Prochaines Étapes**

### 1. **Appliquer Terraform**

```bash
cd infra/aws
terraform plan
terraform apply
```

### 2. **Récupérer l'IP Publique du Service ECS**

```bash
# Obtenir l'IP publique de la tâche ECS
aws ecs describe-tasks \
  --cluster yukpo-cluster \
  --tasks $(aws ecs list-tasks --cluster yukpo-cluster --service-name yukpo-backend-service --region eu-west-1 --desired-status RUNNING --query 'taskArns[0]' --output text) \
  --region eu-west-1 \
  --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' \
  --output text | xargs -I {} aws ec2 describe-network-interfaces \
    --network-interface-ids {} \
    --region eu-west-1 \
    --query 'NetworkInterfaces[0].Association.PublicIp' \
    --output text
```

### 3. **Tester l'Accès**

```bash
# Test health check
curl http://<IP_PUBLIQUE>:8080/health

# Test endpoint API
curl http://<IP_PUBLIQUE>:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

### 4. **Mettre à Jour les Configurations**

Une fois l'IP publique obtenue, mettre à jour:

**Mobile** (`mobile/src/config/api.config.ts`):
```typescript
export const API_BASE_URL = EXPO_API_URL || 'http://<IP_PUBLIQUE>:8080';
```

**Frontend** (`frontend/src/config/api.config.ts`):
```typescript
export const API_BASE_URL = VITE_API_URL || 'http://<IP_PUBLIQUE>:8080';
```

**⚠️ Note**: Utiliser HTTP (pas HTTPS) car pas de certificat SSL avec IP directe.

---

## ⚠️ **Important : IP Publique Change**

L'IP publique d'un service ECS Fargate **change à chaque redémarrage** de la tâche. Pour une URL stable, il faut:

1. **Utiliser un Load Balancer** (recommandé pour production)
2. **Utiliser un domaine dynamique** (Route53 avec script de mise à jour)
3. **Utiliser un Elastic IP** (nécessite EC2, pas Fargate)

---

## ✅ **Checklist**

- [x] Modifier `infra/aws/main.tf` pour utiliser subnets publics
- [x] Modifier Security Group pour autoriser le trafic Internet
- [ ] Appliquer Terraform
- [ ] Récupérer l'IP publique du service ECS
- [ ] Tester l'accès au backend
- [ ] Mettre à jour les configurations mobile/frontend
- [ ] Tester les applications

---

## 📝 **Fichiers Modifiés**

1. ✅ `infra/aws/main.tf` - Configuration réseau ECS (subnets publics + IP publique)
2. ✅ `infra/aws/main.tf` - Security Group ECS (autoriser trafic Internet)
3. ✅ `ACTIVER_IP_PUBLIQUE_DIRECTE.md` - Documentation créée
4. ✅ `RESUME_ACTIVATION_IP_PUBLIQUE.md` - Ce fichier

---

**Prochaine action**: Appliquer Terraform pour activer l'IP publique.

