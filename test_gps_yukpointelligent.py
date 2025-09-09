#!/usr/bin/env python3
"""
Script de test pour vérifier la fonctionnalité GPS dans yukpointelligent
Teste la sélection GPS, la sauvegarde et la récupération des données
"""

import requests
import json
import base64
import time
from typing import Dict, Any

# Configuration
BACKEND_URL = "http://127.0.0.1:3001"
TEST_USER_EMAIL = "test@yukpo.com"
TEST_USER_PASSWORD = "test123"

class GPSYukpoTester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.user_id = None
        
    def login(self) -> bool:
        """Se connecter avec un utilisateur de test"""
        try:
            login_data = {
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            }
            
            response = self.session.post(f"{BACKEND_URL}/api/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("token")
                self.user_id = data.get("user", {}).get("id")
                
                # Ajouter le token aux headers
                self.session.headers.update({
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json"
                })
                
                print(f"✅ Connexion réussie - User ID: {self.user_id}")
                return True
            else:
                print(f"❌ Échec de connexion: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Erreur lors de la connexion: {e}")
            return False
    
    def update_user_gps(self, lat: float, lng: float) -> bool:
        """Mettre à jour la position GPS de l'utilisateur"""
        try:
            gps_data = {
                "latitude": lat,
                "longitude": lng,
                "accuracy": 10.0
            }
            
            response = self.session.patch(f"{BACKEND_URL}/api/user/me/gps_location", json=gps_data)
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Position GPS utilisateur mise à jour: {data.get('gps')}")
                return True
            else:
                print(f"❌ Échec mise à jour GPS: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Erreur mise à jour GPS: {e}")
            return False
    
    def create_service_with_gps(self, gps_coords: str) -> Dict[str, Any]:
        """Créer un service avec des coordonnées GPS"""
        try:
            # Créer une image de test (base64)
            test_image = self.create_test_image()
            
            service_input = {
                "texte": f"Service de test avec GPS {gps_coords}",
                "base64_image": [test_image],
                "gps_zone": gps_coords  # Coordonnées GPS sélectionnées
            }
            
            print(f"📤 Création de service avec GPS: {gps_coords}")
            
            response = self.session.post(
                f"{BACKEND_URL}/api/ia/creation-service",
                json=service_input
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Service créé avec succès")
                print(f"   - Status: {data.get('status')}")
                print(f"   - Intention: {data.get('intention')}")
                print(f"   - Fichiers sauvegardés: {data.get('files_saved')}")
                return data
            else:
                print(f"❌ Échec création service: {response.status_code} - {response.text}")
                return {}
                
        except Exception as e:
            print(f"❌ Erreur création service: {e}")
            return {}
    
    def search_with_gps(self, gps_coords: str) -> Dict[str, Any]:
        """Rechercher des services avec des coordonnées GPS"""
        try:
            search_input = {
                "texte": "recherche par GPS",
                "gps_zone": gps_coords
            }
            
            print(f"🔍 Recherche avec GPS: {gps_coords}")
            
            response = self.session.post(
                f"{BACKEND_URL}/api/ia/auto",
                json=search_input
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Recherche réussie")
                print(f"   - Intention détectée: {data.get('intention')}")
                return data
            else:
                print(f"❌ Échec recherche: {response.status_code} - {response.text}")
                return {}
                
        except Exception as e:
            print(f"❌ Erreur recherche: {e}")
            return {}
    
    def check_database_gps(self, service_id: int) -> bool:
        """Vérifier que les données GPS sont bien sauvegardées en base"""
        try:
            # Vérifier la table services
            response = self.session.get(f"{BACKEND_URL}/api/services/{service_id}")
            
            if response.status_code == 200:
                data = response.json()
                service_data = data.get("data", {})
                
                print(f"📊 Vérification base de données pour service {service_id}:")
                print(f"   - Données service: {json.dumps(service_data, indent=2)}")
                
                # Vérifier les champs GPS
                gps_fixe = service_data.get("gps_fixe")
                gps = data.get("gps")
                
                if gps_fixe:
                    print(f"   ✅ gps_fixe trouvé: {gps_fixe}")
                else:
                    print(f"   ⚠️ gps_fixe manquant")
                
                if gps:
                    print(f"   ✅ gps trouvé: {gps}")
                else:
                    print(f"   ⚠️ gps manquant")
                
                return bool(gps_fixe or gps)
            else:
                print(f"❌ Impossible de récupérer le service: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Erreur vérification base: {e}")
            return False
    
    def create_test_image(self) -> str:
        """Créer une image de test en base64"""
        # Image PNG simple 1x1 pixel (transparent)
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00\x00\x00\x04\x00\x01\xf5\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82'
        return base64.b64encode(png_data).decode('utf-8')
    
    def run_complete_test(self):
        """Exécuter le test complet GPS"""
        print("🚀 Démarrage du test GPS Yukpointelligent")
        print("=" * 50)
        
        # 1. Connexion
        if not self.login():
            print("❌ Impossible de continuer sans connexion")
            return
        
        # 2. Mettre à jour la position GPS de l'utilisateur
        print("\n📍 Test 1: Mise à jour GPS utilisateur")
        user_gps = "4.0511,9.7679"  # Coordonnées de Douala
        lat, lng = map(float, user_gps.split(','))
        if not self.update_user_gps(lat, lng):
            print("⚠️ Impossible de mettre à jour le GPS utilisateur")
        
        # 3. Créer un service avec GPS
        print("\n🏗️ Test 2: Création de service avec GPS")
        service_gps = "4.0615,9.7861"  # Coordonnées différentes
        service_result = self.create_service_with_gps(service_gps)
        
        if service_result:
            service_id = service_result.get("service_created", {}).get("id")
            if service_id:
                # 4. Vérifier la sauvegarde en base
                print(f"\n💾 Test 3: Vérification sauvegarde base de données")
                self.check_database_gps(service_id)
                
                # 5. Recherche avec GPS
                print(f"\n🔍 Test 4: Recherche avec GPS")
                self.search_with_gps(service_gps)
            else:
                print("❌ Impossible de récupérer l'ID du service créé")
        
        print("\n" + "=" * 50)
        print("✅ Test GPS Yukpointelligent terminé")

def main():
    tester = GPSYukpoTester()
    tester.run_complete_test()

if __name__ == "__main__":
    main() 