# 🔍 Vérifier et Corriger DATABASE_URL dans AWS Secrets Manager

## ✅ Configuration Terraform

D'après la configuration Terraform :
- **Variable** : `rds_database_name = "yukpo"` ✅
- **DATABASE_URL attendu** : `postgresql://yukpo_admin:...@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo` ✅

## 📋 Vérification dans AWS Console

### Étape 1 : Accéder à Secrets Manager

1. **Allez dans AWS Console** → **Secrets Manager**
2. **Recherchez** : `yukpo/backend/secrets` ou `yukpo-backend-secrets`
3. **Cliquez sur le secret**

### Étape 2 : Vérifier DATABASE_URL

1. **Onglet "Secret value"** (Valeur du secret)
2. **Cliquez sur "Retrieve secret value"** (Récupérer la valeur du secret)
3. **Vérifiez que DATABASE_URL** se termine par `/yukpo` :

```json
{
  "DATABASE_URL": "postgresql://yukpo_admin:PYvHBVetTuWIKNkXgqJcFiU48D39SLwd@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo",
  ...
}
```

⚠️ **Important** : L'URL doit se terminer par `/yukpo` et **PAS** `/postgres`

### Étape 3 : Si DATABASE_URL est incorrect

Si l'URL se termine par `/postgres` ou une autre base, mettez à jour :

1. **Cliquez sur "Edit"** (Modifier)
2. **Modifiez DATABASE_URL** pour qu'il se termine par `/yukpo`
3. **Sauvegardez**

## 🔧 Mise à Jour via AWS CLI (Alternative)

Si vous avez AWS CLI configuré :

```bash
aws secretsmanager update-secret \
  --secret-id yukpo/backend/secrets \
  --secret-string '{
    "DATABASE_URL": "postgresql://yukpo_admin:PYvHBVetTuWIKNkXgqJcFiU48D39SLwd@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo",
    "REDIS_URL": "redis://...",
    "JWT_SECRET": "...",
    "RUST_LOG": "info",
    "PORT": "8080",
    "HOST": "0.0.0.0",
    "APP_ENV": "production",
    "ENABLE_AUTO_MIGRATIONS": "true"
  }' \
  --region eu-west-1
```

## 🔧 Mise à Jour via Terraform (Recommandé)

Si vous préférez utiliser Terraform :

```bash
cd C:\Users\23767\yukpomnang2\infra\aws
terraform apply -target="aws_secretsmanager_secret_version.backend_secrets" -auto-approve
```

Cela mettra à jour le secret avec la valeur correcte depuis Terraform.

## ✅ Après la Mise à Jour

1. **Redémarrez le service ECS** :
   - ECS → Clusters → `yukpo-cluster` → Services → `yukpo-backend-service`
   - **Mise à jour** → **Forcer un nouveau déploiement**

2. **Vérifiez les logs** pour confirmer que le backend se connecte à la base `yukpo`

