import requests
import json
import time

# Test de création de service avec vérification de l'indexation
headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMxNTI2NCwiaWF0IjoxNzU2NDA0Njg5LCJleHAiOjE3NTY0OTEwODl9.8lzRdwXjvOlvtWtfItaOetkZjsjv_9uA05KCVugj27U'
}

print("=== Test de création de service avec indexation automatique ===")

# Données du service de test
test_service_data = {
    "intention": "creation_service",
    "data": {
        "titre_service": {
            "type_donnee": "string",
            "valeur": "Service de test pour vérification indexation",
            "origine_champs": "test"
        },
        "description": {
            "type_donnee": "string", 
            "valeur": "Ce service est créé pour tester l'indexation automatique dans Pinecone",
            "origine_champs": "test"
        },
        "category": {
            "type_donnee": "string",
            "valeur": "Test",
            "origine_champs": "test"
        },
        "is_tarissable": {
            "type_donnee": "boolean",
            "valeur": True,
            "origine_champs": "test"
        }
    },
    "tokens_consumed": 100,
    "tokens_breakdown": {
        "detection": 50,
        "generation": 50,
        "total": 100
    },
    "model_used": "test",
    "processing_time_ms": 1000
}

print("\n1. Création du service de test...")
try:
    response = requests.post('http://localhost:3001/api/yukpo', 
                           headers=headers, json=test_service_data, timeout=60)
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Service créé avec succès")
        print(f"   Réponse: {json.dumps(result, indent=2)}")
        
        # Extraire l'ID du service créé
        service_id = None
        if 'service_id' in result:
            service_id = result['service_id']
        elif 'data' in result and 'service_id' in result['data']:
            service_id = result['data']['service_id']
        
        if service_id:
            print(f"   Service ID: {service_id}")
            
            # Attendre que les embeddings se terminent
            print(f"\n2. Attente de l'indexation (10 secondes)...")
            time.sleep(10)
            
            # Vérifier si le service est indexé dans Pinecone
            print(f"\n3. Vérification de l'indexation dans Pinecone...")
            
            # Test de recherche pour le service créé
            embedding_headers = {
                'Content-Type': 'application/json',
                'x-api-key': 'yukpo_embedding_key_2024'
            }
            
            search_queries = [
                "Service de test pour vérification indexation",
                "test indexation",
                "vérification indexation"
            ]
            
            service_found = False
            for query in search_queries:
                try:
                    payload = {
                        'query': query,
                        'type_donnee': 'texte',
                        'top_k': 10
                    }
                    
                    search_response = requests.post('http://localhost:8000/search_embedding_pinecone', 
                                                 headers=embedding_headers, json=payload, timeout=30)
                    
                    if search_response.status_code == 200:
                        search_data = search_response.json()
                        results = search_data.get('results', [])
                        
                        print(f"   Recherche '{query}': {len(results)} résultats")
                        
                        for result in results:
                            result_service_id = result.get('metadata', {}).get('service_id')
                            if result_service_id == service_id:
                                score = result.get('score', 0)
                                print(f"     ✅ Service {service_id} trouvé ! (score: {score:.4f})")
                                service_found = True
                                break
                        
                        if service_found:
                            break
                            
                except Exception as e:
                    print(f"     ❌ Erreur recherche '{query}': {e}")
            
            if not service_found:
                print(f"   ❌ Service {service_id} non trouvé dans Pinecone")
                print(f"   ⚠️  L'indexation automatique a peut-être échoué")
            else:
                print(f"   ✅ Indexation automatique réussie !")
                
        else:
            print(f"   ❌ Impossible d'extraire l'ID du service")
            
    else:
        print(f"❌ Erreur création service: {response.status_code}")
        print(f"   Réponse: {response.text}")
        
except Exception as e:
    print(f"❌ Erreur: {e}")

print("\n=== Test terminé ===") 