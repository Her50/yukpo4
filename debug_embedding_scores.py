import requests
import json

print("=== Diagnostic des scores d'embedding ===")

headers = {
    'Content-Type': 'application/json',
    'x-api-key': 'yukpo_embedding_key_2024'
}

# Test 1: Vérifier si le service 129 existe dans Pinecone
print("\n1. 🔍 Vérification de l'existence du service 129 dans Pinecone")

# Recherche très large pour voir tous les services
payload = {
    'query': 'test',
    'type_donnee': 'texte',
    'top_k': 100
}

try:
    response = requests.post('http://localhost:8000/search_embedding_pinecone', 
                           headers=headers, json=payload, timeout=30)
    
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

# Test 2: Comparaison directe des embeddings
print("\n2. 🔬 Test de similarité directe")

test_queries = [
    "Vente de pièces détachées d'automobile",
    "pièces détachées véhicules",
    "magasin pièces automobiles",
    "automobile"
]

for query in test_queries:
    print(f"\n   🔍 Test: '{query}'")
    
    payload = {
        'query': query,
        'type_donnee': 'texte',
        'top_k': 10
    }
    
    try:
        response = requests.post('http://localhost:8000/search_embedding_pinecone', 
                               headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            results = data.get('results', [])
            
            print(f"      📊 {len(results)} résultats")
            
            # Afficher les 3 meilleurs scores
            for i, result in enumerate(results[:3]):
                service_id = result.get('metadata', {}).get('service_id')
                score = result.get('score', 0)
                print(f"      {i+1}. Service {service_id} (score: {score:.4f})")
                
        else:
            print(f"      ❌ Erreur: {response.status_code}")
            
    except Exception as e:
        print(f"      ❌ Erreur: {e}")

# Test 3: Vérifier la configuration du modèle
print("\n3. ⚙️ Vérification de la configuration du microservice")

try:
    response = requests.get('http://localhost:8000/health', timeout=10)
    if response.status_code == 200:
        print("   ✅ Microservice accessible")
    else:
        print(f"   ❌ Erreur microservice: {response.status_code}")
except Exception as e:
    print(f"   ❌ Erreur connexion: {e}")

print("\n=== Diagnostic terminé ===") 