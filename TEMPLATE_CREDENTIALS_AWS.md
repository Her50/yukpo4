# 📝 Template : Credentials AWS - Nouveau Compte

**⚠️ NE PAS COMMITER CE FICHIER** - Remplissez-le et copiez-collez le contenu dans le chat

---

## 🔐 Informations AWS (PUBLIQUES - Sûres à partager)

**✅ Ces informations sont PUBLIQUES et peuvent être partagées sans risque :**

```
AWS_ACCOUNT_ID: [VOTRE_ACCOUNT_ID_12_CHIFFRES]
AWS_REGION: [af-south-1 OU eu-west-1 OU us-east-1]
```

---

## 🔒 Secrets AWS (PRIVÉS - À configurer VOUS-MÊME)

**⚠️ NE ME DONNEZ PAS CES INFORMATIONS !**

**Configurez-les directement dans GitHub Secrets :**
- `AWS_ACCESS_KEY_ID` → GitHub Secrets
- `AWS_SECRET_ACCESS_KEY` → GitHub Secrets

**Voir :** `SECURITE_CREDENTIALS_AWS.md` pour les instructions détaillées.

---

## 🏗️ Configuration Infrastructure

```
PROJECT_NAME: yukpomnang
ENVIRONMENT: production

# RDS PostgreSQL
RDS_INSTANCE_CLASS: db.t3.medium
RDS_STORAGE: 20
RDS_MAX_STORAGE: 100
RDS_PASSWORD: [MOT_DE_PASSE_FORT_16+_CARACTÈRES]

# ElastiCache Redis
REDIS_NODE_TYPE: cache.t3.small

# ECS Fargate
ECS_CPU: 1024
ECS_MEMORY: 2048
ECS_MIN_COUNT: 2
ECS_MAX_COUNT: 10

# JWT
JWT_SECRET: [SECRET_GÉNÉRÉ_AVEC_OPENSSL_RAND_BASE64_64]
```

---

## 📋 Instructions

### Étape 1 : Me donner les informations publiques
1. **Remplissez** les valeurs entre `[...]` dans la section "PUBLIQUES"
2. **Copiez** seulement la section publique
3. **Collez** dans le chat avec moi

### Étape 2 : Configurer les secrets vous-même
4. **Créez** un utilisateur IAM avec permissions limitées
5. **Ajoutez** `AWS_ACCESS_KEY_ID` dans GitHub Secrets
6. **Ajoutez** `AWS_SECRET_ACCESS_KEY` dans GitHub Secrets
7. **Générez** `RDS_PASSWORD` et stockez-le dans AWS Secrets Manager
8. **Générez** `JWT_SECRET` et stockez-le dans AWS Secrets Manager

**Voir :** `SECURITE_CREDENTIALS_AWS.md` pour les instructions détaillées.

---

## 💡 Valeurs Recommandées

### Pour l'Afrique (latence optimale) :
- `AWS_REGION: af-south-1` (Cape Town)

### Pour économies (prix bas) :
- `AWS_REGION: us-east-1` (Virginie)
- `RDS_INSTANCE_CLASS: db.t3.medium`
- `REDIS_NODE_TYPE: cache.t3.small`
- `ECS_CPU: 1024` (1 vCPU)
- `ECS_MEMORY: 2048` (2 GB)

### Pour performance (plus de trafic) :
- `RDS_INSTANCE_CLASS: db.t3.large`
- `REDIS_NODE_TYPE: cache.t3.medium`
- `ECS_CPU: 2048` (2 vCPU)
- `ECS_MEMORY: 4096` (4 GB)

