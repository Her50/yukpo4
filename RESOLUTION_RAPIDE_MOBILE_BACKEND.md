# ⚡ Résolution Rapide : Mobile → Backend

**Problème** : L'application mobile n'arrive pas à se connecter au backend

---

## 🎯 SOLUTION RAPIDE (3 Étapes)

### Étape 1 : Vérifier le DNS

**Commande** :
```bash
nslookup api.yukpomnang.com
```

**Si le DNS ne résout pas** :
1. Aller sur https://dash.cloudflare.com
2. Sélectionner `yukpomnang.com`
3. DNS → Enregistrements
4. Vérifier/Créer l'enregistrement A pour `api`
5. Mettre l'IP publique du backend ECS (voir Étape 2)
6. **⚠️ Désactiver le proxy** (nuage gris)

---

### Étape 2 : Récupérer l'IP Publique du Backend

**Commande** :
```bash
TASK_ARN=$(aws ecs list-tasks --cluster yukpo-cluster --service-name yukpo-backend-service --region eu-west-1 --query 'taskArns[0]' --output text)
ENI_ID=$(aws ecs describe-tasks --cluster yukpo-cluster --tasks "$TASK_ARN" --region eu-west-1 --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text)
PUBLIC_IP=$(aws ec2 describe-network-interfaces --network-interface-ids "$ENI_ID" --region eu-west-1 --query 'NetworkInterfaces[0].Association.PublicIp' --output text)
echo "IP Publique: $PUBLIC_IP"
```

**Action** : Mettre à jour le DNS Cloudflare avec cette IP (voir Étape 1)

---

### Étape 3 : Configurer CORS

**Dans AWS Console** :
1. ECS → Définitions de tâches → `yukpo-backend`
2. Cliquer sur la dernière révision
3. Créer une nouvelle révision
4. Container Definitions → Cliquer sur le conteneur
5. Variables d'environnement → Ajouter :
   ```
   Nom: ALLOWED_ORIGINS
   Valeur: *
   ```
6. Créer la révision
7. Mettre à jour le service avec la nouvelle révision

---

## 🔍 TEST RAPIDE

**Commande** :
```bash
curl -v https://api.yukpomnang.com/health
```

**Résultat attendu** :
```
HTTP/2 200
{"status":"ok"}
```

**Si erreur** :
- ❌ `Connection timeout` → Vérifier Security Groups
- ❌ `DNS resolution failed` → Vérifier DNS Cloudflare
- ❌ `CORS error` → Vérifier ALLOWED_ORIGINS

---

## 📋 CHECKLIST RAPIDE

- [ ] DNS `api.yukpomnang.com` résout vers l'IP publique du backend
- [ ] Security Group autorise le trafic sur le port 8080 depuis `0.0.0.0/0`
- [ ] Variable `ALLOWED_ORIGINS` est configurée dans la Task Definition
- [ ] Test `curl https://api.yukpomnang.com/health` retourne 200 OK
- [ ] Application mobile peut se connecter

---

## 🚨 PROBLÈMES COURANTS

### Problème 1 : DNS Non Configuré

**Symptôme** : `nslookup api.yukpomnang.com` retourne `NXDOMAIN`

**Solution** : Configurer le DNS Cloudflare (Étape 1)

---

### Problème 2 : IP Incorrecte

**Symptôme** : DNS résout vers une ancienne IP

**Solution** : Mettre à jour le DNS avec l'IP actuelle (Étape 2)

---

### Problème 3 : CORS Bloque

**Symptôme** : Erreur CORS dans les logs du backend

**Solution** : Configurer ALLOWED_ORIGINS (Étape 3)

---

### Problème 4 : Security Group Bloque

**Symptôme** : `Connection timeout` ou `Connection refused`

**Solution** : Vérifier que le Security Group autorise le port 8080

**Vérification** :
```bash
SG_ID=$(aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]' --output text)
aws ec2 describe-security-groups --group-ids "$SG_ID" --region eu-west-1 --query 'SecurityGroups[0].IpPermissions'
```

**Si la règle manque** :
```bash
aws ec2 authorize-security-group-ingress \
  --group-id "$SG_ID" \
  --protocol tcp \
  --port 8080 \
  --cidr 0.0.0.0/0 \
  --region eu-west-1
```

---

## ✅ VÉRIFICATION FINALE

**Test depuis l'application mobile** :
1. Ouvrir l'application mobile
2. Tenter une connexion/requête API
3. Vérifier les logs du backend (CloudWatch)
4. Vérifier les logs de l'application mobile

**Si tout fonctionne** :
- ✅ DNS résout correctement
- ✅ Backend accessible
- ✅ CORS configuré
- ✅ Application mobile connectée

---

**Date** : 2026-02-14  
**Statut** : ⚡ Guide de résolution rapide



