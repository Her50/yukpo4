# 🚀 Activer l'IP Publique Directement (Comme l'Ancien Compte)

**Date**: 2026-02-13  
**Objectif**: Rendre le backend accessible publiquement sans Load Balancer, comme dans l'ancien compte AWS

---

## 🔍 **Problème Identifié**

### Configuration Actuelle

Dans `infra/aws/main.tf` ligne 759:
```hcl
assign_public_ip = !var.enable_nat_gateway
```

Avec `enable_nat_gateway = true` dans `terraform.tfvars`, cela donne:
- ❌ `assign_public_ip = false`
- ❌ Service ECS dans sous-réseaux **privés**
- ❌ Pas d'accès Internet direct

### Références à l'Ancien Compte

J'ai trouvé plusieurs références à l'ancien compte AWS:
- ❌ `https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com` (us-east-1)
- ❌ `https://yukpomnang.onrender.com` (Render.com - ancien backend)

---

## ✅ **Solution : Activer l'IP Publique Directement**

### Option 1: Modifier Terraform pour Permettre IP Publique avec NAT Gateway

**Avantage**: Garde le NAT Gateway pour d'autres ressources, mais active l'IP publique pour ECS

**Modification dans `infra/aws/main.tf`**:

```hcl
# Ligne 756-760 - Modifier la configuration réseau
network_configuration {
  subnets          = var.enable_public_ip_for_ecs ? aws_subnet.public[*].id : aws_subnet.private[*].id
  security_groups  = [aws_security_group.ecs.id]
  assign_public_ip = var.enable_public_ip_for_ecs ? true : !var.enable_nat_gateway
}
```

**Ajouter dans `infra/aws/variables.tf`**:

```hcl
variable "enable_public_ip_for_ecs" {
  description = "Enable public IP for ECS tasks (allows direct Internet access without Load Balancer)"
  type        = bool
  default     = true  # ✅ Activé par défaut pour accès direct
}
```

**Modifier `infra/aws/terraform.tfvars`**:

```hcl
enable_public_ip_for_ecs = true  # ✅ Activer IP publique pour ECS
enable_nat_gateway = true        # Garde NAT Gateway pour autres ressources
```

### Option 2: Désactiver NAT Gateway (Plus Simple)

**Avantage**: Plus simple, économise ~$35/mois

**Modification dans `infra/aws/terraform.tfvars`**:

```hcl
enable_nat_gateway = false  # ✅ Active automatiquement assign_public_ip = true
```

**Inconvénient**: Désactive le NAT Gateway (peut affecter d'autres ressources)

### Option 3: Utiliser les Subnets Publics Directement (Recommandé)

**Avantage**: Plus simple et plus direct

**Modification dans `infra/aws/main.tf`**:

```hcl
# Ligne 756-760 - Utiliser subnets publics
network_configuration {
  subnets          = aws_subnet.public[*].id  # ✅ Utiliser subnets publics
  security_groups  = [aws_security_group.ecs.id]
  assign_public_ip = true  # ✅ Toujours activer IP publique
}
```

---

## 🎯 **Solution Recommandée : Option 3 (Subnets Publics)**

C'est la solution la plus simple et la plus directe, comme dans l'ancien compte.

### Étapes

1. **Modifier `infra/aws/main.tf`** (ligne 756-760):

```hcl
network_configuration {
  subnets          = aws_subnet.public[*].id  # ✅ Subnets publics
  security_groups  = [aws_security_group.ecs.id]
  assign_public_ip = true  # ✅ IP publique activée
}
```

2. **Vérifier les Security Groups** permettent le trafic entrant:

```bash
# Vérifier que le Security Group ECS autorise le trafic HTTP/HTTPS
aws ec2 describe-security-groups \
  --group-ids <ECS_SECURITY_GROUP_ID> \
  --region eu-west-1 \
  --query 'SecurityGroups[0].IpPermissions'
```

3. **Ajouter une règle inbound si nécessaire**:

```bash
# Autoriser HTTP (port 80)
aws ec2 authorize-security-group-ingress \
  --group-id <ECS_SECURITY_GROUP_ID> \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0 \
  --region eu-west-1

# Autoriser HTTPS (port 443)
aws ec2 authorize-security-group-ingress \
  --group-id <ECS_SECURITY_GROUP_ID> \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0 \
  --region eu-west-1
```

4. **Appliquer Terraform**:

```bash
cd infra/aws
terraform plan
terraform apply
```

5. **Récupérer l'IP Publique du Service ECS**:

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

6. **Tester l'accès**:

```bash
# Test health check
curl http://<IP_PUBLIQUE>:8080/health

# Test endpoint API
curl http://<IP_PUBLIQUE>:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

---

## ⚠️ **Important : IP Publique Change à Chaque Redémarrage**

L'IP publique d'un service ECS Fargate **change à chaque redémarrage** de la tâche. Pour une URL stable, il faut:

1. **Utiliser un Load Balancer** (recommandé pour production)
2. **Utiliser un domaine dynamique** (Route53 avec script de mise à jour)
3. **Utiliser un Elastic IP** (nécessite EC2, pas Fargate)

---

## 📝 **Mise à Jour des Configurations Mobile/Frontend**

Une fois l'IP publique obtenue, mettre à jour:

1. **Mobile** (`mobile/src/config/api.config.ts`):
```typescript
export const API_BASE_URL = EXPO_API_URL || 'http://<IP_PUBLIQUE>:8080';
```

2. **Frontend** (`frontend/src/config/api.config.ts`):
```typescript
export const API_BASE_URL = VITE_API_URL || 'http://<IP_PUBLIQUE>:8080';
```

**⚠️ Note**: Utiliser HTTP (pas HTTPS) car pas de certificat SSL avec IP directe.

---

## ✅ **Checklist**

- [ ] Modifier `infra/aws/main.tf` pour utiliser subnets publics
- [ ] Vérifier les Security Groups autorisent le trafic entrant
- [ ] Appliquer Terraform
- [ ] Récupérer l'IP publique du service ECS
- [ ] Tester l'accès au backend
- [ ] Mettre à jour les configurations mobile/frontend
- [ ] Tester les applications

---

## 🚀 **Alternative : Load Balancer (Recommandé pour Production)**

Pour une URL stable et HTTPS, activer le Load Balancer:

```hcl
enable_load_balancer = true
```

Puis utiliser l'URL du Load Balancer dans les configurations.

