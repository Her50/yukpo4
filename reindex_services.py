import requests
import json
import psycopg2
import os

# Configuration
headers = {
    'Content-Type': 'application/json',
    'x-api-key': 'yukpo_embedding_key_2024'
}

# Connexion PostgreSQL
DATABASE_URL = "postgres://postgres:Hernandez87@localhost/yukpo_db"

def get_all_services():
    """Récupère tous les services actifs depuis PostgreSQL"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        query = """
        SELECT id, data 
        FROM services 
        WHERE (data->>'actif')::boolean = true 
        ORDER BY id DESC
        LIMIT 50
        """
        
        cursor.execute(query)
        services = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return services
        
    except Exception as e:
        print(f"❌ Erreur récupération services: {e}")
        return []

def reindex_service(service_id, service_data):
    """Réindexe un service dans Pinecone"""
    try:
        # Extraire les informations du service
        titre = service_data.get('titre_service', {}).get('valeur', '')
        description = service_data.get('description', {}).get('valeur', '')
        category = service_data.get('category', {}).get('valeur', '')
        
        print(f"🔄 Réindexation service {service_id}: {titre[:50]}...")
        
        # Ajouter le titre
        if titre:
            payload = {
                'value': titre,
                'type_donnee': 'texte',
                'service_id': service_id,
                'langue': 'fra',
                'active': True,
                'type_metier': 'service'
            }
            
            response = requests.post('http://localhost:8000/add_embedding_pinecone', 
                                   headers=headers, json=payload, timeout=30)
            
            if response.status_code == 200:
                print(f"  ✅ Titre indexé")
            else:
                print(f"  ❌ Erreur titre: {response.status_code}")
        
        # Ajouter la description
        if description:
            payload = {
                'value': description,
                'type_donnee': 'texte',
                'service_id': service_id,
                'langue': 'fra',
                'active': True,
                'type_metier': 'service'
            }
            
            response = requests.post('http://localhost:8000/add_embedding_pinecone', 
                                   headers=headers, json=payload, timeout=30)
            
            if response.status_code == 200:
                print(f"  ✅ Description indexée")
            else:
                print(f"  ❌ Erreur description: {response.status_code}")
        
        # Ajouter la catégorie
        if category:
            payload = {
                'value': category,
                'type_donnee': 'texte',
                'service_id': service_id,
                'langue': 'fra',
                'active': True,
                'type_metier': 'service'
            }
            
            response = requests.post('http://localhost:8000/add_embedding_pinecone', 
                                   headers=headers, json=payload, timeout=30)
            
            if response.status_code == 200:
                print(f"  ✅ Catégorie indexée")
            else:
                print(f"  ❌ Erreur catégorie: {response.status_code}")
        
        return True
        
    except Exception as e:
        print(f"❌ Erreur réindexation service {service_id}: {e}")
        return False

def main():
    print("=== Réindexation des services dans Pinecone ===")
    
    # Récupérer tous les services
    services = get_all_services()
    print(f"📊 {len(services)} services trouvés")
    
    if not services:
        print("❌ Aucun service trouvé")
        return
    
    # Réindexer chaque service
    success_count = 0
    for service_id, service_data in services:
        if reindex_service(service_id, service_data):
            success_count += 1
        print()  # Ligne vide pour séparer
    
    print(f"✅ Réindexation terminée: {success_count}/{len(services)} services réindexés")
    
    # Test de recherche après réindexation
    print("\n=== Test de recherche après réindexation ===")
    try:
        payload = {
            'query': 'librairie',
            'type_donnee': 'texte',
            'top_k': 10
        }
        
        response = requests.post('http://localhost:8000/search_embedding_pinecone', 
                               headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            results = data.get('results', [])
            print(f"🔍 Recherche 'librairie': {len(results)} résultats trouvés")
            
            for i, result in enumerate(results[:5]):
                service_id = result.get('metadata', {}).get('service_id', 'N/A')
                score = result.get('score', 0)
                print(f"  {i+1}. Service {service_id} (score: {score:.4f})")
        else:
            print(f"❌ Erreur recherche: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Erreur test recherche: {e}")

if __name__ == "__main__":
    main() 