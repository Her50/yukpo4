#!/usr/bin/env python3
"""
Script pour vérifier le contenu des services vectorisés
"""

import os
import psycopg2
from dotenv import load_dotenv

# Charger les variables d'environnement depuis le backend
load_dotenv('backend/.env')

def check_service_content():
    """Vérifie le contenu des services vectorisés"""
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("❌ DATABASE_URL non configurée")
        return
    
    try:
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        # Vérifier quelques services vectorisés avec succès
        cursor.execute("""
            SELECT id, data, embedding_status, embedding_data
            FROM services 
            WHERE is_active = true AND embedding_status = 'success'
            ORDER BY id
            LIMIT 5
        """)
        
        services = cursor.fetchall()
        print("🔍 Contenu des services vectorisés:")
        for service_id, data, status, embedding_data in services:
            print(f"\nService {service_id} (status: {status}):")
            if data:
                if isinstance(data, dict):
                    print(f"  - Titre: {data.get('titre_service', 'N/A')}")
                    print(f"  - Description: {data.get('description_service', 'N/A')}")
                    print(f"  - Catégorie: {data.get('category', 'N/A')}")
                    print(f"  - Compétences: {data.get('competences', 'N/A')}")
                else:
                    print(f"  - Data: {str(data)[:200]}...")
            else:
                print(f"  - Aucune donnée")
            
            if embedding_data:
                print(f"  - Embedding data: {str(embedding_data)[:100]}...")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Erreur vérification: {e}")

def main():
    """Fonction principale"""
    print("🔍 Vérification du contenu des services")
    print("=" * 50)
    
    check_service_content()

if __name__ == "__main__":
    main() 