#!/usr/bin/env python3
"""
Script pour tester la recherche optimisée avec les nouveaux timeouts
"""

import requests
import json
import time

def test_optimized_search():
    """Test de la recherche optimisée"""
    print("🚀 Test de la recherche optimisée avec timeouts augmentés")
    print("=" * 60)
    
    # Test 1: Recherche simple
    print("\n1️⃣ Test recherche simple...")
    start_time = time.time()
    
    try:
        headers = {"x-api-key": "yukpo_embedding_key_2024"}
        data = {
            "query": "service",
            "type_donnee": "texte",
            "top_k": 5,
            "active": True
        }
        
        response = requests.post(
            "http://localhost:8000/search_embedding_pinecone",
            headers=headers,
            json=data,
            timeout=300  # Timeout augmenté à 5 minutes
        )
        
        search_time = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            results_count = len(result.get('results', []))
            print(f"✅ Recherche réussie en {search_time:.2f}s")
            print(f"   - Résultats trouvés: {results_count}")
            print(f"   - Temps de recherche Pinecone: {result.get('search_time', 'N/A')}s")
            
            if results_count > 0:
                print(f"   - Premier résultat: {result['results'][0]}")
        else:
            print(f"❌ Erreur recherche: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Erreur test: {e}")
    
    # Test 2: Recherche avec GPS
    print("\n2️⃣ Test recherche avec GPS...")
    start_time = time.time()
    
    try:
        headers = {"x-api-key": "yukpo_embedding_key_2024"}
        data = {
            "query": "plomberie",
            "type_donnee": "texte",
            "top_k": 3,
            "gps_lat": 48.8566,
            "gps_lon": 2.3522,
            "gps_radius_km": 50.0,
            "active": True
        }
        
        response = requests.post(
            "http://localhost:8000/search_embedding_pinecone",
            headers=headers,
            json=data,
            timeout=300
        )
        
        search_time = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            results_count = len(result.get('results', []))
            print(f"✅ Recherche GPS réussie en {search_time:.2f}s")
            print(f"   - Résultats trouvés: {results_count}")
            print(f"   - Temps de recherche Pinecone: {result.get('search_time', 'N/A')}s")
        else:
            print(f"❌ Erreur recherche GPS: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Erreur test GPS: {e}")
    
    # Test 3: Test de performance avec plusieurs requêtes
    print("\n3️⃣ Test de performance...")
    queries = ["service", "plomberie", "informatique", "cours", "réparation"]
    total_time = 0
    successful_queries = 0
    
    for i, query in enumerate(queries, 1):
        start_time = time.time()
        
        try:
            headers = {"x-api-key": "yukpo_embedding_key_2024"}
            data = {
                "query": query,
                "type_donnee": "texte",
                "top_k": 3,
                "active": True
            }
            
            response = requests.post(
                "http://localhost:8000/search_embedding_pinecone",
                headers=headers,
                json=data,
                timeout=300
            )
            
            query_time = time.time() - start_time
            total_time += query_time
            
            if response.status_code == 200:
                result = response.json()
                results_count = len(result.get('results', []))
                print(f"   {i}. '{query}': {query_time:.2f}s ({results_count} résultats)")
                successful_queries += 1
            else:
                print(f"   {i}. '{query}': ❌ {response.status_code}")
                
        except Exception as e:
            print(f"   {i}. '{query}': ❌ {e}")
    
    print(f"\n📊 Performance moyenne: {total_time/len(queries):.2f}s par requête")
    print(f"📊 Taux de succès: {successful_queries}/{len(queries)} ({successful_queries/len(queries)*100:.1f}%)")

def main():
    """Fonction principale"""
    test_optimized_search()

if __name__ == "__main__":
    main() 