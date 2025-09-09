#!/usr/bin/env python3
"""
Script de test pour le microservice d'embedding
"""

import requests
import json
import time

def test_microservice():
    """Test du microservice d'embedding"""
    
    base_url = "http://localhost:8000"
    api_key = "yukpo_embedding_key_2024"
    
    headers = {
        "x-api-key": api_key,
        "Content-Type": "application/json"
    }
    
    print("🧪 Test du microservice d'embedding...")
    
    # Test 1: Endpoint de santé
    try:
        print("1. Test endpoint /health...")
        response = requests.get(f"{base_url}/health", timeout=5)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   ❌ Erreur: {e}")
        return False
    
    # Test 2: Endpoint racine
    try:
        print("2. Test endpoint /...")
        response = requests.get(f"{base_url}/", timeout=5)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   ❌ Erreur: {e}")
        return False
    
    # Test 3: Recherche d'embedding
    try:
        print("3. Test recherche d'embedding...")
        search_data = {
            "query": "salon de coiffure",
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
            print(f"   Résultats trouvés: {len(result.get('matches', []))}")
        else:
            print(f"   Erreur: {response.text}")
    except Exception as e:
        print(f"   ❌ Erreur: {e}")
        return False
    
    print("✅ Tests terminés avec succès!")
    return True

if __name__ == "__main__":
    test_microservice() 