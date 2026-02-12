# 🔧 Automatisation de la Création de la Base de Données

## ✅ Solutions Implémentées

### 1. Terraform - Création Automatique

Terraform devrait créer automatiquement la base de données via le paramètre `db_name` lors de la création de l'instance RDS. Cependant, si cela ne fonctionne pas, un `null_resource` a été ajouté pour tenter de créer la base après la création de RDS.

**Fichier** : `infra/aws/main.tf` (lignes 314-359)

**Fonctionnement** :
- S'exécute automatiquement après la création de RDS
- Vérifie si la base existe
- Tente de la créer si elle n'existe pas
- Affiche un avertissement si la création échoue (permissions insuffisantes)

### 2. Script de Post-Déploiement

Scripts pour vérifier et créer la base de données après Terraform :

**Fichiers** :
- `scripts/post-deploy-aws.sh` (Linux/Mac)
- `scripts/post-deploy-aws.ps1` (Windows)

**Utilisation** :
```bash
# Linux/Mac
./scripts/post-deploy-aws.sh

# Windows
.\scripts\post-deploy-aws.ps1
```

**Fonctionnalités** :
- Récupère automatiquement les informations depuis Terraform
- Vérifie si la base existe
- Crée la base si nécessaire
- Affiche des instructions claires en cas d'erreur

### 3. Script de Démarrage Amélioré

Le script de démarrage du backend (`backend/scripts/start-cloud.sh`) a été amélioré pour :

- Attendre 30 secondes si la base n'existe pas (au cas où elle serait en cours de création)
- Réessayer de se connecter après l'attente
- Afficher des messages d'erreur plus clairs avec des instructions
- Ne pas échouer immédiatement si la base n'existe pas

**Fichier** : `backend/scripts/start-cloud.sh` (lignes 69-95)

## 🚀 Processus Automatique Recommandé

### Option 1 : Terraform Crée Automatiquement (Recommandé)

1. **Appliquer Terraform** :
   ```bash
   cd infra/aws
   terraform apply
   ```

2. **Vérifier que la base existe** :
   ```bash
   ./scripts/post-deploy-aws.sh
   ```

3. **Si la base n'existe pas** :
   - Utilisez AWS RDS Query Editor (voir Option 2)
   - OU exécutez le script de post-déploiement

### Option 2 : Création Manuelle via AWS Console

1. **Ouvrir AWS Console** :
   - https://console.aws.amazon.com/rds/
   - Région : `eu-west-1`

2. **Sélectionner l'instance RDS** :
   - Instance : `yukpo-db`

3. **Ouvrir Query Editor** :
   - Onglet "Connectivity & security"
   - Cliquez sur "Query Editor" ou "Query Editor v2"

4. **Se connecter** :
   - Username : `yukpo_admin`
   - Password : (depuis `terraform.tfvars` ou AWS Secrets Manager)
   - Database : `postgres`

5. **Créer la base** :
   ```sql
   CREATE DATABASE yukpo;
   ```

6. **Vérifier** :
   ```sql
   SELECT datname FROM pg_database WHERE datname = 'yukpo';
   ```

### Option 3 : Script de Post-Déploiement

Après avoir appliqué Terraform :

```bash
# Linux/Mac
./scripts/post-deploy-aws.sh

# Windows
.\scripts\post-deploy-aws.ps1
```

Le script va :
1. Récupérer les informations depuis Terraform
2. Vérifier si la base existe
3. Créer la base si nécessaire
4. Afficher des instructions en cas d'erreur

## 🔍 Vérification

Après avoir créé la base, vérifiez que tout fonctionne :

```bash
# Vérifier que la base existe
aws rds describe-db-instances \
  --db-instance-identifier yukpo-db \
  --region eu-west-1 \
  --query 'DBInstances[0].DBName'

# Vérifier les logs du backend
aws logs tail /ecs/yukpo-backend --region eu-west-1 --follow
```

## ⚠️ Notes Importantes

1. **Permissions RDS** : Sur AWS RDS, seul l'utilisateur master (créé lors de l'initialisation) peut créer des bases de données. Si l'utilisateur `yukpo_admin` n'a pas ces permissions, la base doit être créée manuellement.

2. **Terraform `db_name`** : Le paramètre `db_name` dans Terraform devrait créer la base automatiquement lors de l'initialisation de RDS. Si la base n'existe pas, cela peut signifier :
   - Terraform n'a pas été appliqué correctement
   - La base a été supprimée manuellement
   - Il y a eu un problème lors de la création de l'instance RDS

3. **Script de Démarrage** : Le script de démarrage attend maintenant 30 secondes si la base n'existe pas, au cas où elle serait en cours de création par Terraform.

## 📚 Fichiers Créés/Modifiés

- ✅ `infra/aws/main.tf` - Ajout de `null_resource` pour créer la base
- ✅ `backend/scripts/start-cloud.sh` - Amélioration de la gestion de l'absence de base
- ✅ `scripts/post-deploy-aws.sh` - Script de post-déploiement (Linux/Mac)
- ✅ `scripts/post-deploy-aws.ps1` - Script de post-déploiement (Windows)
- ✅ `scripts/create-database-via-ecs.ps1` - Script pour créer via ECS (alternative)
- ✅ `AUTOMATISATION_CREATION_DATABASE.md` - Ce document

## 🎯 Prochaines Étapes

1. **Appliquer Terraform** (si pas déjà fait)
2. **Exécuter le script de post-déploiement** pour vérifier/créer la base
3. **Vérifier les logs du backend** pour confirmer que tout fonctionne
4. **Redémarrer le service ECS** si nécessaire

