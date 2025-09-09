#!/usr/bin/env python3
"""
Configuration pour les tests de recherche d'images dans Yukpo
"""

# Configuration du backend
BACKEND_CONFIG = {
    "base_url": "http://localhost:3001",
    "api_base": "http://localhost:3001/api",
    "timeout": 30,
    "health_endpoint": "/health"
}

# Configuration de la base de données
DATABASE_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "yukpo_db",
    "user": "postgres",
    "password": "password"  # À modifier selon votre configuration
}

# Configuration des tests
TEST_CONFIG = {
    "test_image_path": "test_image.jpg",
    "temp_image_path": "temp_test_image.jpg",
    "similarity_threshold": 0.3,
    "max_results": 10,
    "wait_time": 3  # Temps d'attente après création de service (secondes)
}

# Configuration des endpoints API
API_ENDPOINTS = {
    "health": "/health",
    "create_service": "/prestataire/valider-service",
    "upload_media": "/prestataire/upload/{service_id}",
    "image_search": "/image-search/upload",
    "get_service": "/services/{service_id}",
    "get_service_media": "/media/service/{service_id}",
    "admin_db_structure": "/admin/db/structure",
    "admin_media_count": "/admin/media/count"
}

# Configuration des services de test
TEST_SERVICE_DATA = {
    "titre_service": "Service de test - Blazer élégant",
    "description": "Service de test pour vérifier la recherche d'images. Ce service propose un blazer élégant en plaid beige.",
    "category": "Mode",
    "is_tarissable": False,
    "prix": 15000,
    "devise": "XAF"
}

# Configuration des colonnes requises pour la recherche d'images
REQUIRED_MEDIA_COLUMNS = [
    "image_signature",  # Signature vectorielle de l'image
    "image_hash",       # Hash MD5 pour détection de doublons
    "image_metadata"    # Métadonnées (dimensions, format, couleurs)
]

# Configuration des fonctions SQL requises
REQUIRED_SQL_FUNCTIONS = [
    "search_similar_images",      # Recherche d'images similaires
    "calculate_image_similarity"  # Calcul de similarité
]

# Configuration des index requis
REQUIRED_INDEXES = [
    "idx_media_image_signature",   # Index sur les signatures
    "idx_media_image_hash",        # Index sur les hashes
    "idx_media_image_metadata",    # Index sur les métadonnées
    "idx_media_type_image"         # Index sur le type d'image
]

# Messages d'erreur et de succès
MESSAGES = {
    "success": {
        "backend_accessible": "✅ Backend accessible",
        "migration_applied": "✅ Migration de recherche d'images appliquée",
        "service_created": "✅ Service créé avec succès",
        "search_successful": "✅ Recherche par image réussie",
        "match_found": "✅ Service trouvé dans les résultats de recherche"
    },
    "error": {
        "backend_inaccessible": "❌ Backend non accessible",
        "migration_missing": "❌ Migration de recherche d'images manquante",
        "service_creation_failed": "❌ Échec de la création du service",
        "search_failed": "❌ Échec de la recherche par image",
        "match_not_found": "❌ Service non trouvé dans les résultats"
    },
    "warning": {
        "partial_migration": "⚠️ Migration partielle détectée",
        "no_auth_token": "⚠️ Aucun token d'authentification fourni",
        "no_test_image": "⚠️ Image de test non trouvée"
    },
    "info": {
        "migration_required": "💡 Appliquez la migration: migrations/20250110000000_extend_media_for_image_search.sql",
        "check_logs": "💡 Vérifiez les logs du backend pour plus de détails",
        "restart_backend": "💡 Redémarrez le backend après application de la migration"
    }
}

# Configuration des logs
LOGGING_CONFIG = {
    "level": "INFO",
    "format": "%(asctime)s - %(levelname)s - %(message)s",
    "file": "test_image_search.log"
}

# Configuration des tests de performance
PERFORMANCE_CONFIG = {
    "max_response_time": 5.0,      # Temps de réponse maximum en secondes
    "min_similarity_score": 0.3,   # Score de similarité minimum acceptable
    "max_memory_usage": 100,       # Utilisation mémoire maximum en MB
}

# Configuration des tests de robustesse
ROBUSTNESS_CONFIG = {
    "retry_attempts": 3,           # Nombre de tentatives en cas d'échec
    "retry_delay": 1,              # Délai entre tentatives en secondes
    "timeout_increase": 2,         # Facteur d'augmentation du timeout
}

# Configuration des tests de sécurité
SECURITY_CONFIG = {
    "require_auth": True,          # Authentification requise
    "validate_token": True,        # Validation du token
    "check_permissions": True,     # Vérification des permissions
    "sanitize_inputs": True        # Nettoyage des entrées
}

# Configuration des tests de compatibilité
COMPATIBILITY_CONFIG = {
    "min_python_version": "3.7",
    "required_packages": ["requests", "pillow"],
    "supported_image_formats": ["jpg", "jpeg", "png", "gif", "bmp"],
    "max_image_size": 10 * 1024 * 1024  # 10 MB
}

def get_full_url(endpoint_key, **kwargs):
    """Construit l'URL complète pour un endpoint donné"""
    endpoint = API_ENDPOINTS.get(endpoint_key, "")
    if not endpoint:
        raise ValueError(f"Endpoint inconnu: {endpoint_key}")
    
    # Remplacer les paramètres dans l'URL
    for key, value in kwargs.items():
        endpoint = endpoint.replace(f"{{{key}}}", str(value))
    
    return f"{BACKEND_CONFIG['api_base']}{endpoint}"

def get_test_headers(token=None):
    """Retourne les en-têtes HTTP pour les tests"""
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Yukpo-Image-Search-Test/1.0"
    }
    
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    return headers

def validate_config():
    """Valide la configuration des tests"""
    errors = []
    
    # Vérifier que l'image de test existe
    if not os.path.exists(TEST_CONFIG["test_image_path"]):
        errors.append(f"Image de test non trouvée: {TEST_CONFIG['test_image_path']}")
    
    # Vérifier que les packages requis sont installés
    try:
        import requests
        import PIL
    except ImportError as e:
        errors.append(f"Package manquant: {e}")
    
    # Vérifier la version de Python
    import sys
    if sys.version_info < (3, 7):
        errors.append("Python 3.7+ requis")
    
    return errors

if __name__ == "__main__":
    import os
    
    print("🔧 Configuration des tests de recherche d'images")
    print("=" * 50)
    
    # Valider la configuration
    errors = validate_config()
    if errors:
        print("❌ Erreurs de configuration:")
        for error in errors:
            print(f"  - {error}")
        exit(1)
    
    print("✅ Configuration valide")
    print(f"📁 Image de test: {TEST_CONFIG['test_image_path']}")
    print(f"🌐 Backend: {BACKEND_CONFIG['base_url']}")
    print(f"🗄️ Base de données: {DATABASE_CONFIG['host']}:{DATABASE_CONFIG['port']}/{DATABASE_CONFIG['database']}")
    
    print("\n🎯 Tests prêts à être exécutés!")
    print("1. Test rapide: python quick_test_image_search.py")
    print("2. Test complet: python test_image_search.py")
    print("3. Vérification DB: .\\test_image_search.ps1")
    print("4. Application migration: .\\apply_image_search_migration.ps1") 