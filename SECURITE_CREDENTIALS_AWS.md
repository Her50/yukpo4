# 🔐 Sécurité : Credentials AWS - Bonnes Pratiques

## ⚠️ Préoccupation Légitime

Vous avez raison de vous préoccuper de la sécurité. Voici les meilleures pratiques et alternatives.

---

## ✅ Recommandations de Sécurité

### 1. **NE JAMAIS utiliser le compte root AWS**

❌ **À éviter :**
- Credentials du compte root AWS
- Accès complet à tous les services

✅ **À faire :**
- Créer un **utilisateur IAM dédié** avec permissions limitées
- Utiliser le **principe du moindre privilège**

---

### 2. **Créer un Utilisateur IAM avec Permissions Minimales**

**Étapes sécurisées :**

1. **Créer un utilisateur IAM dédié** :
   - Nom : `github-actions-yukpomnang` (ou similaire)
   - **UNIQUEMENT** "Programmatic access" (pas de console)

2. **Attacher UNIQUEMENT les permissions nécessaires** :
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "ecr:*",
           "ecs:*",
           "ssm:GetParameter",
           "ssm:PutParameter",
           "rds:DescribeDBInstances",
           "elasticache:DescribeCacheClusters",
           "logs:CreateLogGroup",
           "logs:CreateLogStream",
           "logs:PutLogEvents"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

3. **Limiter par ressource** (encore mieux) :
   ```json
   {
     "Effect": "Allow",
     "Action": ["ecr:*"],
     "Resource": "arn:aws:ecr:REGION:ACCOUNT_ID:repository/yukpomnang-backend"
   }
   ```

---

### 3. **Alternatives Plus Sécurisées**

#### Option A : Me donner seulement les IDs (sans secrets)

**Ce que vous pouvez me donner SANS RISQUE :**
- ✅ `AWS_ACCOUNT_ID` (public, pas de secret)
- ✅ `AWS_REGION` (public, pas de secret)
- ✅ Configuration infrastructure (pas de secrets)

**Ce que vous devez configurer VOUS-MÊME :**
- ⚠️ `AWS_ACCESS_KEY_ID` → Directement dans GitHub Secrets
- ⚠️ `AWS_SECRET_ACCESS_KEY` → Directement dans GitHub Secrets

**Avantage :** Je ne vois jamais vos credentials secrets.

---

#### Option B : Utiliser AWS IAM Roles (Plus Sécurisé)

**Pour GitHub Actions, utilisez OIDC (OpenID Connect) :**

1. **Créer un IAM Role** (pas d'utilisateur avec credentials)
2. **Configurer GitHub OIDC Provider** dans AWS
3. **GitHub Actions s'authentifie directement** via OIDC

**Avantage :** Pas de credentials statiques, authentification temporaire.

**Guide :** https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services

---

#### Option C : Utiliser AWS Secrets Manager

1. **Stocker les credentials** dans AWS Secrets Manager
2. **Me donner seulement** le nom du secret
3. **GitHub Actions récupère** les credentials depuis Secrets Manager

**Avantage :** Rotation automatique possible, audit trail.

---

## 🎯 Recommandation pour Votre Cas

### Approche Hybride (Recommandée)

**Étape 1 : Me donner (SANS RISQUE)**
```
AWS_ACCOUNT_ID: 123456789012
AWS_REGION: af-south-1
PROJECT_NAME: yukpomnang
ENVIRONMENT: production
RDS_INSTANCE_CLASS: db.t3.medium
RDS_STORAGE: 20
RDS_MAX_STORAGE: 100
REDIS_NODE_TYPE: cache.t3.small
ECS_CPU: 1024
ECS_MEMORY: 2048
ECS_MIN_COUNT: 2
ECS_MAX_COUNT: 10
```

**Étape 2 : Vous configurez VOUS-MÊME (Sécurisé)**
- Créer l'utilisateur IAM avec permissions limitées
- Ajouter `AWS_ACCESS_KEY_ID` dans GitHub Secrets
- Ajouter `AWS_SECRET_ACCESS_KEY` dans GitHub Secrets
- Générer `RDS_PASSWORD` et le stocker dans AWS Secrets Manager
- Générer `JWT_SECRET` et le stocker dans AWS Secrets Manager

**Étape 3 : Je mets à jour les fichiers**
- Je mets à jour les fichiers de configuration avec les valeurs publiques
- Les secrets restent dans GitHub Secrets / AWS Secrets Manager

---

## 🔒 Protection Supplémentaire

### 1. **Limiter les Permissions IAM**

Créez une politique IAM qui limite :
- ✅ Seulement la région spécifiée
- ✅ Seulement les ressources créées pour ce projet
- ✅ Pas d'accès à d'autres comptes/services

### 2. **Activer MFA sur le Compte Root**

- ✅ Activer MFA (Multi-Factor Authentication) sur votre compte AWS root
- ✅ Ne jamais utiliser le compte root pour les opérations quotidiennes

### 3. **Activer CloudTrail**

- ✅ Activer AWS CloudTrail pour auditer toutes les actions
- ✅ Recevoir des alertes en cas d'activité suspecte

### 4. **Rotation des Credentials**

- ✅ Changer les credentials régulièrement (tous les 90 jours)
- ✅ Utiliser AWS Secrets Manager pour rotation automatique

### 5. **Limiter par IP (si possible)**

- ✅ Ajouter des conditions dans la politique IAM pour limiter par IP
- ⚠️ Note : GitHub Actions utilise des IPs dynamiques, donc limité

---

## 🚨 En Cas de Compromission

### Plan de Réponse Immédiate

1. **Révoquer immédiatement** les credentials compromis :
   ```bash
   aws iam delete-access-key --user-name github-actions-yukpomnang --access-key-id [KEY_ID]
   ```

2. **Vérifier CloudTrail** pour voir quelles actions ont été effectuées

3. **Créer de nouveaux credentials** avec permissions encore plus limitées

4. **Mettre à jour GitHub Secrets** avec les nouveaux credentials

5. **Vérifier** qu'aucune ressource non autorisée n'a été créée

---

## ✅ Ce Que Je Recommande

### Option Recommandée : Approche Hybride

**Vous me donnez :**
- ✅ Informations publiques (Account ID, région, configuration)
- ❌ PAS de secrets (Access Key, Secret Key, passwords)

**Vous configurez :**
- ✅ Secrets directement dans GitHub Secrets
- ✅ Secrets dans AWS Secrets Manager (pour RDS, JWT, etc.)

**Je fais :**
- ✅ Mise à jour des fichiers de configuration
- ✅ Guide pour vous aider à configurer les secrets

**Résultat :** Sécurité maximale, je ne vois jamais vos secrets.

---

## 📋 Checklist de Sécurité

Avant de me donner des informations :

- [ ] Utilisateur IAM créé (pas le compte root)
- [ ] Permissions limitées au strict nécessaire
- [ ] MFA activé sur le compte root
- [ ] CloudTrail activé
- [ ] Secrets stockés dans GitHub Secrets / AWS Secrets Manager
- [ ] Plan de révoquation des credentials en place

---

## 💡 Conclusion

**Vous avez raison d'être prudent !**

**Meilleure approche :**
1. Me donner seulement les informations publiques
2. Configurer les secrets vous-même dans GitHub Secrets
3. Je mets à jour les fichiers de configuration
4. Vous testez et vérifiez que tout fonctionne

**Résultat :** Configuration automatique + Sécurité maximale ✅

---

## ❓ Questions ?

Si vous avez des doutes, je peux :
- Vous guider étape par étape pour créer l'utilisateur IAM
- Vous aider à configurer GitHub Secrets
- Vous expliquer comment limiter les permissions IAM
- Vous montrer comment révoquer les credentials si nécessaire

**Votre sécurité est ma priorité !** 🔒

