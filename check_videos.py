#!/usr/bin/env python3
"""
Script pour vérifier les vidéos dans la base de données Yukpo
"""

import psycopg2
import os
from datetime import datetime

def check_videos():
    try:
        # Connexion à la base de données
        conn = psycopg2.connect(
            host="34.79.199.41",  # IP publique de yukpo-postgres
            database="yukpo_db",
            user="yukpo_user",
            password="yukpo_password_2024",  # Mot de passe par défaut
            port="5432"
        )
        
        cursor = conn.cursor()
        
        print(f"🔍 [{datetime.now()}] Vérification des vidéos dans la table media...")
        
        # Compter le nombre total de vidéos
        cursor.execute("""
            SELECT COUNT(*) as video_count 
            FROM media 
            WHERE type = 'video' 
            AND path IS NOT NULL 
            AND path != ''
        """)
        
        video_count = cursor.fetchone()[0]
        print(f"📊 Nombre total de vidéos: {video_count}")
        
        if video_count > 0:
            # Afficher les 5 vidéos les plus récentes
            cursor.execute("""
                SELECT 
                    m.id,
                    m.service_id,
                    m.product_index,
                    m.path,
                    m.uploaded_at,
                    s.category,
                    u.name as seller_name
                FROM media m
                INNER JOIN services s ON s.id = m.service_id AND s.is_active = true
                LEFT JOIN users u ON u.id = s.user_id
                WHERE m.type = 'video'
                AND m.path IS NOT NULL
                AND m.path != ''
                ORDER BY m.uploaded_at DESC
                LIMIT 5
            """)
            
            videos = cursor.fetchall()
            print(f"\n📹 Dernières vidéos trouvées:")
            for video in videos:
                video_id, service_id, product_index, path, uploaded_at, category, seller_name = video
                print(f"  - ID: {video_id} | Service: {service_id} | Path: {path[:50]}... | Catégorie: {category} | Vendeur: {seller_name}")
        
        # Vérifier aussi les services avec des vidéos dans leur data JSON (ancien système)
        cursor.execute("""
            SELECT COUNT(*) as json_video_count
            FROM services s
            WHERE s.is_active = true
            AND (
                s.data::jsonb ? 'videos' 
                OR s.data::jsonb ? 'video'
                OR s.data::jsonb->'data' ? 'videos'
                OR s.data::jsonb->'data' ? 'video'
            )
        """)
        
        json_video_count = cursor.fetchone()[0]
        print(f"\n📊 Services avec vidéos dans data JSON: {json_video_count}")
        
        cursor.close()
        conn.close()
        
        if video_count == 0 and json_video_count == 0:
            print(f"\n❌ AUCUNE VIDÉO TROUVÉE - ni dans la table media ni dans services.data JSON")
        elif video_count > 0:
            print(f"\n✅ {video_count} vidéos trouvées dans la table media")
        elif json_video_count > 0:
            print(f"\n⚠️ {json_video_count} services avec vidéos dans data JSON (ancien système)")
            
    except Exception as e:
        print(f"❌ Erreur: {e}")

if __name__ == "__main__":
    check_videos()
