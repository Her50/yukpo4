import requests
import json

# Test de la recherche Pinecone corrigée
url = "http://localhost:3001/api/ia/auto"
headers = {
    "Authorization": "Bearer dev_token_pinecone",
    "Content-Type": "application/json"
}

data = {
    "message": "Je cherche un plombier pour réparer une fuite d'eau"
}

try:
    response = requests.post(url, headers=headers, json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    
    if response.status_code == 200:
        result = response.json()
        if "data" in result and len(result["data"]) > 0:
            print("\n✅ Recherche Pinecone réussie !")
            print(f"Services trouvés: {len(result['data'])}")
            for i, service in enumerate(result["data"][:3]):  # Afficher les 3 premiers
                print(f"  {i+1}. Service ID: {service.get('service_id', 'N/A')}")
                print(f"     Score: {service.get('score', 'N/A')}")
        else:
            print("\n⚠️  Aucun service trouvé")
    else:
        print(f"\n❌ Erreur: {response.status_code}")
        
except requests.exceptions.ConnectionError:
    print("❌ Impossible de se connecter au backend. Vérifiez qu'il est démarré.")
except Exception as e:
    print(f"❌ Erreur: {e}") 