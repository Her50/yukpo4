#!/usr/bin/env python3
"""
Script pour vectoriser tous les services existants dans PostgreSQL
"""

import os
import psycopg2
import requests
import json
import time
from dotenv import load_dotenv

# Charger les variables d'environnement depuis le backend
load_dotenv('backend/.env')

def get_services_from_db():
    """Récupère tous les services de PostgreSQL"""
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("❌ DATABASE_URL non configurée")
        return []
    
    try:
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, user_id, data, gps, is_active 
            FROM services 
            WHERE is_active = true
            ORDER BY id
        """)
        
        services = []
        for row in cursor.fetchall():
            service = {
                'id': row[0],
                'user_id': row[1],
                'data': row[2],
                'gps': row[3],
                'is_active': row[4]
            }
            services.append(service)
        
        cursor.close()
        conn.close()
        
        print(f"✅ {len(services)} services récupérés de PostgreSQL")
        return services
        
    except Exception as e:
        print(f"❌ Erreur récupération services: {e}")
        return []

def extract_service_text(service_data):
    """Extrait le texte du service"""
    text_parts = []
    
    if isinstance(service_data, dict):
        # Titre
        if 'titre_service' in service_data:
            text_parts.append(str(service_data['titre_service']))
        
        # Description
        if 'description_service' in service_data:
            text_parts.append(str(service_data['description_service']))
        
        # Catégorie
        if 'category' in service_data:
            text_parts.append(str(service_data['category']))
        
        # Compétences
        if 'competences' in service_data:
            comp = service_data['competences']
            if isinstance(comp, list):
                text_parts.extend(comp)
            else:
                text_parts.append(str(comp))
    
    return " ".join(text_parts)

def vectorize_service(service):
    """Vectorise un service"""
    try:
        # Extraire le texte
        service_text = extract_service_text(service.get('data', {}))
        if not service_text.strip():
            print(f"⚠️ Service {service['id']}: Aucun texte")
            return False
        
        # Coordonnées GPS
        lat, lon = None, None
        if service.get('gps'):
            gps_str = service['gps']
            if isinstance(gps_str, str) and ',' in gps_str:
                try:
                    lon, lat = gps_str.split(',')
                    lat, lon = float(lat.strip()), float(lon.strip())
                except:
                    pass
        
        # Requête d'embedding
        embedding_request = {
            "value": service_text,
            "type_donnee": "texte",
            "service_id": service['id'],
            "gps_lat": lat,
            "gps_lon": lon,
            "langue": "fr",
            "active": service['is_active'],
            "type_metier": "service"
        }
        
        # Appel au microservice
        headers = {"x-api-key": "yukpo_embedding_key_2024"}
        response = requests.post(
            "http://localhost:8000/add_embedding_pinecone",
            headers=headers,
            json=embedding_request,
            timeout=120
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('status') == 'ok':
                print(f"✅ Service {service['id']}: Vectorisé")
                return True
            else:
                print(f"❌ Service {service['id']}: Erreur - {result}")
                return False
        else:
            print(f"❌ Service {service['id']}: HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Service {service['id']}: Exception - {e}")
        return False

def main():
    """Fonction principale"""
    print("🚀 Vectorisation de tous les services...")
    
    # Récupérer les services
    services = get_services_from_db()
    if not services:
        print("❌ Aucun service à vectoriser")
        return
    
    # Statistiques
    total = len(services)
    success = 0
    failed = 0
    
    print(f"📈 Vectorisation de {total} services...")
    
    for i, service in enumerate(services, 1):
        print(f"\n[{i}/{total}] Service {service['id']}...")
        
        if vectorize_service(service):
            success += 1
        else:
            failed += 1
        
        # Pause
        time.sleep(0.5)
    
    # Résumé
    print(f"\n{'='*50}")
    print("📊 RÉSUMÉ")
    print(f"{'='*50}")
    print(f"Total: {total}")
    print(f"Réussis: {success}")
    print(f"Échoués: {failed}")
    print(f"Taux: {(success/total)*100:.1f}%")
    
    if success > 0:
        print(f"\n✅ {success} services vectorisés dans Pinecone!")
    else:
        print(f"\n❌ Aucun service vectorisé")

if __name__ == "__main__":
    main() 