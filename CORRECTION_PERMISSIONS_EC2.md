# 🔧 Correction des Permissions EC2 pour Secrets Manager

**Date**: 2026-02-13  
**Problème**: L'instance EC2 n'a pas les permissions pour accéder à Secrets Manager

---

## ❌ **ERREUR IDENTIFIÉE**

```
An error occurred (AccessDeniedException) when calling the GetSecretValue operation: 
User: arn:aws:sts::108964700972:assumed-role/yukpo-temp-ec2-ssm-role/i-0b9ad404f8d738d04 
is not authorized to perform: secretsmanager:GetSecretValue on resource: yukpo/backend/secrets
```

**Cause**: Le rôle IAM `yukpo-temp-ec2-ssm-role` n'a pas la permission `secretsmanager:GetSecretValue`.

---

## ✅ **SOLUTION 1: Ajouter la Permission via Terraform**

### Modifier `infra/aws/main.tf`

Ajouter la permission Secrets Manager au rôle IAM de l'instance EC2 :

```hcl
# Dans la ressource aws_iam_role_policy pour l'instance EC2
resource "aws_iam_role_policy" "temp_ec2_secrets" {
  name = "yukpo-temp-ec2-secrets-policy"
  role = aws_iam_role.temp_ec2_ssm_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.backend_secrets.arn
        ]
      }
    ]
  })
}
```

Puis appliquer :
```bash
cd infra/aws
terraform plan
terraform apply
```

---

## ✅ **SOLUTION 2: Ajouter la Permission Manuellement via AWS Console**

### Étape 1: Ouvrir le Rôle IAM

1. **Allez dans AWS Console** → **IAM** → **Roles**
2. **Sélectionnez le rôle**: `yukpo-temp-ec2-ssm-role`
3. **Cliquez sur "Add permissions"** → **"Create inline policy"**

### Étape 2: Créer la Politique

1. **Onglet "JSON"**
2. **Collez ce JSON** :

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue",
                "secretsmanager:DescribeSecret"
            ],
            "Resource": "arn:aws:secretsmanager:eu-west-1:108964700972:secret:yukpo/backend/secrets-*"
        }
    ]
}
```

3. **Cliquez sur "Next"**
4. **Nom de la politique**: `yukpo-temp-ec2-secrets-policy`
5. **Cliquez sur "Create policy"**

---

## ✅ **SOLUTION 3: Utiliser DATABASE_URL Directement (Temporaire)**

Si vous avez DATABASE_URL, vous pouvez l'utiliser directement sans passer par Secrets Manager :

```bash
# Sur l'instance EC2, définir DATABASE_URL directement
export DATABASE_URL="postgresql://yukpo_admin:PYvHBVetTuWIKNkXgqJcFiU48D39SLwd@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo"

# Vérifier la connexion
psql "$DATABASE_URL" -c "SELECT 1;"
```

**⚠️ ATTENTION**: Cette méthode expose le mot de passe. Utilisez-la uniquement pour tester, puis supprimez l'historique.

---

## 🚀 **COMMANDES CORRIGÉES POUR L'INSTANCE EC2**

Une fois les permissions corrigées, exécutez ces commandes :

```bash
# 1. Installer les dépendances nécessaires
sudo yum update -y
sudo yum install -y postgresql15 git jq

# 2. Installer Rust et sqlx (si nécessaire)
if ! command -v cargo &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

# 3. Récupérer DATABASE_URL depuis Secrets Manager
export DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id "yukpo/backend/secrets" \
  --region eu-west-1 \
  --query 'SecretString' --output text | jq -r '.DATABASE_URL')

echo "✅ DATABASE_URL récupérée"
echo ""

# 4. Créer le script SQL de correction
cat > /tmp/fix_merchant_storage_locations.sql << 'EOFSQL'
-- Créer merchant_storage_locations AVANT migration 0
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'merchant_storage_locations'
    ) THEN
        CREATE TABLE merchant_storage_locations (
            id SERIAL PRIMARY KEY,
            merchant_id INTEGER,
            name TEXT NOT NULL,
            address TEXT,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            location GEOGRAPHY(Point, 4326),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            capacity_info JSONB DEFAULT '{}'::jsonb,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_merchant 
            ON merchant_storage_locations(merchant_id);
        CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_active 
            ON merchant_storage_locations(is_active) WHERE is_active = TRUE;
        CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_location 
            ON merchant_storage_locations USING GIST (location);
        
        RAISE NOTICE '✅ Table merchant_storage_locations créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table merchant_storage_locations existe déjà';
    END IF;
END $$;
EOFSQL

# 5. Créer merchant_storage_locations
echo "🔍 Création de merchant_storage_locations..."
psql "$DATABASE_URL" -f /tmp/fix_merchant_storage_locations.sql
echo ""

# 6. Installer sqlx si nécessaire
if ! command -v sqlx &> /dev/null; then
    echo "📦 Installation de sqlx-cli..."
    cargo install sqlx-cli --no-default-features --features postgres
    echo "✅ sqlx installé"
else
    echo "✅ sqlx déjà installé"
fi
echo ""

# 7. Cloner le repo
echo "📥 Clonage du repo..."
cd /tmp
rm -rf yukpomnang2
git clone https://github.com/Her50/yukpo4.git yukpomnang2
cd yukpomnang2/backend
echo "✅ Repo cloné"
echo ""

# 8. Appliquer les migrations
echo "🚀 Application des migrations SQLx..."
export DATABASE_URL="$DATABASE_URL"
sqlx migrate run
echo ""

# 9. Vérification finale
echo "🔍 Vérification finale..."
psql "$DATABASE_URL" -c "
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('users', 'services', 'deliveries', 'merchant_storage_locations')
    ORDER BY table_name;
"
```

---

## ✅ **RÉSUMÉ**

**Problèmes identifiés**:
1. ❌ Permissions Secrets Manager manquantes
2. ❌ git non installé
3. ❌ psql non installé
4. ❌ sqlx non installé

**Solutions**:
1. ✅ Ajouter la permission Secrets Manager au rôle IAM
2. ✅ Installer les dépendances (git, postgresql15, jq)
3. ✅ Installer Rust et sqlx

**Action immédiate**: Utiliser la Solution 3 (DATABASE_URL directe) pour tester rapidement, puis corriger les permissions IAM pour une solution permanente.

