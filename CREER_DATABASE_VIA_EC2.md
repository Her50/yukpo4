# 🚀 Créer la Base de Données via Instance EC2 Temporaire

## ⚠️ Problème

L'instance RDS est dans un subnet privé et n'est pas accessible depuis Internet. Même avec le security group modifié, vous ne pourrez pas vous y connecter directement.

## ✅ Solution : Instance EC2 Temporaire

### Étape 1 : Créer une Instance EC2

1. **Allez dans AWS Console** → **EC2** → **Instances** → **Lancer une instance**

2. **Configuration de base** :
   - **Nom** : `yukpo-temp-db-creator`
   - **AMI** : Amazon Linux 2023 (gratuit, éligible au free tier)
   - **Type d'instance** : `t3.micro` (éligible au free tier)
   - **Clé de paire** : Créez ou sélectionnez une clé SSH (ex: `yukpo-key`)

3. **Configuration réseau** :
   - **VPC** : Sélectionnez le VPC de votre RDS (probablement `yukpo-vpc` ou similaire)
   - **Subnet** : Sélectionnez une **subnet publique** (ex: `yukpo-public-subnet-1`)
   - **Auto-assign Public IP** : **Enable**
   - **Security Group** : Créez un nouveau security group :
     - Nom : `yukpo-temp-ec2-sg`
     - Règle entrante : SSH (port 22) depuis votre IP : `129.0.76.23/32`

4. **Lancez l'instance**

### Étape 2 : Se Connecter à l'Instance EC2

**Option A : Via SSH (si vous avez une clé SSH)**

```bash
# Depuis votre machine Windows (avec Git Bash ou WSL)
ssh -i votre-cle.pem ec2-user@[IP-PUBLIQUE-EC2]
```

**Option B : Via AWS Systems Manager Session Manager (sans clé SSH)**

1. Dans EC2 → Instances → Sélectionnez votre instance
2. Cliquez sur "Connect" → Onglet "Session Manager"
3. Cliquez sur "Connect"

### Étape 3 : Créer la Base de Données

Une fois connecté à l'instance EC2, exécutez :

```bash
# Installer PostgreSQL client
sudo yum install postgresql15 -y

# Créer la base de données
export PGPASSWORD='PYvHBVetTuWIKNkXgqJcFiU48D39SLwd'
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d postgres \
     -c "CREATE DATABASE yukpo;"

# Vérifier
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d postgres \
     -c "SELECT datname FROM pg_database WHERE datname = 'yukpo';"
```

Vous devriez voir `yukpo` dans les résultats.

### Étape 4 : Supprimer l'Instance EC2

**IMPORTANT** : Une fois la base créée, supprimez l'instance EC2 pour éviter les coûts :

1. Dans EC2 → Instances
2. Sélectionnez `yukpo-temp-db-creator`
3. Actions → Instance State → Terminate

## 📝 Prochaines Étapes

Une fois la base créée :

1. ✅ Vérifiez que `DATABASE_URL` dans AWS Secrets Manager pointe vers la base `yukpo`
2. ✅ Redémarrez le backend ECS
3. ✅ Les migrations s'appliqueront automatiquement si `ENABLE_AUTO_MIGRATIONS=true`

## 💰 Coûts

- **t3.micro** : Éligible au free tier (750 heures/mois pendant 12 mois)
- Si vous supprimez l'instance immédiatement après usage, le coût sera minimal (quelques centimes)

## 🔒 Sécurité

- L'instance EC2 est temporaire et sera supprimée après usage
- Le security group autorise uniquement votre IP pour SSH
- L'instance EC2 peut accéder à RDS car elle est dans le même VPC

