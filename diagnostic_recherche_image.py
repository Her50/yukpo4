#!/usr/bin/env python3
"""
Script de diagnostic pour la recherche d'image dans Yukpo
"""

import psycopg2
import json
import base64
import requests
from datetime import datetime

# Configuration de la base de données
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "yukpo_db",
    "user": "postgres",
    "password": "Hernandez87"
}

def check_database_structure():
    """Vérifier la structure de la base de données"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔍 Vérification de la structure de la base de données...")
        
        # Vérifier si la table media existe et ses colonnes
        cursor.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'media' 
            ORDER BY ordinal_position
        """)
        
        columns = cursor.fetchall()
        print(f"📊 Colonnes de la table media ({len(columns)}):")
        for col in columns:
            print(f"  - {col[0]}: {col[1]} (nullable: {col[2]})")
        
        # Vérifier les colonnes spécifiques à la recherche d'image
        image_search_columns = ['image_signature', 'image_hash', 'image_metadata']
        missing_columns = []
        
        for col in image_search_columns:
            cursor.execute("""
                SELECT COUNT(*) FROM information_schema.columns 
                WHERE table_name = 'media' AND column_name = %s
            """, (col,))
            if cursor.fetchone()[0] == 0:
                missing_columns.append(col)
        
        if missing_columns:
            print(f"❌ Colonnes manquantes pour la recherche d'image: {missing_columns}")
        else:
            print("✅ Toutes les colonnes de recherche d'image sont présentes")
        
        # Vérifier les fonctions PostgreSQL
        cursor.execute("""
            SELECT routine_name, routine_type
            FROM information_schema.routines 
            WHERE routine_name IN ('search_similar_images', 'calculate_image_similarity')
        """)
        
        functions = cursor.fetchall()
        print(f"🔧 Fonctions de recherche d'image ({len(functions)}):")
        for func in functions:
            print(f"  - {func[0]} ({func[1]})")
        
        conn.close()
        return len(missing_columns) == 0 and len(functions) > 0
        
    except Exception as e:
        print(f"❌ Erreur lors de la vérification de la structure: {e}")
        return False

def check_image_data():
    """Vérifier les données d'images existantes"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("\n🖼️ Vérification des données d'images...")
        
        # Compter les images
        cursor.execute("SELECT COUNT(*) FROM media WHERE type = 'image'")
        total_images = cursor.fetchone()[0]
        print(f"📊 Total d'images dans media: {total_images}")
        
        # Vérifier les signatures d'images
        cursor.execute("""
            SELECT COUNT(*) FROM media 
            WHERE type = 'image' AND image_signature IS NOT NULL
        """)
        images_with_signature = cursor.fetchone()[0]
        print(f"🔑 Images avec signature: {images_with_signature}")
        
        # Vérifier les métadonnées
        cursor.execute("""
            SELECT COUNT(*) FROM media 
            WHERE type = 'image' AND image_metadata IS NOT NULL
        """)
        images_with_metadata = cursor.fetchone()[0]
        print(f"📋 Images avec métadonnées: {images_with_metadata}")
        
        # Récupérer un exemple d'image
        cursor.execute("""
            SELECT m.id, m.service_id, m.path, m.image_signature, m.image_metadata,
                   s.data->>'titre_service' as titre
            FROM media m
            LEFT JOIN services s ON m.service_id = s.id
            WHERE m.type = 'image'
            LIMIT 1
        """)
        
        example = cursor.fetchone()
        if example:
            media_id, service_id, path, signature, metadata, titre = example
            print(f"\n📸 Exemple d'image:")
            print(f"  - ID: {media_id}")
            print(f"  - Service: {service_id} ({titre})")
            print(f"  - Path: {path}")
            print(f"  - Signature: {'✅' if signature else '❌'}")
            print(f"  - Métadonnées: {'✅' if metadata else '❌'}")
        
        conn.close()
        return images_with_signature > 0
        
    except Exception as e:
        print(f"❌ Erreur lors de la vérification des données: {e}")
        return False

def test_image_search_api():
    """Tester l'API de recherche d'image"""
    try:
        print("\n🚀 Test de l'API de recherche d'image...")
        
        # Créer une image de test simple (1x1 pixel)
        test_image_data = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
        
        # Tester l'endpoint de recherche d'image
        url = "http://localhost:3001/api/image-search/upload"
        
        # Créer un FormData
        files = {'image': ('test.png', test_image_data, 'image/png')}
        data = {
            'similarity_threshold': '0.3',
            'max_results': '10'
        }
        
        response = requests.post(url, files=files, data=data, timeout=10)
        
        print(f"📡 Status: {response.status_code}")
        print(f"📡 Response: {response.text[:200]}...")
        
        if response.status_code == 200:
            print("✅ API de recherche d'image fonctionne")
            return True
        else:
            print(f"❌ API de recherche d'image retourne {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur lors du test de l'API: {e}")
        return False

def check_backend_logs():
    """Vérifier les logs du backend"""
    print("\n📝 Vérification des logs du backend...")
    print("💡 Vérifiez que le backend est démarré avec la fonctionnalité image_search activée")
    print("💡 Vérifiez que les migrations ont été appliquées")
    print("💡 Vérifiez que les signatures d'images sont générées lors de la création de service")

def main():
    """Fonction principale"""
    print("🔍 DIAGNOSTIC COMPLET DE LA RECHERCHE D'IMAGE YUKPO")
    print("=" * 60)
    
    # Vérifier la structure de la base
    structure_ok = check_database_structure()
    
    # Vérifier les données d'images
    data_ok = check_image_data()
    
    # Tester l'API
    api_ok = test_image_search_api()
    
    # Résumé
    print("\n" + "=" * 60)
    print("📊 RÉSUMÉ DU DIAGNOSTIC")
    print("=" * 60)
    print(f"🏗️  Structure DB: {'✅' if structure_ok else '❌'}")
    print(f"🖼️  Données images: {'✅' if data_ok else '❌'}")
    print(f"🚀 API recherche: {'✅' if api_ok else '❌'}")
    
    if not structure_ok:
        print("\n🔧 ACTIONS REQUISES:")
        print("1. Appliquer la migration: 20250110000000_extend_media_for_image_search.sql")
        print("2. Vérifier que les fonctions PostgreSQL sont créées")
    
    if not data_ok:
        print("\n🖼️ ACTIONS REQUISES:")
        print("1. Générer les signatures pour les images existantes")
        print("2. Vérifier que les images sont bien sauvegardées avec leurs métadonnées")
    
    if not api_ok:
        print("\n🚀 ACTIONS REQUISES:")
        print("1. Vérifier que le backend est démarré")
        print("2. Vérifier que la fonctionnalité image_search est activée")
        print("3. Vérifier que les routes de recherche d'image sont configurées")
    
    if structure_ok and data_ok and api_ok:
        print("\n🎉 La recherche d'image fonctionne correctement !")
    else:
        print("\n⚠️  Des problèmes ont été détectés. Vérifiez les actions requises ci-dessus.")

if __name__ == "__main__":
    main() 