# Correction du Problème Redis - Security Group

**Date**: 2026-02-13  
**Problème**: ECS ne peut pas accéder à Redis (port 6379)

---

## 🚨 PROBLÈME IDENTIFIÉ

### Symptômes
- ❌ ECS Security Group (`sg-0d910f6cca6bac2e5`) **N'EST PAS** autorisé dans Redis Security Group
- ❌ Port 6379 non accessible depuis ECS
- ⚠️ L'application Rust peut crash ou ne pas démarrer si elle ne peut pas se connecter à Redis

### Configuration Actuelle

**Redis Security Group**: `sg-06e7d19f54d7fa191`
- Port 6379 autorisé depuis: ❌ **AUCUN** (ou règles incorrectes)

**ECS Security Group**: `sg-0d910f6cca6bac2e5`
- Egress complet autorisé (0.0.0.0/0)

---

## ✅ CORRECTION APPLIQUÉE

### Commande Exécutée
```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-06e7d19f54d7fa191 \
  --protocol tcp \
  --port 6379 \
  --source-group sg-0d910f6cca6bac2e5 \
  --region eu-west-1
```

### Résultat
- ✅ Règle ajoutée avec succès
- ✅ ECS peut maintenant accéder à Redis sur le port 6379

---

## 🔍 AUTRES PROBLÈMES IDENTIFIÉS

### 1. NAT Gateway Manquant (CRITIQUE)

**Problème**:
- ECS est dans des subnets privées
- `assign_public_ip = DISABLED`
- Pas de NAT Gateway détecté

**Impact**:
- ❌ Pas d'accès Internet depuis ECS
- ❌ Impossible de télécharger des images Docker depuis ECR
- ❌ Impossible d'accéder aux APIs externes
- ❌ Health checks peuvent échouer si l'application a besoin d'Internet

**Solutions**:

#### Option 1: Activer assign_public_ip (RECOMMANDÉ - Plus Simple)
```bash
aws ecs update-service \
  --cluster yukpo-cluster \
  --service yukpo-backend-service \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-0670f81dbde94e86d,subnet-0bdead65f27d8039c],securityGroups=[sg-0d910f6cca6bac2e5],assignPublicIp=ENABLED}" \
  --region eu-west-1
```

#### Option 2: Créer NAT Gateway (Plus Sécurisé mais Coûteux)
- Créer un NAT Gateway dans une subnet publique
- Configurer les route tables pour router le trafic Internet via NAT Gateway
- Coût: ~$32/mois + trafic

---

### 2. Vérification RDS (OK)

**Status**: ✅ **OK**
- Port 5432 autorisé depuis ECS SG
- Port 5432 autorisé depuis EC2 Temp SG

---

## 📊 RÉSUMÉ DES CORRECTIONS

| Problème | Status | Action |
|----------|--------|--------|
| Redis Security Group | ✅ **CORRIGÉ** | Règle ajoutée (port 6379) |
| RDS Security Group | ✅ **OK** | Aucune action nécessaire |
| NAT Gateway | ⚠️ **À VÉRIFIER** | Activer assign_public_ip ou créer NAT Gateway |
| ECS -> RDS | ✅ **OK** | Aucune action nécessaire |
| ECS -> Redis | ✅ **CORRIGÉ** | Règle ajoutée |

---

## 🎯 PROCHAINES ÉTAPES

1. ✅ **Correction Redis appliquée** - Redémarrer le service ECS pour tester
2. ⚠️ **Vérifier NAT Gateway** - Activer assign_public_ip si nécessaire
3. 🔄 **Redémarrer le service ECS** pour appliquer les changements
4. 📊 **Vérifier les logs** pour confirmer que l'application démarre correctement

---

## 🔄 REDÉMARRAGE DU SERVICE

Après les corrections, redémarrer le service ECS:

```bash
aws ecs update-service \
  --cluster yukpo-cluster \
  --service yukpo-backend-service \
  --force-new-deployment \
  --region eu-west-1
```

---

## 📝 NOTES

- L'instance EC2 temporaire (`i-0b9ad404f8d738d04`) est toujours active
- Elle peut être supprimée après vérification que tout fonctionne
- Les Security Groups sont correctement configurés maintenant (sauf NAT Gateway)

