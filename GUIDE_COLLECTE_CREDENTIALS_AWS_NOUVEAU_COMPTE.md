# 🔐 Guide : Collecte des Credentials AWS pour Nouveau Compte

## 📋 Informations Nécessaires

Pour configurer automatiquement tout le système avec votre nouveau compte AWS, j'ai besoin des informations suivantes :

---

## ✅ Étape 1 : Informations de Base AWS

### 1.1 AWS Account ID
**Où trouver :**
- AWS Console > En haut à droite (à côté de votre nom d'utilisateur)
- Ou via CLI : `aws sts get-caller-identity --query Account --output text`

**Format :** 12 chiffres (ex: `123456789012`)

**Exemple :**
```
AWS_ACCOUNT_ID: 123456789012
```

---

### 1.2 Région AWS
**Quelle région voulez-vous utiliser ?**

**Recommandations pour l'Afrique :**
- `af-south-1` (Cape Town, Afrique du Sud) - **MEILLEUR pour latence Afrique**
- `eu-west-1` (Irlande) - Bon compromis Europe/Afrique
- `us-east-1` (Virginie) - Si vous préférez les prix les plus bas

**Exemple :**
```
AWS_REGION: af-south-1
```

---

### 1.3 AWS Access Key ID et Secret Access Key

**⚠️ IMPORTANT : Créer un utilisateur IAM dédié pour GitHub Actions**

**Étapes :**

1. **AWS Console** > **IAM** > **Users** > **Create user**

2. **Nom d'utilisateur :** `github-actions-yukpomnang`
   - ✅ **Programmatic access** (pas de console access)

3. **Permissions :** Attacher ces politiques :
   - `AmazonEC2ContainerRegistryPowerUser` (pour ECR)
   - `AmazonECS_FullAccess` (pour ECS)
   - `AmazonSSMFullAccess` (pour Parameter Store)
   - `AmazonRDSFullAccess` (pour RDS)
   - `AmazonElastiCacheFullAccess` (pour Redis)
   - `AmazonVPCFullAccess` (pour VPC)
   - `CloudWatchLogsFullAccess` (pour logs)
   - `IAMFullAccess` (pour créer les rôles ECS)

4. **Créer l'utilisateur** et **SAUVEGARDER IMMÉDIATEMENT** :
   - ✅ **Access Key ID**
   - ✅ **Secret Access Key** (affiché UNE SEULE FOIS)

**Format :**
```
AWS_ACCESS_KEY_ID: AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

---

## ✅ Étape 2 : Configuration Infrastructure

### 2.1 Nom du Projet
**Exemple :**
```
PROJECT_NAME: yukpomnang
```

### 2.2 Environnement
**Exemple :**
```
ENVIRONMENT: production
```

### 2.3 Configuration RDS (PostgreSQL)

**Instance Type :**
- `db.t3.medium` (recommandé pour démarrer)
- `db.t3.large` (si vous avez plus de trafic)

**Stockage :**
- Initial : `20` GB (minimum)
- Maximum : `100` GB (auto-scaling)

**Mot de passe RDS :**
- Générer un mot de passe fort (minimum 16 caractères)
- Exemple : `openssl rand -base64 32`

**Exemple :**
```
RDS_INSTANCE_CLASS: db.t3.medium
RDS_STORAGE: 20
RDS_MAX_STORAGE: 100
RDS_PASSWORD: [VOTRE_MOT_DE_PASSE_FORT]
```

### 2.4 Configuration ElastiCache (Redis)

**Node Type :**
- `cache.t3.small` (recommandé pour démarrer)
- `cache.t3.medium` (si vous avez plus de trafic)

**Exemple :**
```
REDIS_NODE_TYPE: cache.t3.small
```

### 2.5 Configuration ECS

**CPU et Mémoire :**
- CPU : `1024` (1 vCPU) ou `2048` (2 vCPU)
- Mémoire : `2048` (2 GB) ou `4096` (4 GB)

**Nombre d'instances :**
- Minimum : `2` (pour haute disponibilité)
- Maximum : `10` (pour auto-scaling)

**Exemple :**
```
ECS_CPU: 1024
ECS_MEMORY: 2048
ECS_MIN_COUNT: 2
ECS_MAX_COUNT: 10
```

### 2.6 JWT Secret

**Générer un secret JWT fort :**
```bash
openssl rand -base64 64
```

**Exemple :**
```
JWT_SECRET: [VOTRE_JWT_SECRET_GÉNÉRÉ]
```

---

## ✅ Étape 3 : Comment Me Donner les Informations

### Option A : Format Structuré (Recommandé)

Créez un message avec cette structure :

```markdown
## Credentials AWS - Nouveau Compte

### Informations de Base
- AWS_ACCOUNT_ID: [12 chiffres]
- AWS_REGION: [région choisie]
- AWS_ACCESS_KEY_ID: [votre access key]
- AWS_SECRET_ACCESS_KEY: [votre secret key]

### Configuration Infrastructure
- PROJECT_NAME: yukpomnang
- ENVIRONMENT: production
- RDS_INSTANCE_CLASS: db.t3.medium
- RDS_STORAGE: 20
- RDS_MAX_STORAGE: 100
- RDS_PASSWORD: [mot de passe fort]
- REDIS_NODE_TYPE: cache.t3.small
- ECS_CPU: 1024
- ECS_MEMORY: 2048
- ECS_MIN_COUNT: 2
- ECS_MAX_COUNT: 10
- JWT_SECRET: [secret généré]
```

### Option B : Fichier Temporaire (Plus Sécurisé)

Créez un fichier `aws-credentials-temp.txt` (ne le commitez PAS) :

```bash
# AWS Credentials - NOUVEAU COMPTE
# ⚠️ NE PAS COMMITER CE FICHIER

AWS_ACCOUNT_ID=123456789012
AWS_REGION=af-south-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# Infrastructure
PROJECT_NAME=yukpomnang
ENVIRONMENT=production
RDS_INSTANCE_CLASS=db.t3.medium
RDS_STORAGE=20
RDS_MAX_STORAGE=100
RDS_PASSWORD=VotreMotDePasseFort123!
REDIS_NODE_TYPE=cache.t3.small
ECS_CPU=1024
ECS_MEMORY=2048
ECS_MIN_COUNT=2
ECS_MAX_COUNT=10
JWT_SECRET=VotreJWTSecretGénéréAvecOpenSSL
```

Puis copiez-collez le contenu dans le chat (sans le fichier).

---

## ⚠️ Sécurité

1. **Ne commitez JAMAIS** les credentials dans Git
2. **Supprimez** le fichier temporaire après utilisation
3. **Utilisez** un utilisateur IAM dédié (pas le compte root)
4. **Limitez** les permissions IAM au strict nécessaire
5. **Activez** MFA sur votre compte AWS principal

---

## 📝 Checklist Avant de Me Donner les Infos

- [ ] AWS Account ID récupéré
- [ ] Région AWS choisie (recommandé : `af-south-1` pour l'Afrique)
- [ ] Utilisateur IAM créé avec permissions appropriées
- [ ] Access Key ID et Secret Access Key sauvegardés
- [ ] Mot de passe RDS généré (fort, 16+ caractères)
- [ ] JWT Secret généré (`openssl rand -base64 64`)
- [ ] Configuration infrastructure décidée (CPU, mémoire, etc.)

---

## 🚀 Après Avoir Donné les Infos

Une fois que vous m'aurez donné ces informations, je vais :

1. ✅ Mettre à jour `.github/workflows/docker-build-optimized.yml`
2. ✅ Mettre à jour `infra/aws/terraform.tfvars`
3. ✅ Mettre à jour `scripts/run_migrations_aws.py`
4. ✅ Créer un guide pour mettre à jour les secrets GitHub
5. ✅ Vérifier que tout est cohérent

**Temps estimé : 5-10 minutes** ⏱️

---

## ❓ Questions ?

Si vous avez des doutes sur une valeur, dites-moi et je vous aiderai à choisir la meilleure option pour votre cas d'usage.

