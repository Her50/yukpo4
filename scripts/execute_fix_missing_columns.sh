#!/bin/bash
# Script pour exécuter le script SQL de correction des colonnes manquantes
# Usage: ./execute_fix_missing_columns.sh

set -e

# Configuration
DATABASE_URL="${DATABASE_URL:-postgresql://yukpo_admin:PYvHBVetTuWIKNkXgqJcFiU48D39SLwd@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo}"
SQL_FILE="fix_missing_columns.sql"

echo "🔧 Exécution du script de correction des colonnes manquantes..."
echo "=========================================="
echo ""

# Vérifier que psql est installé
if ! command -v psql &> /dev/null; then
    echo "❌ ERREUR: psql n'est pas installé"
    echo "   Installez-le avec: sudo yum install postgresql15 -y"
    exit 1
fi

# Extraire les composants de DATABASE_URL
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p' || echo "5432")
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')

echo "📊 Informations de connexion:"
echo "   User: $DB_USER"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo ""

# Vérifier la connectivité
echo "🔍 Vérification de la connectivité..."
export PGPASSWORD="$DB_PASS"
if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" >/dev/null 2>&1; then
    echo "❌ ERREUR: Impossible de se connecter à la base de données"
    echo "   Vérifiez vos identifiants et que l'instance est accessible"
    exit 1
fi
echo "✅ Connexion réussie"
echo ""

# Créer le script SQL inline si le fichier n'existe pas
if [ ! -f "$SQL_FILE" ]; then
    echo "📝 Création du script SQL inline..."
    cat > /tmp/fix_missing_columns.sql << 'EOFSQL'
-- Script pour corriger les colonnes manquantes identifiées dans les logs
-- À exécuter sur la base de données PostgreSQL

-- 1. Vérifier et ajouter display_name à global_promo_events si manquante
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'global_promo_events' 
        AND column_name = 'display_name'
    ) THEN
        ALTER TABLE global_promo_events 
        ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
        
        -- Mettre à jour les valeurs existantes si nécessaire
        UPDATE global_promo_events 
        SET display_name = COALESCE(theme, slug, 'Event') 
        WHERE display_name = '';
    END IF;
END $$;

-- 2. Vérifier et ajouter promo_price_cfa à live_flash_sales si manquante
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'live_flash_sales' 
        AND column_name = 'promo_price_cfa'
    ) THEN
        ALTER TABLE live_flash_sales 
        ADD COLUMN promo_price_cfa NUMERIC(14,2) NOT NULL DEFAULT 0 
        CHECK (promo_price_cfa >= 0);
    END IF;
END $$;

-- 3. Vérifier et ajouter suggested_status à delivery_proximity_suggestions si manquante
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_proximity_suggestions' 
        AND column_name = 'suggested_status'
    ) THEN
        ALTER TABLE delivery_proximity_suggestions 
        ADD COLUMN suggested_status TEXT;
    END IF;
END $$;

-- 4. Vérifier et ajouter awaiting_courier_confirmation à l'enum delivery_status si manquante
DO $$
BEGIN
    -- Vérifier si la valeur existe dans l'enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'awaiting_courier_confirmation' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'delivery_status')
    ) THEN
        -- Ajouter la valeur à l'enum
        ALTER TYPE delivery_status ADD VALUE IF NOT EXISTS 'awaiting_courier_confirmation';
    END IF;
END $$;

-- 5. Vérifier que la table live_flash_sales existe et a toutes les colonnes nécessaires
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'live_flash_sales'
    ) THEN
        RAISE NOTICE 'Table live_flash_sales n''existe pas. Création nécessaire via migrations.';
    END IF;
END $$;

-- 6. Vérifier que la table global_promo_events existe et a toutes les colonnes nécessaires
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'global_promo_events'
    ) THEN
        RAISE NOTICE 'Table global_promo_events n''existe pas. Création nécessaire via migrations.';
    END IF;
END $$;

-- 7. Vérifier que la table delivery_proximity_suggestions existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'delivery_proximity_suggestions'
    ) THEN
        RAISE NOTICE 'Table delivery_proximity_suggestions n''existe pas. Création nécessaire via migrations.';
    END IF;
END $$;
EOFSQL
    SQL_FILE="/tmp/fix_missing_columns.sql"
fi

# Exécuter le script SQL
echo "🛠️  Exécution du script SQL..."
echo "   Fichier: $SQL_FILE"
echo ""

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SQL_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Script SQL exécuté avec succès"
else
    echo ""
    echo "⚠️  Le script SQL a généré des warnings ou erreurs"
    echo "💡 Note: Certaines erreurs peuvent être normales si les colonnes existent déjà"
fi

echo ""
echo "✅ Correction terminée"



