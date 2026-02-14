# ✅ Étapes Après Redémarrage de l'Instance EC2

**Date**: 2026-02-13  
**Instance**: `i-0b9ad404f8d738d04`  
**Action**: Redémarrage effectué

---

## ⏳ **ATTENDRE 2-3 MINUTES**

Après le redémarrage, attendez **2-3 minutes** pour que :
1. L'instance démarre complètement
2. L'agent SSM se connecte avec les nouvelles credentials
3. Le statut passe à "En ligne" dans Session Manager

---

## 🔍 **VÉRIFICATION - Session Manager**

1. **Allez dans AWS Console** → **EC2** → **Instances**
2. **Sélectionnez l'instance**: `i-0b9ad404f8d738d04`
3. **Cliquez sur "Connect"** → **Onglet "Session Manager"**
4. **Vérifiez le statut**:
   - ✅ **"En ligne"** (Online) avec coche verte → **Parfait !** Cliquez sur "Connect"
   - ❌ **"Hors ligne"** (Offline) → Attendez encore 1-2 minutes, puis réessayez

---

## 🚀 **UNE FOIS CONNECTÉ - Continuer les Migrations**

### Option 1: Utiliser le Binaire Précompilé de sqlx (Recommandé - 30 secondes)

```bash
# 1. Télécharger le binaire précompilé
cd /tmp
wget https://github.com/launchbadge/sqlx/releases/download/v0.8.6/sqlx-cli-v0.8.6-x86_64-unknown-linux-musl.tar.gz

# 2. Extraire
tar -xzf sqlx-cli-v0.8.6-x86_64-unknown-linux-musl.tar.gz

# 3. Installer
sudo mv sqlx /usr/local/bin/
chmod +x /usr/local/bin/sqlx

# 4. Vérifier
sqlx --version
```

### Option 2: Continuer la Compilation de sqlx (Si elle était en cours)

Si la compilation de sqlx était en cours avant la déconnexion, elle a été interrompue. Il vaut mieux utiliser le binaire précompilé (Option 1) pour gagner du temps.

---

## 📝 **SUITE - Appliquer les Migrations**

Une fois sqlx installé (binaire ou compilation), exécutez :

```bash
# 1. Définir DATABASE_URL
export DATABASE_URL="postgresql://yukpo_admin:PYvHBVetTuWIKNkXgqJcFiU48D39SLwd@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo"

# 2. Créer merchant_storage_locations (si pas déjà fait)
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

# 4. Appliquer les migrations
cd yukpomnang2/backend
export DATABASE_URL="$DATABASE_URL"
sqlx migrate run

# 5. Vérification
psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'services', 'deliveries', 'merchant_storage_locations') ORDER BY table_name;"
```

---

## ✅ **RÉSUMÉ**

**Action effectuée**: Redémarrage de l'instance EC2

**Prochaines étapes**:
1. ⏳ Attendre 2-3 minutes
2. 🔍 Vérifier Session Manager (devrait être "En ligne")
3. 🚀 Se connecter et continuer les migrations
4. ✅ Utiliser le binaire précompilé de sqlx (plus rapide)

---

**Dites-moi quand vous êtes reconnecté et je vous guiderai pour la suite !**

