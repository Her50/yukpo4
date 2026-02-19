# 📋 Résumé : Application Mobile n'a pas Accès au Backend

**Date** : 2026-02-14  
**Problème** : L'application mobile n'arrive pas à se connecter au backend

---

## 🔍 DIAGNOSTIC

### Configuration Mobile ✅
- **URL API** : `https://api.yukpomnang.com` (correct)
- **Fichier** : `mobile/src/config/api.config.ts`

### Infrastructure Backend ✅
- **Cluster ECS** : `yukpo-cluster`
- **Service ECS** : `yukpo-backend-service`
- **Région** : `eu-west-1`
- **Security Groups** : ✅ Autorise le trafic sur le port 8080 depuis `0.0.0.0/0`
- **Load Balancer** : ⚠️ Désactivé par défaut (pas obligatoire)

---

## 🎯 PROBLÈMES POTENTIELS

### 1. DNS Non Configuré ou IP Incorrecte ⚠️

**Problème** : `api.yukpomnang.com` ne pointe peut-être pas vers la bonne IP.

**Vérification** :
```bash
nslookup api.yukpomnang.com
```

**Solution** : Voir `RESOLUTION_RAPIDE_MOBILE_BACKEND.md` - Étape 1

---

### 2. CORS Non Configuré ⚠️

**Problème** : La variable `ALLOWED_ORIGINS` n'est peut-être pas configurée dans la Task Definition.

**Vérification** :
```bash
aws ecs describe-task-definition --task-definition yukpo-backend --region eu-west-1 --query 'taskDefinition.containerDefinitions[0].environment[?name==`ALLOWED_ORIGINS`]' --output json
```

**Solution** : Voir `RESOLUTION_RAPIDE_MOBILE_BACKEND.md` - Étape 3

---

### 3. IP Publique Changée ⚠️

**Problème** : L'IP publique du backend ECS peut avoir changé après un redéploiement.

**Vérification** :
```bash
TASK_ARN=$(aws ecs list-tasks --cluster yukpo-cluster --service-name yukpo-backend-service --region eu-west-1 --query 'taskArns[0]' --output text)
ENI_ID=$(aws ecs describe-tasks --cluster yukpo-cluster --tasks "$TASK_ARN" --region eu-west-1 --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text)
PUBLIC_IP=$(aws ec2 describe-network-interfaces --network-interface-ids "$ENI_ID" --region eu-west-1 --query 'NetworkInterfaces[0].Association.PublicIp' --output text)
echo "IP Publique: $PUBLIC_IP"
```

**Solution** : Mettre à jour le DNS Cloudflare avec cette IP

---

## 📋 ACTIONS PRIORITAIRES

### Action 1 : Vérifier le DNS (5 minutes)

1. **Vérifier la résolution DNS** :
   ```bash
   nslookup api.yukpomnang.com
   ```

2. **Si le DNS ne résout pas ou pointe vers une mauvaise IP** :
   - Aller sur https://dash.cloudflare.com
   - Sélectionner `yukpomnang.com`
   - DNS → Enregistrements
   - Vérifier/Créer l'enregistrement A pour `api`
   - Mettre l'IP publique actuelle du backend (voir Action 2)
   - **⚠️ Désactiver le proxy** (nuage gris, pas orange)

---

### Action 2 : Récupérer l'IP Publique Actuelle (2 minutes)

```bash
TASK_ARN=$(aws ecs list-tasks --cluster yukpo-cluster --service-name yukpo-backend-service --region eu-west-1 --query 'taskArns[0]' --output text)
ENI_ID=$(aws ecs describe-tasks --cluster yukpo-cluster --tasks "$TASK_ARN" --region eu-west-1 --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text)
PUBLIC_IP=$(aws ec2 describe-network-interfaces --network-interface-ids "$ENI_ID" --region eu-west-1 --query 'NetworkInterfaces[0].Association.PublicIp' --output text)
echo "IP Publique actuelle: $PUBLIC_IP"
```

**Action** : Mettre à jour le DNS Cloudflare avec cette IP

---

### Action 3 : Configurer CORS (5 minutes)

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

### Action 4 : Tester la Connectivité (1 minute)

```bash
curl -v https://api.yukpomnang.com/health
```

**Résultat attendu** :
```
HTTP/2 200
{"status":"ok"}
```

---

## 📚 GUIDES CRÉÉS

1. ✅ **`DIAGNOSTIC_ACCES_MOBILE_BACKEND.md`** - Guide de diagnostic complet
2. ✅ **`COMMANDES_DIAGNOSTIC_MOBILE_BACKEND.md`** - Commandes de diagnostic
3. ✅ **`RESOLUTION_RAPIDE_MOBILE_BACKEND.md`** - Guide de résolution rapide

---

## 🎯 PROCHAINES ÉTAPES

1. ✅ **Exécuter les commandes de diagnostic** (voir `COMMANDES_DIAGNOSTIC_MOBILE_BACKEND.md`)
2. ✅ **Identifier le problème** (DNS, CORS, IP, etc.)
3. ✅ **Appliquer la solution** (voir `RESOLUTION_RAPIDE_MOBILE_BACKEND.md`)
4. ✅ **Tester** depuis l'application mobile

---

**Date** : 2026-02-14  
**Statut** : 🔍 Diagnostic en cours - Guides créés



