import requests
import json

# Test de la configuration du microservice en cours d'exécution
headers = {
    'Content-Type': 'application/json',
    'x-api-key': 'yukpo_embedding_key_2024'
}

print("=== Test de la configuration du microservice ===")

# Test 1: Vérifier l'état du microservice
print("\n1. État du microservice:")
try:
    response = requests.get('http://localhost:8000/health', timeout=10)
    if response.status_code == 200:
        print(f"✅ Microservice actif: {response.json()}")
    else:
        print(f"❌ Erreur microservice: {response.status_code}")
except Exception as e:
    print(f"❌ Erreur connexion: {e}")

# Test 2: Vérifier la configuration via un test d'ajout
print("\n2. Test de configuration via ajout d'embedding:")
try:
    test_payload = {
        'value': 'test configuration',
        'type_donnee': 'texte',
        'service_id': 999999,  # ID de test
        'langue': 'fra',
        'active': True,
        'type_metier': 'test'
    }
    
    response = requests.post('http://localhost:8000/add_embedding_pinecone', 
                           headers=headers, json=test_payload, timeout=30)
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Test d'ajout réussi: {result}")
        
        # Vérifier si c'est une simulation ou un vrai ajout
        if result.get('simulated'):
            print("⚠️  ATTENTION: Ajout simulé - Pinecone non configuré!")
        else:
            print("✅ Ajout réel dans Pinecone")
            
    else:
        print(f"❌ Erreur ajout: {response.status_code} - {response.text}")
        
except Exception as e:
    print(f"❌ Erreur test ajout: {e}")

# Test 3: Vérifier les logs du microservice
print("\n3. Vérification des logs du microservice:")
print("   (Vérifiez les logs du microservice pour voir les messages de debug)")

print("\n=== Diagnostic terminé ===")
print("\n💡 Solutions possibles:")
print("1. Vérifier que le microservice a les bonnes variables d'environnement")
print("2. Redémarrer le microservice avec la configuration correcte")
print("3. Vérifier que Pinecone est bien configuré") 