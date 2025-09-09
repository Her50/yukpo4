#!/usr/bin/env python3
"""
Examiner le contenu exact du service 138
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import json

# Charger les variables d'environnement
load_dotenv()

def get_db_connection():
    """Établir une connexion à la base de données"""
    try:
        database_url = os.getenv('DATABASE_URL')
        if database_url:
            conn = psycopg2.connect(database_url)
            print("✅ Connexion PostgreSQL établie")
            return conn
        else:
            print("❌ DATABASE_URL non définie")
            return None
    except Exception as e:
        print(f"❌ Erreur de connexion: {e}")
        return None

def examiner_service_138():
    """Examiner le contenu exact du service 138"""
    print("🔍 EXAMEN DÉTAILLÉ DU SERVICE 138")
    print("=" * 50)
    
    conn = get_db_connection()
    if not conn:
        return
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Récupérer le service 138
        cursor.execute("""
            SELECT id, data, created_at, embedding_status, embedding_error
            FROM services 
            WHERE id = 138
        """)
        
        service = cursor.fetchone()
        if not service:
            print("❌ Service 138 non trouvé en base")
            return
        
        print(f"✅ Service 138 trouvé:")
        print(f"   - ID: {service['id']}")
        print(f"   - Créé: {service['created_at']}")
        print(f"   - Statut embedding: {service['embedding_status']}")
        print(f"   - Erreur embedding: {service['embedding_error']}")
        
        # Analyser les données JSON
        data = service['data']
        print(f"\n📋 CONTENU DU SERVICE 138:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        # Extraire les champs clés
        if isinstance(data, dict):
            print(f"\n🔍 CHAMPS CLÉS EXTRAITS:")
            
            # Titre du service
            titre = data.get('titre_service', {})
            if isinstance(titre, dict):
                titre_valeur = titre.get('valeur', 'N/A')
                print(f"   - Titre: {titre_valeur}")
            else:
                print(f"   - Titre: {titre}")
            
            # Description
            description = data.get('description', {})
            if isinstance(description, dict):
                desc_valeur = description.get('valeur', 'N/A')
                print(f"   - Description: {desc_valeur}")
            else:
                print(f"   - Description: {description}")
            
            # Catégorie
            category = data.get('category', {})
            if isinstance(category, dict):
                cat_valeur = category.get('valeur', 'N/A')
                print(f"   - Catégorie: {cat_valeur}")
            else:
                print(f"   - Catégorie: {category}")
            
            # Autres champs
            for key, value in data.items():
                if key not in ['titre_service', 'description', 'category', 'intention']:
                    if isinstance(value, dict) and 'valeur' in value:
                        print(f"   - {key}: {value['valeur']}")
                    else:
                        print(f"   - {key}: {value}")
        
        cursor.close()
        
    except Exception as e:
        print(f"❌ Erreur lors de l'examen: {e}")
    finally:
        conn.close()
        print(f"\n✅ Connexion fermée")

if __name__ == "__main__":
    examiner_service_138() 