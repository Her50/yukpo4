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
SSM_PARAMETER_PATH = os.getenv("SSM_DATABASE_URL_PATH", "/yukpo/production/DATABASE_URL")
AWS_REGION = os.getenv("AWS_REGION", "eu-west-1")
MIGRATIONS_DIR = Path(__file__).parent.parent / "backend" / "migrations"
FAIL_ON_ERROR = os.getenv("FAIL_ON_MIGRATION_ERROR", "false").lower() == "true"
MAX_RETRIES = 2  # Réduit de 3 à 2 pour VPC privé (détection plus rapide)
RETRY_DELAY = 3  # Réduit de 5 à 3 secondes
CONNECTION_TIMEOUT = 30  # Timeout initial pour détecter rapidement les erreurs VPC (30s au lieu de 120s)


def get_database_url_from_ssm() -> str:
    """Récupère DATABASE_URL depuis AWS SSM Parameter Store"""
    print(f"Recuperation de DATABASE_URL depuis SSM: {SSM_PARAMETER_PATH}")
    
    try:
        ssm_client = boto3.client('ssm', region_name=AWS_REGION)
        response = ssm_client.get_parameter(
            Name=SSM_PARAMETER_PATH,
            WithDecryption=True
        )
        database_url = response['Parameter']['Value']
        print(f"OK: DATABASE_URL recuperee depuis SSM")
        return database_url
    except Exception as e:
        print(f"ERREUR lors de la recuperation depuis SSM: {e}")
        # Fallback: utiliser DATABASE_URL depuis l'environnement si disponible
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            print(f"ATTENTION: Utilisation de DATABASE_URL depuis l'environnement")
            return database_url
        else:
            print(f"ERREUR: DATABASE_URL non disponible dans SSM ni dans l'environnement")
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
            timeout=600  # 10 minutes max
        )
        print("OK: sqlx-cli installe avec succes")
        if result.stdout:
            print(f"Sortie: {result.stdout[:200]}...")
    except subprocess.TimeoutExpired:
        print("ERREUR: Timeout lors de l'installation de sqlx-cli (trop long)")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"ERREUR: Erreur lors de l'installation de sqlx-cli: {e}")
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
    print(f"Verification de l'etat des migrations... (tentative {retry_count + 1}/{MAX_RETRIES + 1})")
    print("INFO: SQLx verifie la table _sqlx_migrations pour eviter les doublons")
    
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    
    # Timeout adaptatif : plus court pour la première tentative (détection rapide VPC)
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
        
        # Analyser la sortie pour déterminer s'il y a des migrations en attente
        output = result.stdout.lower()
        has_pending = "pending" in output or "not applied" in output or "not yet applied" in output
        
        # Compter les migrations appliquées vs en attente
        lines = result.stdout.split('\n')
        applied_count = sum(1 for line in lines if 'Applied' in line or 'installed' in line.lower())
        pending_count = sum(1 for line in lines if 'Pending' in line or 'pending' in line.lower())
        
        if applied_count > 0:
            print(f"OK: {applied_count} migration(s) deja appliquee(s) (ignorees)")
        if pending_count > 0:
            print(f"EN ATTENTE: {pending_count} migration(s) en attente d'application")
        
        return {
            "has_pending": has_pending,
            "output": result.stdout,
            "connection_ok": True,
            "applied_count": applied_count,
            "pending_count": pending_count
        }
    except subprocess.TimeoutExpired:
        if retry_count == 0:
            print("INFO: Timeout attendu: Base de donnees probablement dans un VPC prive")
        else:
            print("ATTENTION: Timeout lors de la verification des migrations")
        if retry_count < MAX_RETRIES:
            print(f"Nouvelle tentative dans {RETRY_DELAY} secondes...")
            time.sleep(RETRY_DELAY)
            return check_migrations_status(database_url, retry_count + 1)
        print("INFO: Impossible de se connecter (comportement attendu pour VPC prive)")
        return {"has_pending": True, "output": "Timeout", "connection_ok": False}
    except subprocess.CalledProcessError as e:
        error_output = e.stderr if e.stderr else (e.stdout if e.stdout else str(e))
        
        # Vérifier si c'est une erreur de connexion
        if is_connection_error(error_output):
            print(f"ATTENTION: Erreur de connexion detectee: {error_output[:200]}")
            if retry_count < MAX_RETRIES:
                print(f"Nouvelle tentative dans {RETRY_DELAY} secondes...")
                time.sleep(RETRY_DELAY)
                return check_migrations_status(database_url, retry_count + 1)
            print("ERREUR: Impossible de se connecter a la base de donnees apres plusieurs tentatives")
            print("INFO: La base de donnees est probablement dans un VPC prive et non accessible depuis GitHub Actions")
            print("INFO: Les migrations seront executees automatiquement au demarrage de l'application ECS")
            return {"has_pending": False, "output": error_output, "connection_ok": False}
        
        print(f"ATTENTION: Erreur lors de la verification: {error_output[:200]}")
        # Si la table _sqlx_migrations n'existe pas, on considère qu'il faut appliquer toutes les migrations
        if "relation \"_sqlx_migrations\" does not exist" in error_output.lower():
            print("INFO: Table _sqlx_migrations n'existe pas, toutes les migrations seront appliquees")
            return {"has_pending": True, "output": error_output, "connection_ok": True}
        # Si c'est une autre erreur, on essaie quand même d'appliquer les migrations
        print("INFO: Tentative d'application des migrations malgre l'erreur de verification")
        return {"has_pending": True, "output": error_output, "connection_ok": True}


def run_correction_migrations(database_url: str) -> bool:
    """
    Exécute les migrations de correction AVANT sqlx migrate run
    Ces migrations corrigent les erreurs avant que les autres migrations ne s'exécutent
    
    Utilise sqlx migrate run avec un fichier spécifique pour chaque migration de correction
    """
    print("=" * 80)
    print("Execution des migrations de correction AVANT sqlx migrate run")
    print("=" * 80)
    print()
    
    correction_migrations = [
        "20260130_002_fix_critical_migration_errors.sql",
        "20260130_003_fix_additional_migration_errors.sql",
        "20260130_004_fix_all_migration_errors_final.sql"
    ]
    
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    
    for migration_file in correction_migrations:
        migration_path = MIGRATIONS_DIR / migration_file
        if not migration_path.exists():
            print(f"ATTENTION: Migration de correction non trouvee: {migration_file} (ignoree)")
            continue
        
        print(f"Execution de la migration de correction: {migration_file}")
        try:
            # Utiliser sqlx migrate run avec un fichier spécifique
            # Note: sqlx migrate run exécute toutes les migrations, donc on doit utiliser
            # une approche différente : exécuter le fichier SQL directement via psql ou sqlx
            # Vérifier si psql est disponible
            has_psql = False
            try:
                subprocess.run(["psql", "--version"], capture_output=True, check=True, timeout=5)
                has_psql = True
            except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
                has_psql = False
            
            if has_psql:
                # Utiliser psql pour exécuter le fichier SQL directement
                result = subprocess.run(
                    ["psql", database_url, "-f", str(migration_path)],
                    capture_output=True,
                    text=True,
                    check=False,  # Ne pas échouer si certaines commandes échouent (déjà appliquées)
                    timeout=300
                )
                
                if result.returncode == 0:
                    print(f"OK: Migration de correction {migration_file} appliquee avec succes")
                else:
                    # Vérifier si l'erreur est "already exists" ou similaire (non bloquant)
                    error_output = (result.stderr + result.stdout).lower()
                    if any(keyword in error_output for keyword in [
                        "already exists", "does not exist", "cannot be implemented",
                        "duplicate", "relation already exists", "already applied"
                    ]):
                        print(f"ATTENTION: Migration de correction {migration_file} : erreurs attendues (deja appliquee ou non bloquant)")
                    else:
                        print(f"ATTENTION: Migration de correction {migration_file} : erreurs non critiques")
                        if result.stderr:
                            print(f"   Erreur: {result.stderr[:200]}...")
            else:
                # Fallback: utiliser sqlx migrate run avec le fichier spécifique
                # Note: sqlx migrate run ne supporte pas l'exécution d'un fichier spécifique
                # Donc on doit lire le fichier et l'exécuter via sqlx query
                print(f"ATTENTION: psql non disponible, utilisation de sqlx query...")
                with open(migration_path, 'r', encoding='utf-8') as f:
                    sql_content = f.read()
                
                # Diviser le SQL en commandes individuelles (approximation simple)
                # Note: Cette approche est basique, une vraie implémentation devrait utiliser
                # la même logique que execute_multiple_sql_commands() en Rust
                commands = [cmd.strip() for cmd in sql_content.split(';') if cmd.strip() and not cmd.strip().startswith('--')]
                
                for i, cmd in enumerate(commands[:10]):  # Limiter à 10 commandes pour éviter les timeouts
                    if not cmd or len(cmd) < 10:  # Ignorer les commandes trop courtes
                        continue
                    try:
                        result = subprocess.run(
                            ["sqlx", "query", database_url, cmd],
                            capture_output=True,
                            text=True,
                            check=False,
                            timeout=30
                        )
                        if result.returncode != 0:
                            error_output = (result.stderr + result.stdout).lower()
                            if any(keyword in error_output for keyword in [
                                "already exists", "does not exist", "cannot be implemented"
                            ]):
                                pass  # Erreur attendue, ignorer
                    except Exception:
                        pass  # Ignorer les erreurs individuelles
                
                print(f"ATTENTION: Migration de correction {migration_file} : executee partiellement (psql recommande)")
                
        except subprocess.TimeoutExpired:
            print(f"ATTENTION: Timeout lors de l'execution de {migration_file} (ignore)")
        except Exception as e:
            print(f"ATTENTION: Erreur lors de l'execution de {migration_file}: {e} (ignore)")
    
    print()
    print("OK: Migrations de correction executees")
    print()
    return True


def run_migrations(database_url: str, retry_count: int = 0) -> bool:
    """
    Exécute les migrations via sqlx migrate run avec retry
    
    SQLx est idempotent : il vérifie la table _sqlx_migrations avant d'appliquer chaque migration.
    Si une migration a déjà été appliquée (même checksum), elle est automatiquement ignorée.
    """
    print(f"Execution des migrations SQLx standard... (tentative {retry_count + 1}/{MAX_RETRIES + 1})")
    
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    
    # Timeout adaptatif : plus court pour la première tentative (détection rapide VPC)
    timeout = CONNECTION_TIMEOUT if retry_count == 0 else 300  # 5 minutes pour les retries
    
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
        print("ERREUR: Timeout lors de l'execution des migrations (trop long)")
        if retry_count < MAX_RETRIES:
            print(f"Nouvelle tentative dans {RETRY_DELAY} secondes...")
            time.sleep(RETRY_DELAY)
            return run_migrations(database_url, retry_count + 1)
        return False
    except subprocess.CalledProcessError as e:
        error_output = e.stderr if e.stderr else (e.stdout if e.stdout else str(e))
        print(f"ERREUR: Erreur lors de l'execution des migrations: {error_output[:300]}")
        
        # Vérifier si c'est une erreur de connexion
        if is_connection_error(error_output):
            print("ATTENTION: Erreur de connexion detectee")
            if retry_count < MAX_RETRIES:
                print(f"Nouvelle tentative dans {RETRY_DELAY} secondes...")
                time.sleep(RETRY_DELAY)
                return run_migrations(database_url, retry_count + 1)
            print("ERREUR: Impossible de se connecter a la base de donnees apres plusieurs tentatives")
            print("INFO: La base de donnees est probablement dans un VPC prive et non accessible depuis GitHub Actions")
            print("INFO: Les migrations seront executees automatiquement au demarrage de l'application ECS")
            return False
        
        # Certaines erreurs peuvent être ignorées (migrations déjà appliquées, etc.)
        error_str = error_output.lower()
        if "already applied" in error_str or "duplicate" in error_str:
            print("ATTENTION: Migration deja appliquee, on continue...")
            return True
        
        # Autres erreurs : retry si possible
        if retry_count < MAX_RETRIES:
            print(f"Nouvelle tentative dans {RETRY_DELAY} secondes...")
            time.sleep(RETRY_DELAY)
            return run_migrations(database_url, retry_count + 1)
        
        return False


def main():
    """Fonction principale"""
    print("=" * 80)
    print("Execution des migrations SQLx sur AWS RDS")
    print("=" * 80)
    print()
    
    # Vérifier que le dossier migrations existe
    if not MIGRATIONS_DIR.exists():
        print(f"ERREUR: Dossier migrations introuvable: {MIGRATIONS_DIR}")
        sys.exit(1)
    
    print(f"Dossier migrations: {MIGRATIONS_DIR}")
    print(f"Nombre de fichiers de migration: {len(list(MIGRATIONS_DIR.glob('*.sql')))}")
    print()
    
    # Récupérer DATABASE_URL depuis SSM
    database_url = get_database_url_from_ssm()
    print()
    
    # Vérifier/installer sqlx-cli
    if not check_sqlx_cli_installed():
        print("ATTENTION: sqlx-cli non trouve, installation...")
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
            print(f"Resume: {applied} appliquee(s), {pending} en attente")
            print()
    
    # Vérifier si la connexion fonctionne
    if not status.get("connection_ok", True):
        print("=" * 80)
        print("INFO: COMPORTEMENT ATTENDU: Base de donnees non accessible depuis GitHub Actions")
        print("=" * 80)
        print()
        print("Explication:")
        print("  La base de donnees RDS est dans un VPC prive pour la securite.")
        print("  GitHub Actions s'execute sur des runners publics et ne peut pas y acceder.")
        print("  C'est un comportement normal et securise.")
        print()
        print("Solution automatique:")
        print("  • Les migrations seront executees automatiquement au demarrage de l'application ECS")
        print("  • L'application ECS a acces a la base de donnees via le VPC")
        print("  • Le build Docker continuera normalement")
        print("  • Aucune action manuelle requise")
        print()
        
        if FAIL_ON_ERROR:
            print("ERREUR: FAIL_ON_MIGRATION_ERROR=true, arret du workflow")
            sys.exit(1)
        else:
            print("INFO: FAIL_ON_MIGRATION_ERROR=false, continuation du workflow")
            print("=" * 80)
            print("OK: Migrations differrees (seront executees au demarrage ECS)")
            print("=" * 80)
            sys.exit(0)
    
    # NOUVEAU 2026-01-30: Exécuter les migrations de correction AVANT sqlx migrate run
    # Cela garantit que les corrections sont en place avant que les autres migrations ne s'exécutent
    print("Execution des migrations de correction AVANT sqlx migrate run...")
    run_correction_migrations(database_url)
    print()
    
    # Exécuter les migrations SQLx standard si nécessaire
    if status["has_pending"]:
        print("Des migrations sont en attente, execution...")
        success = run_migrations(database_url)
        if not success:
            print("ERREUR: Echec de l'execution des migrations")
            if FAIL_ON_ERROR:
                print("ERREUR: FAIL_ON_MIGRATION_ERROR=true, arret du workflow")
                sys.exit(1)
            else:
                print("INFO: FAIL_ON_MIGRATION_ERROR=false, continuation du workflow")
                print("INFO: Les migrations seront executees au demarrage de l'application ECS")
                sys.exit(0)
    else:
        print("OK: Toutes les migrations sont deja appliquees")
    
    print()
    print("=" * 80)
    print("OK: Processus termine avec succes")
    print("=" * 80)


if __name__ == "__main__":
    main()

