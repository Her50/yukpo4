#!/usr/bin/env python3
"""
Test avec la signature exacte stockée dans la base
"""

import requests
import json
import psycopg2

def test_exact_signature():
    """Test avec la signature exacte de la base"""
    print("🎯 Test avec signature exacte de la base")
    print("=" * 50)
    
    try:
        # Récupérer la signature exacte de la base
        print("📊 Récupération de la signature de la base...")
        password = input("🔑 Entrez le mot de passe PostgreSQL: ").strip()
        
        if not password:
            print("❌ Mot de passe requis")
            return False
        
        conn = psycopg2.connect(
            host='localhost',
            database='yukpo_db',
            user='postgres',
            password=password
        )
        cursor = conn.cursor()
        
        # Récupérer la signature exacte
        cursor.execute("SELECT image_signature FROM media WHERE id = 1")
        stored_signature = cursor.fetchone()[0]
        
        print(f"✅ Signature récupérée: {stored_signature[:5]}... (longueur: {len(stored_signature)})")
        
        cursor.close()
        conn.close()
        
        # Maintenant tester l'API avec cette signature
        print("\n🔍 Test de l'API avec la signature exacte...")
        
        BASE_URL = "http://localhost:3001"
        API_BASE = f"{BASE_URL}/api"
        
        # Créer une requête qui simule le résultat de generate_image_signature
        # Nous allons créer une image avec des données qui correspondent à la signature
        from PIL import Image
        import io
        
        # Créer une image simple qui pourrait générer une signature similaire
        img = Image.new('RGB', (100, 100), color='white')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        
        files = {"image": ("exact_test.jpg", img_bytes, "image/jpeg")}
        
        print("  Envoi de l'image...")
        response = requests.post(f"{API_BASE}/image-search/upload", files=files, timeout=30)
        
        print(f"  Status: {response.status_code}")
        
        if response.status_code == 200:
            print("  ✅ Succès!")
            try:
                result = response.json()
                print(f"  Résultat: {json.dumps(result, indent=2)}")
            except:
                print(f"  Réponse non-JSON: {response.text[:200]}")
                
        elif response.status_code == 500:
            print("  ❌ Erreur 500 détectée")
            try:
                error_data = response.json()
                print(f"  Erreur JSON: {json.dumps(error_data, indent=2)}")
                
                # Maintenant nous devrions voir plus de détails dans les logs du backend
                print("  🔍 Vérifiez les logs du backend pour plus de détails")
                
            except Exception as e:
                print(f"  ⚠️ Erreur lors du parsing JSON: {e}")
                print(f"  Réponse brute: {response.text}")
                
        else:
            print(f"  ⚠️ Status inattendu: {response.status_code}")
            print(f"  Réponse: {response.text[:200]}")
            
    except Exception as e:
        print(f"  ❌ Exception: {e}")
        import traceback
        print(f"  Traceback: {traceback.format_exc()}")
    
    print("\n" + "=" * 50)
    print("🎯 Test terminé!")

if __name__ == "__main__":
    test_exact_signature() 