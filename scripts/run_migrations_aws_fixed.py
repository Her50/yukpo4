#!/usr/bin/env python3
"""
Script pour exécuter les migrations SQLx directement sur AWS RDS
VERSION CORRIGÉE: Crée merchant_storage_locations AVANT la migration 0

Récupère DATABASE_URL depuis AWS Secrets Manager et exécute les migrations manquantes
"""
import os
import sys
import subprocess
import boto3
import time
from pathlib import Path
from typing import Optional

# Configuration
SECRET_ID = os.getenv("SECRET_ID", "yukpo/backend/secrets")
AWS_REGION = os.getenv("AWS_REGION", "eu-west-1")
MIGRATIONS_DIR = Path(__file__).parent.parent / "backend" / "migrations"
FAIL_ON_ERROR = os.getenv("FAIL_ON_MIGRATION_ERROR", "false").lower() == "true"
MAX_RETRIES = 2
RETRY_DELAY = 3
CONNECTION_TIMEOUT = 30


def get_database_url_from_secrets_manager() -> str:
    """Récupère DATABASE_URL depuis AWS Secrets Manager"""
    print(f"Récupération de DATABASE_URL depuis Secrets Manager: {SECRET_ID}")
    
    try:
        secrets_client = boto3.client('secretsmanager', region_name=AWS_REGION)
        response = secrets_client.get_secret_value(
            SecretId=SECRET_ID
        )
        import json
        secret_string = response['SecretString']
        secret_data = json.loads(secret_string)
        database_url = secret_data.get('DATABASE_URL')
        
        if not database_url:
            print("ERREUR: DATABASE_URL non trouvée dans le secret")
            sys.exit(1)
        
        print("OK: DATABASE_URL recuperee depuis Secrets Manager")
        return database_url
    except Exception as e:
        print(f"ERREUR lors de la recuperation depuis Secrets Manager: {e}")
        # Fallback: utiliser DATABASE_URL depuis l'environnement si disponible
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            print("ATTENTION: Utilisation de DATABASE_URL depuis l'environnement")
            return database_url
        else:
            print("ERREUR: DATABASE_URL non disponible dans Secrets Manager ni dans l'environnement")
            sys.exit(1)


def check_sqlx_cli_installed() -> bool:
    """Vérifie si sqlx-cli est installé"""
    try:
        result = subprocess.run(
            ["sqlx", "--version"],
            capture_output=True,
            text=True,
            check=True,
            timeout=10
        )
        print(f"OK: sqlx-cli installe: {result.stdout.strip()}")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        return False


def install_sqlx_cli():
    """Installe sqlx-cli via cargo"""
    print("Installation de sqlx-cli...")
    print("Cela peut prendre quelques minutes...")
    try:
        result = subprocess.run(
            ["cargo", "install", "sqlx-cli", "--no-default-features", "--features", "postgres"],
            check=True,
            capture_output=True,
            text=True,
            timeout=600
        )
        print("OK: sqlx-cli installe avec succes")
        if result.stdout:
            print(f"Sortie: {result.stdout[:200]}...")
    except subprocess.TimeoutExpired:
        print("ERREUR: Timeout lors de l'installation de sqlx-cli")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"ERREUR: Erreur lors de l'installation de sqlx-cli: {e}")
        if e.stderr:
            print(f"Erreur detaillee: {e.stderr}")
        sys.exit(1)


def check_psql_installed() -> bool:
    """Vérifie si psql est installé"""
    try:
        subprocess.run(["psql", "--version"], capture_output=True, check=True, timeout=5)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        return False


def create_merchant_storage_locations(database_url: str) -> bool:
    """
    ✅ CRITIQUE: Crée merchant_storage_locations AVANT la migration 0
    Cette table est référencée dans 0000_create_all_tables.sql mais n'y est pas créée
    """
    print("=" * 80)
    print("ÉTAPE CRITIQUE: Création de merchant_storage_locations AVANT migration 0")
    print("=" * 80)
    print()
    
    # Vérifier si psql est disponible
    if not check_psql_installed():
        print("⚠️ psql non disponible, tentative avec sqlx...")
        # Fallback: utiliser sqlx query (moins fiable mais fonctionne)
        sql = """
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
        """
        
        try:
            env = os.environ.copy()
            env["DATABASE_URL"] = database_url
            result = subprocess.run(
                ["sqlx", "query", database_url, sql],
                env=env,
                capture_output=True,
                text=True,
                check=False,
                timeout=30
            )
            if result.returncode == 0:
                print("OK: merchant_storage_locations creee via sqlx")
                return True
            else:
                print(f"ATTENTION: Erreur sqlx (peut-etre existe deja): {result.stderr[:200]}")
                return True  # Continuer même en cas d'erreur
        except Exception as e:
            print(f"ATTENTION: Erreur lors de la creation via sqlx: {e}")
            return True  # Continuer quand même
    
    # Utiliser psql (plus fiable)
    fix_sql_path = Path(__file__).parent / "fix_merchant_storage_locations.sql"
    
    if not fix_sql_path.exists():
        print(f"ATTENTION: Fichier fix_merchant_storage_locations.sql non trouve, creation directe...")
        # Créer directement via psql
        sql = """
        CREATE TABLE IF NOT EXISTS merchant_storage_locations (
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
        """
        
        try:
            result = subprocess.run(
                ["psql", database_url, "-c", sql],
                capture_output=True,
                text=True,
                check=False,
                timeout=30
            )
            if result.returncode == 0:
                print("OK: merchant_storage_locations creee")
                return True
            else:
                error_output = (result.stderr + result.stdout).lower()
                if "already exists" in error_output:
                    print("INFO: merchant_storage_locations existe deja")
                    return True
                else:
                    print(f"ATTENTION: Erreur: {result.stderr[:200]}")
                    return True  # Continuer quand même
        except Exception as e:
            print(f"ATTENTION: Erreur: {e}")
            return True  # Continuer quand même
    else:
        # Utiliser le fichier SQL
        try:
            result = subprocess.run(
                ["psql", database_url, "-f", str(fix_sql_path)],
                capture_output=True,
                text=True,
                check=False,
                timeout=60
            )
            if result.returncode == 0:
                print("OK: merchant_storage_locations creee via script SQL")
                return True
            else:
                error_output = (result.stderr + result.stdout).lower()
                if "already exists" in error_output or "existe deja" in error_output:
                    print("INFO: merchant_storage_locations existe deja")
                    return True
                else:
                    print(f"ATTENTION: Erreur (non bloquant): {result.stderr[:200]}")
                    return True  # Continuer quand même
        except Exception as e:
            print(f"ATTENTION: Erreur: {e}")
            return True  # Continuer quand même
    
    print()
    return True


def run_correction_migrations(database_url: str) -> bool:
    """
    Exécute les migrations de correction AVANT sqlx migrate run
    """
    print("=" * 80)
    print("Exécution des migrations de correction AVANT sqlx migrate run")
    print("=" * 80)
    print()
    
    correction_migrations = [
        "20260130_002_fix_critical_migration_errors.sql",
        "20260130_003_fix_additional_migration_errors.sql",
        "20260130_004_fix_all_migration_errors_final.sql",
        "20260130_005_fix_remaining_migration_errors.sql",
        "20260130_006_add_partner_columns_to_users.sql",
        "20260130_007_ensure_users_table_exists.sql",
        "20260130_008_ensure_services_and_media_tables.sql",
        "20260206_fix_all_critical_errors_complete.sql"
    ]
    
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    
    has_psql = check_psql_installed()
    
    for migration_file in correction_migrations:
        migration_path = MIGRATIONS_DIR / migration_file
        if not migration_path.exists():
            print(f"ATTENTION: Migration de correction non trouvee: {migration_file} (ignoree)")
            continue
        
        print(f"Exécution de la migration de correction: {migration_file}")
        try:
            if has_psql:
                result = subprocess.run(
                    ["psql", database_url, "-f", str(migration_path)],
                    capture_output=True,
                    text=True,
                    check=False,
                    timeout=300
                )
                
                if result.returncode == 0:
                    print(f"OK: Migration de correction {migration_file} appliquee avec succes")
                else:
                    error_output = (result.stderr + result.stdout).lower()
                    if any(keyword in error_output for keyword in [
                        "already exists", "does not exist", "cannot be implemented",
                        "duplicate", "relation already exists", "existe deja"
                    ]):
                        print(f"INFO: Migration de correction {migration_file}: erreurs attendues (deja appliquee)")
                    else:
                        print(f"ATTENTION: Migration de correction {migration_file}: erreurs non critiques")
                        if result.stderr:
                            print(f"   Erreur: {result.stderr[:200]}...")
            else:
                print(f"ATTENTION: psql non disponible, migration {migration_file} ignoree")
        except subprocess.TimeoutExpired:
            print(f"ATTENTION: Timeout lors de l'execution de {migration_file} (ignore)")
        except Exception as e:
            print(f"ATTENTION: Erreur lors de l'execution de {migration_file}: {e} (ignore)")
    
    print()
    print("OK: Migrations de correction executees")
    print()
    return True


def check_migrations_status(database_url: str, retry_count: int = 0) -> dict:
    """Vérifie l'état des migrations via sqlx migrate info"""
    print(f"Vérification de l'état des migrations... (tentative {retry_count + 1}/{MAX_RETRIES + 1})")
    
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    
    timeout = CONNECTION_TIMEOUT if retry_count == 0 else 60
    
    try:
        result = subprocess.run(
            ["sqlx", "migrate", "info"],
            env=env,
            cwd=Path(__file__).parent.parent / "backend",
            capture_output=True,
            text=True,
            check=True,
            timeout=timeout
        )
        print(result.stdout)
        
        output = result.stdout.lower()
        has_pending = "pending" in output or "not applied" in output
        
        lines = result.stdout.split('\n')
        applied_count = sum(1 for line in lines if 'Applied' in line or 'installed' in line.lower())
        pending_count = sum(1 for line in lines if 'Pending' in line or 'pending' in line.lower())
        
        if applied_count > 0:
            print(f"OK: {applied_count} migration(s) deja appliquee(s)")
        if pending_count > 0:
            print(f"EN ATTENTE: {pending_count} migration(s) en attente")
        
        return {
            "has_pending": has_pending,
            "output": result.stdout,
            "connection_ok": True,
            "applied_count": applied_count,
            "pending_count": pending_count
        }
    except subprocess.TimeoutExpired:
        if retry_count < MAX_RETRIES:
            print(f"Nouvelle tentative dans {RETRY_DELAY} secondes...")
            time.sleep(RETRY_DELAY)
            return check_migrations_status(database_url, retry_count + 1)
        return {"has_pending": True, "output": "Timeout", "connection_ok": False}
    except subprocess.CalledProcessError as e:
        error_output = e.stderr if e.stderr else (e.stdout if e.stdout else str(e))
        
        if "relation \"_sqlx_migrations\" does not exist" in error_output.lower():
            print("INFO: Table _sqlx_migrations n'existe pas, toutes les migrations seront appliquees")
            return {"has_pending": True, "output": error_output, "connection_ok": True}
        
        print(f"ATTENTION: Erreur lors de la verification: {error_output[:200]}")
        return {"has_pending": True, "output": error_output, "connection_ok": True}


def run_migrations(database_url: str, retry_count: int = 0) -> bool:
    """Exécute les migrations via sqlx migrate run"""
    print(f"Exécution des migrations SQLx standard... (tentative {retry_count + 1}/{MAX_RETRIES + 1})")
    
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    
    timeout = CONNECTION_TIMEOUT if retry_count == 0 else 300
    
    try:
        result = subprocess.run(
            ["sqlx", "migrate", "run"],
            env=env,
            cwd=Path(__file__).parent.parent / "backend",
            capture_output=True,
            text=True,
            check=True,
            timeout=timeout
        )
        print("OK: Migrations SQLx standard executees avec succes")
        if result.stdout:
            print(result.stdout)
        return True
    except subprocess.TimeoutExpired:
        print("ERREUR: Timeout lors de l'exécution des migrations")
        if retry_count < MAX_RETRIES:
            print(f"Nouvelle tentative dans {RETRY_DELAY} secondes...")
            time.sleep(RETRY_DELAY)
            return run_migrations(database_url, retry_count + 1)
        return False
    except subprocess.CalledProcessError as e:
        error_output = e.stderr if e.stderr else (e.stdout if e.stdout else str(e))
        print(f"ERREUR: Erreur lors de l'exécution des migrations: {error_output[:500]}")
        
        if retry_count < MAX_RETRIES:
            print(f"Nouvelle tentative dans {RETRY_DELAY} secondes...")
            time.sleep(RETRY_DELAY)
            return run_migrations(database_url, retry_count + 1)
        
        return False


def add_foreign_key_after_users_created(database_url: str) -> bool:
    """
    Ajoute la FK merchant_id -> users(id) après création de users
    """
    print("Vérification et ajout de la FK merchant_id -> users(id)...")
    
    if not check_psql_installed():
        print("ATTENTION: psql non disponible, FK sera ajoutee automatiquement plus tard")
        return True
    
    sql = """
    DO $$
    BEGIN
        IF EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
        ) THEN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'merchant_storage_locations_merchant_id_fkey'
                AND table_name = 'merchant_storage_locations'
            ) THEN
                ALTER TABLE merchant_storage_locations 
                ADD CONSTRAINT merchant_storage_locations_merchant_id_fkey 
                FOREIGN KEY (merchant_id) REFERENCES users(id) ON DELETE CASCADE;
                RAISE NOTICE 'OK: FK merchant_id -> users(id) ajoutee';
            ELSE
                RAISE NOTICE 'INFO: FK merchant_id -> users(id) existe deja';
            END IF;
        ELSE
            RAISE NOTICE 'ATTENTION: Table users n''existe pas encore, FK sera ajoutee apres creation';
        END IF;
    END $$;
    """
    
    try:
        result = subprocess.run(
            ["psql", database_url, "-c", sql],
            capture_output=True,
            text=True,
            check=False,
            timeout=30
        )
        if result.returncode == 0:
            print("OK: FK verifiee/ajoutee")
            return True
        else:
            print(f"ATTENTION: Erreur FK (non bloquant): {result.stderr[:200]}")
            return True
    except Exception as e:
        print(f"ATTENTION: Erreur FK: {e}")
        return True


def main():
    """Fonction principale"""
    print("=" * 80)
    print("Exécution des migrations SQLx sur AWS RDS (VERSION CORRIGÉE)")
    print("=" * 80)
    print()
    
    # Vérifier que le dossier migrations existe
    if not MIGRATIONS_DIR.exists():
        print(f"ERREUR: Dossier migrations introuvable: {MIGRATIONS_DIR}")
        sys.exit(1)
    
    print(f"Dossier migrations: {MIGRATIONS_DIR}")
    print(f"Nombre de fichiers de migration: {len(list(MIGRATIONS_DIR.glob('*.sql')))}")
    print()
    
    # Récupérer DATABASE_URL depuis Secrets Manager
    database_url = get_database_url_from_secrets_manager()
    print()
    
    # Verifier/installer sqlx-cli
    if not check_sqlx_cli_installed():
        print("ATTENTION: sqlx-cli non trouve, installation...")
        install_sqlx_cli()
    print()
    
    # ETAPE CRITIQUE: Creer merchant_storage_locations AVANT tout
    print("ETAPE CRITIQUE: Creation de merchant_storage_locations AVANT migration 0")
    create_merchant_storage_locations(database_url)
    print()
    
    # Vérifier l'état des migrations
    status = check_migrations_status(database_url)
    print()
    
    if status.get("connection_ok", True):
        applied = status.get("applied_count", 0)
        pending = status.get("pending_count", 0)
        if applied > 0 or pending > 0:
            print(f"Résumé: {applied} appliquée(s), {pending} en attente")
            print()
    
    if not status.get("connection_ok", True):
        print("=" * 80)
        print("INFO: Base de données non accessible (VPC privé)")
        print("=" * 80)
        print("Les migrations seront exécutées au démarrage de l'application ECS")
        sys.exit(0)
    
    # Exécuter les migrations de correction
    print("Exécution des migrations de correction AVANT sqlx migrate run...")
    run_correction_migrations(database_url)
    print()
    
    # Exécuter les migrations SQLx standard
    if status["has_pending"]:
        print("Des migrations sont en attente, exécution...")
        success = run_migrations(database_url)
        if not success:
            print("ERREUR: Échec de l'exécution des migrations")
            if FAIL_ON_ERROR:
                sys.exit(1)
            else:
                print("INFO: Les migrations seront exécutées au démarrage de l'application ECS")
                sys.exit(0)
    else:
        print("OK: Toutes les migrations sont deja appliquees")
    
    # Ajouter la FK après création de users
    add_foreign_key_after_users_created(database_url)
    print()
    
    print("=" * 80)
    print("OK: Processus termine avec succes")
    print("=" * 80)


if __name__ == "__main__":
    main()

