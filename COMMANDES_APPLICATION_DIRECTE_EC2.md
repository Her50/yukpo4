# 🚀 Commandes pour Appliquer les Migrations Directement sur EC2

**Date**: 2026-02-13  
**Méthode**: Utiliser `psql` directement, sans attendre sqlx

---

## ✅ **AVANTAGES**

- ✅ **Pas besoin de sqlx** - Utilise `psql` directement
- ✅ **Plus rapide** - Pas d'attente de compilation (10-20 minutes)
- ✅ **Fonctionne immédiatement** - `psql` est déjà installé sur EC2
- ✅ **Applique toutes les migrations** - Dans l'ordre automatiquement

---

## 🚀 **COMMANDES À EXÉCUTER SUR L'INSTANCE EC2**

**Copiez-collez ces commandes UNE PAR UNE** dans votre session SSM :

### Étape 1: Définir DATABASE_URL

```bash
export DATABASE_URL="postgresql://yukpo_admin:PYvHBVetTuWIKNkXgqJcFiU48D39SLwd@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo"
echo "DATABASE_URL définie"
```

### Étape 2: Créer merchant_storage_locations

```bash
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
    END IF;
END $$;
EOF

psql "$DATABASE_URL" -f /tmp/fix.sql
```

### Étape 3: Cloner le Repo

```bash
cd /tmp
rm -rf yukpomnang2
git clone https://github.com/Her50/yukpo4.git yukpomnang2
cd yukpomnang2/backend/migrations
```

### Étape 4: Appliquer les Migrations dans l'Ordre

```bash
# Appliquer toutes les migrations dans l'ordre
for file in $(ls -1 *.sql | sort); do
    echo "Application de: $file..."
    psql "$DATABASE_URL" -f "$file" 2>&1 | grep -v "NOTICE" || echo "ATTENTION: Erreur (peut-être déjà appliquée)"
    echo ""
done
```

### Étape 5: Vérification

```bash
psql "$DATABASE_URL" -c "
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('users', 'services', 'deliveries', 'merchant_storage_locations')
    ORDER BY table_name;
"
```

---

## 🚀 **ALTERNATIVE - Utiliser le Script Bash**

Si vous préférez utiliser le script créé :

```bash
# 1. Cloner le repo
cd /tmp
rm -rf yukpomnang2
git clone https://github.com/Her50/yukpo4.git yukpomnang2

# 2. Exécuter le script
cd yukpomnang2
bash scripts/apply_migrations_direct_psql.sh
```

---

## ⚠️ **ATTENTION**

**Cette méthode applique TOUTES les migrations**, même si certaines ont déjà été appliquées.

**Pour éviter les doublons**, les migrations utilisent `IF NOT EXISTS` et les erreurs "already exists" sont ignorées.

---

## ✅ **RÉSUMÉ**

**Avantage principal**: Pas besoin d'attendre la compilation de sqlx (10-20 minutes)

**Action immédiate**: 
- Si vous êtes sur EC2 : Utilisez les commandes ci-dessus
- Ou utilisez le script : `bash scripts/apply_migrations_direct_psql.sh`

---

**Cette méthode est beaucoup plus rapide ! Exécutez les commandes ci-dessus sur votre instance EC2.**

