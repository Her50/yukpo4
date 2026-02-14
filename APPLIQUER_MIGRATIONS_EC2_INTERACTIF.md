# 🚀 Application des Migrations via EC2 - Mode Interactif

**Date**: 2026-02-13  
**Instance EC2**: `i-0b9ad404f8d738d04` (yukpo-temp-db-creator)

---

## ✅ **MÉTHODE RECOMMANDÉE - Session Manager Interactif**

### Étape 1: Se Connecter à l'Instance EC2

**Via AWS Console**:
1. Allez dans **AWS Console** → **EC2** → **Instances**
2. Sélectionnez l'instance: `yukpo-temp-db-creator` (ID: `i-0b9ad404f8d738d04`)
3. Cliquez sur **"Connect"** (en haut)
4. Onglet **"Session Manager"**
5. Cliquez sur **"Connect"**

**Via AWS CLI**:
```bash
aws ssm start-session --target i-0b9ad404f8d738d04 --region eu-west-1
```

---

### Étape 2: Exécuter les Commandes sur l'Instance

Une fois connecté à l'instance EC2, exécutez ces commandes :

```bash
# 1. Récupérer DATABASE_URL depuis Secrets Manager
export DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id "yukpo/backend/secrets" \
  --region eu-west-1 \
  --query 'SecretString' --output text | jq -r '.DATABASE_URL')

echo "DATABASE_URL récupérée"
echo ""

# 2. Créer le script SQL de correction
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
        
        RAISE NOTICE 'OK: Table merchant_storage_locations créée';
    ELSE
        RAISE NOTICE 'INFO: Table merchant_storage_locations existe déjà';
    END IF;
END $$;
EOFSQL

# 3. Créer merchant_storage_locations
echo "Création de merchant_storage_locations..."
psql "$DATABASE_URL" -f /tmp/fix_merchant_storage_locations.sql
echo ""

# 4. Installer sqlx si nécessaire
if ! command -v sqlx &> /dev/null; then
    echo "Installation de sqlx-cli..."
    cargo install sqlx-cli --no-default-features --features postgres
fi

# 5. Cloner ou mettre à jour le repo
if [ ! -d "/tmp/yukpomnang2" ]; then
    cd /tmp
    git clone https://github.com/Her50/yukpo4.git yukpomnang2
else
    cd /tmp/yukpomnang2
    git pull
fi

# 6. Appliquer les migrations
cd /tmp/yukpomnang2/backend
export DATABASE_URL="$DATABASE_URL"
echo "Application des migrations SQLx..."
sqlx migrate run

# 7. Vérification finale
echo ""
echo "Vérification finale..."
psql "$DATABASE_URL" -c "
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
    LIMIT 20;
"
```

---

## ✅ **ALTERNATIVE - Utiliser le Script Bash**

Si vous préférez utiliser le script bash créé :

```bash
# 1. Se connecter à l'instance EC2
aws ssm start-session --target i-0b9ad404f8d738d04 --region eu-west-1

# 2. Sur l'instance, cloner le repo
cd /tmp
git clone https://github.com/Her50/yukpo4.git yukpomnang2
cd yukpomnang2

# 3. Exécuter le script
bash scripts/apply_migrations_ec2_direct.sh
```

---

## 📊 **VÉRIFICATION**

Après l'application, vérifiez que les tables sont créées :

```bash
psql "$DATABASE_URL" -c "
    SELECT COUNT(*) as total_tables
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';
"

# Vérifier les tables critiques
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

**Méthode recommandée**: Utiliser Session Manager interactif pour exécuter les commandes directement.

**Avantages**:
- ✅ Pas besoin de gérer l'échappement de caractères
- ✅ Vous voyez la sortie en temps réel
- ✅ Plus facile à déboguer

**Fichiers créés**:
- ✅ `scripts/apply_migrations_ec2_direct.sh` - Script bash pour EC2
- ✅ `APPLIQUER_MIGRATIONS_EC2_INTERACTIF.md` - Ce document

---

**Action immédiate**: Se connecter à l'instance EC2 via Session Manager et exécuter les commandes ci-dessus.

