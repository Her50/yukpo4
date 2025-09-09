#!/usr/bin/env python3
"""
Test avec une signature qui devrait matcher exactement
"""

import psycopg2
import json

def test_matching_signature():
    """Test avec une signature qui devrait matcher"""
    print("🎯 Test avec signature qui devrait matcher")
    print("=" * 50)
    
    try:
        # Demander le mot de passe
        password = input("🔑 Entrez le mot de passe PostgreSQL: ").strip()
        
        if not password:
            print("❌ Mot de passe requis")
            return False
        
        # Connexion à la base de données
        conn = psycopg2.connect(
            host='localhost',
            database='yukpo_db',
            user='postgres',
            password=password
        )
        cursor = conn.cursor()
        
        print("✅ Connexion à la base réussie")
        
        # Récupérer la signature exacte stockée dans la base
        print("\n📊 Récupération de la signature stockée...")
        cursor.execute("SELECT image_signature FROM media WHERE id = 1")
        stored_signature = cursor.fetchone()[0]
        
        print(f"  Signature stockée: {stored_signature[:5]}... (longueur: {len(stored_signature)})")
        
        # Test avec la signature exacte
        print("\n🔍 Test avec la signature exacte...")
        cursor.execute("SELECT * FROM search_similar_images(%s, 0.1, 5)", 
                     (json.dumps(stored_signature),))
        
        results = cursor.fetchall()
        print(f"  Résultats trouvés: {len(results)}")
        
        if results:
            for row in results:
                media_id, service_id, path, similarity_score, metadata = row
                print(f"    - Media ID {media_id}: Service {service_id}, Score: {similarity_score}")
                print(f"      Path: {path}")
        else:
            print("  ❌ Aucun résultat trouvé (problème!)")
        
        # Test avec un seuil plus bas
        print("\n🔍 Test avec seuil 0.01...")
        cursor.execute("SELECT * FROM search_similar_images(%s, 0.01, 5)", 
                     (json.dumps(stored_signature),))
        
        results = cursor.fetchall()
        print(f"  Résultats trouvés: {len(results)}")
        
        if results:
            for row in results:
                media_id, service_id, path, similarity_score, metadata = row
                print(f"    - Media ID {media_id}: Service {service_id}, Score: {similarity_score}")
        
        cursor.close()
        conn.close()
        
        print("\n✅ Test de signature terminé")
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors du test: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return False

if __name__ == "__main__":
    test_matching_signature() 