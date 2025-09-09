import requests
import json

print("=== Diagnostic du système multi-méthodes ===")

# Test 1: Vérifier la communication avec le microservice
print("\n1. 🔌 Test de communication avec le microservice")

try:
    response = requests.get('http://localhost:8000/health', timeout=10)
    if response.status_code == 200:
        print("   ✅ Microservice accessible")
    else:
        print(f"   ❌ Erreur microservice: {response.status_code}")
except Exception as e:
    print(f"   ❌ Erreur connexion microservice: {e}")

# Test 2: Vérifier la communication avec le backend
print("\n2. 🔌 Test de communication avec le backend")

try:
    # Test avec un token valide
    headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMxNTAyMCwiaWF0IjoxNzU2NDA3MzcxLCJleHAiOjE3NTY0OTM3NzF9.uhko6biwAmRYPwUdZutIif-xLuxryZePL8JCQCliEbM'
    }
    
    # Test simple de l'endpoint /api/users/balance
    response = requests.get('http://localhost:3001/api/users/balance', headers=headers, timeout=10)
    if response.status_code == 200:
        print("   ✅ Backend accessible (endpoint /api/users/balance)")
    else:
        print(f"   ❌ Erreur backend: {response.status_code}")
        print(f"   Réponse: {response.text}")
        
except Exception as e:
    print(f"   ❌ Erreur connexion backend: {e}")

# Test 3: Test direct du matching multi-méthodes
print("\n3. 🔬 Test direct du matching multi-méthodes")

test_data = {
    "texte": "pièces détachées véhicules",
    "base64_image": [],
    "doc_base64": [],
    "excel_base64": []
}

try:
    response = requests.post('http://localhost:3001/api/ia/auto', 
                           headers=headers, json=test_data, timeout=60)
    
    if response.status_code == 200:
        result = response.json()
        print(f"   ✅ Recherche réussie")
        
        # Extraire les résultats
        resultats = result.get('resultats', [])
        nombre_matchings = result.get('nombre_matchings', 0)
        
        print(f"   📊 Nombre de résultats: {nombre_matchings}")
        
        if resultats:
            print(f"   🎯 Services trouvés:")
            for i, service in enumerate(resultats[:3]):
                service_id = service.get('service_id', 'N/A')
                score = service.get('score', 0)
                titre = service.get('data', {}).get('titre_service', {}).get('valeur', 'N/A')
                print(f"      {i+1}. Service {service_id} (score: {score:.4f}) - {titre}")
        else:
            print(f"      ❌ Aucun service trouvé")
            
    else:
        print(f"   ❌ Erreur: {response.status_code}")
        print(f"   Réponse: {response.text}")
        
except Exception as e:
    print(f"   ❌ Erreur: {e}")

# Test 4: Vérifier les services dans Pinecone
print("\n4. 🔍 Vérification des services dans Pinecone")

try:
    embedding_headers = {
        'Content-Type': 'application/json',
        'x-api-key': 'yukpo_embedding_key_2024'
    }
    
    # Recherche large pour voir tous les services
    payload = {
        'query': 'test',
        'type_donnee': 'texte',
        'top_k': 50
    }
    
    response = requests.post('http://localhost:8000/search_embedding_pinecone', 
                           headers=embedding_headers, json=payload, timeout=30)
    
    if response.status_code == 200:
        data = response.json()
        results = data.get('results', [])
        
        print(f"   📊 Total de services dans Pinecone: {len(results)}")
        
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
            print(f"   ❌ Service 129 NON trouvé dans Pinecone")
            print(f"   📋 Services trouvés: {[r.get('metadata', {}).get('service_id') for r in results[:10]]}")
    else:
        print(f"   ❌ Erreur: {response.status_code}")
        
except Exception as e:
    print(f"   ❌ Erreur: {e}")

print("\n=== Diagnostic terminé ===") 