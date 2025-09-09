#!/usr/bin/env python3
"""
Script pour vérifier l'état de vectorisation des services dans PostgreSQL
"""

import os
import psycopg2
from dotenv import load_dotenv

# Charger les variables d'environnement depuis le backend
load_dotenv('backend/.env')

def check_embedding_status():
    """Vérifie l'état de vectorisation des services"""
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("❌ DATABASE_URL non configurée")
        return
    
    try:
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        # Vérifier l'état de vectorisation
        cursor.execute("""
            SELECT 
                embedding_status,
                COUNT(*) as count
            FROM services 
            WHERE is_active = true
            GROUP BY embedding_status
            ORDER BY embedding_status
        """)
        
        status_counts = cursor.fetchall()
        print("📊 État de vectorisation des services:")
        for status, count in status_counts:
            print(f"  - {status or 'NULL'}: {count} services")
        
        # Vérifier les services avec erreurs
        cursor.execute("""
            SELECT id, embedding_status, embedding_error, embedding_last_attempt
            FROM services 
            WHERE is_active = true AND embedding_error IS NOT NULL
            ORDER BY id
            LIMIT 10
        """)
        
        error_services = cursor.fetchall()
        if error_services:
            print(f"\n❌ Services avec erreurs de vectorisation:")
            for service_id, status, error, last_attempt in error_services:
                print(f"  - Service {service_id}: {status} - {error}")
        else:
            print(f"\n✅ Aucun service avec erreur de vectorisation")
        
        # Vérifier les services vectorisés avec succès
        cursor.execute("""
            SELECT id, embedding_status, embedding_updated_at, embedding_data
            FROM services 
            WHERE is_active = true AND embedding_status = 'success'
            ORDER BY id
            LIMIT 5
        """)
        
        success_services = cursor.fetchall()
        if success_services:
            print(f"\n✅ Services vectorisés avec succès:")
            for service_id, status, updated_at, embedding_data in success_services:
                print(f"  - Service {service_id}: {status} - Mis à jour: {updated_at}")
        else:
            print(f"\n⚠️ Aucun service vectorisé avec succès")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Erreur vérification: {e}")

def main():
    """Fonction principale"""
    print("🔍 Diagnostic de l'état de vectorisation dans PostgreSQL")
    print("=" * 60)
    
    check_embedding_status()

if __name__ == "__main__":
    main() 