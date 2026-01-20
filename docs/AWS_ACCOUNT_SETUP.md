# 🚀 Guide de Création du Compte AWS

## Étape 1 : Créer un Compte AWS

1. **Aller sur** : https://aws.amazon.com/fr/
2. **Cliquer sur** "Créer un compte AWS" (en haut à droite)
3. **Remplir le formulaire** :
   - Email
   - Mot de passe (12+ caractères, majuscules, minuscules, chiffres, symboles)
   - Nom du compte AWS
4. **Vérifier l'email** et confirmer
5. **Ajouter les informations de paiement** :
   - Carte bancaire (nécessaire même pour Free Tier)
   - Adresse de facturation
6. **Vérifier l'identité** par téléphone
7. **Choisir un plan** : Sélectionner "Support de base (gratuit)"

## Étape 2 : Activer MFA (Recommandé)

1. **Console AWS** → **IAM** → **Users** → Votre utilisateur
2. **Onglet "Security credentials"**
3. **"Assign MFA device"** → Choisir "Virtual MFA device"
4. Scanner le QR code avec Google Authenticator ou Authy

## Étape 3 : Créer un Utilisateur IAM avec Accès Programmatique

⚠️ **IMPORTANT** : Ne jamais utiliser les credentials root pour l'automatisation !

1. **Console AWS** → **IAM** → **Users** → **Add users**
2. **Nom d'utilisateur** : `yukpomnang-deploy`
3. **Type d'accès** : ✅ **Access key - Programmatic access**
4. **Permissions** : Attacher directement les politiques :
   - `AdministratorAccess` (pour simplifier) OU
   - Politiques spécifiques :
     - `AmazonECS_FullAccess`
     - `AmazonRDS_FullAccess`
     - `AmazonElastiCacheFullAccess`
     - `AmazonEC2FullAccess`
     - `ElasticLoadBalancingFullAccess`
     - `AmazonEC2ContainerRegistryFullAccess`
     - `SecretsManagerReadWrite`
     - `CloudWatchLogsFullAccess`
     - `IAMFullAccess`
     - `AmazonVPCFullAccess`
5. **Créer l'utilisateur**
6. **⚠️ IMPORTANT : Sauvegarder immédiatement** :
   - **Access Key ID** : `AKIA...`
   - **Secret Access Key** : `xxxxx...` (visible UNE SEULE FOIS)

## Étape 4 : Installer AWS CLI

### Windows (PowerShell)
```powershell
# Option 1 : Via winget
winget install Amazon.AWSCLI

# Option 2 : Via MSI
# Télécharger depuis : https://awscli.amazonaws.com/AWSCLIV2.msi
```

### Vérifier l'installation
```powershell
aws --version
# Doit afficher : aws-cli/2.x.x
```

## Étape 5 : Configurer AWS CLI

```powershell
aws configure
```

**Entrer les informations** :
```
AWS Access Key ID [None]: AKIA... (votre Access Key ID)
AWS Secret Access Key [None]: xxxxx... (votre Secret Access Key)
Default region name [None]: eu-west-1 (ou us-east-1, eu-central-1, etc.)
Default output format [None]: json
```

## Étape 6 : Vérifier la Configuration

```powershell
# Tester la connexion
aws sts get-caller-identity

# Devrait afficher :
# {
#     "UserId": "AIDA...",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/yukpomnang-deploy"
# }
```

## Étape 7 : Installer Terraform (pour l'automatisation)

### Windows (PowerShell)
```powershell
# Via Chocolatey
choco install terraform

# Ou télécharger depuis : https://www.terraform.io/downloads
# Extraire terraform.exe dans un dossier dans PATH
```

### Vérifier l'installation
```powershell
terraform version
# Doit afficher : Terraform v1.x.x
```

## Étape 8 : Installer Docker (si pas déjà installé)

```powershell
# Via winget
winget install Docker.DockerDesktop

# Ou télécharger depuis : https://www.docker.com/products/docker-desktop
```

## ✅ Checklist Prérequis

- [ ] Compte AWS créé et vérifié
- [ ] MFA activé sur le compte root
- [ ] Utilisateur IAM créé avec Access Key
- [ ] AWS CLI installé et configuré
- [ ] Terraform installé
- [ ] Docker installé
- [ ] Credentials sauvegardés de manière sécurisée

## 🔐 Sécurité des Credentials

**⚠️ NE JAMAIS COMMITER LES CREDENTIALS DANS GIT !**

1. **Créer un fichier** `.aws-credentials` (déjà dans .gitignore)
2. **Y stocker** :
   ```
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=xxxxx...
   AWS_REGION=eu-west-1
   AWS_ACCOUNT_ID=123456789012
   ```
3. **OU utiliser** AWS Secrets Manager (recommandé pour production)

## 📝 Informations Nécessaires pour l'Automatisation

Avant de lancer les scripts, vous devez avoir :

1. **AWS Access Key ID** : `AKIA...`
2. **AWS Secret Access Key** : `xxxxx...`
3. **AWS Region** : `eu-west-1` (recommandé pour l'Europe)
4. **AWS Account ID** : Trouvable via `aws sts get-caller-identity`

## Étape 9 : Vérification Finale

Avant de déployer, vérifiez que tout est correctement configuré :

```powershell
# Script de vérification automatique
.\scripts\verify-aws-setup.ps1
```

Ce script vérifie :
- ✅ AWS CLI installé et configuré
- ✅ Credentials AWS valides
- ✅ Terraform installé
- ✅ Docker installé et démarré
- ✅ Fichiers de configuration présents

**OU vérifiez manuellement** :

```powershell
# Vérifier AWS
aws sts get-caller-identity

# Vérifier Terraform
terraform version

# Vérifier Docker
docker --version
docker ps  # Doit fonctionner si Docker Desktop est démarré
```

## Étape 10 : Build de l'Image Docker (Recommandé avant déploiement)

**⚠️ IMPORTANT** : Si vous avez fait des modifications au backend, build l'image Docker localement d'abord pour tester :

```powershell
# Build et test de l'image Docker
.\scripts\build-backend-docker.ps1 -Test
```

Ce script :
- ✅ Vérifie que Docker est démarré
- ✅ Vérifie/génère le cache SQLx (nécessaire pour le build)
- ✅ Build l'image Docker localement
- ✅ Teste l'image (si `-Test` est spécifié)

**Options disponibles** :
```powershell
# Build simple
.\scripts\build-backend-docker.ps1

# Build avec tests
.\scripts\build-backend-docker.ps1 -Test

# Build sans cache (plus long mais plus propre)
.\scripts\build-backend-docker.ps1 -SkipCache
```

**Note** : Le script `deploy-aws.ps1` build automatiquement l'image lors du déploiement, mais il est recommandé de tester localement d'abord.

## 🎯 Prochaines Étapes

### Option 1 : Déploiement Complet (Première fois)

Une fois tout configuré et vérifié :

```powershell
# Vérifier la configuration
.\scripts\verify-aws-setup.ps1

# Build l'image localement (recommandé)
.\scripts\build-backend-docker.ps1 -Test

# Déployer sur AWS (build automatique inclus)
.\scripts\deploy-aws.ps1
```

Le script `deploy-aws.ps1` va :
1. Vérifier tous les prérequis
2. Initialiser Terraform
3. Créer l'infrastructure AWS (ECS, RDS, Redis, etc.)
4. **Builder et pousser l'image Docker** (inclut vos modifications)
5. Déployer l'application

### Option 2 : Mise à Jour Uniquement (Après modifications)

Si l'infrastructure existe déjà et vous voulez juste mettre à jour le code :

```powershell
# Build localement d'abord (recommandé)
.\scripts\build-backend-docker.ps1 -Test

# Mettre à jour uniquement l'image sur AWS
.\scripts\deploy-aws.ps1 -Action update
```

Cette commande va :
1. Builder la nouvelle image Docker
2. La pousser vers AWS ECR
3. Redémarrer le service ECS avec la nouvelle image

**Note** : L'action `update` ne modifie pas l'infrastructure Terraform, seulement l'image Docker.

npx eas build --platform android --profile preview 