#!/usr/bin/env python3
"""
Script pour créer un service de test et faire la recherche
"""

import os
import psycopg2
import requests
import json
import time
from dotenv import load_dotenv

# Charger les variables d'environnement depuis le backend
load_dotenv('backend/.env')

def create_test_service():
    """Crée un service de test dans PostgreSQL"""
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("❌ DATABASE_URL non configurée")
        return None
    
    try:
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        # Service de test
        test_service_data = {
            "titre_service": "Service de plomberie d'urgence",
            "description_service": "Plombier disponible 24h/24 pour réparations d'urgence. Spécialisé dans la réparation de fuites d'eau, débouchage, installation de chauffe-eau. Intervention rapide dans les 2h.",
            "category": "Plomberie",
            "competences": ["Réparation fuites", "Débouchage", "Installation chauffe-eau", "Urgence 24h"],
            "prix": {"valeur": "80", "devise": "EUR"},
            "disponibilite": "24h/24"
        }
        
        # Insérer le service
        cursor.execute("""
            INSERT INTO services (user_id, data, is_active, embedding_status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, NOW(), NOW())
            RETURNING id
        """, (1, json.dumps(test_service_data), True, 'pending'))
        
        service_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"✅ Service de test créé avec l'ID: {service_id}")
        return service_id
        
    except Exception as e:
        print(f"❌ Erreur création service: {e}")
        return None

def vectorize_service(service_id):
    """Vectorise le service créé"""
    try:
        # Extraire le texte du service
        db_url = os.getenv('DATABASE_URL')
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        cursor.execute("SELECT data FROM services WHERE id = %s", (service_id,))
        result = cursor.fetchone()
        
        if not result:
            print(f"❌ Service {service_id} non trouvé")
            return False
        
        service_data = result[0]
        
        # Extraire le texte
        text_parts = []
        if isinstance(service_data, dict):
            if 'titre_service' in service_data:
                text_parts.append(str(service_data['titre_service']))
            if 'description_service' in service_data:
                text_parts.append(str(service_data['description_service']))
            if 'category' in service_data:
                text_parts.append(str(service_data['category']))
            if 'competences' in service_data:
                comp = service_data['competences']
                if isinstance(comp, list):
                    text_parts.extend(comp)
                else:
                    text_parts.append(str(comp))
        
        service_text = " ".join(text_parts)
        print(f"📝 Texte extrait: {service_text[:100]}...")
        
        # Requête d'embedding
        embedding_request = {
            "value": service_text,
            "type_donnee": "texte",
            "service_id": service_id,
            "gps_lat": 48.8566,
            "gps_lon": 2.3522,
            "langue": "fr",
            "active": True,
            "type_metier": "service"
        }
        
        # Appel au microservice
        headers = {"x-api-key": "yukpo_embedding_key_2024"}
        response = requests.post(
            "http://localhost:8000/add_embedding_pinecone",
            headers=headers,
            json=embedding_request,
            timeout=300
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('status') == 'ok':
                print(f"✅ Service {service_id} vectorisé avec succès")
                
                # Mettre à jour le statut dans PostgreSQL
                cursor.execute("""
                    UPDATE services 
                    SET embedding_status = 'success', 
                        embedding_updated_at = NOW(),
                        embedding_data = %s
                    WHERE id = %s
                """, (json.dumps(result), service_id))
                conn.commit()
                
                cursor.close()
                conn.close()
                return True
            else:
                print(f"❌ Erreur vectorisation: {result}")
                return False
        else:
            print(f"❌ Erreur HTTP: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur vectorisation: {e}")
        return False

def search_service():
    """Recherche le service créé"""
    print("\n🔍 Recherche du service créé...")
    
    try:
        headers = {"x-api-key": "yukpo_embedding_key_2024"}
        
        # Recherche avec différents termes
        search_terms = ["plomberie", "fuite", "urgence", "réparation"]
        
        for term in search_terms:
            print(f"\n   Recherche: '{term}'")
            start_time = time.time()
            
            data = {
                "query": term,
                "type_donnee": "texte",
                "top_k": 5,
                "active": True
            }
            
            response = requests.post(
                "http://localhost:8000/search_embedding_pinecone",
                headers=headers,
                json=data,
                timeout=300
            )
            
            search_time = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                results_count = len(result.get('results', []))
                print(f"     ✅ Trouvé en {search_time:.2f}s: {results_count} résultats")
                
                if results_count > 0:
                    for i, match in enumerate(result['results'], 1):
                        score = match.get('score', 0)
                        service_id = match.get('service_id', 'N/A')
                        print(f"       {i}. Service {service_id}: score={score:.3f}")
                else:
                    print(f"       Aucun résultat trouvé")
            else:
                print(f"     ❌ Erreur: {response.status_code}")
                
    except Exception as e:
        print(f"❌ Erreur recherche: {e}")

def main():
    """Fonction principale"""
    print("🚀 Création et recherche de service de test")
    print("=" * 60)
    
    # 1. Créer le service
    service_id = create_test_service()
    if not service_id:
        return
    
    # 2. Vectoriser le service
    print(f"\n🔄 Vectorisation du service {service_id}...")
    if not vectorize_service(service_id):
        print("❌ Échec de la vectorisation")
        return
    
    # 3. Rechercher le service
    search_service()
    
    print(f"\n✅ Test terminé pour le service {service_id}")

if __name__ == "__main__":
    main() 