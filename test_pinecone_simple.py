import os
import pinecone

print("=== Test simple de Pinecone ===")

# Configuration
api_key = "pcsk_6aD9si_CSCQPpYjfbVR5VKmqaZQYDu2P49KsvSBvbgUftR24tRMYp7YesZfNWDrALRhdmu"
env = "us-east-1"
index_name = "service-embeddings"

try:
    # Initialiser Pinecone
    pc = pinecone.Pinecone(api_key=api_key)
    print("✅ Connexion Pinecone établie")
    
    # Lister les index
    indexes = pc.list_indexes()
    print(f"📋 Index disponibles: {[idx.name for idx in indexes]}")
    
    # Accéder à l'index
    if index_name in [idx.name for idx in indexes]:
        index = pc.Index(index_name)
        stats = index.describe_index_stats()
        print(f"📊 Index '{index_name}' contient {stats.total_vector_count} vecteurs")
        
        if stats.total_vector_count > 0:
            print("✅ Pinecone fonctionne parfaitement !")
            print("🚀 Le système multi-méthodes devrait maintenant fonctionner")
        else:
            print("⚠️ Index vide")
    else:
        print(f"❌ Index '{index_name}' non trouvé")
        
except Exception as e:
    print(f"❌ Erreur: {e}")

print("\n=== Test terminé ===") 