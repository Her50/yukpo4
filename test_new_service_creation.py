#!/usr/bin/env python3
"""
Test de création d'un nouveau service avec image
"""

import requests
import json
import base64
from PIL import Image
import io

def create_test_image():
    """Créer une image de test simple"""
    # Créer une image 100x100 avec des couleurs
    img = Image.new('RGB', (100, 100), color='red')
    
    # Ajouter du texte
    from PIL import ImageDraw, ImageFont
    draw = ImageDraw.Draw(img)
    
    # Essayer d'utiliser une police par défaut
    try:
        font = ImageFont.load_default()
    except:
        font = None
    
    draw.text((10, 40), "TEST", fill='white', font=font)
    
    # Convertir en base64
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    
    # Encoder en base64
    image_base64 = base64.b64encode(img_bytes.getvalue()).decode('utf-8')
    return image_base64

def test_service_creation():
    """Tester la création d'un service avec image"""
    print("🎯 Test de création d'un nouveau service avec image")
    print("=" * 60)
    
    # Créer une image de test
    print("📸 Création de l'image de test...")
    image_base64 = create_test_image()
    print(f"✅ Image créée (base64 length: {len(image_base64)})")
    
    # Données du service
    service_data = {
        "user_id": 1,
        "data": {
            "intention": "creation_service",
            "titre_service": {
                "type_donnee": "string",
                "valeur": "Service de test avec image corrigée",
                "origine_champs": "test"
            },
            "category": {
                "type_donnee": "string",
                "valeur": "Test et développement",
                "origine_champs": "test"
            },
            "description": {
                "type_donnee": "string",
                "valeur": "Ceci est un service de test pour vérifier que la correction fonctionne",
                "origine_champs": "test"
            },
            "is_tarissable": {
                "type_donnee": "boolean",
                "valeur": True,
                "origine_champs": "test"
            },
            "tokens_consumed": 100,
            "actif": True,
            "base64_image": [image_base64]
        }
    }
    
    print("\n📤 Envoi de la requête de création...")
    
    BASE_URL = "http://localhost:3001"
    API_BASE = f"{BASE_URL}/api"
    
    try:
        response = requests.post(
            f"{API_BASE}/services/create",
            json=service_data,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"📊 Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Service créé avec succès!")
            try:
                result = response.json()
                service_id = result.get("service_id")
                print(f"🎯 Service ID: {service_id}")
                print(f"📝 Message: {result.get('message')}")
                
                # Vérifier que l'image est bien dans la base
                print("\n🔍 Vérification de l'image dans la base...")
                check_image_in_database(service_id)
                
            except Exception as e:
                print(f"⚠️ Erreur lors du parsing JSON: {e}")
                print(f"📄 Réponse: {response.text[:200]}")
                
        elif response.status_code == 500:
            print("❌ Erreur 500 détectée")
            try:
                error_data = response.json()
                print(f"🚨 Erreur: {json.dumps(error_data, indent=2)}")
            except:
                print(f"📄 Réponse brute: {response.text}")
                
        else:
            print(f"⚠️ Status inattendu: {response.status_code}")
            print(f"📄 Réponse: {response.text[:200]}")
            
    except Exception as e:
        print(f"❌ Exception: {e}")
        import traceback
        print(f"📋 Traceback: {traceback.format_exc()}")
    
    print("\n" + "=" * 60)
    print("🎯 Test terminé!")

def check_image_in_database(service_id):
    """Vérifier que l'image est bien dans la base"""
    print(f"🔍 Vérification pour le service {service_id}...")
    
    try:
        # Demander le mot de passe
        password = input("🔑 Entrez le mot de passe PostgreSQL: ").strip()
        
        if not password:
            print("❌ Mot de passe requis")
            return
        
        import psycopg2
        
        conn = psycopg2.connect(
            host='localhost',
            database='yukpo_db',
            user='postgres',
            password=password
        )
        cursor = conn.cursor()
        
        # Vérifier la table media
        cursor.execute("""
            SELECT id, type, path, image_signature, image_hash, image_metadata
            FROM media 
            WHERE service_id = %s
            ORDER BY id DESC
        """, (service_id,))
        
        media_records = cursor.fetchall()
        
        if media_records:
            print(f"✅ {len(media_records)} enregistrement(s) media trouvé(s)")
            for record in media_records:
                media_id, media_type, path, signature, hash, metadata = record
                print(f"  📁 Media ID: {media_id}")
                print(f"  📂 Type: {media_type}")
                print(f"  🗂️ Path: {path}")
                print(f"  🔍 Signature: {'✅' if signature else '❌'}")
                print(f"  🆔 Hash: {'✅' if hash else '❌'}")
                print(f"  📊 Métadonnées: {'✅' if metadata else '❌'}")
                print()
        else:
            print("❌ Aucun enregistrement media trouvé")
            
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Erreur lors de la vérification: {e}")

if __name__ == "__main__":
    test_service_creation() 