# 🔍 Diagnostic Complet : Connexion Mobile → Backend AWS → PostgreSQL

## 📋 Vue d'Ensemble du Problème

**Symptôme** : L'application mobile ne peut pas créer de compte, même une simple inscription échoue.

**Chaîne de connexion à vérifier** :
1. **Mobile** → **Backend AWS (ALB)** → **ECS/Fargate** → **PostgreSQL RDS**

---

## 🔍 1. Vérification Mobile → Backend AWS

### 1.1 Configuration Mobile

**Fichiers de configuration** :
- `mobile/eas.json` : ✅ Pointe vers AWS
- `mobile/src/config/api.config.ts` : Utilise `EXPO_PUBLIC_API_URL`
- `mobile/src/config/environment.ts` : Utilise `EXPO_PUBLIC_API_URL`

**URL Backend configurée** :
```
https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com
```

### 1.2 Endpoints Utilisés

**Endpoint d'inscription** : `/api/auth/register` (après corrections)

**URL complète attendue** :
```
POST https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/auth/register
```

### 1.3 Vérifications à Faire

#### ✅ Test 1 : Vérifier que l'ALB est accessible

```bash
# Depuis votre machine locale
curl -v https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/health

# Résultat attendu : 200 OK avec {"status":"ok"}
```

**Si échec** :
- ❌ ALB non accessible depuis Internet
- ❌ Security Groups bloquent le trafic
- ❌ ALB mal configuré

#### ✅ Test 2 : Vérifier l'endpoint d'inscription

```bash
curl -X POST https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!","nom":"Test","prenom":"User"}'

# Résultat attendu : 201 Created avec token JWT
```

**Si échec** :
- ❌ Route `/api/auth/register` n'existe pas (404)
- ❌ Backend ne démarre pas correctement
- ❌ Erreur de base de données (500)

---

## 🔍 2. Vérification Backend AWS → PostgreSQL RDS

### 2.1 Configuration Backend

**Fichier** : `backend/src/main.rs`

**Variables d'environnement requises** :
- `DATABASE_URL` : URL de connexion PostgreSQL
- `PORT` : Port d'écoute (défaut: 8080)
- `HOST` : Host d'écoute (défaut: 0.0.0.0)

**Format DATABASE_URL attendu** :
```
postgresql://username:password@host:5432/database?sslmode=require
```

### 2.2 Vérifications à Faire

#### ✅ Test 3 : Vérifier que le backend démarre

**Dans les logs CloudWatch** :
```
✅ Serveur lance sur http://0.0.0.0:8080
✅ Connexion PostgreSQL établie
✅ [MIGRATION CORRECTION 007] Table users garantie d'exister
✅ [MIGRATION CORRECTION 008] Tables services et media garanties d'exister
```

**Si échec** :
- ❌ `DATABASE_URL` manquante ou invalide
- ❌ Connexion PostgreSQL échoue
- ❌ Migrations échouent

#### ✅ Test 4 : Vérifier la connexion PostgreSQL

**Dans les logs CloudWatch** :
```
✅ Connexion PostgreSQL établie (pool: max=100, min=10, acquire_timeout=30s)
```

**Si échec** :
- ❌ `DATABASE_URL` incorrecte
- ❌ Security Groups RDS bloquent le trafic depuis ECS
- ❌ RDS dans un VPC différent
- ❌ Credentials incorrects

#### ✅ Test 5 : Vérifier que les tables existent

**Requête SQL** (depuis ECS ou EC2 dans le même VPC) :
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'services', 'media');
```

**Résultat attendu** : 3 lignes (users, services, media)

**Si échec** :
- ❌ Migrations non appliquées
- ❌ Tables non créées

---

## 🔍 3. Problèmes Potentiels Identifiés

### 3.1 Problème 1 : Endpoints Incorrects

**Symptôme** : 404 Not Found sur `/api/auth/register`

**Cause** : Le mobile utilise peut-être `/auth/register` au lieu de `/api/auth/register`

**Solution** : Vérifier `mobile/src/services/api.ts` ligne ~714

### 3.2 Problème 2 : ALB Non Accessible

**Symptôme** : `Network request failed`, `ECONNREFUSED`, Timeout

**Causes possibles** :
- Security Groups ALB bloquent le trafic HTTPS (443)
- ALB non configuré pour accepter le trafic Internet
- Target Group ne pointe pas vers les bonnes instances ECS

**Solution** : Vérifier dans AWS Console :
- ALB Security Group : Autoriser HTTPS (443) depuis 0.0.0.0/0
- Target Group : Vérifier que les instances ECS sont healthy
- Listener ALB : Vérifier que le listener HTTPS est configuré

### 3.3 Problème 3 : Backend Ne Démarre Pas

**Symptôme** : Pas de logs dans CloudWatch, ou erreurs de démarrage

**Causes possibles** :
- `DATABASE_URL` manquante dans ECS Task Definition
- Connexion PostgreSQL échoue
- Migrations échouent et bloquent le démarrage

**Solution** : Vérifier les logs CloudWatch du service ECS

### 3.4 Problème 4 : Base de Données Non Accessible

**Symptôme** : Erreurs "connection refused" ou "timeout" dans les logs

**Causes possibles** :
- Security Groups RDS bloquent le trafic depuis ECS
- RDS dans un VPC différent
- `DATABASE_URL` pointe vers le mauvais endpoint

**Solution** : Vérifier dans AWS Console :
- RDS Security Group : Autoriser PostgreSQL (5432) depuis le Security Group ECS
- VPC : Vérifier que RDS et ECS sont dans le même VPC
- Endpoint RDS : Vérifier que `DATABASE_URL` utilise le bon endpoint

### 3.5 Problème 5 : Tables Non Créées

**Symptôme** : Erreur "relation 'users' does not exist" lors de l'inscription

**Cause** : Migrations non appliquées ou échouées

**Solution** : Vérifier les logs de migration dans CloudWatch

---

## 🔧 4. Plan d'Action de Diagnostic

### Étape 1 : Tester l'ALB depuis Internet

```bash
# Test health check
curl -v https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/health

# Test endpoint d'inscription
curl -X POST https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!","nom":"Test","prenom":"User"}'
```

### Étape 2 : Vérifier les Logs CloudWatch

**Service** : ECS Task → Logs CloudWatch

**Chercher** :
- ✅ "Serveur lance sur http://0.0.0.0:8080"
- ✅ "Connexion PostgreSQL établie"
- ✅ "[MIGRATION CORRECTION 007] Table users garantie d'exister"
- ❌ Erreurs de connexion PostgreSQL
- ❌ Erreurs de migration

### Étape 3 : Vérifier la Configuration ECS

**Dans AWS Console** :
1. ECS → Clusters → Votre cluster
2. Services → Votre service
3. Task Definition → Vérifier les variables d'environnement :
   - `DATABASE_URL` : Doit pointer vers RDS
   - `PORT` : Doit être 8080
   - `HOST` : Doit être 0.0.0.0

### Étape 4 : Vérifier les Security Groups

**ALB Security Group** :
- Inbound : HTTPS (443) depuis 0.0.0.0/0
- Outbound : All traffic

**ECS Security Group** :
- Inbound : HTTP (8080) depuis ALB Security Group
- Outbound : PostgreSQL (5432) vers RDS Security Group

**RDS Security Group** :
- Inbound : PostgreSQL (5432) depuis ECS Security Group
- Outbound : All traffic

### Étape 5 : Vérifier la Base de Données

**Depuis ECS Task (via AWS Systems Manager)** :
```bash
# Se connecter à la task ECS
aws ecs execute-command --cluster <cluster-name> --task <task-id> --container <container-name> --command "/bin/bash" --interactive

# Tester la connexion PostgreSQL
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

---

## 📊 5. Checklist de Vérification

### Mobile
- [ ] `EXPO_PUBLIC_API_URL` pointe vers AWS ALB
- [ ] Endpoints utilisent `/api/auth/register` (pas `/auth/register`)
- [ ] Build mobile utilise les bonnes variables d'environnement

### ALB
- [ ] ALB est accessible depuis Internet (test curl)
- [ ] Listener HTTPS (443) est configuré
- [ ] Target Group pointe vers ECS service
- [ ] Health checks passent (targets healthy)

### ECS
- [ ] Service ECS est running
- [ ] Tasks sont running (pas stopped)
- [ ] Variables d'environnement sont correctes (`DATABASE_URL`, `PORT`, `HOST`)
- [ ] Logs CloudWatch montrent que le backend démarre

### RDS
- [ ] RDS instance est available
- [ ] Endpoint RDS est correct dans `DATABASE_URL`
- [ ] Security Group autorise PostgreSQL depuis ECS
- [ ] Tables `users`, `services`, `media` existent

### Backend
- [ ] Backend écoute sur `0.0.0.0:8080`
- [ ] Routes `/api/auth/register` est montée
- [ ] Connexion PostgreSQL réussit
- [ ] Migrations sont appliquées

---

## 🎯 6. Actions Immédiates

1. **Tester l'ALB** : `curl https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/health`
2. **Vérifier les logs CloudWatch** : Chercher les erreurs de démarrage
3. **Vérifier les Security Groups** : S'assurer que le trafic peut circuler
4. **Tester l'endpoint d'inscription** : `curl -X POST .../api/auth/register`
5. **Vérifier la base de données** : S'assurer que les tables existent

---

**Date** : 2026-01-30  
**Statut** : Diagnostic en cours

