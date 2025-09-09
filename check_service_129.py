import requests
import json

print("=== Vérification du service 129 dans Pinecone ===")

headers = {
    'Content-Type': 'application/json',
    'x-api-key': 'yukpo_embedding_key_2024'
}

# Test de recherche spécifique pour le service 129
queries = [
    "Vente de pièces détachées d'automobile",
    "pièces détachées véhicules",
    "magasin pièces automobiles",
    "service 129",
    "automobile"
]

for query in queries:
    print(f"\n🔍 Recherche: '{query}'")
    
    payload = {
        'query': query,
        'type_donnee': 'texte',
        'top_k': 20
    }
    
    try:
        response = requests.post('http://localhost:8000/search_embedding_pinecone', 
                               headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            results = data.get('results', [])
            
            print(f"   📊 {len(results)} résultats trouvés")
            
            service_129_found = False
            for i, result in enumerate(results[:5]):  # Afficher les 5 premiers
                service_id = result.get('metadata', {}).get('service_id')
                score = result.get('score', 0)
                
                if service_id == 129:
                    print(f"   ✅ Service 129 trouvé ! (position {i+1}, score: {score:.4f})")
                    service_129_found = True
                else:
                    print(f"   {i+1}. Service {service_id} (score: {score:.4f})")
            
            if not service_129_found:
                print(f"   ❌ Service 129 non trouvé dans les résultats")
                
        else:
            print(f"   ❌ Erreur: {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ Erreur: {e}")

print("\n=== Test terminé ===") 