# ✅ Vérification : Base de Données 'yukpo' Créée

## 🎉 Excellente Nouvelle !

La base de données `yukpo` existe déjà ! L'erreur "database 'yukpo' already exists" confirme que la base est présente.

## ✅ Vérification Finale

Dans votre terminal Session Manager, exécutez :

```bash
export PGPASSWORD='PYvHBVetTuWIKNkXgqJcFiU48D39SLwd'
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d postgres \
     -c "SELECT datname FROM pg_database WHERE datname = 'yukpo';"
```

Vous devriez voir `yukpo` dans les résultats.

## 📋 Prochaines Étapes

### 1. Vérifier DATABASE_URL dans AWS Secrets Manager

1. **Allez dans AWS Console** → **Secrets Manager**
2. **Sélectionnez le secret** : `yukpo-backend-secrets`
3. **Vérifiez que DATABASE_URL** pointe vers la base `yukpo` :
   ```
   postgresql://yukpo_admin:PYvHBVetTuWIKNkXgqJcFiU48D39SLwd@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo
   ```
   
   ⚠️ **Important** : L'URL doit se terminer par `/yukpo` et non `/postgres`

### 2. Redémarrer le Backend ECS

1. **Allez dans AWS Console** → **ECS** → **Clusters** → `yukpo-cluster`
2. **Services** → `yukpo-backend-service`
3. **Mise à jour** (Update) → **Forcer un nouveau déploiement** (Force new deployment)
4. Ou simplement **Redémarrer** (Restart) le service

### 3. Vérifier les Logs

Une fois le backend redémarré, vérifiez les logs :

1. **ECS** → **Clusters** → `yukpo-cluster` → **Services** → `yukpo-backend-service`
2. **Onglet "Logs"** ou **CloudWatch Logs**
3. Vous devriez voir :
   - ✅ Base de données accessible
   - ✅ Migrations appliquées (si `ENABLE_AUTO_MIGRATIONS=true`)
   - ✅ Backend démarré avec succès

## 🗑️ N'oubliez Pas de Supprimer l'Instance EC2 Temporaire

Une fois que tout fonctionne, supprimez l'instance EC2 temporaire :

```bash
cd C:\Users\23767\yukpomnang2\infra\aws
terraform destroy -target="aws_instance.temp_db_creator" -target="aws_security_group.temp_ec2" -target="aws_iam_instance_profile.temp_ec2_ssm" -target="aws_iam_role.temp_ec2_ssm" -auto-approve
```

Ou via AWS Console : EC2 → Instances → Terminate

## ✅ Supprimer la Règle de Sécurité Temporaire

Vous pouvez aussi supprimer la règle de sécurité temporaire ajoutée au security group RDS :

```bash
cd C:\Users\23767\yukpomnang2\infra\aws
# Modifier main.tf pour retirer la règle temp_ec2 du security group RDS
terraform apply
```

