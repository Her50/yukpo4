# 🔴 Résultats des Tests Backend AWS

## 📊 Résultats des Tests

**Date** : 2026-01-30  
**URL Testée** : `https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com`

### ❌ Test 1: Health Check
- **Statut** : ÉCHEC
- **Erreur** : `Impossible de se connecter au serveur distant`
- **URL** : `/health`

### ❌ Test 2: Endpoint d'inscription
- **Statut** : ÉCHEC
- **Erreur** : `Impossible de se connecter au serveur distant`
- **URL** : `/api/auth/register`

### ❌ Test 3: Headers CORS
- **Statut** : ÉCHEC
- **Erreur** : `Le délai de l'opération a expiré`
- **URL** : `/health` (OPTIONS)

---

## 🔴 Problème Identifié

**L'ALB n'est pas accessible depuis Internet.**

Cela signifie que :
- ❌ Les requêtes depuis le mobile échouent
- ❌ Les requêtes depuis votre machine locale échouent
- ❌ L'ALB est probablement mal configuré ou les Security Groups bloquent le trafic

---

## 🔧 Causes Possibles

### 1. Security Groups ALB Bloquent le Trafic

**Problème** : Le Security Group de l'ALB n'autorise pas HTTPS (443) depuis Internet.

**Solution** :
1. Aller dans AWS Console → EC2 → Security Groups
2. Sélectionner le Security Group de l'ALB
3. Onglet **Inbound rules**
4. Ajouter une règle :
   - **Type** : HTTPS
   - **Protocol** : TCP
   - **Port** : 443
   - **Source** : `0.0.0.0/0` (ou une IP spécifique pour plus de sécurité)

### 2. ALB Non Configuré pour Internet

**Problème** : L'ALB est configuré en mode "Internal" au lieu de "Internet-facing".

**Solution** :
1. Aller dans AWS Console → EC2 → Load Balancers
2. Sélectionner l'ALB `yukpomnang-backend-alb`
3. Onglet **Description**
4. Vérifier que **Scheme** est `internet-facing` (pas `internal`)

### 3. Listener HTTPS Non Configuré

**Problème** : L'ALB n'a pas de listener HTTPS (443) configuré.

**Solution** :
1. Aller dans AWS Console → EC2 → Load Balancers
2. Sélectionner l'ALB
3. Onglet **Listeners**
4. Vérifier qu'un listener HTTPS (443) existe
5. Si absent, créer un listener :
   - **Protocol** : HTTPS
   - **Port** : 443
   - **Default action** : Forward to Target Group
   - **SSL Certificate** : Certificat ACM ou IAM

### 4. Target Group Vide ou Instances Unhealthy

**Problème** : Le Target Group ne pointe vers aucune instance ECS, ou les instances sont "unhealthy".

**Solution** :
1. Aller dans AWS Console → EC2 → Target Groups
2. Sélectionner le Target Group de l'ALB
3. Onglet **Targets**
4. Vérifier que :
   - Des instances ECS sont enregistrées
   - Le statut est "healthy" (pas "unhealthy" ou "draining")
   - Les health checks passent

### 5. VPC/Subnets Mal Configurés

**Problème** : L'ALB est dans des subnets privés sans route vers Internet.

**Solution** :
1. Aller dans AWS Console → EC2 → Load Balancers
2. Sélectionner l'ALB
3. Onglet **Description**
4. Vérifier que les subnets sont des subnets publics (avec Internet Gateway)
5. Si subnets privés, modifier l'ALB pour utiliser des subnets publics

---

## 📋 Checklist de Vérification AWS

### ALB Configuration
- [ ] **Scheme** : `internet-facing` (pas `internal`)
- [ ] **Subnets** : Subnets publics (avec Internet Gateway)
- [ ] **Security Group** : Autorise HTTPS (443) depuis `0.0.0.0/0`
- [ ] **Listener HTTPS** : Configuré sur le port 443
- [ ] **SSL Certificate** : Certificat ACM ou IAM configuré

### Target Group Configuration
- [ ] **Targets** : Instances ECS enregistrées
- [ ] **Health Status** : Tous les targets sont "healthy"
- [ ] **Health Check Path** : `/health` ou `/healthz`
- [ ] **Health Check Protocol** : HTTP
- [ ] **Health Check Port** : 8080 (ou le port du backend)

### ECS Service Configuration
- [ ] **Service Status** : Running
- [ ] **Tasks** : Au moins une task est running
- [ ] **Task Definition** : Variables d'environnement correctes (`DATABASE_URL`, `PORT`, `HOST`)
- [ ] **Logs CloudWatch** : Backend démarre correctement

---

## 🎯 Actions Immédiates

### 1. Vérifier le Scheme de l'ALB

```bash
# Via AWS CLI
aws elbv2 describe-load-balancers \
  --load-balancer-arns <ALB_ARN> \
  --query 'LoadBalancers[0].Scheme' \
  --output text

# Résultat attendu : internet-facing
```

### 2. Vérifier les Security Groups

```bash
# Via AWS CLI
aws ec2 describe-security-groups \
  --group-ids <ALB_SECURITY_GROUP_ID> \
  --query 'SecurityGroups[0].IpPermissions' \
  --output json

# Vérifier qu'une règle autorise HTTPS (443) depuis 0.0.0.0/0
```

### 3. Vérifier le Target Group

```bash
# Via AWS CLI
aws elbv2 describe-target-health \
  --target-group-arn <TARGET_GROUP_ARN> \
  --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State]' \
  --output table

# Résultat attendu : Tous les targets sont "healthy"
```

### 4. Vérifier les Logs ECS

Dans AWS Console → CloudWatch → Log Groups → `/ecs/yukpomnang-backend`

Chercher :
- ✅ "Serveur lance sur http://0.0.0.0:8080"
- ✅ "Connexion PostgreSQL établie"
- ❌ Erreurs de démarrage
- ❌ Erreurs de connexion base de données

---

## 🔧 Solutions Recommandées

### Solution 1 : Corriger les Security Groups (Le Plus Probable)

1. **AWS Console** → **EC2** → **Security Groups**
2. Trouver le Security Group de l'ALB
3. **Edit inbound rules**
4. Ajouter :
   - **Type** : HTTPS
   - **Port** : 443
   - **Source** : `0.0.0.0/0`
5. **Save rules**

### Solution 2 : Vérifier que l'ALB est Internet-Facing

1. **AWS Console** → **EC2** → **Load Balancers**
2. Sélectionner l'ALB
3. **Description** → Vérifier **Scheme**
4. Si `internal`, créer un nouvel ALB `internet-facing`

### Solution 3 : Vérifier le Target Group

1. **AWS Console** → **EC2** → **Target Groups**
2. Sélectionner le Target Group
3. **Targets** → Vérifier que les instances ECS sont "healthy"
4. Si "unhealthy", vérifier les logs ECS et les health checks

---

## 📊 Prochaines Étapes

1. **Vérifier les Security Groups** dans AWS Console
2. **Vérifier le Scheme de l'ALB** (internet-facing)
3. **Vérifier le Target Group** (targets healthy)
4. **Vérifier les logs CloudWatch** (backend démarre)
5. **Relancer le test** : `.\scripts\test_backend_aws.ps1`

---

**Statut** : 🔴 **ALB non accessible depuis Internet**  
**Action Requise** : Vérifier la configuration AWS (Security Groups, ALB Scheme, Target Group)

