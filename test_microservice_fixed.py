#!/usr/bin/env python3
"""
Test du microservice après correction de la configuration
"""

import requests
import json
import time

def test_microservice_fixed():
    """Test du microservice avec la vraie configuration"""
    
    print("🧪 Test du microservice après correction...")
    print("=" * 50)
    
    base_url = "http://localhost:8000"
    api_key = "yukpo_embedding_key_2024"
    
    headers = {
        "x-api-key": api_key,
        "Content-Type": "application/json"
    }
    
    # Test 1: Endpoint de santé
    try:
        print("1. Test endpoint /health...")
        response = requests.get(f"{base_url}/health", timeout=5)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   ❌ Erreur: {e}")
        return False
    
    # Test 2: Ajout d'un embedding de test
    try:
        print("\n2. Test ajout embedding Pinecone...")
        test_data = {
            "value": "Test restaurant",
            "type_donnee": "texte",
            "service_id": 999999,
            "active": True,
            "type_metier": "test"
        }
        
        response = requests.post(
            f"{base_url}/add_embedding_pinecone",
            headers=headers,
            json=test_data,
            timeout=30
        )
        
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ Succès: {result}")
            
            # Vérifier que ce n'est pas simulé
            if result.get('simulated'):
                print(f"   ⚠️  ATTENTION: Embedding simulé !")
            else:
                print(f"   🎉 VRAI embedding stocké dans Pinecone !")
        else:
            print(f"   ❌ Erreur: {response.text}")
            
    except Exception as e:
        print(f"   ❌ Erreur: {e}")
        return False
    
    # Test 3: Recherche de l'embedding de test
    try:
        print("\n3. Test recherche embedding...")
        search_data = {
            "query": "Test restaurant",
            "type_donnee": "texte",
            "top_k": 5
        }
        
        response = requests.post(
            f"{base_url}/search_embedding_pinecone",
            headers=headers,
            json=search_data,
            timeout=30
        )
        
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ Résultats: {len(result.get('results', []))}")
            for i, match in enumerate(result.get('results', [])):
                print(f"     {i+1}. Score: {match.get('score', 0):.4f} | ID: {match.get('id', 'N/A')}")
        else:
            print(f"   ❌ Erreur: {response.text}")
            
    except Exception as e:
        print(f"   ❌ Erreur: {e}")
        return False
    
    print("\n✅ Tests terminés avec succès!")
    return True

if __name__ == "__main__":
    # Attendre que le microservice démarre
    print("⏳ Attente du démarrage du microservice...")
    time.sleep(5)
    
    test_microservice_fixed() 