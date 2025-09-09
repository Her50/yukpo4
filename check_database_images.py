#!/usr/bin/env python3
"""
Script pour vérifier les images dans la base de données PostgreSQL
"""

import psycopg2
import json
from datetime import datetime

# Configuration de la base de données
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "yukpomnang",
    "user": "postgres",
    "password": "postgres"
}

def check_media_table():
    """Vérifier le contenu de la table media"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔍 Vérification de la table media...")
        
        # Compter le nombre total d'images
        cursor.execute("SELECT COUNT(*) FROM media WHERE type = 'image'")
        total_images = cursor.fetchone()[0]
        print(f"📊 Total d'images dans la table media: {total_images}")
        
        # Récupérer les dernières images
        cursor.execute("""
            SELECT m.id, m.service_id, m.path, m.uploaded_at, s.data->>'titre_service' as titre
            FROM media m
            LEFT JOIN services s ON m.service_id = s.id
            WHERE m.type = 'image'
            ORDER BY m.uploaded_at DESC
            LIMIT 10
        """)
        
        recent_images = cursor.fetchall()
        
        if recent_images:
            print("\n📸 Dernières images ajoutées:")
            for img in recent_images:
                media_id, service_id, path, uploaded_at, titre = img
                print(f"  - ID: {media_id}, Service: {service_id} ({titre}), Path: {path}, Date: {uploaded_at}")
        else:
            print("❌ Aucune image trouvée dans la table media")
        
        # Vérifier les services récents
        cursor.execute("""
            SELECT id, data->>'titre_service' as titre, created_at
            FROM services
            ORDER BY created_at DESC
            LIMIT 5
        """)
        
        recent_services = cursor.fetchall()
        
        if recent_services:
            print("\n📝 Derniers services créés:")
            for service in recent_services:
                service_id, titre, created_at = service
                print(f"  - ID: {service_id}, Titre: {titre}, Date: {created_at}")
        
        cursor.close()
        conn.close()
        
        return total_images > 0
        
    except Exception as e:
        print(f"❌ Erreur de connexion à la base de données: {e}")
        return False

def check_service_with_images():
    """Vérifier les services qui ont des images"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("\n🔍 Services avec images:")
        
        cursor.execute("""
            SELECT s.id, s.data->>'titre_service' as titre, COUNT(m.id) as nb_images
            FROM services s
            LEFT JOIN media m ON s.id = m.service_id AND m.type = 'image'
            GROUP BY s.id, s.data->>'titre_service'
            HAVING COUNT(m.id) > 0
            ORDER BY s.created_at DESC
            LIMIT 10
        """)
        
        services_with_images = cursor.fetchall()
        
        if services_with_images:
            for service in services_with_images:
                service_id, titre, nb_images = service
                print(f"  - Service {service_id}: {titre} ({nb_images} images)")
        else:
            print("❌ Aucun service avec images trouvé")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Erreur: {e}")

def main():
    """Fonction principale"""
    print("🧪 Vérification de la base de données PostgreSQL")
    print("=" * 60)
    print(f"⏰ Date/heure: {datetime.now()}")
    
    # Vérifier la table media
    has_images = check_media_table()
    
    # Vérifier les services avec images
    check_service_with_images()
    
    print("\n" + "=" * 60)
    if has_images:
        print("✅ Images trouvées dans la base de données")
    else:
        print("❌ Aucune image trouvée dans la base de données")
    print("🏁 Fin de la vérification")

if __name__ == "__main__":
    main() 