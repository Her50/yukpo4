#!/usr/bin/env python3
"""
Script de diagnostic pour vérifier l'état de Pinecone et des services vectorisés
"""

import os
import requests
import json
from dotenv import load_dotenv

# Charger les variables d'environnement depuis le backend
load_dotenv('backend/.env')

def test_pinecone_connection():
    """Test de connexion à Pinecone"""
    print("🔍 Test de connexion à Pinecone...")
    
    try:
        headers = {"x-api-key": "yukpo_embedding_key_2024"}
        response = requests.get("http://localhost:8000/health", headers=headers, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Connexion Pinecone OK: {result}")
            return True
        else:
            print(f"❌ Erreur connexion Pinecone: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur connexion Pinecone: {e}")
        return False

def test_index_status():
    """Test du statut de l'index Pinecone"""
    print("\n📊 Test du statut de l'index...")
    
    try:
        headers = {"x-api-key": "yukpo_embedding_key_2024"}
        response = requests.get("http://localhost:8000/index_status", headers=headers, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Statut index OK: {result}")
            return True
        else:
            print(f"❌ Erreur statut index: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur statut index: {e}")
        return False

def test_search_with_debug():
    """Test de recherche avec debug"""
    print("\n🔍 Test de recherche avec debug...")
    
    try:
        headers = {"x-api-key": "yukpo_embedding_key_2024"}
        data = {
            "query": "service",
            "type_donnee": "texte",
            "top_k": 5,
            "active": True,
            "debug": True
        }
        
        response = requests.post(
            "http://localhost:8000/search_embedding_pinecone",
            headers=headers,
            json=data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Recherche OK: {json.dumps(result, indent=2)}")
            return True
        else:
            print(f"❌ Erreur recherche: {response.status_code}")
            print(f"Réponse: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur recherche: {e}")
        return False

def test_add_sample_service():
    """Test d'ajout d'un service de test"""
    print("\n➕ Test d'ajout d'un service de test...")
    
    try:
        headers = {"x-api-key": "yukpo_embedding_key_2024"}
        data = {
            "value": "Service de test informatique pour diagnostic",
            "type_donnee": "texte",
            "service_id": 999999,
            "gps_lat": 48.8566,
            "gps_lon": 2.3522,
            "langue": "fr",
            "active": True,
            "type_metier": "service"
        }
        
        response = requests.post(
            "http://localhost:8000/add_embedding_pinecone",
            headers=headers,
            json=data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Ajout service test OK: {result}")
            return True
        else:
            print(f"❌ Erreur ajout service test: {response.status_code}")
            print(f"Réponse: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur ajout service test: {e}")
        return False

def test_search_after_add():
    """Test de recherche après ajout du service de test"""
    print("\n🔍 Test de recherche après ajout...")
    
    try:
        headers = {"x-api-key": "yukpo_embedding_key_2024"}
        data = {
            "query": "informatique",
            "type_donnee": "texte",
            "top_k": 5,
            "active": True
        }
        
        response = requests.post(
            "http://localhost:8000/search_embedding_pinecone",
            headers=headers,
            json=data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Recherche après ajout OK: {json.dumps(result, indent=2)}")
            return True
        else:
            print(f"❌ Erreur recherche après ajout: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur recherche après ajout: {e}")
        return False

def main():
    """Fonction principale de diagnostic"""
    print("🔧 Diagnostic Pinecone et services vectorisés")
    print("=" * 50)
    
    tests = [
        test_pinecone_connection,
        test_index_status,
        test_search_with_debug,
        test_add_sample_service,
        test_search_after_add
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"❌ Test échoué: {e}")
    
    print(f"\n{'='*50}")
    print(f"📊 RÉSULTATS: {passed}/{total} tests réussis")
    
    if passed == total:
        print("✅ Tous les tests de diagnostic sont réussis!")
    else:
        print("⚠️ Certains tests de diagnostic ont échoué")

if __name__ == "__main__":
    main() 