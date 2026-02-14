# Problème Critique - Route Tables ECS

**Date**: 2026-02-13  
**Problème**: Les subnets ECS n'ont pas de route vers Internet (NAT Gateway)

---

## 🚨 PROBLÈME IDENTIFIÉ

### Symptômes
- ❌ Les subnets ECS n'ont **PAS** de route `0.0.0.0/0` vers le NAT Gateway
- ❌ ECS ne peut pas accéder à Internet
- ❌ Impact sur le démarrage de l'application

### Configuration Actuelle

**Subnets ECS**:
- `subnet-0670f81dbde94e86d`
- `subnet-0bdead65f27d8039c`

**Routes Actuelles**:
- ✅ `10.0.0.0/16` -> local (VPC)
- ❌ `0.0.0.0/0` -> **MANQUANT**

**NAT Gateway**:
- ✅ Existe: `nat-09e64ae24f9be6099`
- ⚠️ Mais pas utilisé par les route tables ECS

---

## 🔧 CORRECTION

### Commande de Correction
```bash
# Pour chaque route table associée aux subnets ECS
aws ec2 create-route \
  --route-table-id <route-table-id> \
  --destination-cidr-block "0.0.0.0/0" \
  --nat-gateway-id nat-09e64ae24f9be6099 \
  --region eu-west-1
```

### Via Terraform
Vérifier que les route tables privées ont bien une route vers le NAT Gateway:

```hcl
resource "aws_route" "private_nat" {
  route_table_id         = aws_route_table.private[0].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main[0].id
}
```

---

## 📊 IMPACT

### Sans Route Internet
- ❌ Pas d'accès Internet depuis ECS
- ❌ Impossible de télécharger des images Docker depuis ECR
- ❌ Impossible d'accéder aux APIs externes
- ❌ Health checks peuvent échouer
- ❌ L'application peut crash si elle a besoin d'Internet

### Avec Route Internet (NAT Gateway)
- ✅ Accès Internet depuis ECS
- ✅ Téléchargement d'images Docker depuis ECR
- ✅ Accès aux APIs externes
- ✅ Health checks fonctionnent

---

## 🎯 CONCLUSION

**Le problème principal est probablement**:
1. ❌ **Route Tables** - Pas de route vers Internet (NAT Gateway)
2. ✅ Security Groups - Correctement configurés
3. ✅ NAT Gateway - Existe mais pas utilisé

**Action immédiate**: Ajouter les routes `0.0.0.0/0` -> NAT Gateway dans les route tables des subnets ECS.

