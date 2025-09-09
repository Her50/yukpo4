#!/usr/bin/env python3
"""
Test de détection de produits pour Yukpo
Teste différents scénarios de détection de produits multiples
"""

import requests
import json
import time
from datetime import datetime, timedelta
import jwt

# Configuration
BACKEND_URL = "http://localhost:3001"
JWT_SECRET = "dev_secret"

def generate_jwt_token():
    """Génère un token JWT valide pour les tests"""
    payload = {
        "sub": "test_user",
        "exp": int((datetime.utcnow() + timedelta(hours=1)).timestamp()),
        "iat": int(datetime.utcnow().timestamp()),
        "user_id": "test_user_id",
        "email": "test@example.com",
        "role": "user"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def test_product_detection():
    """Teste la détection de produits avec différents cas"""
    
    token = generate_jwt_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Cas de test pour la détection de produits
    test_cases = [
        {
            "name": "Boutique avec plusieurs produits",
            "input": {
                "texte": "J'ai une boutique de vêtements pour enfants. Je vends des robes à 25€, des chaussures à 40€ et des sacs à 15€.",
                "gps_mobile": "3.848033,11.502075"
            }
        },
        {
            "name": "Liste numérotée de produits",
            "input": {
                "texte": "Voici mes produits : 1. Robe d'été 2. Chaussures de sport 3. Sac à main 4. Accessoires",
                "gps_mobile": "3.848033,11.502075"
            }
        },
        {
            "name": "Produits avec connecteurs",
            "input": {
                "texte": "Je propose des robes et aussi des chaussures, ainsi que des accessoires comme des sacs et des bijoux.",
                "gps_mobile": "3.848033,11.502075"
            }
        },
        {
            "name": "Quantités multiples",
            "input": {
                "texte": "J'ai plusieurs robes, 5 paires de chaussures et différents accessoires disponibles.",
                "gps_mobile": "3.848033,11.502075"
            }
        },
        {
            "name": "Contexte commercial sans produits spécifiques",
            "input": {
                "texte": "J'ai une boutique de vêtements pour enfants à Douala.",
                "gps_mobile": "3.848033,11.502075"
            }
        },
        {
            "name": "Un seul produit",
            "input": {
                "texte": "Je vends une robe d'été.",
                "gps_mobile": "3.848033,11.502075"
            }
        },
        {
            "name": "Produits avec prix",
            "input": {
                "texte": "robe à 25€, chaussures 40€, sac coûte 15€, pantalon prix 30€",
                "gps_mobile": "3.848033,11.502075"
            }
        }
    ]
    
    print("🧪 Test de détection de produits Yukpo")
    print("=" * 50)
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{i}. {test_case['name']}")
        print(f"Input: {test_case['input']['texte']}")
        
        try:
            start_time = time.time()
            
            response = requests.post(
                f"{BACKEND_URL}/api/ia/orchestration",
                headers=headers,
                json=test_case['input'],
                timeout=30
            )
            
            end_time = time.time()
            duration = end_time - start_time
            
            if response.status_code == 200:
                result = response.json()
                
                # Vérifier si le champ 'produits' est présent
                has_products_field = False
                if isinstance(result, dict):
                    # Chercher dans les champs de données
                    for field_name, field_data in result.items():
                        if isinstance(field_data, dict) and field_data.get('type_donnee') == 'listeproduit':
                            has_products_field = True
                            print(f"✅ Champ 'produits' détecté dans '{field_name}'")
                            break
                
                if not has_products_field:
                    print("❌ Aucun champ 'produits' détecté")
                
                print(f"⏱️  Temps: {duration:.2f}s")
                print(f"📊 Réponse: {json.dumps(result, indent=2, ensure_ascii=False)}")
                
            else:
                print(f"❌ Erreur HTTP {response.status_code}: {response.text}")
                
        except requests.exceptions.Timeout:
            print("⏰ Timeout - L'IA prend trop de temps")
        except requests.exceptions.ConnectionError:
            print("🔌 Erreur de connexion - Vérifiez que le backend tourne sur le port 3001")
        except Exception as e:
            print(f"💥 Erreur: {e}")
        
        print("-" * 50)

def test_multimodal_product_detection():
    """Teste la détection avec contexte multimodal"""
    
    token = generate_jwt_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print("\n🎯 Test de détection multimodale")
    print("=" * 50)
    
    # Test avec contexte multimodal
    multimodal_input = {
        "texte": "J'ai une boutique de vêtements",
        "gps_mobile": "3.848033,11.502075",
        "site_web": "https://ma-boutique.com",
        "base64_image": ["image1_base64", "image2_base64"],  # Plusieurs images
        "excel_base64": ["catalogue.xlsx"]  # Fichier Excel
    }
    
    print("Input multimodal avec plusieurs images et Excel:")
    print(f"- Texte: {multimodal_input['texte']}")
    print(f"- Images: {len(multimodal_input['base64_image'])}")
    print(f"- Excel: {len(multimodal_input['excel_base64'])}")
    print(f"- Site web: {multimodal_input['site_web']}")
    
    try:
        start_time = time.time()
        
        response = requests.post(
            f"{BACKEND_URL}/api/ia/orchestration",
            headers=headers,
            json=multimodal_input,
            timeout=30
        )
        
        end_time = time.time()
        duration = end_time - start_time
        
        if response.status_code == 200:
            result = response.json()
            
            # Vérifier la détection de produits
            has_products_field = False
            if isinstance(result, dict):
                for field_name, field_data in result.items():
                    if isinstance(field_data, dict) and field_data.get('type_donnee') == 'listeproduit':
                        has_products_field = True
                        print(f"✅ Champ 'produits' détecté dans '{field_name}'")
                        break
            
            if not has_products_field:
                print("❌ Aucun champ 'produits' détecté malgré le contexte multimodal")
            
            print(f"⏱️  Temps: {duration:.2f}s")
            print(f"📊 Réponse: {json.dumps(result, indent=2, ensure_ascii=False)}")
            
        else:
            print(f"❌ Erreur HTTP {response.status_code}: {response.text}")
            
    except Exception as e:
        print(f"💥 Erreur: {e}")

if __name__ == "__main__":
    print("🚀 Lancement des tests de détection de produits...")
    
    # Test 1: Détection basée sur le texte
    test_product_detection()
    
    # Test 2: Détection multimodale
    test_multimodal_product_detection()
    
    print("\n✅ Tests terminés!") 