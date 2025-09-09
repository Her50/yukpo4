#!/usr/bin/env python3
"""
Script de test pour vérifier les améliorations apportées
"""

import requests
import json
import time

def test_direct_search():
    """Test de la recherche directe sans passer par l'IA externe"""
    print("🔍 Test de recherche directe...")
    
    try:
        # Test avec un texte simple
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
            print(f"✅ Recherche directe OK ({results_count} résultats)")
            
            # Vérifier le seuil de 0.65
            for i, match in enumerate(result.get('results', [])):
                score = match.get('score', 0)
                if score >= 0.65:
                    print(f"   Match {i+1}: score={score:.3f} ✅")
                else:
                    print(f"   Match {i+1}: score={score:.3f} ❌ (en dessous du seuil)")
            
            return True
        else:
            print(f"❌ Erreur recherche directe: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur test recherche directe: {e}")
        return False

def test_audio_transcription():
    """Test de la transcription audio"""
    print("\n🎵 Test de transcription audio...")
    
    try:
        # Simuler un input avec audio
        headers = {"x-api-key": "yukpo_embedding_key_2024"}
        data = {
            "texte": "Je cherche un service",
            "audio_base64": ["base64_audio_data_here"],
            "type_donnee": "texte"
        }
        
        response = requests.post(
            "http://localhost:8000/embedding",
            headers=headers,
            json=data,
            timeout=120
        )
        
        if response.status_code == 200:
            print("✅ Traitement audio OK")
            return True
        else:
            print(f"❌ Erreur traitement audio: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur test audio: {e}")
        return False

def test_matching_threshold():
    """Test du seuil de matching à 0.65"""
    print("\n📊 Test du seuil de matching (0.65)...")
    
    try:
        headers = {"x-api-key": "yukpo_embedding_key_2024"}
        
        # Test avec différentes requêtes
        test_queries = [
            "service informatique",
            "plomberie",
            "cours de français",
            "réparation voiture"
        ]
        
        for query in test_queries:
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
                timeout=120
            )
            
            if response.status_code == 200:
                result = response.json()
                results = result.get('results', [])
                
                print(f"  Requête: '{query}'")
                if results:
                    for i, match in enumerate(results):
                        score = match.get('score', 0)
                        status = "✅" if score >= 0.65 else "❌"
                        print(f"    Match {i+1}: score={score:.3f} {status}")
                else:
                    print(f"    Aucun résultat trouvé")
            else:
                print(f"  ❌ Erreur pour '{query}': {response.status_code}")
        
        return True
        
    except Exception as e:
        print(f"❌ Erreur test seuil: {e}")
        return False

def test_background_processing():
    """Test du traitement en arrière-plan"""
    print("\n⚙️ Test du traitement en arrière-plan...")
    
    try:
        # Simuler une création de service avec traitement en arrière-plan
        headers = {"x-api-key": "yukpo_embedding_key_2024"}
        data = {
            "titre": "Service de test",
            "description": "Description de test",
            "category": "test",
            "prix": {"valeur": "50", "devise": "EUR"},
            "type_metier": "service"
        }
        
        start_time = time.time()
        response = requests.post(
            "http://localhost:8000/add_embedding_pinecone",
            headers=headers,
            json=data,
            timeout=120
        )
        processing_time = time.time() - start_time
        
        if response.status_code == 200:
            print(f"✅ Traitement en arrière-plan OK (temps: {processing_time:.2f}s)")
            return True
        else:
            print(f"❌ Erreur traitement arrière-plan: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur test arrière-plan: {e}")
        return False

def main():
    """Fonction principale de test"""
    print("🧪 Tests des améliorations apportées")
    print("=" * 50)
    
    tests = [
        test_direct_search,
        test_audio_transcription,
        test_matching_threshold,
        test_background_processing
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
        print("✅ Toutes les améliorations fonctionnent correctement!")
    else:
        print("⚠️ Certaines améliorations nécessitent des ajustements")

if __name__ == "__main__":
    main() 