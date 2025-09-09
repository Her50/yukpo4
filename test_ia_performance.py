#!/usr/bin/env python3
"""
Script de test pour mesurer les performances de l'IA
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime

# Configuration
BACKEND_URL = "http://localhost:3001"
JWT_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTYzNjYwMiwiaWF0IjoxNzUyMzIyMTQ1LCJleHAiOjE3NTI0MDg1NDV9.7DM-X2jFDeJU1Hsvr0Q-rNtY5lkRKDgPC1uLCMlI9Gw"

async def test_ia_performance():
    """Test des performances de l'IA"""
    print("🧪 Test des performances de l'IA")
    print("=" * 50)
    
    async with aiohttp.ClientSession() as session:
        headers = {
            "Authorization": f"Bearer {JWT_TOKEN}",
            "Content-Type": "application/json"
        }
        
        # Test avec différents inputs
        test_cases = [
            {
                "name": "Création service simple",
                "input": {
                    "texte": "je suis un plombier dans la ville de BAfoussam",
                    "base64_image": [],
                    "doc_base64": [],
                    "excel_base64": []
                }
            },
            {
                "name": "Recherche service",
                "input": {
                    "texte": "je cherche un plombier pour réparer ma douche",
                    "base64_image": [],
                    "doc_base64": [],
                    "excel_base64": []
                }
            },
            {
                "name": "Question générale",
                "input": {
                    "texte": "comment fonctionne la plateforme Yukpo ?",
                    "base64_image": [],
                    "doc_base64": [],
                    "excel_base64": []
                }
            }
        ]
        
        results = []
        
        for i, test_case in enumerate(test_cases, 1):
            print(f"\n{i}. Test: {test_case['name']}")
            print(f"   Input: {test_case['input']['texte']}")
            
            start_time = time.time()
            
            try:
                async with session.post(f"{BACKEND_URL}/api/ia/auto", json=test_case['input'], headers=headers) as response:
                    duration = time.time() - start_time
                    
                    if response.status == 200:
                        data = await response.json()
                        intention = data.get('intention', 'N/A')
                        tokens = data.get('tokens_consumed', 'N/A')
                        
                        print(f"   ✅ Succès en {duration:.2f}s")
                        print(f"   📊 Intention: {intention}")
                        print(f"   🧠 Tokens: {tokens}")
                        
                        results.append({
                            "test": test_case['name'],
                            "duration": duration,
                            "success": True,
                            "intention": intention,
                            "tokens": tokens
                        })
                    else:
                        error_text = await response.text()
                        print(f"   ❌ Erreur {response.status}: {error_text}")
                        results.append({
                            "test": test_case['name'],
                            "duration": duration,
                            "success": False,
                            "error": f"{response.status}: {error_text}"
                        })
                        
            except Exception as e:
                duration = time.time() - start_time
                print(f"   ❌ Erreur réseau: {e}")
                results.append({
                    "test": test_case['name'],
                    "duration": duration,
                    "success": False,
                    "error": str(e)
                })
    
    # Résumé des performances
    print("\n" + "=" * 50)
    print("📊 RÉSUMÉ DES PERFORMANCES")
    print("=" * 50)
    
    successful_tests = [r for r in results if r['success']]
    failed_tests = [r for r in results if not r['success']]
    
    if successful_tests:
        avg_duration = sum(r['duration'] for r in successful_tests) / len(successful_tests)
        min_duration = min(r['duration'] for r in successful_tests)
        max_duration = max(r['duration'] for r in successful_tests)
        
        print(f"✅ Tests réussis: {len(successful_tests)}/{len(results)}")
        print(f"⏱️  Temps moyen: {avg_duration:.2f}s")
        print(f"⚡ Temps minimum: {min_duration:.2f}s")
        print(f"🐌 Temps maximum: {max_duration:.2f}s")
        
        # Évaluation des performances
        if avg_duration < 10.0:
            print("🎉 EXCELLENT: Performance optimale (< 10s)")
        elif avg_duration < 20.0:
            print("👍 BON: Performance acceptable (< 20s)")
        elif avg_duration < 30.0:
            print("⚠️  MOYEN: Performance à améliorer (< 30s)")
        else:
            print("❌ MAUVAIS: Performance inacceptable (> 30s)")
    
    if failed_tests:
        print(f"\n❌ Tests échoués: {len(failed_tests)}")
        for test in failed_tests:
            print(f"   - {test['test']}: {test['error']}")
    
    return results

async def main():
    """Test principal"""
    print("🚀 Test des performances de l'IA Yukpo")
    print(f"⏰ Début: {datetime.now().strftime('%H:%M:%S')}")
    
    results = await test_ia_performance()
    
    print(f"\n⏰ Fin: {datetime.now().strftime('%H:%M:%S')}")
    print("\n🎯 Objectifs de performance:")
    print("   - Temps moyen: < 10s")
    print("   - Temps maximum: < 20s")
    print("   - Taux de succès: 100%")

if __name__ == "__main__":
    asyncio.run(main()) 