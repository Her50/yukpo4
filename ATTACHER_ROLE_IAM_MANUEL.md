# 🔧 Attacher le Rôle IAM à l'Instance EC2 (Manuel)

## ⚠️ Problème

L'utilisateur Terraform n'a pas la permission `ec2:AssociateIamInstanceProfile`. Il faut attacher le rôle IAM manuellement.

## ✅ Solution : Attacher le Rôle via AWS Console

### Étape 1 : Ouvrir l'Instance EC2

1. **Allez dans AWS Console** → **EC2** → **Instances**
2. **Sélectionnez l'instance** : `yukpo-temp-db-creator` (ID: `i-0b9ad404f8d738d04`)

### Étape 2 : Attacher le Rôle IAM

1. **Cliquez sur l'instance** pour voir les détails
2. **Onglet "Sécurité"** (Security) en bas
3. **Section "Rôles IAM"** (IAM roles)
4. **Cliquez sur "Modifier les rôles IAM"** (Modify IAM roles)
5. **Sélectionnez le rôle** : `yukpo-temp-ec2-ssm-role`
6. **Cliquez sur "Mettre à jour les rôles IAM"** (Update IAM roles)

### Étape 3 : Attendre 1-2 minutes

Attendez 1-2 minutes pour que l'agent SSM se connecte avec les nouvelles credentials.

### Étape 4 : Vérifier la Connexion SSM

1. **Retournez sur la page "Connect"** de l'instance
2. **Onglet "Session Manager"**
3. Le statut devrait maintenant être **"En ligne"** (Online) avec une coche verte
4. **Cliquez sur "Connect"** pour vous connecter

## ✅ Alternative : Utiliser SSH Directement

Si vous avez une clé SSH, vous pouvez vous connecter directement :

```bash
ssh ec2-user@52.17.27.232
```

Mais vous devrez d'abord créer une clé SSH dans AWS Console et l'attacher à l'instance.

## 📝 Après la Connexion

Une fois connecté (via Session Manager ou SSH), exécutez :

```bash
# Vérifier que PostgreSQL client est installé
psql --version

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

