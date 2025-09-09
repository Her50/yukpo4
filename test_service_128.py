import requests
import json

# Test de recherche directe pour le service 128
headers = {
    'Content-Type': 'application/json',
    'x-api-key': 'yukpo_embedding_key_2024'
}

# Test 1: Recherche par "librairie bayangam"
payload1 = {
    'query': 'librairie bayangam',
    'type_donnee': 'texte',
    'top_k': 10
}

# Test 2: Recherche par "fournitures scolaires"
payload2 = {
    'query': 'fournitures scolaires',
    'type_donnee': 'texte',
    'top_k': 10
}

# Test 3: Recherche par "commerce"
payload3 = {
    'query': 'commerce',
    'type_donnee': 'texte',
    'top_k': 10
}

print("=== Test 1: Recherche 'librairie bayangam' ===")
try:
    response = requests.post('http://localhost:8000/search_embedding_pinecone', 
                           headers=headers, json=payload1, timeout=10)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Résultats trouvés: {len(data.get('matches', []))}")
        for i, match in enumerate(data.get('matches', [])[:5]):
            print(f"  {i+1}. ID: {match.get('id')} | Score: {match.get('score', 0):.4f}")
            if 'metadata' in match:
                print(f"     Metadata: {match['metadata']}")
    else:
        print(f"Erreur: {response.text}")
except Exception as e:
    print(f"Erreur: {e}")

print("\n=== Test 2: Recherche 'fournitures scolaires' ===")
try:
    response = requests.post('http://localhost:8000/search_embedding_pinecone', 
                           headers=headers, json=payload2, timeout=10)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Résultats trouvés: {len(data.get('matches', []))}")
        for i, match in enumerate(data.get('matches', [])[:5]):
            print(f"  {i+1}. ID: {match.get('id')} | Score: {match.get('score', 0):.4f}")
            if 'metadata' in match:
                print(f"     Metadata: {match['metadata']}")
    else:
        print(f"Erreur: {response.text}")
except Exception as e:
    print(f"Erreur: {e}")

print("\n=== Test 3: Recherche 'commerce' ===")
try:
    response = requests.post('http://localhost:8000/search_embedding_pinecone', 
                           headers=headers, json=payload3, timeout=10)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Résultats trouvés: {len(data.get('matches', []))}")
        for i, match in enumerate(data.get('matches', [])[:5]):
            print(f"  {i+1}. ID: {match.get('id')} | Score: {match.get('score', 0):.4f}")
            if 'metadata' in match:
                print(f"     Metadata: {match['metadata']}")
    else:
        print(f"Erreur: {response.text}")
except Exception as e:
    print(f"Erreur: {e}") 