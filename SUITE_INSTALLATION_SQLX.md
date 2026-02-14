# 🚀 Suite - Installation de sqlx-cli

**Date**: 2026-02-13  
**État**: Rust installé ✅

---

## ✅ **ÉTAPE SUIVANTE - Installer sqlx-cli**

Rust est installé. Maintenant, installez sqlx-cli :

```bash
# 1. Charger l'environnement Rust (si pas déjà fait)
source $HOME/.cargo/env

# 2. Installer sqlx-cli via cargo
echo "📦 Installation de sqlx-cli via cargo..."
echo "⏳ Cela peut prendre 10-20 minutes sur une t3.micro..."
echo "   Ne fermez pas la session !"
echo ""
cargo install sqlx-cli --no-default-features --features postgres

# 3. Vérifier
echo ""
echo "🔍 Vérification..."
sqlx --version
```

---

## ⏳ **TEMPS D'ATTENTE**

- **Compilation de sqlx-cli**: 10-20 minutes sur une t3.micro
- **C'est normal que ça prenne du temps !** Ne fermez pas la session.

---

## 📊 **CE QUI VA SE PASSER**

Vous allez voir beaucoup de messages de compilation comme :
```
   Compiling tokio v1.49.0
   Compiling futures-util v0.3.31
   Building [==========>               ] 92/201: tokio, futures-util
```

**C'est normal !** Laissez la compilation se terminer.

---

## ✅ **APRÈS L'INSTALLATION**

Une fois que vous voyez :
```
Installed sqlx-cli v0.8.6
```

Exécutez ces commandes pour appliquer les migrations :

```bash
# 1. Définir DATABASE_URL
export DATABASE_URL="postgresql://yukpo_admin:PYvHBVetTuWIKNkXgqJcFiU48D39SLwd@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo"

# 2. Créer merchant_storage_locations
cat > /tmp/fix.sql << 'EOF'
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'merchant_storage_locations') THEN
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
        CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_merchant ON merchant_storage_locations(merchant_id);
        CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_active ON merchant_storage_locations(is_active) WHERE is_active = TRUE;
        CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_location ON merchant_storage_locations USING GIST (location);
        RAISE NOTICE '✅ Table merchant_storage_locations créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table merchant_storage_locations existe déjà';
    END IF;
END $$;
EOF

psql "$DATABASE_URL" -f /tmp/fix.sql
echo ""

# 3. Cloner le repo
echo "📥 Clonage du repo..."
cd /tmp
rm -rf yukpomnang2
git clone https://github.com/Her50/yukpo4.git yukpomnang2
echo "✅ Repo cloné"
echo ""

# 4. Appliquer les migrations
echo "🚀 Application des migrations SQLx..."
cd yukpomnang2/backend
export DATABASE_URL="$DATABASE_URL"
sqlx migrate run
echo ""

# 5. Vérification finale
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

**État actuel**: Rust installé ✅

**Prochaine étape**: Installer sqlx-cli via cargo (10-20 minutes)

**Action immédiate**: Exécutez les commandes ci-dessus et attendez la fin de la compilation.

---

**Exécutez les commandes et laissez la compilation se terminer. Dites-moi quand vous voyez "Installed sqlx-cli v0.8.6" !**

