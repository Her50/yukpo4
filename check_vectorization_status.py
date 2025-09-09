#!/usr/bin/env python3
"""
Script pour vérifier l'état de vectorisation des services dans PostgreSQL
"""

import os
import psycopg2
import requests
import json
from dotenv import load_dotenv

# Charger les variables d'environnement depuis le backend
load_dotenv('backend/.env')

def check_vectorization_status():
    """Vérifie l'état de vectorisation des services"""
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("❌ DATABASE_URL non configurée")
        return
    
    try:
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        # Vérifier la structure de la table services
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'services'
            ORDER BY ordinal_position
        """)
        
        columns = cursor.fetchall()
        print("📋 Structure de la table services:")
        for col in columns:
            print(f"  - {col[0]}: {col[1]}")
        
        # Vérifier s'il y a une colonne pour l'état de vectorisation
        vectorization_columns = [col[0] for col in columns if 'vector' in col[0].lower() or 'embedding' in col[0].lower()]
        print(f"\n🔍 Colonnes liées à la vectorisation: {vectorization_columns}")
        
        # Compter les services
        cursor.execute("SELECT COUNT(*) FROM services WHERE is_active = true")
        total_services = cursor.fetchone()[0]
        print(f"\n📊 Total services actifs: {total_services}")
        
        # Vérifier quelques services récents
        cursor.execute("""
            SELECT id, user_id, data, gps, is_active, created_at, updated_at
            FROM services 
            WHERE is_active = true
            ORDER BY id DESC
            LIMIT 5
        """)
        
        recent_services = cursor.fetchall()
        print(f"\n🔍 Services récents:")
        for service in recent_services:
            service_id, user_id, data, gps, is_active, created_at, updated_at = service
            print(f"  Service {service_id}:")
            print(f"    - User ID: {user_id}")
            print(f"    - Actif: {is_active}")
            print(f"    - Créé: {created_at}")
            print(f"    - Modifié: {updated_at}")
            if data:
                if isinstance(data, dict):
                    titre = data.get('titre_service', 'N/A')
                    description = data.get('description_service', 'N/A')[:50] + "..." if data.get('description_service') else 'N/A'
                    print(f"    - Titre: {titre}")
                    print(f"    - Description: {description}")
                else:
                    print(f"    - Data: {str(data)[:100]}...")
            print()
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Erreur vérification PostgreSQL: {e}")

def check_pinecone_index():
    """Vérifie l'état de l'index Pinecone"""
    try:
        headers = {"x-api-key": "yukpo_embedding_key_2024"}
        
        # Vérifier l'état de l'index
        response = requests.get("http://localhost:8000/health", headers=headers)
        if response.status_code == 200:
            print("✅ Microservice d'embedding accessible")
        else:
            print(f"❌ Microservice inaccessible: {response.status_code}")
            return
        
        # Tenter une recherche pour voir s'il y a des vecteurs
        search_data = {
            "query": "test",
            "type_donnee": "texte",
            "top_k": 1,
            "active": True
        }
        
        response = requests.post(
            "http://localhost:8000/search_embedding_pinecone",
            headers=headers,
            json=search_data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Recherche Pinecone fonctionne")
            print(f"   - Temps de recherche: {result.get('search_time', 'N/A')}s")
            print(f"   - Résultats trouvés: {len(result.get('results', []))}")
            
            if result.get('results'):
                print(f"   - Premier résultat: {result['results'][0]}")
        else:
            print(f"❌ Erreur recherche Pinecone: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Erreur vérification Pinecone: {e}")

def main():
    """Fonction principale"""
    print("🔍 Diagnostic de l'état de vectorisation")
    print("=" * 50)
    
    check_vectorization_status()
    print("\n" + "=" * 50)
    check_pinecone_index()

if __name__ == "__main__":
    main() 