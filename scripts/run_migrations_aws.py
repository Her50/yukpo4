#!/usr/bin/env python3
"""
Script pour exécuter les migrations SQLx directement sur AWS RDS
Récupère DATABASE_URL depuis AWS SSM Parameter Store et exécute les migrations manquantes
"""
import os
import sys
import subprocess
import boto3
from pathlib import Path
from typing import Optional

# Configuration
SSM_PARAMETER_PATH = os.getenv("SSM_DATABASE_URL_PATH", "/yukpomnang/production/DATABASE_URL")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
MIGRATIONS_DIR = Path(__file__).parent.parent / "backend" / "migrations"


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


def check_migrations_status(database_url: str) -> dict:
    """Vérifie l'état des migrations via sqlx migrate info"""
    print("🔍 Vérification de l'état des migrations...")
    
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
            timeout=60
        )
        print(result.stdout)
        
        # Analyser la sortie pour déterminer s'il y a des migrations en attente
        output = result.stdout.lower()
        has_pending = "pending" in output or "not applied" in output or "not yet applied" in output
        
        return {
            "has_pending": has_pending,
            "output": result.stdout
        }
    except subprocess.TimeoutExpired:
        print("⚠️ Timeout lors de la vérification des migrations")
        return {"has_pending": True, "output": "Timeout"}
    except subprocess.CalledProcessError as e:
        error_output = e.stderr if e.stderr else (e.stdout if e.stdout else str(e))
        print(f"⚠️ Erreur lors de la vérification: {error_output}")
        # Si la table _sqlx_migrations n'existe pas, on considère qu'il faut appliquer toutes les migrations
        if "relation \"_sqlx_migrations\" does not exist" in error_output.lower():
            print("ℹ️ Table _sqlx_migrations n'existe pas, toutes les migrations seront appliquées")
            return {"has_pending": True, "output": error_output}
        # Si c'est une autre erreur, on essaie quand même d'appliquer les migrations
        print("ℹ️ Tentative d'application des migrations malgré l'erreur de vérification")
        return {"has_pending": True, "output": error_output}


def run_migrations(database_url: str) -> bool:
    """Exécute les migrations via sqlx migrate run"""
    print("🚀 Exécution des migrations...")
    
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    
    try:
        result = subprocess.run(
            ["sqlx", "migrate", "run"],
            env=env,
            cwd=Path(__file__).parent.parent / "backend",
            check=True,
            text=True,
            timeout=300  # 5 minutes max
        )
        print("✅ Migrations exécutées avec succès")
        if result.stdout:
            print(result.stdout)
        return True
    except subprocess.TimeoutExpired:
        print("❌ Timeout lors de l'exécution des migrations (trop long)")
        return False
    except subprocess.CalledProcessError as e:
        print(f"❌ Erreur lors de l'exécution des migrations: {e}")
        if e.stderr:
            print(f"Erreur détaillée: {e.stderr}")
        if e.stdout:
            print(f"Sortie: {e.stdout}")
        # Certaines erreurs peuvent être ignorées (migrations déjà appliquées, etc.)
        error_str = (e.stderr or e.stdout or str(e)).lower()
        if "already applied" in error_str or "duplicate" in error_str:
            print("⚠️ Migration déjà appliquée, on continue...")
            return True
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
    status = check_migrations_status(database_url)
    print()
    
    # Exécuter les migrations si nécessaire
    if status["has_pending"]:
        print("🔄 Des migrations sont en attente, exécution...")
        success = run_migrations(database_url)
        if not success:
            print("❌ Échec de l'exécution des migrations")
            sys.exit(1)
    else:
        print("✅ Toutes les migrations sont déjà appliquées")
    
    print()
    print("=" * 80)
    print("✅ Processus terminé avec succès")
    print("=" * 80)


if __name__ == "__main__":
    main()

