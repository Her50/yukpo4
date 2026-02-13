# 🚀 Instructions Finales : Créer la Base de Données

## ⚠️ Situation Actuelle

L'instance EC2 existe toujours mais n'a pas le rôle IAM attaché. Terraform ne peut pas la modifier à cause des permissions.

## ✅ Solution : Terminer l'Instance et Attacher le Rôle Manuellement

### Option 1 : Attacher le Rôle IAM via AWS Console (Plus Simple)

1. **Allez dans AWS Console** → **EC2** → **Instances**
2. **Sélectionnez l'instance** : `yukpo-temp-db-creator` (ID: `i-0b9ad404f8d738d04`)
3. **Onglet "Actions"** (en haut) → **Sécurité** → **Modifier le rôle IAM** (Modify IAM role)
4. **Sélectionnez le rôle** : `yukpo-temp-ec2-ssm-role`
5. **Cliquez sur "Mettre à jour"** (Update)
6. **Attendez 1-2 minutes** pour que l'agent SSM se connecte
7. **Retournez sur "Connect"** → **Session Manager** → Le statut devrait être "En ligne"
8. **Cliquez sur "Connect"** pour vous connecter

### Option 2 : Terminer et Recréer (Si Option 1 ne fonctionne pas)

1. **Terminer l'instance** :
   - EC2 → Instances → Sélectionnez `yukpo-temp-db-creator`
   - Actions → Instance State → Terminate Instance
   - Attendez que l'instance soit terminée

2. **Recréer avec Terraform** :
   ```bash
   cd C:\Users\23767\yukpomnang2\infra\aws
   terraform apply -target="aws_instance.temp_db_creator" -auto-approve
   ```

## 📋 Une Fois Connecté (via Session Manager ou SSH)

Exécutez ces commandes pour créer la base de données :

```bash
# Vérifier que PostgreSQL client est installé
psql --version

# Créer la base de données
export PGPASSWORD='PYvHBVetTuWIKNkXgqJcFiU48D39SLwd'
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d postgres \
     -c "CREATE DATABASE yukpo;"
```

### Vérifier que la base a été créée :

```bash
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d postgres \
     -c "SELECT datname FROM pg_database WHERE datname = 'yukpo';"
```

Vous devriez voir `yukpo` dans les résultats.

## ✅ Prochaines Étapes

Une fois la base créée :

1. ✅ Vérifiez que `DATABASE_URL` dans AWS Secrets Manager pointe vers la base `yukpo`
2. ✅ Redémarrez le backend ECS
3. ✅ Les migrations s'appliqueront automatiquement si `ENABLE_AUTO_MIGRATIONS=true`

## 🗑️ N'oubliez Pas de Supprimer l'Instance

Une fois la base créée, supprimez l'instance EC2 temporaire :

```bash
cd C:\Users\23767\yukpomnang2\infra\aws
terraform destroy -target="aws_instance.temp_db_creator" -target="aws_security_group.temp_ec2" -target="aws_iam_instance_profile.temp_ec2_ssm" -target="aws_iam_role.temp_ec2_ssm" -auto-approve
```

Ou via AWS Console : EC2 → Instances → Terminate

