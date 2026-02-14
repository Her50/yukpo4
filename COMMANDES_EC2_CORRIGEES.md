# ✅ Commandes Corrigées pour l'Instance EC2

**Date**: 2026-02-13  
**Instance EC2**: `i-0b9ad404f8d738d04`

---

## 🔧 **PROBLÈMES IDENTIFIÉS ET CORRECTIONS**

1. ❌ **Permissions Secrets Manager manquantes** → ✅ Ajoutées dans Terraform
2. ❌ **git non installé** → ✅ À installer
3. ❌ **psql essaie de se connecter localement** → ✅ Utiliser DATABASE_URL correctement
4. ❌ **sqlx non installé** → ✅ À installer

---

## 🚀 **COMMANDES À EXÉCUTER SUR L'INSTANCE EC2**

**Copiez-collez ces commandes UNE PAR UNE** dans votre session SSM :

### Étape 1: Installer les Dépendances

```bash
sudo yum update -y
sudo yum install -y postgresql15 git jq
```

### Étape 2: Installer Rust (pour sqlx)

```bash
if ! command -v cargo &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
    echo "✅ Rust installé"
else
    echo "✅ Rust déjà installé"
fi
```

### Étape 3: Récupérer DATABASE_URL depuis Secrets Manager

**ATTENTION**: Si vous obtenez encore une erreur de permission, utilisez la Solution Alternative ci-dessous.

```bash
export DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id "yukpo/backend/secrets" \
  --region eu-west-1 \
  --query 'SecretString' --output text | jq -r '.DATABASE_URL')

echo "✅ DATABASE_URL récupérée"
echo "Base de données: $(echo $DATABASE_URL | sed -n 's#.*@\([^:]*\):.*#\1#p')"
echo ""
```

### Étape 4: Créer le Script SQL de Correction

```bash
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

echo "✅ Script SQL créé"
echo ""
```

### Étape 5: Créer merchant_storage_locations

```bash
echo "🔍 Création de merchant_storage_locations..."
psql "$DATABASE_URL" -f /tmp/fix_merchant_storage_locations.sql
echo ""
```

### Étape 6: Installer sqlx

```bash
if ! command -v sqlx &> /dev/null; then
    echo "📦 Installation de sqlx-cli..."
    cargo install sqlx-cli --no-default-features --features postgres
    echo "✅ sqlx installé"
else
    echo "✅ sqlx déjà installé"
fi
echo ""
```

### Étape 7: Cloner le Repo

```bash
echo "📥 Clonage du repo..."
cd /tmp
rm -rf yukpomnang2
git clone https://github.com/Her50/yukpo4.git yukpomnang2
cd yukpomnang2/backend
echo "✅ Repo cloné"
echo ""
```

### Étape 8: Appliquer les Migrations

```bash
echo "🚀 Application des migrations SQLx..."
export DATABASE_URL="$DATABASE_URL"
sqlx migrate run
echo ""
```

### Étape 9: Vérification Finale

```bash
echo "🔍 Vérification finale..."
echo "Nombre de tables:"
psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';
"

echo ""
echo "Tables critiques:"
psql "$DATABASE_URL" -c "
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('users', 'services', 'deliveries', 'merchant_storage_locations')
    ORDER BY table_name;
"
```

---

## 🔧 **SOLUTION ALTERNATIVE - Si Permissions Manquantes**

Si vous obtenez encore une erreur de permission pour Secrets Manager, utilisez DATABASE_URL directement :

```bash
# Utiliser DATABASE_URL directement (temporaire)
export DATABASE_URL="postgresql://yukpo_admin:PYvHBVetTuWIKNkXgqJcFiU48D39SLwd@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo"

# Vérifier la connexion
psql "$DATABASE_URL" -c "SELECT 1;"
```

**⚠️ ATTENTION**: Cette méthode expose le mot de passe. Utilisez-la uniquement pour tester, puis supprimez l'historique avec `history -c`.

---

## 🔧 **CORRECTION TERRAFORM**

J'ai ajouté la permission Secrets Manager dans `infra/aws/temp_ec2_db_creator.tf`. 

**Pour appliquer** :

```bash
cd infra/aws
terraform plan
terraform apply -target=aws_iam_role_policy.temp_ec2_secrets
```

**Puis redémarrer l'instance EC2** pour que le nouveau rôle soit pris en compte :

```bash
aws ec2 reboot-instances --instance-ids i-0b9ad404f8d738d04 --region eu-west-1
```

---

## ✅ **RÉSUMÉ**

**Commandes principales**:
1. Installer dépendances (git, postgresql15, jq)
2. Installer Rust et sqlx
3. Récupérer DATABASE_URL (ou utiliser directement)
4. Créer merchant_storage_locations
5. Cloner repo et appliquer migrations

**Fichiers modifiés**:
- ✅ `infra/aws/temp_ec2_db_creator.tf` - Permission Secrets Manager ajoutée

---

**Action immédiate**: Exécutez les commandes ci-dessus dans votre session SSM, en commençant par l'installation des dépendances.

