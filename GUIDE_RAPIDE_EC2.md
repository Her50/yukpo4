# 🚀 Guide Rapide - Application Migrations via EC2

**Date**: 2026-02-13  
**Instance EC2**: `i-0b9ad404f8d738d04`

---

## ⚡ **SOLUTION RAPIDE - Utiliser DATABASE_URL Directement**

Puisque les permissions Secrets Manager ne sont pas encore appliquées, utilisez DATABASE_URL directement :

### Sur l'Instance EC2 (Session SSM), exécutez :

```bash
# 1. Installer les dépendances
sudo yum update -y
sudo yum install -y postgresql15 git jq

# 2. Installer Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source $HOME/.cargo/env

# 3. Utiliser DATABASE_URL directement
export DATABASE_URL="postgresql://yukpo_admin:PYvHBVetTuWIKNkXgqJcFiU48D39SLwd@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo"

# 4. Vérifier la connexion
psql "$DATABASE_URL" -c "SELECT 1;"

# 5. Créer merchant_storage_locations
cat > /tmp/fix.sql << 'EOF'
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
    END IF;
END $$;
EOF

psql "$DATABASE_URL" -f /tmp/fix.sql

# 6. Installer sqlx
cargo install sqlx-cli --no-default-features --features postgres

# 7. Cloner le repo
cd /tmp
rm -rf yukpomnang2
git clone https://github.com/Her50/yukpo4.git yukpomnang2

# 8. Appliquer les migrations
cd yukpomnang2/backend
export DATABASE_URL="$DATABASE_URL"
sqlx migrate run

# 9. Vérification
psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'services', 'deliveries', 'merchant_storage_locations') ORDER BY table_name;"
```

---

## 🔧 **CORRECTION PERMANENTE - Permissions IAM**

J'ai ajouté la permission Secrets Manager dans `infra/aws/temp_ec2_db_creator.tf`.

**Pour appliquer** (depuis votre machine locale) :

```bash
cd infra/aws
terraform apply
```

**Puis redémarrer l'instance EC2** :

```bash
aws ec2 reboot-instances --instance-ids i-0b9ad404f8d738d04 --region eu-west-1
```

---

## ✅ **RÉSUMÉ**

**Action immédiate**: Utilisez DATABASE_URL directement (Solution Rapide ci-dessus)

**Action permanente**: Appliquez la correction Terraform pour les permissions IAM

**Fichiers modifiés**:
- ✅ `infra/aws/temp_ec2_db_creator.tf` - Permission Secrets Manager ajoutée
- ✅ `COMMANDES_EC2_CORRIGEES.md` - Guide détaillé
- ✅ `GUIDE_RAPIDE_EC2.md` - Ce guide rapide

