#!/usr/bin/env python3
"""
Script pour créer les tables manquantes directement sur AWS RDS
Récupère DATABASE_URL depuis AWS SSM Parameter Store et exécute les migrations SQL correspondantes
"""
import os
import sys
import boto3
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from pathlib import Path

# Configuration
SSM_PARAMETER_PATH = os.getenv("SSM_DATABASE_URL_PATH", "/yukpomnang/production/DATABASE_URL")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
MIGRATIONS_DIR = Path(__file__).parent.parent / "backend" / "migrations"

# Mapping des tables manquantes vers les fichiers de migration
TABLE_TO_MIGRATION = {
    "product_creation_queue": "20260102_create_product_creation_queue.sql",
    "deliveries": "20251110005_104_create_delivery_core.sql",
    "delivery_matching_queue": "20251115001_create_delivery_matching_tables.sql",
    "delivery_proximity_suggestions": None,  # Créée dans auto_migrate.rs
    "product_orders": "20250120_001_add_order_preparation_system.sql",
    "global_promo_events": "20251115002_create_global_promo_platform.sql",
    "live_flash_sales": "20251111001_002_create_live_flash_sales.sql",
    "social_publication_jobs": "20251111002_create_social_connectors.sql",
    "video_generation_jobs": None,  # Créée dans auto_migrate.rs
}

def get_database_url_from_ssm() -> str:
    """Récupère DATABASE_URL depuis AWS SSM Parameter Store"""
    print(f"🔍 Récupération de DATABASE_URL depuis SSM: {SSM_PARAMETER_PATH}")
    
    try:
        ssm_client = boto3.client('ssm', region_name=AWS_REGION)
        response = ssm_client.get_parameter(
            Name=SSM_PARAMETER_PATH,
            WithDecryption=True
        )
        database_url = response['Parameter']['Value']
        print(f"✅ DATABASE_URL récupérée depuis SSM")
        return database_url
    except Exception as e:
        print(f"❌ Erreur lors de la récupération depuis SSM: {e}")
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            print(f"⚠️ Utilisation de DATABASE_URL depuis l'environnement")
            return database_url
        else:
            print(f"❌ DATABASE_URL non disponible")
            sys.exit(1)


def check_table_exists(conn, table_name: str) -> bool:
    """Vérifie si une table existe"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT EXISTS(
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = %s
        )
    """, (table_name,))
    exists = cursor.fetchone()[0]
    cursor.close()
    return exists


def execute_migration_file(conn, migration_file: Path):
    """Exécute un fichier de migration SQL"""
    if not migration_file.exists():
        print(f"  ⚠️ Fichier de migration non trouvé: {migration_file}")
        return False
    
    print(f"  📄 Exécution de: {migration_file.name}")
    
    try:
        cursor = conn.cursor()
        with open(migration_file, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        # Exécuter le SQL (gérer les blocs DO $$)
        cursor.execute(sql_content)
        conn.commit()
        cursor.close()
        print(f"  ✅ Migration exécutée avec succès")
        return True
    except psycopg2.Error as e:
        # Ignorer les erreurs "already exists" et "duplicate"
        error_str = str(e).lower()
        if "already exists" in error_str or "duplicate" in error_str:
            print(f"  ⚠️ Table/objet existe déjà (ignoré)")
            conn.rollback()
            return True
        print(f"  ❌ Erreur: {e}")
        conn.rollback()
        return False


def create_table_from_migration(conn, table_name: str, migration_file: str):
    """Crée une table en exécutant sa migration SQL"""
    if migration_file is None:
        print(f"  ⚠️ Pas de migration SQL pour {table_name} (créée dans auto_migrate.rs)")
        return False
    
    migration_path = MIGRATIONS_DIR / migration_file
    return execute_migration_file(conn, migration_path)


def main():
    """Fonction principale"""
    print("=" * 80)
    print("🔧 Création des tables manquantes sur AWS RDS")
    print("=" * 80)
    print()
    
    # Récupérer DATABASE_URL depuis SSM
    database_url = get_database_url_from_ssm()
    print()
    
    try:
        print("🔌 Connexion à la base de données...")
        conn = psycopg2.connect(database_url)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        print("✅ Connecté à la base de données")
        print()
        
        # Vérifier quelles tables manquent
        print("🔍 Vérification des tables manquantes...")
        missing = []
        for table in TABLE_TO_MIGRATION.keys():
            if not check_table_exists(conn, table):
                missing.append(table)
                print(f"  ❌ {table} - MANQUANTE")
            else:
                print(f"  ✅ {table} - Existe")
        
        print()
        
        if not missing:
            print("✅ Toutes les tables existent déjà!")
            return
        
        print(f"🔄 Création de {len(missing)} table(s) manquante(s)...")
        print()
        
        # Ordre d'exécution des migrations (dépendances)
        execution_order = [
            "deliveries",  # Doit être créée en premier
            "delivery_matching_queue",  # Dépend de deliveries
            "product_orders",  # Dépend de deliveries
            "product_creation_queue",
            "global_promo_events",
            "live_flash_sales",
            "social_publication_jobs",
            "delivery_proximity_suggestions",  # Créée dans auto_migrate.rs
            "video_generation_jobs",  # Créée dans auto_migrate.rs
        ]
        
        # Exécuter les migrations dans l'ordre
        created_count = 0
        for table_name in execution_order:
            if table_name in missing:
                print(f"🔧 Création de {table_name}...")
                migration_file = TABLE_TO_MIGRATION.get(table_name)
                if create_table_from_migration(conn, table_name, migration_file):
                    created_count += 1
                print()
        
        print(f"✅ {created_count}/{len(missing)} table(s) créée(s)")
        
        print()
        print("=" * 80)
        print("✅ Tables créées avec succès")
        print("=" * 80)
        
        conn.close()
        
    except psycopg2.Error as e:
        print(f"❌ Erreur PostgreSQL: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Erreur: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

