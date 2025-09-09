import requests
import json

print("=== Test de recherche avec améliorations ===")

headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMxNTAyMCwiaWF0IjoxNzU2NDA3MzcxLCJleHAiOjE3NTY0OTM3NzF9.uhko6biwAmRYPwUdZutIif-xLuxryZePL8JCQCliEbM'
}

# Test de recherche pour pièces détachées
test_data = {
    "texte": "je cherche un magasin de vente des pièces detachées de vehicules",
    "base64_image": [],
    "doc_base64": [],
    "excel_base64": []
}

print("\n🔍 Test de recherche: 'je cherche un magasin de vente des pièces detachées de vehicules'")

try:
    response = requests.post('http://localhost:3001/api/ia/auto', 
                           headers=headers, json=test_data, timeout=60)
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Recherche réussie")
        
        # Extraire les résultats
        resultats = result.get('resultats', [])
        nombre_matchings = result.get('nombre_matchings', 0)
        
        print(f"📊 Nombre de résultats: {nombre_matchings}")
        
        if resultats:
            print(f"\n🎯 Services trouvés:")
            for i, service in enumerate(resultats[:5]):  # Afficher les 5 premiers
                service_id = service.get('service_id', 'N/A')
                score = service.get('score', 0)
                titre = service.get('data', {}).get('titre_service', {}).get('valeur', 'N/A')
                print(f"   {i+1}. Service {service_id} (score: {score:.4f}) - {titre}")
        else:
            print(f"   ❌ Aucun service trouvé")
            
        # Vérifier si le service 129 est dans les résultats
        service_129_found = any(
            service.get('service_id') == 129 
            for service in resultats
        )
        
        if service_129_found:
            print(f"\n✅ Service 129 trouvé dans les résultats !")
        else:
            print(f"\n❌ Service 129 non trouvé dans les résultats")
            
    else:
        print(f"❌ Erreur: {response.status_code}")
        print(f"   Réponse: {response.text}")
        
except Exception as e:
    print(f"❌ Erreur: {e}")

print("\n=== Test terminé ===") 