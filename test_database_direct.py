#!/usr/bin/env python3
"""
Test direct de la base de données et des fonctions PostgreSQL
"""

import psycopg2
import json

def test_database_direct():
    """Test direct de la base de données"""
    print("🗄️ Test direct de la base de données")
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
        
        # Test 1: Vérifier les données dans media
        print("\n📊 Test 1: Vérification des données media")
        cursor.execute("SELECT COUNT(*) FROM media WHERE type = 'image'")
        media_count = cursor.fetchone()[0]
        print(f"  Images dans la base: {media_count}")
        
        if media_count > 0:
            cursor.execute("""
                SELECT id, service_id, path, 
                       image_signature IS NOT NULL as has_signature,
                       image_metadata IS NOT NULL as has_metadata,
                       jsonb_array_length(image_signature) as signature_length
                FROM media WHERE type = 'image' LIMIT 3
            """)
            
            for row in cursor.fetchall():
                media_id, service_id, path, has_signature, has_metadata, sig_length = row
                print(f"    - Media ID {media_id}: Service {service_id}, Path: {path}")
                print(f"      Signature: {has_signature} (longueur: {sig_length})")
                print(f"      Métadonnées: {has_metadata}")
        
        # Test 2: Tester la fonction calculate_image_similarity
        print("\n🔍 Test 2: Test de calculate_image_similarity")
        try:
            # Créer deux signatures de test
            sig1 = [0.5] * 192
            sig2 = [0.6] * 192
            
            cursor.execute("SELECT calculate_image_similarity(%s, %s)", 
                         (json.dumps(sig1), json.dumps(sig2)))
            similarity = cursor.fetchone()[0]
            print(f"  Similarité entre [0.5] et [0.6]: {similarity}")
        except Exception as e:
            print(f"  ❌ Erreur avec calculate_image_similarity: {e}")
        
        # Test 3: Tester la fonction search_similar_images
        print("\n🔍 Test 3: Test de search_similar_images")
        try:
            # Créer une signature de test
            test_sig = [0.5] * 192
            
            cursor.execute("SELECT * FROM search_similar_images(%s, 0.1, 5)", 
                         (json.dumps(test_sig),))
            
            results = cursor.fetchall()
            print(f"  Résultats trouvés: {len(results)}")
            
            if results:
                for row in results:
                    print(f"    - {row}")
            else:
                print("  ℹ️ Aucun résultat trouvé (normal avec le seuil 0.1)")
                
        except Exception as e:
            print(f"  ❌ Erreur avec search_similar_images: {e}")
            import traceback
            print(f"  Traceback: {traceback.format_exc()}")
        
        # Test 4: Vérifier la structure de la table media
        print("\n🏗️ Test 4: Structure de la table media")
        cursor.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'media' 
            ORDER BY ordinal_position
        """)
        
        columns = cursor.fetchall()
        for col in columns:
            col_name, data_type, nullable = col
            print(f"  - {col_name}: {data_type} (nullable: {nullable})")
        
        cursor.close()
        conn.close()
        
        print("\n✅ Tests de base de données terminés")
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors des tests: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return False

if __name__ == "__main__":
    test_database_direct() 