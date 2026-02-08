# 🔍 Diagnostic Erreur 522 - Backend Non Répondant

**Date** : 2026-02-07  
**Erreur** : Cloudflare Error 522 - Connection timeout  
**Domaine** : `yukpomnang.com`

## 📋 Analyse de l'Erreur 522

### Qu'est-ce que l'erreur 522 ?

L'erreur **522** de Cloudflare signifie :
- ✅ **Cloudflare fonctionne** (réseau et DNS OK)
- ✅ **Votre navigateur fonctionne** (connexion OK)
- ❌ **Le serveur backend ne répond pas** (timeout de connexion)

### Architecture Actuelle

```
Utilisateur Mobile
       ↓
   Internet
       ↓
Cloudflare DNS (gestion DNS)
       ↓
   yukpomnang.com → Résout vers → ALB AWS
       ↓
   AWS ALB (Application Load Balancer)
       ↓
   ECS Tasks (Backend Rust) ← ❌ PROBLÈME ICI
```

## 🔍 Causes Possibles

### 1. **Serveur Backend AWS ECS Arrêté** ⚠️ CRITIQUE

**Symptômes** :
- Aucune tâche ECS en cours d'exécution
- Service ECS arrêté ou en erreur
- Pas de conteneurs actifs

**Vérification** :
```bash
# Vérifier l'état du service ECS
aws ecs describe-services \
  --cluster yukpomnang-cluster \
  --services yukpomnang-backend-service \
  --region us-east-1

# Vérifier les tâches en cours
aws ecs list-tasks \
  --cluster yukpomnang-cluster \
  --service-name yukpomnang-backend-service \
  --region us-east-1
```

**Solution** :
- Redémarrer le service ECS
- Vérifier les logs CloudWatch pour identifier l'erreur
- Vérifier que le nombre de tâches désirées > 0

---

### 2. **Problème de Configuration Cloudflare Proxy** ⚠️

**Symptômes** :
- Proxy Cloudflare activé (nuage orange) pour l'API
- Timeout lors de la connexion au backend

**Vérification** :
1. Aller dans **Cloudflare Dashboard** → **DNS**
2. Chercher l'enregistrement pour `yukpomnang.com` ou `api.yukpomnang.com`
3. Vérifier si le **proxy est activé** (nuage orange)

**Solution** :
- **Désactiver le proxy** (nuage gris) pour les enregistrements API
- Le proxy Cloudflare peut causer des timeouts avec AWS ALB
- Configuration recommandée :
  - `api.yukpomnang.com` → **Proxy OFF** (nuage gris)
  - `yukpomnang.com` → **Proxy ON** (nuage orange) si nécessaire

---

### 3. **Problème de Security Group AWS** ⚠️

**Symptômes** :
- Les Security Groups bloquent les connexions depuis Cloudflare
- Seules certaines IPs peuvent se connecter

**Vérification** :
```bash
# Vérifier les Security Groups du ALB
aws elbv2 describe-load-balancers \
  --region us-east-1 \
  --query 'LoadBalancers[?LoadBalancerName==`yukpomnang-backend-alb`]'

# Vérifier les règles du Security Group
aws ec2 describe-security-groups \
  --group-ids sg-xxxxxxxxx \
  --region us-east-1
```

**Solution** :
- Autoriser le trafic HTTPS (443) depuis **0.0.0.0/0** (toutes les IPs)
- OU autoriser les IPs Cloudflare spécifiques
- Vérifier que le Security Group du ALB autorise le trafic entrant

---

### 4. **Problème de Health Check ALB** ⚠️

**Symptômes** :
- Les health checks échouent
- Aucune cible saine dans le Target Group
- Les tâches ECS démarrent mais sont marquées comme malsaines

**Vérification** :
```bash
# Vérifier l'état des targets
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:ACCOUNT:targetgroup/... \
  --region us-east-1
```

**Solution** :
- Vérifier que l'endpoint `/health` ou `/api/health` répond correctement
- Vérifier la configuration du health check dans le Target Group
- Vérifier que le port 8080 est accessible depuis l'ALB

---

### 5. **Problème de Timeout Cloudflare** ⚠️

**Symptômes** :
- Le backend répond mais trop lentement
- Timeout après 100 secondes (défaut Cloudflare)

**Vérification** :
- Vérifier les logs CloudWatch pour voir les temps de réponse
- Vérifier si certaines requêtes prennent trop de temps

**Solution** :
- Augmenter le timeout Cloudflare (si proxy activé)
- OU optimiser les requêtes backend lentes
- OU désactiver le proxy Cloudflare pour l'API

---

### 6. **Problème de Configuration ALB** ⚠️

**Symptômes** :
- L'ALB ne route pas correctement vers les tâches ECS
- Les listeners ne sont pas configurés correctement

**Vérification** :
```bash
# Vérifier les listeners de l'ALB
aws elbv2 describe-listeners \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --region us-east-1

# Vérifier les règles de routage
aws elbv2 describe-rules \
  --listener-arn arn:aws:elasticloadbalancing:... \
  --region us-east-1
```

**Solution** :
- Vérifier que les listeners HTTPS (443) sont configurés
- Vérifier que les règles pointent vers le bon Target Group
- Vérifier que le certificat SSL est valide

---

## 🚀 Actions Immédiates à Effectuer

### Étape 1 : Vérifier l'État du Service ECS

1. **Aller dans AWS Console** → **ECS** → **Clusters**
2. **Sélectionner** `yukpomnang-cluster`
3. **Onglet Services** → Vérifier `yukpomnang-backend-service`
4. **Vérifier** :
   - ✅ **Running count** > 0
   - ✅ **Desired count** > 0
   - ✅ **Status** = ACTIVE
   - ✅ **Tasks** = En cours d'exécution

**Si le service est arrêté** :
- Cliquer sur **Update Service**
- Vérifier que **Desired count** = 1 ou plus
- Cliquer sur **Update**

---

### Étape 2 : Vérifier les Logs CloudWatch

1. **Aller dans AWS Console** → **CloudWatch** → **Log Groups**
2. **Chercher** `/ecs/yukpomnang-backend` ou similaire
3. **Vérifier les logs récents** pour identifier les erreurs

**Erreurs courantes** :
- ❌ Erreur de connexion à la base de données
- ❌ Variables d'environnement manquantes
- ❌ Port 8080 non accessible
- ❌ Erreur de démarrage de l'application

---

### Étape 3 : Vérifier la Configuration Cloudflare

1. **Aller dans Cloudflare Dashboard** → **DNS**
2. **Chercher** l'enregistrement pour `yukpomnang.com`
3. **Vérifier** :
   - Si **Proxy est activé** (nuage orange) → **DÉSACTIVER** (nuage gris)
   - Si l'enregistrement pointe vers le bon ALB AWS
   - Si le type est correct (CNAME ou A)

**Configuration recommandée** :
```
Type: CNAME
Name: yukpomnang.com (ou api.yukpomnang.com)
Target: yukpomnang-backend-alb-xxxxx.us-east-1.elb.amazonaws.com
Proxy: OFF (nuage gris) ⚠️ IMPORTANT
TTL: Auto
```

---

### Étape 4 : Vérifier les Security Groups

1. **Aller dans AWS Console** → **EC2** → **Load Balancers**
2. **Sélectionner** l'ALB `yukpomnang-backend-alb`
3. **Onglet Security** → Vérifier le Security Group
4. **Vérifier les règles entrantes** :
   - ✅ Port 443 (HTTPS) depuis 0.0.0.0/0
   - ✅ Port 80 (HTTP) depuis 0.0.0.0/0 (si redirection)

---

### Étape 5 : Tester la Connexion Directe

**Tester sans passer par Cloudflare** :

```bash
# Récupérer l'URL de l'ALB
ALB_URL="yukpomnang-backend-alb-xxxxx.us-east-1.elb.amazonaws.com"

# Tester le health check
curl -v https://$ALB_URL/api/health

# Tester un endpoint API
curl -v https://$ALB_URL/api/ping
```

**Si ça fonctionne directement** :
- ✅ Le problème vient de Cloudflare
- Solution : Désactiver le proxy Cloudflare

**Si ça ne fonctionne pas** :
- ❌ Le problème vient d'AWS (ECS, ALB, Security Group)
- Solution : Vérifier les étapes 1-4

---

## 📊 Checklist de Diagnostic

- [ ] Service ECS en cours d'exécution (Running count > 0)
- [ ] Tâches ECS actives et saines
- [ ] Logs CloudWatch sans erreurs critiques
- [ ] Proxy Cloudflare **DÉSACTIVÉ** pour l'API (nuage gris)
- [ ] Security Group autorise le trafic HTTPS (443)
- [ ] Target Group a des targets sains
- [ ] Health check répond correctement
- [ ] Certificat SSL valide sur l'ALB
- [ ] ALB accessible directement (sans Cloudflare)

---

## 🔧 Solutions Rapides

### Solution 1 : Redémarrer le Service ECS

```bash
aws ecs update-service \
  --cluster yukpomnang-cluster \
  --service yukpomnang-backend-service \
  --force-new-deployment \
  --region us-east-1
```

### Solution 2 : Désactiver le Proxy Cloudflare

1. Cloudflare Dashboard → DNS
2. Trouver l'enregistrement `yukpomnang.com`
3. Cliquer sur le **nuage orange** pour le désactiver (nuage gris)

### Solution 3 : Vérifier et Corriger les Security Groups

```bash
# Autoriser HTTPS depuis partout
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0 \
  --region us-east-1
```

---

## 📝 Notes Importantes

1. **Proxy Cloudflare et AWS ALB** :
   - Le proxy Cloudflare peut causer des problèmes avec AWS ALB
   - **Recommandation** : Désactiver le proxy pour les enregistrements API
   - Le proxy est utile pour le CDN mais pas pour l'API

2. **Health Checks** :
   - L'ALB vérifie régulièrement la santé des tâches ECS
   - Si les health checks échouent, les tâches sont retirées du pool
   - Vérifier que `/api/health` répond correctement

3. **Timeouts** :
   - Cloudflare a un timeout par défaut de 100 secondes
   - Si le backend prend plus de temps, augmenter le timeout OU désactiver le proxy

---

## 🎯 Prochaines Étapes

1. **Effectuer les vérifications** ci-dessus dans l'ordre
2. **Identifier la cause** du problème
3. **Appliquer la solution** correspondante
4. **Tester** que le backend répond correctement
5. **Vérifier** que les liens partagés fonctionnent

---

**Date de création** : 2026-02-07  
**Statut** : ⚠️ Diagnostic en cours



