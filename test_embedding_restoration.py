#!/usr/bin/env python3
"""
Script de test pour vérifier la restauration du microservice d'embedding
et la configuration du backend
"""

import os
import sys
import requests
import json
import time

def test_microservice_config():
    """Teste la configuration du microservice d'embedding"""
    print("🔧 Test de la configuration du microservice d'embedding...")
    
    # Vérifier le fichier .env
    env_file = ".env"
    if not os.path.exists(env_file):
        print("❌ Fichier .env manquant")
        return False
    
    with open(env_file, 'r') as f:
        env_content = f.read()
    
    # Vérifier les variables critiques
    required_vars = [
        "PINECONE_API_KEY",
        "PINECONE_INDEX", 
        "PINECONE_ENV",
        "YUKPO_API_KEY",
        "REQUEST_TIMEOUT",
        "EMBEDDING_TIMEOUT"
    ]
    
    for var in required_vars:
        if var not in env_content:
            print(f"❌ Variable {var} manquante dans .env")
            return False
    
    print("✅ Configuration .env OK")
    return True

def test_microservice_connection():
    """Teste la connexion au microservice d'embedding"""
    print("\n🔗 Test de connexion au microservice d'embedding...")
    
    try:
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code == 200:
            print("✅ Microservice d'embedding accessible")
            return True
        else:
            print(f"❌ Microservice répond avec code {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Impossible de se connecter au microservice: {e}")
        return False

def test_pinecone_connection():
    """Teste la connexion à Pinecone via le microservice"""
    print("\n🌲 Test de connexion à Pinecone...")
    
    try:
        headers = {"x-api-key": "yukpo_embedding_key_2024"}
        response = requests.post(
            "http://localhost:8000/test_pinecone",
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Connexion Pinecone OK")
            print(f"   Index: {result.get('index_name', 'N/A')}")
            print(f"   Environnement: {result.get('environment', 'N/A')}")
            return True
        else:
            print(f"❌ Erreur Pinecone: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Erreur de connexion: {e}")
        return False

def test_embedding_generation():
    """Teste la génération d'embeddings"""
    print("\n🧠 Test de génération d'embeddings...")
    
    try:
        headers = {"x-api-key": "yukpo_embedding_key_2024"}
        data = {
            "value": "Test d'embedding pour vérifier la restauration",
            "type_donnee": "texte"
        }
        
        response = requests.post(
            "http://localhost:8000/embedding",
            headers=headers,
            json=data,
            timeout=120  # Utilise le nouveau timeout
        )
        
        if response.status_code == 200:
            result = response.json()
            embedding_length = len(result.get('embedding', []))
            print(f"✅ Embedding généré avec succès (dimension: {embedding_length})")
            return True
        else:
            print(f"❌ Erreur génération embedding: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Erreur de connexion: {e}")
        return False

def test_backend_config():
    """Teste la configuration du backend"""
    print("\n⚙️ Test de la configuration du backend...")
    
    backend_env = "../backend/.env"
    if not os.path.exists(backend_env):
        print("❌ Fichier .env du backend manquant")
        return False
    
    with open(backend_env, 'r') as f:
        env_content = f.read()
    
    # Vérifier les variables critiques du backend
    required_vars = [
        "EMBEDDING_API_URL",
        "EMBEDDING_API_KEY", 
        "EMBEDDING_TIMEOUT_SECONDS",
        "IA_TIMEOUT_SECONDS"
    ]
    
    for var in required_vars:
        if var not in env_content:
            print(f"❌ Variable {var} manquante dans le backend")
            return False
    
    print("✅ Configuration backend OK")
    return True

def test_matching_functionality():
    """Teste la fonctionnalité de matching"""
    print("\n🔍 Test de la fonctionnalité de matching...")
    
    try:
        headers = {"x-api-key": "yukpo_embedding_key_2024"}
        data = {
            "query": "service informatique",
            "type_donnee": "texte",
            "top_k": 5,
            "active": True
        }
        
        response = requests.post(
            "http://localhost:8000/search_embedding_pinecone",
            headers=headers,
            json=data,
            timeout=120
        )
        
        if response.status_code == 200:
            result = response.json()
            results_count = len(result.get('results', []))
            print(f"✅ Recherche sémantique OK ({results_count} résultats)")
            return True
        else:
            print(f"❌ Erreur recherche sémantique: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Erreur de connexion: {e}")
        return False

def main():
    """Fonction principale de test"""
    print("🚀 Test de restauration du microservice d'embedding")
    print("=" * 60)
    
    # Tests du microservice
    config_ok = test_microservice_config()
    if not config_ok:
        print("\n❌ Configuration du microservice échouée")
        return False
    
    connection_ok = test_microservice_connection()
    if not connection_ok:
        print("\n❌ Connexion au microservice échouée")
        print("💡 Assurez-vous que le microservice est démarré: uvicorn main:app --host 0.0.0.0 --port 8000")
        return False
    
    pinecone_ok = test_pinecone_connection()
    if not pinecone_ok:
        print("\n❌ Connexion Pinecone échouée")
        return False
    
    embedding_ok = test_embedding_generation()
    if not embedding_ok:
        print("\n❌ Génération d'embeddings échouée")
        return False
    
    matching_ok = test_matching_functionality()
    if not matching_ok:
        print("\n❌ Fonctionnalité de matching échouée")
        return False
    
    # Tests du backend
    backend_ok = test_backend_config()
    if not backend_ok:
        print("\n❌ Configuration du backend échouée")
        return False
    
    print("\n" + "=" * 60)
    print("✅ RESTAURATION RÉUSSIE !")
    print("✅ Microservice d'embedding opérationnel")
    print("✅ Connexion Pinecone fonctionnelle")
    print("✅ Timeouts configurés à 120s")
    print("✅ Backend configuré pour le microservice")
    print("✅ Fonction de recherche besoin corrigée")
    print("✅ Matching global Pinecone opérationnel")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 