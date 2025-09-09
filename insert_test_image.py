#!/usr/bin/env python3
"""
Insertion directe d'une image de test dans la base de données
"""

import psycopg2
import json
import base64
import hashlib
from datetime import datetime

def insert_test_image():
    """Insère une image de test dans la base de données"""
    print("🔧 Insertion d'une image de test dans la base de données")
    print("=" * 60)
    
    # Configuration de la base de données
    DB_CONFIG = {
        'host': 'localhost',
        'database': 'yukpo_db',
        'user': 'postgres',
        'password': None  # Sera demandé
    }
    
    try:
        # Demander le mot de passe
        password = input("🔑 Entrez le mot de passe PostgreSQL: ").strip()
        if not password:
            print("❌ Mot de passe requis")
            return False
        
        DB_CONFIG['password'] = password
        
        # Charger l'image
        print("\n📷 Chargement de l'image de test...")
        with open("test_image.jpg", "rb") as f:
            image_data = f.read()
        
        # Calculer le hash MD5
        image_hash = hashlib.md5(image_data).hexdigest()
        
        # Créer des métadonnées fictives
        image_metadata = {
            "width": 800,
            "height": 600,
            "format": "jpeg",
            "file_size": len(image_data),
            "dominant_colors": [[255, 255, 255], [0, 0, 0], [128, 128, 128]],
            "color_histogram": [0.1] * 256,
            "edge_density": 0.5,
            "brightness": 0.6,
            "contrast": 0.4
        }
        
        # Créer une signature d'image fictive (192 valeurs float)
        image_signature = [0.5] * 192  # Signature uniforme pour le test
        
        print(f"✅ Image chargée: {len(image_data)} bytes")
        print(f"✅ Hash MD5: {image_hash}")
        
        # Connexion à la base de données
        print("\n🔌 Connexion à la base de données...")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Vérifier si la table services a des données
        cursor.execute("SELECT COUNT(*) FROM services")
        services_count = cursor.fetchone()[0]
        
        if services_count == 0:
            print("⚠️ Aucun service dans la table services")
            print("🔧 Création d'un service de test...")
            
            # Créer un service de test
            cursor.execute("""
                INSERT INTO services (titre_service, description, category, is_tarissable, prix, devise, data, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                "Service de test - Blazer élégant",
                "Service de test pour vérifier la recherche d'images",
                "Mode",
                False,
                15000,
                "XAF",
                json.dumps({"test": True}),
                datetime.now(),
                datetime.now()
            ))
            
            service_id = cursor.fetchone()[0]
            print(f"✅ Service de test créé avec ID: {service_id}")
        else:
            # Utiliser le premier service existant
            cursor.execute("SELECT id FROM services LIMIT 1")
            service_id = cursor.fetchone()[0]
            print(f"✅ Utilisation du service existant ID: {service_id}")
        
        # Insérer l'image dans la table media
        print("\n📤 Insertion de l'image dans la table media...")
        
        cursor.execute("""
            INSERT INTO media (service_id, type, path, media_type, file_size, file_format, 
                             image_signature, image_hash, image_metadata, uploaded_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            service_id,
            "image",
            "test_image.jpg",
            "image",
            len(image_data),
            "jpeg",
            json.dumps(image_signature),
            image_hash,
            json.dumps(image_metadata),
            datetime.now()
        ))
        
        media_id = cursor.fetchone()[0]
        print(f"✅ Image insérée avec ID: {media_id}")
        
        # Valider la transaction
        conn.commit()
        
        # Vérifier l'insertion
        cursor.execute("SELECT COUNT(*) FROM media WHERE type = 'image'")
        media_count = cursor.fetchone()[0]
        print(f"✅ Total d'images dans la base: {media_count}")
        
        # Vérifier que la signature est bien stockée
        cursor.execute("SELECT image_signature IS NOT NULL FROM media WHERE id = %s", (media_id,))
        has_signature = cursor.fetchone()[0]
        print(f"✅ Signature d'image stockée: {has_signature}")
        
        cursor.close()
        conn.close()
        
        print("\n🎉 Image de test insérée avec succès!")
        print("🚀 Vous pouvez maintenant tester la recherche d'images!")
        
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors de l'insertion: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return False

if __name__ == "__main__":
    insert_test_image() 