#!/usr/bin/env python3
"""
Script de diagnostic PostgreSQL pour vérifier la synchronisation
avec Pinecone et comprendre pourquoi les services sont manquants
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import json
from dotenv import load_dotenv

# Charger les variables d'environnement depuis le fichier .env
load_dotenv()

def print_section(title):
    print(f"\n{title}")
    print("=" * len(title))

def print_subsection(title):
    print(f"\n{title}")
    print("-" * len(title))

def check_env_vars():
    """Vérifier les variables d'environnement de base de données"""
    print_subsection("🔧 VARIABLES D'ENVIRONNEMENT")
    
    # Variables principales
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        print(f"   DATABASE_URL: ✅ DÉFINI")
        # Masquer le mot de passe dans l'affichage
        if '@' in database_url:
            parts = database_url.split('@')
            if ':' in parts[0]:
                user_pass = parts[0].split(':')
                if len(user_pass) >= 3:
                    masked_url = f"{user_pass[0]}:***@{parts[1]}"
                    print(f"   Format: {masked_url}")
    else:
        print(f"   DATABASE_URL: ❌ NON DÉFINI")
    
    # Variables individuelles
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = os.getenv('DB_PORT', '5432')
    db_name = os.getenv('DB_NAME', 'yukpo_db')
    db_user = os.getenv('DB_USER', 'postgres')
    
    print(f"   DB_HOST: {'✅' if db_host else '❌'} {db_host}")
    print(f"   DB_PORT: {'✅' if db_port else '❌'} {db_port}")
    print(f"   DB_NAME: {'✅' if db_name else '❌'} {db_name}")
    print(f"   DB_USER: {'✅' if db_user else '❌'} {db_user}")
    print(f"   DB_PASSWORD: {'✅' if os.getenv('DB_PASSWORD') else '❌'} {'DÉFINI' if os.getenv('DB_PASSWORD') else 'NON DÉFINI'}")

def get_db_connection():
    """Établir une connexion à la base de données"""
    try:
        # Essayer d'abord avec DATABASE_URL
        database_url = os.getenv('DATABASE_URL')
        if database_url:
            conn = psycopg2.connect(database_url)
            print("✅ Connexion PostgreSQL établie via DATABASE_URL")
            return conn
        
        # Fallback sur les variables individuelles
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', '5432'),
            database=os.getenv('DB_NAME', 'yukpo_db'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', '')
        )
        print("✅ Connexion PostgreSQL établie via variables individuelles")
        return conn
        
    except Exception as e:
        print(f"❌ Erreur de connexion: {e}")
        return None

def check_database_status(conn):
    """Vérifier le statut de la base de données"""
    print_subsection("🔍 VÉRIFICATION DU STATUT DE LA BASE POSTGRESQL")
    
    if not conn:
        print("❌ Aucune connexion disponible")
        return
    
    try:
        cursor = conn.cursor()
        
        # Vérifier la version de PostgreSQL
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]
        print(f"✅ Version PostgreSQL: {version.split(',')[0]}")
        
        # Vérifier les bases de données
        cursor.execute("SELECT datname FROM pg_database WHERE datistemplate = false;")
        databases = [row[0] for row in cursor.fetchall()]
        print(f"✅ Bases de données disponibles: {', '.join(databases)}")
        
        # Vérifier la base actuelle
        cursor.execute("SELECT current_database();")
        current_db = cursor.fetchone()[0]
        print(f"✅ Base de données actuelle: {current_db}")
        
        cursor.close()
        
    except Exception as e:
        print(f"❌ Erreur lors de la vérification: {e}")

def check_services_table(conn):
    """Vérifier l'existence et le contenu de la table services"""
    print_subsection("📋 VÉRIFICATION DE LA TABLE SERVICES")
    
    if not conn:
        print("❌ Aucune connexion disponible")
        return
    
    try:
        cursor = conn.cursor()
        
        # Vérifier si la table existe
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'services'
            );
        """)
        table_exists = cursor.fetchone()[0]
        
        if table_exists:
            print("✅ Table 'services' existe")
            
            # Compter le nombre de services
            cursor.execute("SELECT COUNT(*) FROM services;")
            count = cursor.fetchone()[0]
            print(f"✅ Nombre de services: {count}")
            
            # Vérifier la structure de la table
            cursor.execute("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'services'
                ORDER BY ordinal_position;
            """)
            columns = cursor.fetchall()
            print(f"✅ Structure de la table ({len(columns)} colonnes):")
            for col in columns:
                nullable = "NULL" if col[2] == "YES" else "NOT NULL"
                print(f"   - {col[0]}: {col[1]} ({nullable})")
            
            # Afficher quelques exemples de services
            if count > 0:
                cursor.execute("""
                    SELECT id, data, created_at, embedding_status 
                    FROM services 
                    ORDER BY created_at DESC 
                    LIMIT 5;
                """)
                services = cursor.fetchall()
                print(f"✅ Exemples de services:")
                for service in services:
                    service_id = service[0]
                    data = service[1]
                    created = service[2]
                    embedding_status = service[3]
                    
                    # Extraire le titre du service depuis le JSON
                    titre = "N/A"
                    if data and isinstance(data, dict):
                        titre_service = data.get('titre_service', {})
                        if isinstance(titre_service, dict):
                            titre = titre_service.get('valeur', 'N/A')
                        else:
                            titre = str(titre_service)
                    
                    print(f"   - ID {service_id}: {titre} (créé: {created}, embedding: {embedding_status})")
        else:
            print("❌ Table 'services' n'existe pas")
            
            # Vérifier quelles tables existent
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name;
            """)
            tables = [row[0] for row in cursor.fetchall()]
            print(f"📋 Tables disponibles: {', '.join(tables)}")
        
        cursor.close()
        
    except Exception as e:
        print(f"❌ Erreur lors de la vérification: {e}")

def check_sync_issues(conn):
    """Analyser les problèmes de synchronisation"""
    print_subsection("🔄 ANALYSE DES PROBLÈMES DE SYNCHRONISATION")
    
    if not conn:
        print("❌ Aucune connexion disponible")
        return
    
    try:
        cursor = conn.cursor()
        
        # Vérifier si la table services existe
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'services'
            );
        """)
        table_exists = cursor.fetchone()[0]
        
        if not table_exists:
            print("❌ Table 'services' n'existe pas - impossible d'analyser la synchronisation")
            return
        
        # Compter les services par statut
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN created_at IS NOT NULL THEN 1 END) as avec_date_creation,
                COUNT(CASE WHEN updated_at IS NOT NULL THEN 1 END) as avec_date_modification,
                COUNT(CASE WHEN embedding_status IS NOT NULL THEN 1 END) as avec_status_embedding
            FROM services;
        """)
        stats = cursor.fetchone()
        print(f"✅ Statistiques des services:")
        print(f"   - Total: {stats[0]}")
        print(f"   - Avec date de création: {stats[1]}")
        print(f"   - Avec date de modification: {stats[2]}")
        print(f"   - Avec statut embedding: {stats[3]}")
        
        # Vérifier les services récents
        cursor.execute("""
            SELECT id, data, created_at, updated_at, embedding_status
            FROM services 
            ORDER BY created_at DESC 
            LIMIT 10;
        """)
        recent_services = cursor.fetchall()
        print(f"✅ Services les plus récents:")
        for service in recent_services:
            service_id = service[0]
            data = service[1]
            created = service[2]
            updated = service[3]
            embedding_status = service[4]
            
            # Extraire le titre du service
            titre = "N/A"
            if data and isinstance(data, dict):
                titre_service = data.get('titre_service', {})
                if isinstance(titre_service, dict):
                    titre = titre_service.get('valeur', 'N/A')
                else:
                    titre = str(titre_service)
            
            created_str = created.strftime('%Y-%m-%d %H:%M') if created else 'N/A'
            updated_str = updated.strftime('%Y-%m-%d %H:%M') if updated else 'N/A'
            
            print(f"   - ID {service_id}: {titre} (créé: {created_str}, modifié: {updated_str}, embedding: {embedding_status})")
        
        cursor.close()
        
    except Exception as e:
        print(f"❌ Erreur lors de l'analyse de synchronisation: {e}")

def main():
    print("🚀 DIAGNOSTIC COMPLET POSTGRESQL")
    print("=" * 50)
    print(f"⏰ Début: {datetime.now()}")
    
    # Vérifier les variables d'environnement
    check_env_vars()
    
    # Établir la connexion
    conn = get_db_connection()
    
    if conn:
        # Vérifier le statut de la base
        check_database_status(conn)
        
        # Vérifier la table services
        check_services_table(conn)
        
        # Analyser les problèmes de synchronisation
        check_sync_issues(conn)
        
        # Fermer la connexion
        conn.close()
        print("\n✅ Connexion fermée")
    else:
        print("\n❌ Impossible de continuer sans connexion à la base de données")
    
    print(f"\n✅ Diagnostic terminé à {datetime.now()}")

if __name__ == "__main__":
    main() 