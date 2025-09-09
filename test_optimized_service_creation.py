#!/usr/bin/env python3
"""
Script de test pour vérifier les performances optimisées de création de service
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime

# Configuration
BACKEND_URL = "http://localhost:3001"
EMBEDDING_URL = "http://localhost:8000"
API_KEY = "yukpo_embedding_key_dev"

# Token JWT de test (à remplacer par un vrai token)
JWT_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTYzNjYwMiwiaWF0IjoxNzUyMzIyMTQ1LCJleHAiOjE3NTI0MDg1NDV9.7DM-X2jFDeJU1Hsvr0Q-rNtY5lkRKDgPC1uLCMlI9Gw"

async def test_ia_analysis():
    """Test de l'analyse IA optimisée"""
    print("🔍 Test de l'analyse IA...")
    
    async with aiohttp.ClientSession() as session:
        headers = {
            "Authorization": f"Bearer {JWT_TOKEN}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "texte": "je suis un plombier dans la ville de BAfoussam",
            "base64_image": [],
            "doc_base64": [],
            "excel_base64": []
        }
        
        start_time = time.time()
        
        try:
            async with session.post(f"{BACKEND_URL}/api/ia/auto", json=payload, headers=headers) as response:
                duration = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Analyse IA réussie en {duration:.2f}s")
                    print(f"   Intention détectée: {data.get('intention', 'N/A')}")
                    print(f"   Tokens consommés: {data.get('tokens_consumed', 'N/A')}")
                    return data
                else:
                    print(f"❌ Erreur analyse IA: {response.status}")
                    return None
        except Exception as e:
            print(f"❌ Erreur réseau analyse IA: {e}")
            return None

async def test_service_creation(ia_data):
    """Test de création de service optimisée"""
    print("\n🚀 Test de création de service...")
    
    if not ia_data:
        print("❌ Données IA manquantes, impossible de créer le service")
        return None
    
    async with aiohttp.ClientSession() as session:
        headers = {
            "Authorization": f"Bearer {JWT_TOKEN}",
            "Content-Type": "application/json"
        }
        
        # Préparer les données du service
        service_data = {
            **ia_data,
            "actif": True,
            "gps_mobile": "4.05,9.71",
            "whatsapp": {
                "type_donnee": "string",
                "valeur": "445567789",
                "origine_champs": "formulaire"
            }
        }
        
        start_time = time.time()
        
        try:
            async with session.post(f"{BACKEND_URL}/api/services/create", json=service_data, headers=headers) as response:
                duration = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Service créé avec succès en {duration:.2f}s")
                    print(f"   Service ID: {data.get('service_id', 'N/A')}")
                    print(f"   Titre: {data.get('titre_service', {}).get('valeur', 'N/A')}")
                    return data
                else:
                    error_text = await response.text()
                    print(f"❌ Erreur création service: {response.status}")
                    print(f"   Détails: {error_text}")
                    return None
        except Exception as e:
            print(f"❌ Erreur réseau création service: {e}")
            return None

async def test_embedding_performance():
    """Test des performances d'embedding"""
    print("\n🧠 Test des performances d'embedding...")
    
    async with aiohttp.ClientSession() as session:
        headers = {
            "x-api-key": API_KEY,
            "Content-Type": "application/json"
        }
        
        # Test d'embedding simple
        payload = {
            "value": "Services de plomberie à Bafoussam",
            "type_donnee": "texte",
            "service_id": 999,
            "langue": "fra",
            "active": True,
            "type_metier": "service"
        }
        
        start_time = time.time()
        
        try:
            async with session.post(f"{EMBEDDING_URL}/add_embedding_pinecone", json=payload, headers=headers) as response:
                duration = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Embedding créé en {duration:.2f}s")
                    if 'performance' in data:
                        perf = data['performance']
                        print(f"   Temps embedding: {perf.get('embedding_time', 0):.3f}s")
                        print(f"   Temps Pinecone: {perf.get('pinecone_time', 0):.3f}s")
                    return data
                else:
                    print(f"❌ Erreur embedding: {response.status}")
                    return None
        except Exception as e:
            print(f"❌ Erreur réseau embedding: {e}")
            return None

async def main():
    """Test principal"""
    print("🧪 Test des performances optimisées de création de service")
    print("=" * 60)
    
    # Test 1: Analyse IA
    ia_result = await test_ia_analysis()
    
    # Test 2: Création de service
    service_result = await test_service_creation(ia_result)
    
    # Test 3: Performance embedding
    embedding_result = await test_embedding_performance()
    
    print("\n" + "=" * 60)
    print("📊 Résumé des tests:")
    
    if ia_result:
        print("✅ Analyse IA: Fonctionnelle")
    else:
        print("❌ Analyse IA: Échec")
    
    if service_result:
        print("✅ Création service: Fonctionnelle")
    else:
        print("❌ Création service: Échec")
    
    if embedding_result:
        print("✅ Embedding: Fonctionnel")
    else:
        print("❌ Embedding: Échec")
    
    print("\n🎯 Objectifs de performance:")
    print("   - Analyse IA: < 10s")
    print("   - Création service: < 30s")
    print("   - Embedding: < 5s par champ")

if __name__ == "__main__":
    asyncio.run(main()) 