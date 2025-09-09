import requests
import json

# Vérifier l'état des embeddings pour le service 128
headers = {
    'Content-Type': 'application/json',
    'x-api-key': 'yukpo_embedding_key_2024'
}

# Test 1: Vérifier si le service 128 existe dans Pinecone
print("=== Test 1: Vérification existence service 128 dans Pinecone ===")
try:
    # Recherche avec un top_k très élevé pour voir tous les services
    payload = {
        'query': 'test',
        'type_donnee': 'texte',
        'top_k': 1000  # Très élevé pour voir tous les services
    }
    
    response = requests.post('http://localhost:8000/search_embedding_pinecone', 
                           headers=headers, json=payload, timeout=30)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        matches = data.get('matches', [])
        print(f"Total de services dans Pinecone: {len(matches)}")
        
        # Chercher le service 128
        service_128_found = False
        for match in matches:
            if 'metadata' in match and 'service_id' in match['metadata']:
                service_id = match['metadata']['service_id']
                if service_id == 128:
                    service_128_found = True
                    print(f"✅ Service 128 trouvé dans Pinecone!")
                    print(f"   ID: {match.get('id')}")
                    print(f"   Score: {match.get('score', 0):.4f}")
                    print(f"   Metadata: {match['metadata']}")
                    break
        
        if not service_128_found:
            print("❌ Service 128 NON trouvé dans Pinecone")
            
        # Afficher les 10 premiers services pour debug
        print("\nPremiers 10 services dans Pinecone:")
        for i, match in enumerate(matches[:10]):
            service_id = match.get('metadata', {}).get('service_id', 'N/A')
            print(f"  {i+1}. Service ID: {service_id} | Score: {match.get('score', 0):.4f}")
            
    else:
        print(f"Erreur: {response.text}")
        
except Exception as e:
    print(f"Erreur: {e}")

# Test 2: Vérifier l'état de l'index Pinecone
print("\n=== Test 2: Vérification état index Pinecone ===")
try:
    response = requests.get('http://localhost:8000/health', headers=headers, timeout=10)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"État du microservice: {data}")
    else:
        print(f"Erreur: {response.text}")
except Exception as e:
    print(f"Erreur: {e}")

# Test 3: Recherche avec des termes plus génériques
print("\n=== Test 3: Recherche avec termes génériques ===")
generic_queries = ['librairie', 'fournitures', 'scolaires', 'bayangam', 'commerce']

for query in generic_queries:
    try:
        payload = {
            'query': query,
            'type_donnee': 'texte',
            'top_k': 20
        }
        
        response = requests.post('http://localhost:8000/search_embedding_pinecone', 
                               headers=headers, json=payload, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            matches = data.get('matches', [])
            print(f"'{query}': {len(matches)} résultats")
            
            # Chercher le service 128 dans ces résultats
            for match in matches:
                if 'metadata' in match and match.get('metadata', {}).get('service_id') == 128:
                    print(f"  ✅ Service 128 trouvé avec requête '{query}' (score: {match.get('score', 0):.4f})")
                    break
        else:
            print(f"'{query}': Erreur {response.status_code}")
            
    except Exception as e:
        print(f"'{query}': Erreur {e}") 