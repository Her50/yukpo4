# 🔍 Diagnostic : Application Mobile n'a pas Accès au Backend

**Date** : 2026-02-14  
**Problème** : L'application mobile n'arrive pas à se connecter au backend

---

## 📋 CHECKLIST DE DIAGNOSTIC

### 1. ✅ Vérifier la Configuration Mobile

**Fichier** : `mobile/src/config/api.config.ts`

**Vérifier** :
- ✅ URL API : `https://api.yukpomnang.com` (ligne 21)
- ✅ URL WebSocket : `wss://api.yukpomnang.com` (ligne 22)

**Statut** : ✅ **Correct** - Le mobile utilise `api.yukpomnang.com`

---

### 2. 🔍 Vérifier le DNS

**Problème potentiel** : Le DNS `api.yukpomnang.com` ne pointe peut-être pas vers la bonne IP.

**Vérification** :

```bash
# Vérifier la résolution DNS
nslookup api.yukpomnang.com
# ou
dig api.yukpomnang.com
```

**Résultat attendu** : L'IP doit pointer vers l'IP publique du backend ECS.

**Si le DNS ne résout pas** :
- Aller sur Cloudflare Dashboard
- Vérifier que l'enregistrement A pour `api` existe
- Vérifier que l'IP est correcte (IP actuelle du backend ECS)

---

### 3. 🔍 Vérifier l'IP Publique du Backend ECS

**Problème potentiel** : L'IP publique du backend ECS peut avoir changé.

**Vérification** :

```bash
# Récupérer l'IP publique actuelle du backend ECS
aws ecs describe-services \
  --cluster yukpo-cluster \
  --services yukpo-backend-service \
  --region eu-west-1 \
  --query 'services[0].networkConfiguration.awsvpcConfiguration.assignPublicIp' \
  --output text

# Récupérer les tâches ECS
aws ecs list-tasks \
  --cluster yukpo-cluster \
  --service-name yukpo-backend-service \
  --region eu-west-1 \
  --query 'taskArns[0]' \
  --output text

# Récupérer l'IP publique de la tâche
TASK_ARN=$(aws ecs list-tasks --cluster yukpo-cluster --service-name yukpo-backend-service --region eu-west-1 --query 'taskArns[0]' --output text)
aws ecs describe-tasks \
  --cluster yukpo-cluster \
  --tasks "$TASK_ARN" \
  --region eu-west-1 \
  --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' \
  --output text | xargs -I {} aws ec2 describe-network-interfaces \
  --network-interface-ids {} \
  --region eu-west-1 \
  --query 'NetworkInterfaces[0].Association.PublicIp' \
  --output text
```

**Action requise** : Si l'IP a changé, mettre à jour le DNS Cloudflare.

---

### 4. 🔍 Vérifier les Security Groups

**Problème potentiel** : Les Security Groups peuvent bloquer le trafic entrant.

**Vérification** :

```bash
# Récupérer le Security Group du backend ECS
aws ecs describe-services \
  --cluster yukpo-cluster \
  --services yukpo-backend-service \
  --region eu-west-1 \
  --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]' \
  --output text

# Vérifier les règles du Security Group
SG_ID=$(aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]' --output text)
aws ec2 describe-security-groups \
  --group-ids "$SG_ID" \
  --region eu-west-1 \
  --query 'SecurityGroups[0].IpPermissions'
```

**Règles requises** :
- ✅ Port 8080 (HTTP) : Autoriser depuis `0.0.0.0/0` (ou IPs spécifiques)
- ✅ Port 443 (HTTPS) : Si Load Balancer activé

**Action requise** : Si les règles manquent, les ajouter.

---

### 5. 🔍 Vérifier le Load Balancer

**Problème potentiel** : Le Load Balancer n'est peut-être pas activé.

**Vérification** :

```bash
# Vérifier si le Load Balancer est activé dans Terraform
cd infra/aws
grep "enable_load_balancer" terraform.tfvars
```

**Statut actuel** : ⚠️ **Désactivé par défaut** (`enable_load_balancer = false`)

**Options** :
1. **Activer le Load Balancer** (Recommandé pour production)
2. **Utiliser l'IP publique directe** (Temporaire, IP change à chaque redéploiement)

---

### 6. 🔍 Vérifier CORS

**Problème potentiel** : CORS peut bloquer les requêtes mobiles.

**Vérification** :

```bash
# Vérifier la variable ALLOWED_ORIGINS dans la Task Definition
aws ecs describe-task-definition \
  --task-definition yukpo-backend \
  --region eu-west-1 \
  --query 'taskDefinition.containerDefinitions[0].environment[?name==`ALLOWED_ORIGINS`]' \
  --output json
```

**Configuration requise** :
- ✅ `ALLOWED_ORIGINS` doit inclure les origines mobiles ou `*` (moins sécurisé)
- ✅ Pour les apps mobiles, le backend utilise la première origine autorisée par défaut (voir `backend/src/middlewares/cors.rs` ligne 99-109)

**Action requise** : Si `ALLOWED_ORIGINS` n'est pas configuré, l'ajouter dans la Task Definition.

---

### 7. 🔍 Vérifier l'Accessibilité du Backend

**Test de connectivité** :

```bash
# Test HTTP direct (si IP publique connue)
curl -v http://52.211.202.11:8080/health

# Test via DNS (si DNS configuré)
curl -v https://api.yukpomnang.com/health
```

**Résultat attendu** : Réponse HTTP 200 avec `{"status":"ok"}`

**Si erreur** :
- ❌ `Connection refused` → Security Group bloque le trafic
- ❌ `Connection timeout` → Backend non accessible ou IP incorrecte
- ❌ `DNS resolution failed` → DNS non configuré

---

## 🎯 SOLUTIONS PAR PROBLÈME

### Solution 1 : DNS Non Configuré ou IP Incorrecte

**Problème** : `api.yukpomnang.com` ne pointe pas vers la bonne IP.

**Solution** :

1. **Récupérer l'IP publique actuelle** :
   ```bash
   # Voir section 3 ci-dessus
   ```

2. **Mettre à jour Cloudflare** :
   - Aller sur https://dash.cloudflare.com
   - Sélectionner `yukpomnang.com`
   - DNS → Enregistrements
   - Modifier l'enregistrement A pour `api`
   - Mettre à jour l'IP avec l'IP actuelle
   - **⚠️ Désactiver le proxy** (nuage gris, pas orange)

---

### Solution 2 : Security Groups Bloquent le Trafic

**Problème** : Les Security Groups ne permettent pas le trafic entrant sur le port 8080.

**Solution** :

1. **Récupérer le Security Group ID** :
   ```bash
   SG_ID=$(aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]' --output text)
   ```

2. **Ajouter la règle** :
   ```bash
   aws ec2 authorize-security-group-ingress \
     --group-id "$SG_ID" \
     --protocol tcp \
     --port 8080 \
     --cidr 0.0.0.0/0 \
     --region eu-west-1
   ```

---

### Solution 3 : Activer le Load Balancer (Recommandé)

**Problème** : Pas de Load Balancer, IP change à chaque redéploiement.

**Solution** :

1. **Activer dans Terraform** :
   ```bash
   cd infra/aws
   # Éditer terraform.tfvars
   enable_load_balancer = true
   ```

2. **Appliquer Terraform** :
   ```bash
   terraform plan
   terraform apply
   ```

3. **Récupérer l'URL du Load Balancer** :
   ```bash
   terraform output alb_dns_name
   ```

4. **Mettre à jour le DNS** :
   - Cloudflare : Modifier l'enregistrement A pour `api` → Pointer vers l'URL du Load Balancer
   - OU Route53 : Créer un alias vers le Load Balancer

---

### Solution 4 : Configurer CORS

**Problème** : CORS bloque les requêtes mobiles.

**Solution** :

1. **Ajouter ALLOWED_ORIGINS dans la Task Definition** :
   - AWS Console → ECS → Définitions de tâches → yukpo-backend
   - Créer une nouvelle révision
   - Variables d'environnement → Ajouter :
     ```
     ALLOWED_ORIGINS=*
     ```
     OU (plus sécurisé) :
     ```
     ALLOWED_ORIGINS=https://api.yukpomnang.com,capacitor://localhost,ionic://localhost
     ```

2. **Mettre à jour le service** :
   - Utiliser la nouvelle révision de la Task Definition

---

## 📊 COMMANDES DE DIAGNOSTIC RAPIDE

**Copier-coller pour diagnostic complet** :

```bash
# 1. Vérifier DNS
echo "=== DNS ==="
nslookup api.yukpomnang.com

# 2. Vérifier IP publique ECS
echo "=== IP Publique ECS ==="
TASK_ARN=$(aws ecs list-tasks --cluster yukpo-cluster --service-name yukpo-backend-service --region eu-west-1 --query 'taskArns[0]' --output text)
if [ -n "$TASK_ARN" ]; then
  ENI_ID=$(aws ecs describe-tasks --cluster yukpo-cluster --tasks "$TASK_ARN" --region eu-west-1 --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text)
  aws ec2 describe-network-interfaces --network-interface-ids "$ENI_ID" --region eu-west-1 --query 'NetworkInterfaces[0].Association.PublicIp' --output text
fi

# 3. Vérifier Security Groups
echo "=== Security Groups ==="
SG_ID=$(aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]' --output text)
aws ec2 describe-security-groups --group-ids "$SG_ID" --region eu-west-1 --query 'SecurityGroups[0].{GroupId:GroupId,IpPermissions:IpPermissions}' --output json

# 4. Tester connectivité
echo "=== Test Connectivité ==="
curl -v http://api.yukpomnang.com/health 2>&1 | head -20
```

---

## ✅ PROCHAINES ÉTAPES

1. ✅ **Exécuter les commandes de diagnostic** ci-dessus
2. ✅ **Identifier le problème** (DNS, Security Groups, CORS, etc.)
3. ✅ **Appliquer la solution** correspondante
4. ✅ **Tester** depuis l'application mobile

---

**Date** : 2026-02-14  
**Statut** : 🔍 Diagnostic en cours

