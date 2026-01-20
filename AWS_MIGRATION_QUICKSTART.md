# 🚀 Migration AWS - Guide Rapide

## ⚡ Démarrage Rapide (5 minutes)

### 1. Prérequis (une seule fois)

```powershell
# Installer AWS CLI
winget install Amazon.AWSCLI

# Installer Terraform
choco install terraform

# Configurer AWS (suivre docs/AWS_ACCOUNT_SETUP.md)
aws configure
```

### 2. Configuration (2 minutes)

```powershell
# Copier le fichier de configuration
cd infra/aws
cp terraform.tfvars.example terraform.tfvars

# Éditer avec vos valeurs (notamment rds_password et jwt_secret)
notepad terraform.tfvars
```

### 3. Déploiement (10-15 minutes)

```powershell
# Depuis la racine du projet
.\scripts\deploy-aws.ps1
```

**C'est tout !** Le script fait tout automatiquement :
- ✅ Crée l'infrastructure AWS
- ✅ Build et push l'image Docker
- ✅ Déploie sur ECS
- ✅ Affiche les URLs

## 📋 Ce qui est créé automatiquement

| Service | Description |
|---------|-------------|
| **VPC** | Réseau isolé avec subnets publics/privés |
| **RDS PostgreSQL** | Base de données avec backups automatiques |
| **ElastiCache Redis** | Cache Redis avec encryption |
| **ECR** | Registry Docker pour vos images |
| **ECS Fargate** | Conteneurs avec auto-scaling |
| **ALB** | Load balancer avec health checks |
| **Secrets Manager** | Stockage sécurisé des secrets |
| **CloudWatch** | Logs et monitoring |

## 🎯 Prochaines Étapes

### 1. Migrer les Données (optionnel)

```powershell
.\scripts\migrate-render-to-aws.ps1 `
  -RenderDbUrl "postgresql://user:pass@render-url:5432/db" `
  -AwsRdsUrl "postgresql://user:pass@rds-url:5432/db"
```

### 2. Configurer le DNS (optionnel)

1. Créer un certificat ACM
2. Ajouter l'ARN dans `terraform.tfvars`
3. `terraform apply`
4. Configurer Route 53

### 3. Mettre à Jour le Frontend

Mettre à jour l'URL de l'API dans votre frontend :
```env
VITE_API_BASE_URL=https://votre-alb-url.eu-west-1.elb.amazonaws.com
```

## 📚 Documentation Complète

- **[Guide de création compte AWS](docs/AWS_ACCOUNT_SETUP.md)** - Comment créer et configurer votre compte AWS
- **[Guide de déploiement complet](docs/AWS_DEPLOYMENT_GUIDE.md)** - Guide détaillé étape par étape
- **[README Infrastructure](infra/aws/README.md)** - Documentation technique Terraform

## 🔧 Commandes Utiles

```powershell
# Voir les logs
aws logs tail /ecs/yukpomnang-backend --follow --region eu-west-1

# Statut du service
aws ecs describe-services `
  --cluster yukpomnang-cluster `
  --services yukpomnang-backend-service `
  --region eu-west-1

# Mettre à jour après un nouveau build
.\scripts\deploy-aws.ps1 -Action update

# Détruire l'infrastructure
.\scripts\deploy-aws.ps1 -Action destroy
```

## 💰 Coûts Estimés

**~$195-260/mois** pour l'infrastructure complète (production)

Réduire les coûts :
- Utiliser des instances plus petites (dev/staging)
- Désactiver NAT Gateway si pas nécessaire
- Utiliser le Free Tier AWS (12 mois)

## ✅ Checklist

- [ ] Compte AWS créé et configuré
- [ ] AWS CLI installé et configuré
- [ ] Terraform installé
- [ ] Docker installé
- [ ] `terraform.tfvars` configuré
- [ ] Infrastructure déployée
- [ ] Service ECS running
- [ ] Health checks OK
- [ ] Données migrées (optionnel)
- [ ] DNS configuré (optionnel)

## 🆘 Besoin d'Aide ?

1. **Erreur de credentials** : Vérifiez `aws configure`
2. **Erreur Terraform** : Vérifiez `terraform.tfvars`
3. **Service ne démarre pas** : Vérifiez les logs CloudWatch
4. **Health check échoue** : Vérifiez que `/health` existe dans votre app

---

**🎉 Prêt à migrer ? Lancez `.\scripts\deploy-aws.ps1` !**






