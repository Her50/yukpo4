# 🔐 Guide : Configuration des Secrets GitHub (Sécurisé)

## 🎯 Objectif

Configurer les secrets AWS dans GitHub **SANS** me les donner. Approche sécurisée recommandée.

---

## ✅ Étape 1 : Créer un Utilisateur IAM (5 minutes)

### 1.1 Aller dans AWS Console

1. Connectez-vous à AWS Console
2. Allez dans **IAM** > **Users** > **Create user**

### 1.2 Créer l'utilisateur

- **Username** : `github-actions-yukpo` (ou `github-actions-yukpomnang`)
- ❌ **"Fournir aux utilisateurs l'accès à la console de gestion AWS"** : **NE PAS COCHER**
  - ⚠️ **Important** : Pour GitHub Actions, on a besoin d'un accès **PROGRAMMATIQUE** (Access Keys), pas d'un accès console
  - L'accès console crée un mot de passe pour se connecter à la console web, ce qui n'est pas nécessaire
  - L'accès programmatique sera créé **après** la création de l'utilisateur (étape suivante)

**Cliquez sur "Suivant" (Next)**

### 1.3 Attacher les Permissions

**Sur la page "Régler les autorisations" :**

1. **Sélectionnez l'option 3** : **"Attacher directement des politiques"** (Attach policies directly)
   - ✅ C'est la meilleure option pour un utilisateur dédié à GitHub Actions
   - ✅ Plus simple que de créer un groupe pour un seul utilisateur

2. **Dans la liste des politiques, recherchez et cochez ces politiques :**

   **Politiques essentielles (10 politiques) :**
   - ✅ `AmazonEC2ContainerRegistryPowerUser` (pour ECR - push/pull images Docker)
   - ✅ `AmazonECS_FullAccess` (pour ECS - déployer et gérer les services)
   - ✅ `AmazonSSMFullAccess` (pour Parameter Store - stocker DATABASE_URL)
   - ✅ `AmazonRDSFullAccess` (pour RDS PostgreSQL)
   - ✅ `AmazonElastiCacheFullAccess` (pour Redis)
   - ✅ `AmazonVPCFullAccess` (pour VPC, sous-réseaux, etc.)
   - ✅ `CloudWatchLogsFullAccess` (pour les logs)
   - ✅ `IAMFullAccess` (pour créer les rôles ECS nécessaires)
   - ✅ `AmazonS3FullAccess` (pour stocker les vidéos et fichiers)
   - ✅ `CloudFrontFullAccess` (pour CDN - distribution du contenu vers l'Afrique)

   **Comment chercher :**
   - Utilisez la barre de recherche en haut de la liste
   - Tapez le nom de la politique (ex: "ECR", "ECS", "SSM")
   - Cochez chaque politique trouvée

3. **Vérifiez que toutes les politiques sont cochées** (vous devriez voir **10 politiques** cochées)

4. **Cliquez sur "Suivant" (Next)**

### 1.4 Vérifier et Créer

1. **Sur la page "Vérifier et créer"** :
   - Vérifiez que le nom d'utilisateur est correct : `github-actions-yukpo`
   - Vérifiez que les 8 politiques sont listées
   - ❌ Vérifiez que "Accès console" n'est PAS activé

2. **Cliquez sur "Créer un utilisateur" (Create user)**

### 1.5 Créer les Access Keys (Accès Programmatique)

**Après avoir créé l'utilisateur :**

1. Allez dans **IAM** > **Users** > `github-actions-yukpo`
2. Cliquez sur l'onglet **"Security credentials"** (Informations d'identification de sécurité)
3. Dans la section **"Access keys"**, cliquez sur **"Create access key"**
4. Sélectionnez **"Application running outside AWS"** (Application s'exécutant en dehors d'AWS)
5. Cliquez sur **"Next"** puis **"Create access key"**

**⚠️ IMPORTANT : Sauvegardez immédiatement :**
- ✅ **Access Key ID** : `AKIA...`
- ✅ **Secret Access Key** : `wJalr...` (affiché UNE SEULE FOIS)

**⚠️ Si vous perdez la Secret Access Key, vous devrez en créer une nouvelle !**

**Note :** Les Access Keys sont ce dont GitHub Actions a besoin pour s'authentifier, pas un mot de passe console.

---

## ✅ Étape 2 : Configurer GitHub Secrets (2 minutes)

### 2.1 Aller dans GitHub Secrets

1. Allez sur votre repository GitHub
2. **Settings** > **Secrets and variables** > **Actions**
3. Cliquez sur **New repository secret**

### 2.2 Ajouter AWS_ACCESS_KEY_ID

**Secret 1 :**
- **Name** : `AWS_ACCESS_KEY_ID`
- **Value** : Votre Access Key ID (ex: `AKIAIOSFODNN7EXAMPLE`)
- Cliquez sur **Add secret**

### 2.3 Ajouter AWS_SECRET_ACCESS_KEY

**Secret 2 :**
- **Name** : `AWS_SECRET_ACCESS_KEY`
- **Value** : Votre Secret Access Key (ex: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`)
- Cliquez sur **Add secret**

---

## ✅ Étape 3 : Générer et Stocker les Autres Secrets

### 3.1 Générer RDS Password

```bash
# Windows PowerShell
$rdsPassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
Write-Host "RDS Password: $rdsPassword"

# Linux/Mac
openssl rand -base64 32
```

**Sauvegardez** ce mot de passe (vous en aurez besoin pour Terraform).

### 3.2 Générer JWT Secret

```bash
# Windows PowerShell
$jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
Write-Host "JWT Secret: $jwtSecret"

# Linux/Mac
openssl rand -base64 64
```

**Sauvegardez** ce secret (vous en aurez besoin pour Terraform).

### 3.3 Stocker dans AWS Secrets Manager (Optionnel mais Recommandé)

**Pour RDS Password :**
```bash
aws secretsmanager create-secret \
  --name yukpomnang/rds-password \
  --secret-string "VOTRE_RDS_PASSWORD" \
  --region [VOTRE_RÉGION]
```

**Pour JWT Secret :**
```bash
aws secretsmanager create-secret \
  --name yukpomnang/jwt-secret \
  --secret-string "VOTRE_JWT_SECRET" \
  --region [VOTRE_RÉGION]
```

---

## ✅ Étape 4 : Vérifier la Configuration

### 4.1 Vérifier GitHub Secrets

GitHub > Settings > Secrets and variables > Actions

Vous devriez voir :
- ✅ `AWS_ACCESS_KEY_ID`
- ✅ `AWS_SECRET_ACCESS_KEY`

### 4.2 Tester la Connexion AWS

```bash
# Configurer AWS CLI localement (si pas déjà fait)
aws configure

# Entrer :
# AWS Access Key ID: [VOTRE_ACCESS_KEY]
# AWS Secret Access Key: [VOTRE_SECRET_KEY]
# Default region: [VOTRE_RÉGION]
# Default output format: json

# Tester
aws sts get-caller-identity
```

Vous devriez voir votre Account ID et User ARN.

---

## ✅ Étape 5 : Me Donner Seulement les Infos Publiques

**Maintenant, vous pouvez me donner SANS RISQUE :**

```
AWS_ACCOUNT_ID: [VOTRE_ACCOUNT_ID]
AWS_REGION: [VOTRE_RÉGION]
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

**⚠️ NE ME DONNEZ PAS :**
- ❌ `AWS_ACCESS_KEY_ID`
- ❌ `AWS_SECRET_ACCESS_KEY`
- ❌ `RDS_PASSWORD`
- ❌ `JWT_SECRET`

---

## 🔒 Sécurité : Bonnes Pratiques

### 1. **Limiter les Permissions IAM**

Après avoir créé l'infrastructure, créez une politique IAM plus restrictive qui limite :
- ✅ Seulement la région spécifiée
- ✅ Seulement les ressources du projet
- ✅ Pas d'accès à d'autres services

### 2. **Activer MFA sur le Compte Root**

- ✅ Allez dans IAM > Users > [Votre compte root]
- ✅ Security credentials > Enable MFA
- ✅ Utilisez une app d'authentification (Google Authenticator, Authy, etc.)

### 3. **Activer CloudTrail**

```bash
aws cloudtrail create-trail \
  --name yukpomnang-trail \
  --s3-bucket-name yukpomnang-cloudtrail-logs \
  --region [VOTRE_RÉGION]
```

### 4. **Rotation des Credentials**

- ✅ Changez les credentials tous les 90 jours
- ✅ Utilisez AWS Secrets Manager pour rotation automatique

### 5. **Surveillance**

Configurez des alertes CloudWatch pour :
- ✅ Création de ressources non autorisées
- ✅ Accès depuis des IPs suspectes
- ✅ Utilisation excessive de ressources

---

## 🚨 En Cas de Compromission

### Plan de Réponse Immédiate

1. **Révoquer les credentials** :
   ```bash
   aws iam delete-access-key \
     --user-name github-actions-yukpomnang \
     --access-key-id [KEY_ID]
   ```

2. **Vérifier CloudTrail** :
   ```bash
   aws cloudtrail lookup-events \
     --lookup-attributes AttributeKey=Username,AttributeValue=github-actions-yukpomnang
   ```

3. **Créer de nouveaux credentials** avec permissions encore plus limitées

4. **Mettre à jour GitHub Secrets** avec les nouveaux credentials

---

## ✅ Checklist Finale

- [ ] Utilisateur IAM créé (pas le compte root)
- [ ] Permissions limitées au strict nécessaire
- [ ] `AWS_ACCESS_KEY_ID` ajouté dans GitHub Secrets
- [ ] `AWS_SECRET_ACCESS_KEY` ajouté dans GitHub Secrets
- [ ] RDS Password généré et sauvegardé
- [ ] JWT Secret généré et sauvegardé
- [ ] MFA activé sur le compte root
- [ ] CloudTrail activé (optionnel mais recommandé)
- [ ] Test de connexion AWS réussi

---

## 🎉 C'est Tout !

**Maintenant :**
1. ✅ Vous avez configuré les secrets de manière sécurisée
2. ✅ Je n'ai jamais vu vos secrets
3. ✅ Vous pouvez me donner les informations publiques
4. ✅ Je mets à jour les fichiers de configuration
5. ✅ Tout est prêt pour le déploiement !

**Votre sécurité est garantie !** 🔒

