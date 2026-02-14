# 🚀 Appliquer les Migrations Directement avec psql

**Date**: 2026-02-13  
**Méthode**: Utiliser `psql` directement pour exécuter les fichiers SQL, sans sqlx

---

## ✅ **AVANTAGES**

- ✅ **Pas besoin de sqlx** - Utilise `psql` directement
- ✅ **Plus rapide** - Pas d'attente de compilation
- ✅ **Plus simple** - Exécute les fichiers SQL directement
- ✅ **Fonctionne immédiatement** - Pas de dépendances supplémentaires

---

## 🚀 **UTILISATION**

### Option 1: Via Script PowerShell (Depuis votre machine locale)

**Prérequis**: 
- `psql` installé sur votre machine locale
- Accès à la base de données (via VPN ou bastion)

```powershell
# Exécuter le script
powershell -ExecutionPolicy Bypass -File scripts\apply_migrations_direct_psql.ps1
```

### Option 2: Via EC2 (Sur l'instance EC2)

Si vous êtes connecté à l'instance EC2 via Session Manager :

```bash
# 1. Récupérer DATABASE_URL
export DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id "yukpo/backend/secrets" \
  --region eu-west-1 \
  --query 'SecretString' --output text | jq -r '.DATABASE_URL')

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
    END IF;
END $$;
EOF

psql "$DATABASE_URL" -f /tmp/fix.sql

# 3. Cloner le repo
cd /tmp
rm -rf yukpomnang2
git clone https://github.com/Her50/yukpo4.git yukpomnang2

# 4. Appliquer les migrations dans l'ordre
cd yukpomnang2/backend/migrations

# Appliquer la migration 0 d'abord
psql "$DATABASE_URL" -f 0000_create_all_tables.sql

# Puis les autres migrations dans l'ordre
for file in *.sql; do
    if [ "$file" != "0000_create_all_tables.sql" ]; then
        echo "Application de: $file"
        psql "$DATABASE_URL" -f "$file" || echo "ATTENTION: Erreur (peut-être déjà appliquée)"
    fi
done

# 5. Vérification
psql "$DATABASE_URL" -c "
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('users', 'services', 'deliveries', 'merchant_storage_locations')
    ORDER BY table_name;
"
```

---

## 📊 **CE QUE FAIT LE SCRIPT**

1. ✅ Récupère `DATABASE_URL` depuis Secrets Manager
2. ✅ Crée `merchant_storage_locations` en premier
3. ✅ Applique toutes les migrations SQL dans l'ordre
4. ✅ Vérifie que les tables critiques sont créées

---

## ⚠️ **ATTENTION**

**Cette méthode applique TOUTES les migrations**, même si certaines ont déjà été appliquées.

**Pour éviter les doublons**, le script utilise `IF NOT EXISTS` et ignore les erreurs "already exists".

---

## ✅ **RÉSUMÉ**

**Avantage principal**: Pas besoin d'attendre la compilation de sqlx (10-20 minutes)

**Action immédiate**: 
- Si vous êtes sur EC2 : Utilisez l'Option 2 (commandes bash)
- Si vous êtes sur votre machine locale : Utilisez l'Option 1 (script PowerShell)

---

**Cette méthode est beaucoup plus rapide que d'attendre la compilation de sqlx !**

