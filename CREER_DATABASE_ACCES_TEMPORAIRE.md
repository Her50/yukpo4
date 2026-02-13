# 🚀 Créer la Base de Données - Accès Temporaire

## ⚠️ Problème

- CloudShell n'est pas disponible (compte nouveau)
- Query Editor ne fonctionne que pour Aurora Serverless
- L'instance RDS est dans un VPC privé

## ✅ Solution 1 : Modifier Temporairement le Security Group (Recommandé)

### Étape 1 : Obtenir Votre IP Publique

Depuis votre machine Windows, exécutez dans PowerShell :

```powershell
(Invoke-WebRequest -Uri "https://api.ipify.org").Content
```

Notez cette IP (exemple : `123.45.67.89`)

### Étape 2 : Modifier le Security Group RDS

1. **Allez dans AWS Console** → **EC2** → **Security Groups**
2. **Trouvez le Security Group** associé à `yukpo-db` :
   - Nom : `yukpo-rds-sg` ou similaire
   - Ou allez dans RDS → `yukpo-db` → Onglet "Connectivité et sécurité" → Security groups
3. **Cliquez sur le Security Group** → Onglet "Règles de trafic entrant" (Inbound rules)
4. **Cliquez sur "Modifier les règles entrantes"** (Edit inbound rules)
5. **Ajoutez une règle temporaire** :
   - Type : `PostgreSQL`
   - Protocole : `TCP`
   - Port : `5432`
   - Source : `Mon IP` ou votre IP publique (ex: `123.45.67.89/32`)
   - Description : `Accès temporaire pour créer la base`
6. **Sauvegardez**

### Étape 3 : Créer la Base avec psql

Depuis votre machine Windows (si vous avez psql installé) :

```powershell
# Installer psql si nécessaire
# Télécharger depuis : https://www.postgresql.org/download/windows/

# Définir le mot de passe
$env:PGPASSWORD = "PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"

# Créer la base de données
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com `
     -U yukpo_admin `
     -d postgres `
     -c "CREATE DATABASE yukpo;"

# Vérifier
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com `
     -U yukpo_admin `
     -d postgres `
     -c "SELECT datname FROM pg_database WHERE datname = 'yukpo';"
```

### Étape 4 : Supprimer la Règle Temporaire

**IMPORTANT** : Une fois la base créée, supprimez la règle de sécurité pour la sécurité :

1. Retournez dans le Security Group
2. Supprimez la règle que vous avez ajoutée
3. Sauvegardez

---

## ✅ Solution 2 : Créer une Instance EC2 Temporaire

Si vous préférez ne pas exposer RDS à Internet :

### Étape 1 : Créer une Instance EC2 dans le Même VPC

1. **Allez dans EC2** → **Instances** → **Lancer une instance**
2. **Configuration** :
   - Nom : `yukpo-temp-db-creator`
   - AMI : Amazon Linux 2023 (gratuit)
   - Type d'instance : `t3.micro` (éligible au free tier)
   - VPC : Sélectionnez le VPC de votre RDS (probablement `yukpo-vpc`)
   - Subnet : Sélectionnez une subnet publique
   - Security Group : Créez-en un nouveau qui autorise SSH (port 22) depuis votre IP
   - Clé : Créez ou sélectionnez une clé SSH
3. **Lancez l'instance**

### Étape 2 : Se Connecter à l'Instance EC2

```bash
# Depuis votre machine (si vous avez SSH)
ssh -i votre-cle.pem ec2-user@[IP-PUBLIQUE-EC2]
```

### Étape 3 : Créer la Base depuis EC2

Une fois connecté à l'instance EC2 :

```bash
# Installer PostgreSQL client
sudo yum install postgresql15 -y

# Créer la base
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

### Étape 4 : Supprimer l'Instance EC2

Une fois terminé, supprimez l'instance EC2 pour éviter les coûts.

---

## ✅ Solution 3 : Utiliser AWS CLI (Si Disponible)

Si vous avez AWS CLI configuré et que vous pouvez créer une instance EC2 via CLI :

```bash
# Créer une instance EC2
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.micro \
  --subnet-id [SUBNET-ID] \
  --security-group-ids [SG-ID] \
  --key-name [KEY-NAME] \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=yukpo-temp-db-creator}]'
```

Puis suivez les étapes de la Solution 2.

---

## 📝 Prochaines Étapes

Une fois la base créée :

1. ✅ Vérifiez que `DATABASE_URL` dans AWS Secrets Manager pointe vers la base `yukpo`
2. ✅ Redémarrez le backend ECS
3. ✅ Les migrations s'appliqueront automatiquement si `ENABLE_AUTO_MIGRATIONS=true`

---

## 🔒 Sécurité

- **Solution 1** : N'oubliez pas de supprimer la règle de sécurité après usage
- **Solution 2** : Supprimez l'instance EC2 temporaire après usage
- Les deux solutions sont temporaires et doivent être supprimées après création de la base

