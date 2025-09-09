import requests
import json

# Test final de recherche pour le service 128
headers = {
    'Content-Type': 'application/json',
    'x-api-key': 'yukpo_embedding_key_2024'
}

print("=== Test final : Service 128 dans les recherches ===")

# Test 1: Recherche spécifique pour le service 128
print("\n1. Recherche 'librairie bayangam':")
try:
    payload = {
        'query': 'librairie bayangam',
        'type_donnee': 'texte',
        'top_k': 10
    }
    
    response = requests.post('http://localhost:8000/search_embedding_pinecone', 
                           headers=headers, json=payload, timeout=30)
    
    if response.status_code == 200:
        data = response.json()
        results = data.get('results', [])
        print(f"📊 {len(results)} résultats trouvés")
        
        service_128_found = False
        for i, result in enumerate(results):
            service_id = result.get('metadata', {}).get('service_id', 'N/A')
            score = result.get('score', 0)
            print(f"  {i+1}. Service {service_id} (score: {score:.4f})")
            
            if service_id == 128:
                service_128_found = True
                print(f"     ✅ Service 128 trouvé !")
        
        if not service_128_found:
            print("  ❌ Service 128 non trouvé dans cette recherche")
    else:
        print(f"❌ Erreur: {response.status_code}")
        
except Exception as e:
    print(f"❌ Erreur: {e}")

# Test 2: Recherche "fournitures scolaires"
print("\n2. Recherche 'fournitures scolaires':")
try:
    payload = {
        'query': 'fournitures scolaires',
        'type_donnee': 'texte',
        'top_k': 10
    }
    
    response = requests.post('http://localhost:8000/search_embedding_pinecone', 
                           headers=headers, json=payload, timeout=30)
    
    if response.status_code == 200:
        data = response.json()
        results = data.get('results', [])
        print(f"📊 {len(results)} résultats trouvés")
        
        service_128_found = False
        for i, result in enumerate(results):
            service_id = result.get('metadata', {}).get('service_id', 'N/A')
            score = result.get('score', 0)
            print(f"  {i+1}. Service {service_id} (score: {score:.4f})")
            
            if service_id == 128:
                service_128_found = True
                print(f"     ✅ Service 128 trouvé !")
        
        if not service_128_found:
            print("  ❌ Service 128 non trouvé dans cette recherche")
    else:
        print(f"❌ Erreur: {response.status_code}")
        
except Exception as e:
    print(f"❌ Erreur: {e}")

# Test 3: Recherche "commerce"
print("\n3. Recherche 'commerce':")
try:
    payload = {
        'query': 'commerce',
        'type_donnee': 'texte',
        'top_k': 10
    }
    
    response = requests.post('http://localhost:8000/search_embedding_pinecone', 
                           headers=headers, json=payload, timeout=30)
    
    if response.status_code == 200:
        data = response.json()
        results = data.get('results', [])
        print(f"📊 {len(results)} résultats trouvés")
        
        service_128_found = False
        for i, result in enumerate(results):
            service_id = result.get('metadata', {}).get('service_id', 'N/A')
            score = result.get('score', 0)
            print(f"  {i+1}. Service {service_id} (score: {score:.4f})")
            
            if service_id == 128:
                service_128_found = True
                print(f"     ✅ Service 128 trouvé !")
        
        if not service_128_found:
            print("  ❌ Service 128 non trouvé dans cette recherche")
    else:
        print(f"❌ Erreur: {response.status_code}")
        
except Exception as e:
    print(f"❌ Erreur: {e}")

print("\n=== Test terminé ===") 