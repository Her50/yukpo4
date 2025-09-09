#!/usr/bin/env python3
"""
Test de performance détaillé avec logs de temps
Mesure chaque étape de l'orchestration IA pour identifier les goulots d'étranglement
"""

import requests
import json
import time
import re
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:3000"
TEST_USER_TOKEN = "your_test_token_here"  # À remplacer par un vrai token

def extract_timing_from_logs(logs_text):
    """Extrait les temps d'exécution depuis les logs"""
    timing_data = {}
    
    # Patterns pour extraire les temps
    patterns = {
        'orchestration_steps': r'\[TIMING\] Étape (\d+) - ([^:]+): ([0-9.]+ms|[0-9.]+s)',
        'ia_external': r'🤖 TEMPS IA EXTERNE: ([0-9.]+ms|[0-9.]+s)',
        'total_time': r'⏱️  TEMPS TOTAL: ([0-9.]+ms|[0-9.]+s)',
        'ia_percentage': r'📈 POURCENTAGE IA: ([0-9.]+)%',
        'optimized_steps': r'\[OptimizedIAService\]\[TIMING\] Étape (\d+) - ([^:]+): ([0-9.]+ms|[0-9.]+s)',
        'intention_steps': r'\[IntentionDetector\]\[TIMING\] Étape (\d+) - ([^:]+): ([0-9.]+ms|[0-9.]+s)',
    }
    
    for pattern_name, pattern in patterns.items():
        matches = re.findall(pattern, logs_text)
        if matches:
            timing_data[pattern_name] = matches
    
    return timing_data

def analyze_performance(timing_data):
    """Analyse les données de performance"""
    print("\n" + "=" * 80)
    print("📊 ANALYSE DÉTAILLÉE DES PERFORMANCES")
    print("=" * 80)
    
    # Analyse des étapes d'orchestration
    if 'orchestration_steps' in timing_data:
        print("\n🔧 ÉTAPES D'ORCHESTRATION:")
        print("-" * 40)
        total_orchestration = 0
        for step_num, step_name, duration in timing_data['orchestration_steps']:
            # Convertir en millisecondes
            if 'ms' in duration:
                ms = float(duration.replace('ms', ''))
            else:
                ms = float(duration.replace('s', '')) * 1000
            
            total_orchestration += ms
            print(f"  Étape {step_num:2} - {step_name:<25}: {duration:>10}")
        
        print(f"  {'TOTAL ORCHESTRATION':<25}: {total_orchestration:>8.1f}ms")
    
    # Analyse des étapes IA optimisées
    if 'optimized_steps' in timing_data:
        print("\n⚡ ÉTAPES IA OPTIMISÉES:")
        print("-" * 40)
        total_optimized = 0
        for step_num, step_name, duration in timing_data['optimized_steps']:
            if 'ms' in duration:
                ms = float(duration.replace('ms', ''))
            else:
                ms = float(duration.replace('s', '')) * 1000
            
            total_optimized += ms
            print(f"  Étape {step_num} - {step_name:<20}: {duration:>10}")
        
        print(f"  {'TOTAL OPTIMIZED':<20}: {total_optimized:>8.1f}ms")
    
    # Analyse des étapes de détection d'intention
    if 'intention_steps' in timing_data:
        print("\n🎯 ÉTAPES DÉTECTION INTENTION:")
        print("-" * 40)
        total_intention = 0
        for step_num, step_name, duration in timing_data['intention_steps']:
            if 'ms' in duration:
                ms = float(duration.replace('ms', ''))
            else:
                ms = float(duration.replace('s', '')) * 1000
            
            total_intention += ms
            print(f"  Étape {step_num} - {step_name:<20}: {duration:>10}")
        
        print(f"  {'TOTAL INTENTION':<20}: {total_intention:>8.1f}ms")
    
    # Temps IA externe
    if 'ia_external' in timing_data:
        print("\n🤖 TEMPS IA EXTERNE:")
        print("-" * 40)
        for duration in timing_data['ia_external']:
            print(f"  IA externe: {duration}")
    
    # Temps total
    if 'total_time' in timing_data:
        print("\n⏱️  TEMPS TOTAL:")
        print("-" * 40)
        for duration in timing_data['total_time']:
            print(f"  Total: {duration}")
    
    # Pourcentage IA
    if 'ia_percentage' in timing_data:
        print("\n📈 POURCENTAGE IA:")
        print("-" * 40)
        for percentage in timing_data['ia_percentage']:
            print(f"  IA: {percentage}%")
    
    # Recommandations d'optimisation
    print("\n💡 RECOMMANDATIONS D'OPTIMISATION:")
    print("-" * 40)
    
    if 'orchestration_steps' in timing_data:
        # Identifier les étapes les plus lentes
        step_times = []
        for step_num, step_name, duration in timing_data['orchestration_steps']:
            if 'ms' in duration:
                ms = float(duration.replace('ms', ''))
            else:
                ms = float(duration.replace('s', '')) * 1000
            step_times.append((step_num, step_name, ms))
        
        # Trier par temps décroissant
        step_times.sort(key=lambda x: x[2], reverse=True)
        
        print("  Étapes les plus lentes:")
        for i, (step_num, step_name, ms) in enumerate(step_times[:5]):
            print(f"    {i+1}. Étape {step_num} - {step_name}: {ms:.1f}ms")
    
    if 'ia_percentage' in timing_data:
        ia_percent = float(timing_data['ia_percentage'][0])
        if ia_percent > 80:
            print("  ⚠️  L'IA externe représente plus de 80% du temps total")
            print("     → Optimiser les prompts pour réduire les tokens")
            print("     → Implémenter un cache plus agressif")
        elif ia_percent > 60:
            print("  📈 L'IA externe représente 60-80% du temps total")
            print("     → Considérer l'optimisation des prompts")
        else:
            print("  ✅ L'IA externe représente moins de 60% du temps total")
            print("     → Les optimisations internes sont efficaces")

def test_performance_detailed():
    """Test de performance avec analyse détaillée"""
    
    print("🧪 Test de performance détaillé avec logs de temps")
    print("=" * 80)
    
    # Test 1: Création de service
    print("\n1️⃣ Test création de service (analyse complète)")
    test_data_1 = {
        "texte": "Je vends un iPhone 13 en excellent état, 500€, disponible immédiatement",
        "base64_image": [],
        "audio_base64": [],
        "video_base64": [],
        "doc_base64": [],
        "excel_base64": [],
        "gps_mobile": "48.8566,2.3522",  # Paris
        "site_web": None
    }
    
    start_time = time.time()
    response_1 = requests.post(
        f"{BASE_URL}/api/ia/auto",
        headers={
            "Authorization": f"Bearer {TEST_USER_TOKEN}",
            "Content-Type": "application/json"
        },
        json=test_data_1,
        timeout=120  # Timeout plus long pour les logs détaillés
    )
    time_1 = time.time() - start_time
    
    print(f"   ⏱️  Temps de réponse: {time_1:.2f}s")
    print(f"   📊 Status: {response_1.status_code}")
    
    if response_1.status_code == 200:
        result_1 = response_1.json()
        print(f"   ✅ Succès: {result_1.get('status', 'N/A')}")
        
        # Extraire les logs de timing depuis la réponse (si disponibles)
        if 'logs' in result_1:
            timing_data = extract_timing_from_logs(result_1['logs'])
            analyze_performance(timing_data)
        else:
            print("   ℹ️  Logs de timing non disponibles dans la réponse")
    else:
        print(f"   ❌ Erreur: {response_1.text}")
    
    # Test 2: Recherche de besoin
    print("\n2️⃣ Test recherche de besoin")
    test_data_2 = {
        "texte": "Je cherche un plombier professionnel pour réparer une fuite d'eau urgente",
        "base64_image": [],
        "audio_base64": [],
        "video_base64": [],
        "doc_base64": [],
        "excel_base64": [],
        "gps_mobile": "48.8566,2.3522",  # Paris
        "site_web": None
    }
    
    start_time = time.time()
    response_2 = requests.post(
        f"{BASE_URL}/api/ia/auto",
        headers={
            "Authorization": f"Bearer {TEST_USER_TOKEN}",
            "Content-Type": "application/json"
        },
        json=test_data_2,
        timeout=120
    )
    time_2 = time.time() - start_time
    
    print(f"   ⏱️  Temps de réponse: {time_2:.2f}s")
    print(f"   📊 Status: {response_2.status_code}")
    
    if response_2.status_code == 200:
        result_2 = response_2.json()
        print(f"   ✅ Succès: {result_2.get('status', 'N/A')}")
        
        if 'logs' in result_2:
            timing_data = extract_timing_from_logs(result_2['logs'])
            analyze_performance(timing_data)
    else:
        print(f"   ❌ Erreur: {response_2.text}")
    
    # Résumé des performances
    print("\n" + "=" * 80)
    print("📊 RÉSUMÉ DES PERFORMANCES")
    print("=" * 80)
    
    if 'time_1' in locals() and 'time_2' in locals():
        avg_time = (time_1 + time_2) / 2
        print(f"⏱️  Temps moyen: {avg_time:.2f}s")
        
        if avg_time < 5.0:
            print("🚀 Performance EXCELLENTE (< 5s)")
        elif avg_time < 10.0:
            print("⚡ Performance BONNE (< 10s)")
        elif avg_time < 20.0:
            print("📈 Performance ACCEPTABLE (< 20s)")
        else:
            print("🐌 Performance LENTE (> 20s)")
    
    print("\n💡 POUR ANALYSER LES LOGS DÉTAILLÉS:")
    print("   1. Vérifiez les logs du backend Rust")
    print("   2. Cherchez les sections [TIMING]")
    print("   3. Identifiez les étapes les plus lentes")
    print("   4. Optimisez en priorité les goulots d'étranglement")
    
    print("\n✅ Test de performance détaillé terminé!")

if __name__ == "__main__":
    try:
        test_performance_detailed()
    except requests.exceptions.ConnectionError:
        print("❌ Erreur: Impossible de se connecter au backend")
        print("   Assurez-vous que le backend Rust est démarré sur http://localhost:3000")
    except Exception as e:
        print(f"❌ Erreur inattendue: {e}") 