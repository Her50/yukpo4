#!/usr/bin/env python3
"""
Benchmark de Performance Yukpo - GPU vs CPU
Test des objectifs : Création <5s, Recherche <2s
"""

import time
import requests
import json
import statistics
import sys
from typing import Dict, List, Tuple
import argparse

# Configuration
BACKEND_URL = "http://localhost:3001"
TEST_ITERATIONS = 10
VERBOSE = True

def log(message: str, level: str = "INFO"):
    """Logger simple avec timestamps"""
    if VERBOSE or level == "ERROR":
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}][{level}] {message}")

def test_service_creation(iteration: int = 1) -> Dict:
    """Test de création de service"""
    log(f"🚀 Test création service #{iteration}")
    
    test_data = {
        "texte": f"Je vends mon ordinateur portable gaming RTX 4070 en excellent état, utilisé 6 mois. Processeur Intel i7, 32GB RAM, SSD 1TB. Prix négociable. Test #{iteration}",
        "intention": "creation_service",
        "base64_image": []  # Pas d'image pour ce test de vitesse
    }
    
    start_time = time.time()
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/ia/auto",
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        end_time = time.time()
        elapsed_ms = (end_time - start_time) * 1000
        
        if response.status_code == 200:
            result = response.json()
            
            # Vérifier les headers de performance
            tokens_consumed = response.headers.get('x-tokens-consumed', 'N/A')
            model_used = result.get('ia_model_used', 'unknown')
            
            success = True
            intention = result.get('intention', 'unknown')
            
            log(f"✅ Création réussie en {elapsed_ms:.0f}ms (tokens: {tokens_consumed}, modèle: {model_used})")
            
        else:
            log(f"❌ Erreur HTTP {response.status_code}", "ERROR")
            success = False
            intention = "error"
            model_used = "none"
            
    except requests.exceptions.Timeout:
        end_time = time.time()
        elapsed_ms = (end_time - start_time) * 1000
        log(f"⏰ Timeout après {elapsed_ms:.0f}ms", "ERROR")
        success = False
        intention = "timeout"
        model_used = "none"
        
    except Exception as e:
        end_time = time.time()
        elapsed_ms = (end_time - start_time) * 1000
        log(f"❌ Erreur: {e} après {elapsed_ms:.0f}ms", "ERROR")
        success = False
        intention = "error"
        model_used = "none"
    
    return {
        "iteration": iteration,
        "success": success,
        "elapsed_ms": elapsed_ms,
        "intention": intention,
        "model_used": model_used
    }

def test_cache_performance() -> Dict:
    """Test de performance du cache"""
    log("🧪 Test de performance du cache")
    
    # Données de test identiques pour tester le cache
    test_data = {
        "texte": "Je vends des vêtements pour enfants, boutique en ligne, livraison gratuite",
        "intention": "creation_service",
        "base64_image": []
    }
    
    results = []
    
    # Premier appel (pas de cache)
    log("📞 Premier appel (sans cache)")
    start_time = time.time()
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/ia/auto",
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        first_call_time = (time.time() - start_time) * 1000
        
        if response.status_code == 200:
            log(f"✅ Premier appel réussi en {first_call_time:.0f}ms")
            results.append(first_call_time)
        else:
            log(f"❌ Premier appel échoué: {response.status_code}", "ERROR")
            return {"error": "Premier appel échoué"}
            
    except Exception as e:
        log(f"❌ Erreur premier appel: {e}", "ERROR")
        return {"error": str(e)}
    
    # Deuxième appel (avec cache)
    log("⚡ Deuxième appel (avec cache)")
    start_time = time.time()
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/ia/auto",
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        second_call_time = (time.time() - start_time) * 1000
        
        if response.status_code == 200:
            log(f"✅ Deuxième appel réussi en {second_call_time:.0f}ms")
            results.append(second_call_time)
        else:
            log(f"❌ Deuxième appel échoué: {response.status_code}", "ERROR")
            return {"error": "Deuxième appel échoué"}
            
    except Exception as e:
        log(f"❌ Erreur deuxième appel: {e}", "ERROR")
        return {"error": str(e)}
    
    # Calcul des améliorations
    if len(results) == 2:
        improvement = ((results[0] - results[1]) / results[0]) * 100
        speedup = results[0] / results[1] if results[1] > 0 else float('inf')
        
        log(f"📊 Amélioration: {improvement:.1f}% plus rapide")
        log(f"📊 Accélération: {speedup:.1f}x plus rapide")
        
        return {
            "first_call_ms": results[0],
            "second_call_ms": results[1],
            "improvement_percent": improvement,
            "speedup_factor": speedup,
            "cache_working": results[1] < results[0] * 0.8  # 20% plus rapide = cache fonctionne
        }
    
    return {"error": "Pas assez de données"}

def test_multiple_requests(count: int = 5) -> List[Dict]:
    """Test de plusieurs requêtes pour mesurer la stabilité"""
    log(f"🔄 Test de {count} requêtes consécutives")
    
    results = []
    
    for i in range(1, count + 1):
        result = test_service_creation(i)
        results.append(result)
        
        # Pause entre les requêtes
        if i < count:
            time.sleep(1)
    
    return results

def analyze_performance(results: List[Dict]) -> Dict:
    """Analyse les résultats de performance"""
    if not results:
        return {"error": "Aucun résultat"}
    
    successful_results = [r for r in results if r["success"]]
    
    if not successful_results:
        return {"error": "Aucun test réussi"}
    
    times = [r["elapsed_ms"] for r in successful_results]
    
    analysis = {
        "total_tests": len(results),
        "successful_tests": len(successful_results),
        "success_rate": (len(successful_results) / len(results)) * 100,
        "avg_time_ms": statistics.mean(times),
        "median_time_ms": statistics.median(times),
        "min_time_ms": min(times),
        "max_time_ms": max(times),
        "std_dev_ms": statistics.stdev(times) if len(times) > 1 else 0,
    }
    
    return analysis

def main():
    """Fonction principale de test"""
    log("🚀 Démarrage des tests de performance optimisés")
    
    # Test 1: Performance du cache
    log("\n" + "="*50)
    log("TEST 1: Performance du cache")
    cache_result = test_cache_performance()
    
    if "error" not in cache_result:
        log(f"✅ Cache fonctionne: {cache_result['cache_working']}")
        if cache_result['cache_working']:
            log(f"🎉 Amélioration de {cache_result['improvement_percent']:.1f}% avec le cache!")
        else:
            log("⚠️ Cache ne semble pas fonctionner correctement")
    else:
        log(f"❌ Erreur test cache: {cache_result['error']}", "ERROR")
    
    # Test 2: Requêtes multiples
    log("\n" + "="*50)
    log("TEST 2: Requêtes multiples")
    multiple_results = test_multiple_requests(3)
    
    # Analyse des résultats
    log("\n" + "="*50)
    log("ANALYSE DES RÉSULTATS")
    
    analysis = analyze_performance(multiple_results)
    
    if "error" not in analysis:
        log(f"📊 Tests réussis: {analysis['successful_tests']}/{analysis['total_tests']} ({analysis['success_rate']:.1f}%)")
        log(f"📊 Temps moyen: {analysis['avg_time_ms']:.0f}ms")
        log(f"📊 Temps médian: {analysis['median_time_ms']:.0f}ms")
        log(f"📊 Min/Max: {analysis['min_time_ms']:.0f}ms / {analysis['max_time_ms']:.0f}ms")
        
        # Évaluation des performances
        if analysis['avg_time_ms'] < 5000:
            log("🎉 EXCELLENT: Temps moyen < 5s")
        elif analysis['avg_time_ms'] < 10000:
            log("✅ BON: Temps moyen < 10s")
        elif analysis['avg_time_ms'] < 15000:
            log("⚠️ MOYEN: Temps moyen < 15s")
        else:
            log("❌ LENT: Temps moyen > 15s")
    else:
        log(f"❌ Erreur analyse: {analysis['error']}", "ERROR")
    
    log("\n" + "="*50)
    log("FIN DES TESTS")

if __name__ == "__main__":
    main() 