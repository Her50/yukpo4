import os
import requests
import json

print("=== DIAGNOSTIC CRITIQUE PINECONE ===")

# Test 1: Vérifier les variables d'environnement
print("\n1. 🔍 Vérification des variables d'environnement")

env_vars = [
    'PINECONE_API_KEY',
    'PINECONE_ENV', 
    'PINECONE_INDEX'
]

for var in env_vars:
    value = os.environ.get(var, 'NON DÉFINIE')
    if var == 'PINECONE_API_KEY' and value != 'NON DÉFINIE':
        masked_value = value[:8] + "..." + value[-4:] if len(value) > 12 else "***"
        print(f"   {var}: {masked_value}")
    else:
        print(f"   {var}: {value}")

# Test 2: Vérifier la connectivité Pinecone directe
print("\n2. 🔌 Test de connectivité Pinecone directe")

try:
    import pinecone
    
    api_key = os.environ.get('PINECONE_API_KEY')
    env = os.environ.get('PINECONE_ENV')
    index_name = os.environ.get('PINECONE_INDEX')
    
    if not all([api_key, env, index_name]):
        print("   ❌ Variables d'environnement manquantes pour Pinecone")
    else:
        print(f"   🔑 API Key: {'*' * 8 + api_key[-4:] if api_key else 'N/A'}")
        print(f"   🌍 Environnement: {env}")
        print(f"   📊 Index: {index_name}")
        
        try:
            pc = pinecone.Pinecone(api_key=api_key)
            print("   ✅ Connexion Pinecone établie")
            
            indexes = pc.list_indexes()
            print(f"   📋 Index disponibles: {[idx.name for idx in indexes]}")
            
            if index_name in [idx.name for idx in indexes]:
                print(f"   ✅ Index '{index_name}' trouvé")
                
                try:
                    index = pc.Index(index_name)
                    stats = index.describe_index_stats()
                    print(f"   📊 Stats de l'index:")
                    print(f"      - Total vectors: {stats.total_vector_count}")
                    print(f"      - Namespaces: {list(stats.namespaces.keys()) if stats.namespaces else 'Aucun'}")
                    
                    if stats.total_vector_count == 0:
                        print("   🚨 CRITIQUE: Index vide !")
                    else:
                        print(f"   ✅ Index contient {stats.total_vector_count} vecteurs")
                        
                except Exception as e:
                    print(f"   ❌ Erreur accès index: {e}")
            else:
                print(f"   🚨 CRITIQUE: Index '{index_name}' NON trouvé !")
                
        except Exception as e:
            print(f"   ❌ Erreur connexion Pinecone: {e}")
            
except ImportError:
    print("   ❌ Module pinecone non installé")
except Exception as e:
    print(f"   ❌ Erreur: {e}")

# Test 3: Vérifier le microservice
print("\n3. 🔌 Test du microservice d'embedding")

try:
    response = requests.get('http://localhost:8000/health', timeout=10)
    if response.status_code == 200:
        print("   ✅ Microservice accessible")
        
        # Tester l'endpoint d'indexation
        headers = {
            'Content-Type': 'application/json',
            'x-api-key': 'yukpo_embedding_key_2024'
        }
        
        test_payload = {
            'service_id': 999,
            'value': 'test',
            'type_donnee': 'texte',
            'active': True
        }
        
        response = requests.post('http://localhost:8000/add_embedding_pinecone', 
                               headers=headers, json=test_payload, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ Test d'indexation réussi: {result}")
        else:
            print(f"   ❌ Erreur test d'indexation: {response.status_code}")
            print(f"   Réponse: {response.text}")
            
    else:
        print(f"   ❌ Erreur microservice: {response.status_code}")
        
except Exception as e:
    print(f"   ❌ Erreur connexion microservice: {e}")

# Test 4: Vérifier la configuration du microservice
print("\n4. ⚙️ Configuration du microservice")

try:
    # Lire le fichier de configuration du microservice
    config_file = "microservice_embedding/services.py"
    if os.path.exists(config_file):
        with open(config_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Chercher les références Pinecone
        if 'PINECONE_API_KEY' in content:
            print("   ✅ Références Pinecone trouvées dans services.py")
        else:
            print("   ❌ Aucune référence Pinecone dans services.py")
            
        if 'get_pinecone_index' in content:
            print("   ✅ Fonction get_pinecone_index trouvée")
        else:
            print("   ❌ Fonction get_pinecone_index manquante")
    else:
        print(f"   ❌ Fichier {config_file} non trouvé")
        
except Exception as e:
    print(f"   ❌ Erreur lecture configuration: {e}")

print("\n=== DIAGNOSTIC TERMINÉ ===")
print("\n🚨 RECOMMANDATIONS CRITIQUES:")
print("1. Vérifier que l'index Pinecone n'a pas été supprimé")
print("2. Contrôler les variables d'environnement")
print("3. Vérifier la région/environnement Pinecone")
print("4. Contrôler les quotas et limites de stockage")
print("5. Vérifier la persistance des données en mode serverless") 