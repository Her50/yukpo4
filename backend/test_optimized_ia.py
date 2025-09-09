#!/usr/bin/env python3
"""
Script de test pour la nouvelle architecture IA optimisée
"""

import requests
import json
import time
from typing import Dict, Any

# Configuration
BACKEND_URL = "http://127.0.0.1:3001"
TEST_USER_ID = 1

def test_optimized_ia_performance():
    """Test de performance de la nouvelle architecture IA"""
    
    test_cases = [
        {
            "name": "Creation Service",
            "input": "Je vends des T-shirts pour enfants à 5000 FCFA et des chaussures à 10000 FCFA. Boutique de vêtements pour enfants.",
            "expected_intention": "creation_service"
        },
        {
            "name": "Recherche Besoin", 
            "input": "Je cherche un professeur de mathématiques pour mon fils de 15 ans",
            "expected_intention": "recherche_besoin"
        },
        {
            "name": "Échange",
            "input": "J'échange mon vélo contre un ordinateur portable",
            "expected_intention": "echange"
        },
        {
            "name": "Assistance Générale",
            "input": "Comment fonctionne la plateforme Yukpo ?",
            "expected_intention": "assistance_generale"
        }
    ]
    
    print("🚀 Test de Performance - Architecture IA Optimisée")
    print("=" * 60)
    
    total_time = 0
    success_count = 0
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n🧪 Test {i}: {test_case['name']}")
        print(f"📝 Input: {test_case['input']}")
        print(f"🎯 Intention attendue: {test_case['expected_intention']}")
        
        start_time = time.time()
        
        try:
            payload = {
                "texte": test_case['input'],
                "user_id": TEST_USER_ID
            }
            headers = {
                "Content-Type": "application/json",
                "Authorization": "Bearer test_token"
            }
            response = requests.post(
                f"{BACKEND_URL}/api/ia/auto",
                json=payload,
                headers=headers,
                timeout=30
            )
            
            end_time = time.time()
            response_time = end_time - start_time
            total_time += response_time
            
            if response.status_code == 200:
                result = response.json()
                detected_intention = result.get('intention', 'unknown')
                
                print(f"✅ Succès en {response_time:.2f}s")
                print(f"🎯 Intention détectée: {detected_intention}")
                
                if detected_intention == test_case['expected_intention']:
                    print(f"✅ Intention correcte!")
                    success_count += 1
                else:
                    print(f"⚠️ Intention incorrecte (attendu: {test_case['expected_intention']})")
                
                # Vérifier la structure JSON
                data = result.get('data', {})
                if data.get('intention') == test_case['expected_intention']:
                    print(f"✅ Structure JSON correcte")
                else:
                    print(f"⚠️ Structure JSON incorrecte")
                    
            else:
                print(f"❌ Erreur {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ Erreur: {e}")
    
    print("\n" + "=" * 60)
    print("📊 Résumé des Tests de Performance")
    print(f"✅ Tests réussis: {success_count}/{len(test_cases)}")
    print(f"⏱️ Temps total: {total_time:.2f}s")
    print(f"⏱️ Temps moyen: {total_time/len(test_cases):.2f}s")
    
    # Évaluation des performances
    if total_time/len(test_cases) < 3.0:
        print("🏆 Performance EXCELLENTE (< 3s)")
    elif total_time/len(test_cases) < 5.0:
        print("✅ Performance BONNE (< 5s)")
    else:
        print("⚠️ Performance à améliorer (> 5s)")
    
    return success_count == len(test_cases)

def test_intention_detection_accuracy():
    """Test de précision de la détection d'intention"""
    
    accuracy_tests = [
        ("Je vends", "creation_service"),
        ("Je propose", "creation_service"),
        ("Je suis un", "creation_service"),
        ("Je cherche", "recherche_besoin"),
        ("Je voudrais trouver", "recherche_besoin"),
        ("J'ai besoin de", "recherche_besoin"),
        ("J'échange", "echange"),
        ("Je troque", "echange"),
        ("Comment", "assistance_generale"),
        ("Qu'est-ce que", "assistance_generale"),
        ("Programme scolaire", "programme_scolaire"),
    ]
    
    print("\n🎯 Test de Précision de Détection d'Intention")
    print("=" * 50)
    
    correct_detections = 0
    
    for phrase, expected in accuracy_tests:
        try:
            response = requests.post(
                f"{BACKEND_URL}/api/ia/auto",
                json={"texte": phrase, "user_id": TEST_USER_ID},
                headers={"Content-Type": "application/json", "Authorization": "Bearer test_token"},
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                detected = result.get('intention', 'unknown')
                
                if detected == expected:
                    print(f"✅ '{phrase}' → {detected}")
                    correct_detections += 1
                else:
                    print(f"❌ '{phrase}' → {detected} (attendu: {expected})")
            else:
                print(f"❌ Erreur pour '{phrase}': {response.status_code}")
                
        except Exception as e:
            print(f"❌ Erreur pour '{phrase}': {e}")
    
    accuracy = correct_detections / len(accuracy_tests) * 100
    print(f"\n📊 Précision: {accuracy:.1f}% ({correct_detections}/{len(accuracy_tests)})")
    
    return accuracy >= 80

if __name__ == "__main__":
    print("🚀 Démarrage des tests de l'architecture IA optimisée")
    
    # Test 1: Performance générale
    performance_ok = test_optimized_ia_performance()
    
    # Test 2: Précision de détection
    accuracy_ok = test_intention_detection_accuracy()
    
    print("\n" + "=" * 60)
    print("🏁 Résumé Final")
    print(f"✅ Performance: {'OK' if performance_ok else 'ÉCHEC'}")
    print(f"✅ Précision: {'OK' if accuracy_ok else 'ÉCHEC'}")
    
    if performance_ok and accuracy_ok:
        print("🎉 Tous les tests sont passés! Architecture optimisée fonctionnelle.")
    else:
        print("⚠️ Certains tests ont échoué. Vérifiez l'implémentation.") 