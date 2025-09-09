#!/usr/bin/env python3
"""
Diagnostic complet de la recherche d'images
"""

import psycopg2
import json
import os
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

def check_database():
    """Vérifier la base de données"""
    
    # Connexion à la base de données
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST", "localhost"),
            database=os.getenv("DB_NAME", "yukpomnang"),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", "postgres"),
            port=os.getenv("DB_PORT", "5432")
        )
        
        print("✅ Connexion à la base de données réussie")
        
        cursor = conn.cursor()
        
        # 1. Vérifier la structure de la table media
        print("\n📋 Structure de la table media:")
        cursor.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'media'
            ORDER BY ordinal_position;
        """)
        
        columns = cursor.fetchall()
        for col in columns:
            print(f"  {col[0]}: {col[1]} (nullable: {col[2]})")
        
        # 2. Vérifier les fonctions PostgreSQL
        print("\n🔧 Fonctions PostgreSQL:")
        cursor.execute("""
            SELECT proname, prosrc
            FROM pg_proc
            WHERE proname IN ('search_similar_images', 'calculate_image_similarity')
            ORDER BY proname;
        """)
        
        functions = cursor.fetchall()
        if functions:
            for func in functions:
                print(f"  {func[0]}: {func[1][:100]}...")
        else:
            print("  ❌ Aucune fonction trouvée!")
        
        # 3. Vérifier les extensions
        print("\n📦 Extensions installées:")
        cursor.execute("SELECT * FROM pg_extension;")
        extensions = cursor.fetchall()
        for ext in extensions:
            print(f"  {ext[1]}")
        
        # 4. Vérifier les données dans media
        print("\n📊 Données dans la table media:")
        cursor.execute("""
            SELECT 
                id, 
                service_id, 
                type,
                CASE WHEN image_signature IS NOT NULL THEN 'OUI' ELSE 'NON' END as has_signature,
                CASE WHEN image_metadata IS NOT NULL THEN 'OUI' ELSE 'NON' END as has_metadata,
                CASE WHEN image_hash IS NOT NULL THEN 'OUI' ELSE 'NON' END as has_hash
            FROM media 
            WHERE type = 'image'
            ORDER BY id DESC 
            LIMIT 5;
        """)
        
        media_data = cursor.fetchall()
        if media_data:
            for row in media_data:
                print(f"  ID: {row[0]}, Service: {row[1]}, Type: {row[2]}, Signature: {row[3]}, Metadata: {row[4]}, Hash: {row[5]}")
        else:
            print("  ❌ Aucune image trouvée dans la table media")
        
        # 5. Tester la fonction search_similar_images
        print("\n🧪 Test de la fonction search_similar_images:")
        try:
            cursor.execute("""
                SELECT search_similar_images(
                    '[0.1, 0.2, 0.3]'::jsonb,
                    0.8,
                    10
                );
            """)
            result = cursor.fetchone()
            print(f"  ✅ Fonction exécutée: {result}")
        except Exception as e:
            print(f"  ❌ Erreur: {e}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Erreur de connexion: {e}")

if __name__ == "__main__":
    print("🔍 Diagnostic de la recherche d'images")
    print("=" * 50)
    check_database() 