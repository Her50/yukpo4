import os

print("=== Variables d'environnement Pinecone ===")
print(f"PINECONE_API_KEY: {os.getenv('PINECONE_API_KEY', 'Non définie')[:20] if os.getenv('PINECONE_API_KEY') else 'Non définie'}")
print(f"PINECONE_INDEX: {os.getenv('PINECONE_INDEX', 'Non définie')}")
print(f"PINECONE_ENV: {os.getenv('PINECONE_ENV', 'Non définie')}")
print(f"YUKPO_API_KEY: {os.getenv('YUKPO_API_KEY', 'Non définie')}")

print("\n=== Test de connexion Pinecone ===")
try:
    from microservice_embedding.services import get_pinecone_index
    index = get_pinecone_index()
    print("✅ Connexion Pinecone réussie")
    
    # Vérifier le nombre de vecteurs dans l'index
    stats = index.describe_index_stats()
    print(f"📊 Statistiques de l'index: {stats}")
    
except Exception as e:
    print(f"❌ Erreur connexion Pinecone: {e}") 