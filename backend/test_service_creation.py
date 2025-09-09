#!/usr/bin/env python3
"""
Script de test pour vérifier la création de service avec le nouveau format JSON
"""

import requests
import json
import time

# Configuration
BACKEND_URL = "http://127.0.0.1:3001"
TEST_USER_ID = 1

def test_service_creation():
    """Test de création de service avec le nouveau format JSON"""
    
    # Données de test conformes au nouveau schéma
    test_data = {
        "intention": "creation_service",
        "titre_service": {
            "type_donnee": "string",
            "valeur": "Boutique de vêtements pour enfants",
            "origine_champs": "test"
        },
        "category": {
            "type_donnee": "string", 
            "valeur": "Commerce",
            "origine_champs": "test"
        },
        "description": {
            "type_donnee": "string",
            "valeur": "Vente de vêtements et chaussures pour enfants",
            "origine_champs": "test"
        },
        "is_tarissable": True,
        "vitesse_tarissement": "moyenne",  # String simple, pas d'objet
        "produits": {
            "type_donnee": "listeproduit",
            "valeur": [
                {
                    "nom": {
                        "type_donnee": "string",
                        "valeur": "T-shirt enfant",
                        "origine_champs": "test"
                    },
                    "description": {
                        "type_donnee": "string", 
                        "valeur": "T-shirt en coton pour enfants",
                        "origine_champs": "test"
                    },
                    "prix": {
                        "type_donnee": "number",  # Type number, pas object
                        "valeur": 5000,  # Nombre simple, pas d'objet montant/devise
                        "origine_champs": "test"
                    },
                    "quantite": {
                        "type_donnee": "number",
                        "valeur": 1,
                        "origine_champs": "test"
                    },
                    "categorie": {
                        "type_donnee": "string",
                        "valeur": "Vêtements",
                        "origine_champs": "test"
                    }
                },
                {
                    "nom": {
                        "type_donnee": "string",
                        "valeur": "Chaussures enfant",
                        "origine_champs": "test"
                    },
                    "description": {
                        "type_donnee": "string",
                        "valeur": "Chaussures confortables pour enfants",
                        "origine_champs": "test"
                    },
                    "prix": {
                        "type_donnee": "number",
                        "valeur": 10000,
                        "origine_champs": "test"
                    },
                    "quantite": {
                        "type_donnee": "number",
                        "valeur": 1,
                        "origine_champs": "test"
                    },
                    "categorie": {
                        "type_donnee": "string",
                        "valeur": "Chaussures",
                        "origine_champs": "test"
                    }
                }
            ],
            "origine_champs": "test"
        }
    }
    
    print("🧪 Test de création de service avec le nouveau format JSON")
    print(f"📡 URL: {BACKEND_URL}/api/services/create")
    print(f"👤 User ID: {TEST_USER_ID}")
    print(f"📦 Données: {json.dumps(test_data, indent=2)}")
    
    try:
        # Appel à l'API de création de service
        response = requests.post(
            f"{BACKEND_URL}/api/services/create",
            json={
                "user_id": TEST_USER_ID,
                "data": test_data
            },
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer test_token"  # Token de test
            },
            timeout=30
        )
        
        print(f"\n📊 Statut de la réponse: {response.status_code}")
        print(f"📄 Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Succès! Service créé avec l'ID: {result.get('service_id')}")
            print(f"📈 Tokens consommés: {result.get('tokens_consumed')}")
            return True
        else:
            print(f"❌ Erreur {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Erreur de connexion: {e}")
        return False
    except Exception as e:
        print(f"❌ Erreur inattendue: {e}")
        return False

def test_ia_orchestration():
    """Test de l'orchestration IA avec le nouveau format"""
    
    test_input = {
        "text": "Je vends des T-shirts pour enfants à 5000 FCFA et des chaussures à 10000 FCFA. Boutique de vêtements pour enfants.",
        "user_id": TEST_USER_ID
    }
    
    print("\n🧪 Test de l'orchestration IA")
    print(f"📡 URL: {BACKEND_URL}/api/ia/auto")
    print(f"📝 Input: {test_input['text']}")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/ia/auto",
            json=test_input,
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer test_token"
            },
            timeout=60
        )
        
        print(f"\n📊 Statut de la réponse: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Succès! Intention détectée: {result.get('intention')}")
            print(f"📈 Tokens consommés: {result.get('tokens_consumed')}")
            
            # Vérifier si le JSON généré est conforme
            data = result.get('data', {})
            if data.get('intention') == 'creation_service':
                print("✅ Intention correcte: creation_service")
                
                # Vérifier la structure des produits
                produits = data.get('produits', {})
                if produits and produits.get('type_donnee') == 'listeproduit':
                    print("✅ Structure produits correcte")
                    
                    # Vérifier vitesse_tarissement
                    vitesse = data.get('vitesse_tarissement')
                    if isinstance(vitesse, str) and vitesse in ['lente', 'moyenne', 'rapide']:
                        print("✅ vitesse_tarissement correct (string simple)")
                    else:
                        print(f"⚠️ vitesse_tarissement incorrect: {vitesse}")
                        
                    # Vérifier les prix dans les produits
                    produits_list = produits.get('valeur', [])
                    for i, produit in enumerate(produits_list):
                        prix = produit.get('prix', {})
                        if isinstance(prix, dict) and prix.get('type_donnee') == 'number':
                            print(f"✅ Prix produit {i+1} correct (type number)")
                        else:
                            print(f"⚠️ Prix produit {i+1} incorrect: {prix}")
                else:
                    print("⚠️ Structure produits manquante ou incorrecte")
            else:
                print(f"⚠️ Intention incorrecte: {data.get('intention')}")
                
            return True
        else:
            print(f"❌ Erreur {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Démarrage des tests de création de service")
    print("=" * 50)
    
    # Test 1: Création directe de service
    success1 = test_service_creation()
    
    # Attendre un peu entre les tests
    time.sleep(2)
    
    # Test 2: Orchestration IA
    success2 = test_ia_orchestration()
    
    print("\n" + "=" * 50)
    print("📊 Résumé des tests:")
    print(f"✅ Création directe: {'SUCCÈS' if success1 else 'ÉCHEC'}")
    print(f"✅ Orchestration IA: {'SUCCÈS' if success2 else 'ÉCHEC'}")
    
    if success1 and success2:
        print("\n🎉 Tous les tests sont passés! Le nouveau format JSON fonctionne correctement.")
    else:
        print("\n⚠️ Certains tests ont échoué. Vérifiez les logs pour plus de détails.") 