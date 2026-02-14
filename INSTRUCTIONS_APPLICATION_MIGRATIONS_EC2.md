# 🚀 Instructions - Application des Migrations via EC2

**Date**: 2026-02-13  
**Instance EC2**: `i-0b9ad404f8d738d04` (yukpo-temp-db-creator)  
**IP Publique**: `52.17.27.232`

---

## ✅ **FICHIERS CRÉÉS**

1. ✅ `scripts/fix_merchant_storage_locations.sql` - Script SQL pour créer la table manquante
2. ✅ `scripts/apply_migrations_ec2_direct.sh` - Script bash pour EC2
3. ✅ `APPLIQUER_MIGRATIONS_EC2_INTERACTIF.md` - Guide détaillé

---

## 🎯 **MÉTHODE RECOMMANDÉE - Session Manager Interactif**

### Étape 1: Se Connecter à l'Instance EC2

**Option A: Via AWS Console (Plus Simple)**

1. Allez dans **AWS Console** → **EC2** → **Instances**
2. Sélectionnez l'instance: `yukpo-temp-db-creator` (ID: `i-0b9ad404f8d738d04`)
3. Cliquez sur **"Connect"** (bouton en haut)
4. Onglet **"Session Manager"**
5. Cliquez sur **"Connect"**

**Option B: Via AWS CLI**

```bash
aws ssm start-session --target i-0b9ad404f8d738d04 --region eu-west-1
```

---

### Étape 2: Exécuter les Commandes sur l'Instance

Une fois connecté à l'instance EC2, copiez-collez ces commandes **UNE PAR UNE** :

```bash
# 1. Récupérer DATABASE_URL depuis Secrets Manager
export DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id "yukpo/backend/secrets" \
  --region eu-west-1 \
  --query 'SecretString' --output text | jq -r '.DATABASE_URL')

echo "✅ DATABASE_URL récupérée"
echo ""
```

```bash
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
        
        RAISE NOTICE '✅ Table merchant_storage_locations créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table merchant_storage_locations existe déjà';
    END IF;
END $$;
EOFSQL

echo "✅ Script SQL créé"
echo ""
```

```bash
# 3. Créer merchant_storage_locations
echo "🔍 Création de merchant_storage_locations..."
psql "$DATABASE_URL" -f /tmp/fix_merchant_storage_locations.sql
echo ""
```

```bash
# 4. Installer sqlx si nécessaire
if ! command -v sqlx &> /dev/null; then
    echo "📦 Installation de sqlx-cli..."
    cargo install sqlx-cli --no-default-features --features postgres
    echo "✅ sqlx installé"
else
    echo "✅ sqlx déjà installé"
fi
echo ""
```

```bash
# 5. Cloner ou mettre à jour le repo
if [ ! -d "/tmp/yukpomnang2" ]; then
    echo "📥 Clonage du repo..."
    cd /tmp
    git clone https://github.com/Her50/yukpo4.git yukpomnang2
    echo "✅ Repo cloné"
else
    echo "🔄 Mise à jour du repo..."
    cd /tmp/yukpomnang2
    git pull
    echo "✅ Repo mis à jour"
fi
echo ""
```

```bash
# 6. Appliquer les migrations
cd /tmp/yukpomnang2/backend
export DATABASE_URL="$DATABASE_URL"
echo "🚀 Application des migrations SQLx..."
sqlx migrate run
echo ""
```

```bash
# 7. Vérification finale
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

## ✅ **RÉSUMÉ**

**Ce qui a été fait**:
1. ✅ Script SQL de correction créé (`fix_merchant_storage_locations.sql`)
2. ✅ Script bash pour EC2 créé (`apply_migrations_ec2_direct.sh`)
3. ✅ Instructions détaillées créées

**Ce qu'il reste à faire**:
1. Se connecter à l'instance EC2 via Session Manager
2. Exécuter les commandes ci-dessus
3. Vérifier que les migrations sont appliquées

---

## 🎯 **ACTION IMMÉDIATE**

**Allez dans AWS Console** → **EC2** → **Instances** → **yukpo-temp-db-creator** → **Connect** → **Session Manager** → **Connect**

Puis copiez-collez les commandes ci-dessus **UNE PAR UNE**.

---

**Besoin d'aide ?** Dites-moi où vous en êtes et je vous guiderai !

