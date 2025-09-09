#!/usr/bin/env python3
"""
Script pour vérifier l'état de l'index Pinecone
"""

import requests
import json

def check_pinecone_index():
    """Vérifie l'état de l'index Pinecone"""
    print("🔍 Vérification de l'index Pinecone")
    print("=" * 50)
    
    try:
        headers = {"x-api-key": "yukpo_embedding_key_2024"}
        
        # 1. Vérifier l'état du microservice
        print("1️⃣ Vérification du microservice...")
        response = requests.get("http://localhost:8000/health", headers=headers, timeout=10)
        if response.status_code == 200:
            health = response.json()
            print(f"   ✅ Microservice en ligne: {health}")
        else:
            print(f"   ❌ Microservice inaccessible: {response.status_code}")
            return
        
        # 2. Vérifier le seuil de matching actuel
        print("\n2️⃣ Vérification du seuil de matching...")
        try:
            with open('microservice_embedding/.env', 'r') as f:
                content = f.read()
                for line in content.split('\n'):
                    if 'MATCHING_SCORE_THRESHOLD' in line:
                        print(f"   📊 Seuil configuré: {line.strip()}")
                        break
        except Exception as e:
            print(f"   ❌ Erreur lecture .env: {e}")
        
        # 3. Test avec seuil très bas
        print("\n3️⃣ Test avec recherche sans filtre...")
        data = {
            "query": "plomberie",
            "type_donnee": "texte",
            "top_k": 10,
            "active": True
        }
        
        response = requests.post(
            "http://localhost:8000/search_embedding_pinecone",
            headers=headers,
            json=data,
            timeout=300
        )
        
        if response.status_code == 200:
            result = response.json()
            results_count = len(result.get('results', []))
            print(f"   📊 Résultats trouvés: {results_count}")
            print(f"   ⏱️ Temps de recherche: {result.get('search_time', 'N/A')}s")
            
            if results_count > 0:
                print(f"   📋 Détail des résultats:")
                for i, match in enumerate(result['results'], 1):
                    score = match.get('score', 0)
                    service_id = match.get('service_id', 'N/A')
                    print(f"     {i}. Service {service_id}: score={score:.3f}")
            else:
                print(f"   ⚠️ Aucun résultat trouvé même avec seuil bas")
        else:
            print(f"   ❌ Erreur recherche: {response.status_code}")
        
        # 4. Test avec requête vide pour voir tous les vecteurs
        print("\n4️⃣ Test avec requête générique...")
        data = {
            "query": "test",
            "type_donnee": "texte",
            "top_k": 20,
            "active": True
        }
        
        response = requests.post(
            "http://localhost:8000/search_embedding_pinecone",
            headers=headers,
            json=data,
            timeout=300
        )
        
        if response.status_code == 200:
            result = response.json()
            results_count = len(result.get('results', []))
            print(f"   📊 Résultats avec 'test': {results_count}")
            
            if results_count > 0:
                print(f"   📋 Services disponibles:")
                for i, match in enumerate(result['results'], 1):
                    score = match.get('score', 0)
                    service_id = match.get('service_id', 'N/A')
                    print(f"     {i}. Service {service_id}: score={score:.3f}")
            else:
                print(f"   ⚠️ Aucun service trouvé dans l'index")
        
    except Exception as e:
        print(f"❌ Erreur vérification: {e}")

def main():
    """Fonction principale"""
    check_pinecone_index()

if __name__ == "__main__":
    main() 