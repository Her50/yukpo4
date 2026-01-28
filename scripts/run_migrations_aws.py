#!/usr/bin/env python3
"""
Script pour exécuter les migrations SQLx directement sur AWS RDS
Récupère DATABASE_URL depuis AWS SSM Parameter Store et exécute les migrations manquantes

Note: Si la base de données est dans un VPC privé et non accessible depuis GitHub Actions,
les migrations seront exécutées automatiquement au démarrage de l'application ECS.
"""
import os
import sys
import subprocess
import boto3
import time
from pathlib import Path
from typing import Optional

# Configuration
SSM_PARAMETER_PATH = os.getenv("SSM_DATABASE_URL_PATH", "/yukpomnang/production/DATABASE_URL")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
MIGRATIONS_DIR = Path(__file__).parent.parent / "backend" / "migrations"
FAIL_ON_ERROR = os.getenv("FAIL_ON_MIGRATION_ERROR", "false").lower() == "true"
MAX_RETRIES = 3
RETRY_DELAY = 5  # secondes


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
        # Fallback: utiliser DATABASE_URL depuis l'environnement si disponible
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            print(f"⚠️ Utilisation de DATABASE_URL depuis l'environnement")
            return database_url
        else:
            print(f"❌ DATABASE_URL non disponible dans SSM ni dans l'environnement")
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
        print(f"✅ sqlx-cli installé: {result.stdout.strip()}")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        return False


def install_sqlx_cli():
    """Installe sqlx-cli via cargo"""
    print("📦 Installation de sqlx-cli...")
    print("⏳ Cela peut prendre quelques minutes...")
    try:
        result = subprocess.run(
            ["cargo", "install", "sqlx-cli", "--no-default-features", "--features", "postgres"],
            check=True,
            capture_output=True,
            text=True,
            timeout=600  # 10 minutes max
        )
        print("✅ sqlx-cli installé avec succès")
        if result.stdout:
            print(f"Sortie: {result.stdout[:200]}...")
    except subprocess.TimeoutExpired:
        print("❌ Timeout lors de l'installation de sqlx-cli (trop long)")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"❌ Erreur lors de l'installation de sqlx-cli: {e}")
        if e.stderr:
            print(f"Erreur détaillée: {e.stderr}")
        sys.exit(1)


def is_connection_error(error_output: str) -> bool:
    """Détecte si l'erreur est une erreur de connexion"""
    error_lower = error_output.lower()
    connection_errors = [
        "connection timed out",
        "connection refused",
        "could not connect",
        "network unreachable",
        "no route to host",
        "timeout",
        "os error 110",
        "os error 111",
        "os error 113"
    ]
    return any(err in error_lower for err in connection_errors)


def check_migrations_status(database_url: str, retry_count: int = 0) -> dict:
    """
    Vérifie l'état des migrations via sqlx migrate info avec retry
    
    SQLx utilise la table _sqlx_migrations pour tracker les migrations appliquées :
    - Compare les checksums des fichiers avec ceux en base
    - Identifie uniquement les migrations non encore appliquées
    - Évite ainsi les doublons automatiquement
    """
    print(f"🔍 Vérification de l'état des migrations... (tentative {retry_count + 1}/{MAX_RETRIES + 1})")
    print("ℹ️ SQLx vérifie la table _sqlx_migrations pour éviter les doublons")
    
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    
    try:
        result = subprocess.run(
            ["sqlx", "migrate", "info"],
            env=env,
            cwd=Path(__file__).parent.parent / "backend",
            capture_output=True,
            text=True,
            check=True,
            timeout=120  # Augmenté à 2 minutes
        )
        print(result.stdout)
        
        # Analyser la sortie pour déterminer s'il y a des migrations en attente
        output = result.stdout.lower()
        has_pending = "pending" in output or "not applied" in output or "not yet applied" in output
        
        # Compter les migrations appliquées vs en attente
        lines = result.stdout.split('\n')
        applied_count = sum(1 for line in lines if 'Applied' in line or 'installed' in line.lower())
        pending_count = sum(1 for line in lines if 'Pending' in line or 'pending' in line.lower())
        
        if applied_count > 0:
            print(f"✅ {applied_count} migration(s) déjà appliquée(s) (ignorées)")
        if pending_count > 0:
            print(f"🔄 {pending_count} migration(s) en attente d'application")
        
        return {
            "has_pending": has_pending,
            "output": result.stdout,
            "connection_ok": True,
            "applied_count": applied_count,
            "pending_count": pending_count
        }
    except subprocess.TimeoutExpired:
        print("⚠️ Timeout lors de la vérification des migrations")
        if retry_count < MAX_RETRIES:
            print(f"⏳ Nouvelle tentative dans {RETRY_DELAY} secondes...")
            time.sleep(RETRY_DELAY)
            return check_migrations_status(database_url, retry_count + 1)
        return {"has_pending": True, "output": "Timeout", "connection_ok": False}
    except subprocess.CalledProcessError as e:
        error_output = e.stderr if e.stderr else (e.stdout if e.stdout else str(e))
        
        # Vérifier si c'est une erreur de connexion
        if is_connection_error(error_output):
            print(f"⚠️ Erreur de connexion détectée: {error_output[:200]}")
            if retry_count < MAX_RETRIES:
                print(f"⏳ Nouvelle tentative dans {RETRY_DELAY} secondes...")
                time.sleep(RETRY_DELAY)
                return check_migrations_status(database_url, retry_count + 1)
            print("❌ Impossible de se connecter à la base de données après plusieurs tentatives")
            print("ℹ️ La base de données est probablement dans un VPC privé et non accessible depuis GitHub Actions")
            print("ℹ️ Les migrations seront exécutées automatiquement au démarrage de l'application ECS")
            return {"has_pending": False, "output": error_output, "connection_ok": False}
        
        print(f"⚠️ Erreur lors de la vérification: {error_output[:200]}")
        # Si la table _sqlx_migrations n'existe pas, on considère qu'il faut appliquer toutes les migrations
        if "relation \"_sqlx_migrations\" does not exist" in error_output.lower():
            print("ℹ️ Table _sqlx_migrations n'existe pas, toutes les migrations seront appliquées")
            return {"has_pending": True, "output": error_output, "connection_ok": True}
        # Si c'est une autre erreur, on essaie quand même d'appliquer les migrations
        print("ℹ️ Tentative d'application des migrations malgré l'erreur de vérification")
        return {"has_pending": True, "output": error_output, "connection_ok": True}


def run_migrations(database_url: str, retry_count: int = 0) -> bool:
    """Exécute les migrations via sqlx migrate run avec retry"""
    print(f"🚀 Exécution des migrations... (tentative {retry_count + 1}/{MAX_RETRIES + 1})")
    
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    
    try:
        result = subprocess.run(
            ["sqlx", "migrate", "run"],
            env=env,
            cwd=Path(__file__).parent.parent / "backend",
            check=True,
            text=True,
            timeout=600  # 10 minutes max (augmenté pour les grandes migrations)
        )
        print("✅ Migrations exécutées avec succès")
        if result.stdout:
            print(result.stdout)
        return True
    except subprocess.TimeoutExpired:
        print("❌ Timeout lors de l'exécution des migrations (trop long)")
        if retry_count < MAX_RETRIES:
            print(f"⏳ Nouvelle tentative dans {RETRY_DELAY} secondes...")
            time.sleep(RETRY_DELAY)
            return run_migrations(database_url, retry_count + 1)
        return False
    except subprocess.CalledProcessError as e:
        error_output = e.stderr if e.stderr else (e.stdout if e.stdout else str(e))
        print(f"❌ Erreur lors de l'exécution des migrations: {error_output[:300]}")
        
        # Vérifier si c'est une erreur de connexion
        if is_connection_error(error_output):
            print("⚠️ Erreur de connexion détectée")
            if retry_count < MAX_RETRIES:
                print(f"⏳ Nouvelle tentative dans {RETRY_DELAY} secondes...")
                time.sleep(RETRY_DELAY)
                return run_migrations(database_url, retry_count + 1)
            print("❌ Impossible de se connecter à la base de données après plusieurs tentatives")
            print("ℹ️ La base de données est probablement dans un VPC privé et non accessible depuis GitHub Actions")
            print("ℹ️ Les migrations seront exécutées automatiquement au démarrage de l'application ECS")
            return False
        
        # Certaines erreurs peuvent être ignorées (migrations déjà appliquées, etc.)
        error_str = error_output.lower()
        if "already applied" in error_str or "duplicate" in error_str:
            print("⚠️ Migration déjà appliquée, on continue...")
            return True
        
        # Autres erreurs : retry si possible
        if retry_count < MAX_RETRIES:
            print(f"⏳ Nouvelle tentative dans {RETRY_DELAY} secondes...")
            time.sleep(RETRY_DELAY)
            return run_migrations(database_url, retry_count + 1)
        
        return False


def main():
    """Fonction principale"""
    print("=" * 80)
    print("🔄 Exécution des migrations SQLx sur AWS RDS")
    print("=" * 80)
    print()
    
    # Vérifier que le dossier migrations existe
    if not MIGRATIONS_DIR.exists():
        print(f"❌ Dossier migrations introuvable: {MIGRATIONS_DIR}")
        sys.exit(1)
    
    print(f"📁 Dossier migrations: {MIGRATIONS_DIR}")
    print(f"📊 Nombre de fichiers de migration: {len(list(MIGRATIONS_DIR.glob('*.sql')))}")
    print()
    
    # Récupérer DATABASE_URL depuis SSM
    database_url = get_database_url_from_ssm()
    print()
    
    # Vérifier/installer sqlx-cli
    if not check_sqlx_cli_installed():
        print("⚠️ sqlx-cli non trouvé, installation...")
        install_sqlx_cli()
    print()
    
    # Vérifier l'état des migrations
    # SQLx vérifie automatiquement la table _sqlx_migrations pour éviter les doublons
    status = check_migrations_status(database_url)
    print()
    
    # Afficher le résumé des migrations
    if status.get("connection_ok", True):
        applied = status.get("applied_count", 0)
        pending = status.get("pending_count", 0)
        if applied > 0 or pending > 0:
            print(f"📊 Résumé: {applied} appliquée(s), {pending} en attente")
            print()
    
    # Vérifier si la connexion fonctionne
    if not status.get("connection_ok", True):
        print("⚠️" * 40)
        print("⚠️ ATTENTION: Impossible de se connecter à la base de données")
        print("⚠️" * 40)
        print()
        print("Causes possibles:")
        print("  1. La base de données RDS est dans un VPC privé")
        print("  2. Les Security Groups ne permettent pas les connexions depuis GitHub Actions")
        print("  3. La base de données nécessite un VPN ou un bastion host")
        print()
        print("Solution:")
        print("  ✅ Les migrations seront exécutées automatiquement au démarrage de l'application ECS")
        print("  ✅ L'application ECS a accès à la base de données via le VPC")
        print("  ✅ Le build Docker continuera normalement")
        print()
        
        if FAIL_ON_ERROR:
            print("❌ FAIL_ON_MIGRATION_ERROR=true, arrêt du workflow")
            sys.exit(1)
        else:
            print("ℹ️ FAIL_ON_MIGRATION_ERROR=false, continuation du workflow")
            print("=" * 80)
            print("⚠️ Migrations non exécutées (seront exécutées au démarrage ECS)")
            print("=" * 80)
            sys.exit(0)
    
    # Exécuter les migrations si nécessaire
    if status["has_pending"]:
        print("🔄 Des migrations sont en attente, exécution...")
        success = run_migrations(database_url)
        if not success:
            print("❌ Échec de l'exécution des migrations")
            if FAIL_ON_ERROR:
                print("❌ FAIL_ON_MIGRATION_ERROR=true, arrêt du workflow")
                sys.exit(1)
            else:
                print("ℹ️ FAIL_ON_MIGRATION_ERROR=false, continuation du workflow")
                print("ℹ️ Les migrations seront exécutées au démarrage de l'application ECS")
                sys.exit(0)
    else:
        print("✅ Toutes les migrations sont déjà appliquées")
    
    print()
    print("=" * 80)
    print("✅ Processus terminé avec succès")
    print("=" * 80)


if __name__ == "__main__":
    main()

