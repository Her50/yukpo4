import requests
import json
import psycopg2
import os

print("=== Réindexation complète de tous les services ===")

# Configuration
DATABASE_URL = "postgres://postgres:Hernandez87@localhost/yukpo_db"
EMBEDDING_API_URL = "http://localhost:8000"
API_KEY = "yukpo_embedding_key_2024"

def get_all_active_services():
    """Récupérer tous les services actifs depuis PostgreSQL"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        query = """
        SELECT id, data
        FROM services
        WHERE (data->>'actif')::boolean = true
        ORDER BY id DESC
        """
        
        cursor.execute(query)
        services = cursor.fetchall()
        
        print(f"📊 {len(services)} services actifs trouvés en PostgreSQL")
        
        cursor.close()
        conn.close()
        
        return services
        
    except Exception as e:
        print(f"❌ Erreur récupération services: {e}")
        return []

def reindex_service(service_id, service_data):
    """Réindexer un service dans Pinecone"""
    try:
        headers = {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY
        }
        
        # Extraire les champs pertinents
        titre = service_data.get('titre_service', {}).get('valeur', '')
        description = service_data.get('description', {}).get('valeur', '')
        category = service_data.get('category', {}).get('valeur', '')
        
        if not titre and not description and not category:
            print(f"   ⚠️ Service {service_id}: Aucun champ pertinent trouvé")
            return False
        
        # Indexer le titre
        if titre:
            payload = {
                'service_id': service_id,
                'value': titre,
                'type_donnee': 'texte',
                'active': True
            }
            
            response = requests.post(f'{EMBEDDING_API_URL}/add_embedding_pinecone', 
                                   headers=headers, json=payload, timeout=30)
            
            if response.status_code == 200:
                print(f"   ✅ Titre indexé pour service {service_id}")
            else:
                print(f"   ❌ Erreur indexation titre service {service_id}: {response.status_code}")
                return False
        
        # Indexer la description
        if description:
            payload = {
                'service_id': service_id,
                'value': description,
                'type_donnee': 'texte',
                'active': True
            }
            
            response = requests.post(f'{EMBEDDING_API_URL}/add_embedding_pinecone', 
                                   headers=headers, json=payload, timeout=30)
            
            if response.status_code == 200:
                print(f"   ✅ Description indexée pour service {service_id}")
            else:
                print(f"   ❌ Erreur indexation description service {service_id}: {response.status_code}")
                return False
        
        # Indexer la catégorie
        if category:
            payload = {
                'service_id': service_id,
                'value': category,
                'type_donnee': 'texte',
                'active': True
            }
            
            response = requests.post(f'{EMBEDDING_API_URL}/add_embedding_pinecone', 
                                   headers=headers, json=payload, timeout=30)
            
            if response.status_code == 200:
                print(f"   ✅ Catégorie indexée pour service {service_id}")
            else:
                print(f"   ❌ Erreur indexation catégorie service {service_id}: {response.status_code}")
                return False
        
        return True
        
    except Exception as e:
        print(f"   ❌ Erreur réindexation service {service_id}: {e}")
        return False

def main():
    print("🔍 Récupération des services depuis PostgreSQL...")
    services = get_all_active_services()
    
    if not services:
        print("❌ Aucun service trouvé, arrêt")
        return
    
    print(f"\n🚀 Démarrage de la réindexation de {len(services)} services...")
    
    successful = 0
    failed = 0
    
    for service_id, service_data in services:
        print(f"\n📝 Service {service_id}:")
        
        if reindex_service(service_id, service_data):
            successful += 1
        else:
            failed += 1
    
    print(f"\n📊 Résumé de la réindexation:")
    print(f"   ✅ Succès: {successful}")
    print(f"   ❌ Échecs: {failed}")
    print(f"   📈 Taux de succès: {(successful/(successful+failed)*100):.1f}%")
    
    # Vérification finale
    print(f"\n🔍 Vérification finale dans Pinecone...")
    
    try:
        headers = {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY
        }
        
        payload = {
            'query': 'test',
            'type_donnee': 'texte',
            'top_k': 100
        }
        
        response = requests.post(f'{EMBEDDING_API_URL}/search_embedding_pinecone', 
                               headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            results = data.get('results', [])
            
            print(f"   📊 Total de services dans Pinecone après réindexation: {len(results)}")
            
            # Chercher le service 129
            service_129_found = False
            for result in results:
                service_id = result.get('metadata', {}).get('service_id')
                if service_id == 129:
                    score = result.get('score', 0)
                    print(f"   ✅ Service 129 trouvé ! (score: {score:.4f})")
                    service_129_found = True
                    break
            
            if not service_129_found:
                print(f"   ❌ Service 129 toujours non trouvé")
                
        else:
            print(f"   ❌ Erreur vérification: {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ Erreur vérification: {e}")

if __name__ == "__main__":
    main() 