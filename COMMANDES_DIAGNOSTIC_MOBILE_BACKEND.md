# 🔍 Commandes de Diagnostic : Mobile → Backend

**Copier-coller ces commandes pour diagnostiquer le problème**

---

## 📋 DIAGNOSTIC COMPLET (À Exécuter sur EC2 ou Local avec AWS CLI)

```bash
# ============================================================================
# DIAGNOSTIC COMPLET : Mobile → Backend
# ============================================================================

echo "=== 1. VÉRIFICATION DNS ==="
nslookup api.yukpomnang.com
echo ""

echo "=== 2. IP PUBLIQUE DU BACKEND ECS ==="
TASK_ARN=$(aws ecs list-tasks --cluster yukpo-cluster --service-name yukpo-backend-service --region eu-west-1 --query 'taskArns[0]' --output text 2>/dev/null)
if [ -n "$TASK_ARN" ] && [ "$TASK_ARN" != "None" ]; then
  echo "Task ARN: $TASK_ARN"
  ENI_ID=$(aws ecs describe-tasks --cluster yukpo-cluster --tasks "$TASK_ARN" --region eu-west-1 --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text 2>/dev/null)
  if [ -n "$ENI_ID" ] && [ "$ENI_ID" != "None" ]; then
    PUBLIC_IP=$(aws ec2 describe-network-interfaces --network-interface-ids "$ENI_ID" --region eu-west-1 --query 'NetworkInterfaces[0].Association.PublicIp' --output text 2>/dev/null)
    echo "IP Publique: $PUBLIC_IP"
  else
    echo "❌ Impossible de récupérer l'ENI ID"
  fi
else
  echo "❌ Aucune tâche ECS trouvée"
fi
echo ""

echo "=== 3. VÉRIFICATION SECURITY GROUPS ==="
SG_ID=$(aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]' --output text 2>/dev/null)
if [ -n "$SG_ID" ] && [ "$SG_ID" != "None" ]; then
  echo "Security Group ID: $SG_ID"
  aws ec2 describe-security-groups --group-ids "$SG_ID" --region eu-west-1 --query 'SecurityGroups[0].{GroupId:GroupId,IngressRules:IpPermissions}' --output json 2>/dev/null
else
  echo "❌ Impossible de récupérer le Security Group"
fi
echo ""

echo "=== 4. VÉRIFICATION CORS (ALLOWED_ORIGINS) ==="
aws ecs describe-task-definition --task-definition yukpo-backend --region eu-west-1 --query 'taskDefinition.containerDefinitions[0].environment[?name==`ALLOWED_ORIGINS`]' --output json 2>/dev/null || echo "❌ Variable ALLOWED_ORIGINS non trouvée"
echo ""

echo "=== 5. TEST DE CONNECTIVITÉ ==="
echo "Test HTTP direct (si IP connue):"
if [ -n "$PUBLIC_IP" ]; then
  curl -v --max-time 10 "http://$PUBLIC_IP:8080/health" 2>&1 | head -20
else
  echo "⚠️ IP non disponible, test impossible"
fi
echo ""

echo "Test via DNS:"
curl -v --max-time 10 "https://api.yukpomnang.com/health" 2>&1 | head -20
echo ""

echo "=== 6. VÉRIFICATION LOAD BALANCER ==="
cd infra/aws 2>/dev/null && grep "enable_load_balancer" terraform.tfvars 2>/dev/null || echo "⚠️ Fichier terraform.tfvars non trouvé"
echo ""

echo "=== DIAGNOSTIC TERMINÉ ==="
```

---

## 📋 DIAGNOSTIC RAPIDE (Version Simplifiée)

```bash
# 1. Vérifier DNS
nslookup api.yukpomnang.com

# 2. Tester connectivité
curl -v https://api.yukpomnang.com/health

# 3. Vérifier IP publique ECS
aws ecs list-tasks --cluster yukpo-cluster --service-name yukpo-backend-service --region eu-west-1
```

---

## 📋 COMMANDES DE RÉSOLUTION

### Solution 1 : Mettre à Jour le DNS Cloudflare

```bash
# 1. Récupérer l'IP publique actuelle
TASK_ARN=$(aws ecs list-tasks --cluster yukpo-cluster --service-name yukpo-backend-service --region eu-west-1 --query 'taskArns[0]' --output text)
ENI_ID=$(aws ecs describe-tasks --cluster yukpo-cluster --tasks "$TASK_ARN" --region eu-west-1 --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text)
PUBLIC_IP=$(aws ec2 describe-network-interfaces --network-interface-ids "$ENI_ID" --region eu-west-1 --query 'NetworkInterfaces[0].Association.PublicIp' --output text)
echo "IP Publique actuelle: $PUBLIC_IP"

# 2. Mettre à jour Cloudflare manuellement :
# - Aller sur https://dash.cloudflare.com
# - Sélectionner yukpomnang.com
# - DNS → Enregistrements
# - Modifier l'enregistrement A pour "api"
# - Mettre l'IP: $PUBLIC_IP
# - Désactiver le proxy (nuage gris)
```

---

### Solution 2 : Configurer CORS

```bash
# Vérifier la Task Definition actuelle
aws ecs describe-task-definition --task-definition yukpo-backend --region eu-west-1 --query 'taskDefinition.containerDefinitions[0].environment' --output json

# Ajouter ALLOWED_ORIGINS dans AWS Console :
# - ECS → Définitions de tâches → yukpo-backend
# - Créer une nouvelle révision
# - Variables d'environnement → Ajouter :
#   ALLOWED_ORIGINS=*
# - Mettre à jour le service avec la nouvelle révision
```

---

### Solution 3 : Activer le Load Balancer

```bash
# 1. Activer dans Terraform
cd infra/aws
# Éditer terraform.tfvars
# enable_load_balancer = true

# 2. Appliquer
terraform plan
terraform apply

# 3. Récupérer l'URL
terraform output alb_dns_name

# 4. Mettre à jour le DNS Cloudflare avec l'URL du Load Balancer
```

---

## 📊 INTERPRÉTATION DES RÉSULTATS

### ✅ Si DNS résout correctement :
- `api.yukpomnang.com` → IP publique du backend ECS
- ✅ DNS OK

### ❌ Si DNS ne résout pas :
- `NXDOMAIN` ou `Non-existent domain`
- ❌ DNS non configuré → Solution 1

### ✅ Si Security Group autorise le port 8080 :
- Règle ingress avec `0.0.0.0/0` sur le port 8080
- ✅ Security Group OK

### ❌ Si Security Group bloque :
- Pas de règle ingress sur le port 8080
- ❌ Security Group bloque → Ajouter la règle

### ✅ Si curl retourne 200 OK :
- `{"status":"ok"}` ou réponse HTTP 200
- ✅ Backend accessible

### ❌ Si curl timeout :
- `Connection timeout` ou `Connection refused`
- ❌ Backend non accessible → Vérifier Security Groups et IP

### ✅ Si ALLOWED_ORIGINS est configuré :
- Variable présente avec valeur `*` ou liste d'origines
- ✅ CORS OK

### ❌ Si ALLOWED_ORIGINS manque :
- Variable absente
- ❌ CORS peut bloquer → Solution 2

---

**Date** : 2026-02-14  
**Statut** : 🔍 Commandes de diagnostic prêtes

