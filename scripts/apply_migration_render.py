#!/usr/bin/env python3
"""
Script pour appliquer la migration de scalabilité de recherche sur Render
"""
import psycopg2
import sys
import os
from pathlib import Path

# Configuration de la base de données Render
DATABASE_URL = "postgresql://user:password@host:port/database"

# Chemin vers la migration
MIGRATION_FILE = Path(__file__).parent.parent / "backend" / "migrations" / "20251202_search_scalability_improvements.sql"

def apply_migration():
    """Applique la migration SQL sur la base de données Render"""
    print("🚀 Application de la migration de scalabilité de recherche...")
    print(f"📄 Fichier: {MIGRATION_FILE}")
    
    # Vérifier que le fichier existe
    if not MIGRATION_FILE.exists():
        print(f"❌ Erreur: Fichier de migration introuvable: {MIGRATION_FILE}")
        sys.exit(1)
    
    # Lire le contenu de la migration
    with open(MIGRATION_FILE, 'r', encoding='utf-8') as f:
        migration_sql = f.read()
    
    try:
        # Se connecter à la base de données
        print("🔌 Connexion à la base de données Render...")
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True  # ✅ CRITIQUE: autocommit pour CREATE INDEX CONCURRENTLY
        cursor = conn.cursor()
        
        print("⏳ Application de la migration...")
        
        # Exécuter la migration (autocommit activé)
        cursor.execute(migration_sql)
        
        print("✅ Migration appliquée avec succès!")
        
        # Vérifier que la vue matérialisée existe
        print("🔍 Vérification de la vue matérialisée...")
        cursor.execute("""
            SELECT EXISTS(
                SELECT 1 FROM pg_matviews 
                WHERE matviewname = 'services_search_optimized'
            );
        """)
        exists = cursor.fetchone()[0]
        
        if exists:
            print("✅ Vue matérialisée 'services_search_optimized' créée avec succès!")
        else:
            print("⚠️  Vue matérialisée non trouvée. Vérifiez les logs ci-dessus.")
        
        # Rafraîchir la vue initiale
        print("🔄 Rafraîchissement initial de la vue matérialisée...")
        cursor.execute("SELECT refresh_services_search_optimized();")
        conn.commit()
        
        print("✅ Vue matérialisée rafraîchie!")
        
        # Vérifier le nombre de lignes
        cursor.execute("SELECT COUNT(*) FROM services_search_optimized;")
        count = cursor.fetchone()[0]
        print(f"📊 Nombre de services dans la vue: {count}")
        
        cursor.close()
        conn.close()
        
        print("\n🎉 Migration terminée avec succès!")
        return True
        
    except psycopg2.Error as e:
        print(f"❌ Erreur PostgreSQL: {e}")
        if conn:
            conn.rollback()
        sys.exit(1)
    except Exception as e:
        print(f"❌ Erreur: {e}")
        sys.exit(1)

if __name__ == "__main__":
    apply_migration()

