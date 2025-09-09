# 🚀 Configuration de Production - Embedding Yukpo

## 📋 Vue d'ensemble

Ce document décrit la configuration de production pour le système d'embedding de Yukpo, incluant la vectorisation automatique des services et leur sauvegarde dans Pinecone.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend Rust      │    │ Microservice    │
│   (React)       │◄──►│   (Port 3001)       │◄──►│   Embedding     │
│                 │    │                     │    │   (Port 8000)   │
└─────────────────┘    └─────────────────────┘    └─────────────────┘
                                │                           │
                                ▼                           ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   PostgreSQL    │    │    Pinecone     │
                       │   (Base locale) │    │   (Vector DB)   │
                       └─────────────────┘    └─────────────────┘
```

## 🔧 Configuration

### 1. Variables d'environnement

#### Backend Rust (`backend/`)
```bash
# Configuration du microservice d'embedding
EMBEDDING_API_URL=http://localhost:8000
YUKPO_API_KEY=yukpo_embedding_key_2024
EMBEDDING_TIMEOUT_SECONDS=30
EMBEDDING_MAX_RETRIES=3
```

#### Microservice d'embedding (`microservice_embedding/`)
```bash
# Configuration Pinecone
PINECONE_API_KEY=votre_cle_pinecone_ici
PINECONE_ENVIRONMENT=votre_environment_pinecone
PINECONE_INDEX_NAME=yukpo-services
```

### 2. Fichiers de configuration

#### `backend/config/embedding.toml`
```toml
[embedding]
api_url = "http://localhost:8000"
api_key = "yukpo_embedding_key_2024"
timeout_seconds = 30
max_retries = 3
retry_delay_ms = 1000
batch_size = 10
batch_timeout_seconds = 60
log_level = "info"
log_embedding_calls = true
log_performance_metrics = true
```

## 🚀 Démarrage en production

### Option 1: Script automatique (Recommandé)
```powershell
# Depuis la racine du projet
.\start_yukpo_ecosystem.ps1
```

### Option 2: Démarrage manuel

#### Étape 1: Microservice d'embedding
```powershell
cd microservice_embedding
.\start_embedding_service.ps1
```

#### Étape 2: Backend Rust
```powershell
cd backend
.\start_with_embedding.ps1
```

## 📊 Monitoring et logs

### Logs du backend Rust
```bash
# Vectorisation des services
[EMBEDDING_CLIENT] Configuration chargée depuis les variables d'environnement
[EMBEDDING_CLIENT] - URL: http://localhost:8000
[EMBEDDING_CLIENT] - API Key: yukpo_em... (len=24)
[PINECONE][SERVICE] Appel add_embedding_pinecone pour champ 'titre_service'
[PINECONE][BACKGROUND] ✅ Embedding réussi pour champ 'titre_service'
```

### Logs du microservice d'embedding
```bash
# Appels d'embedding
[INFO] Embedding request received: titre_service
[INFO] Pinecone vector stored successfully
[INFO] Response time: 1.2s
```

## 🔍 Vérification du fonctionnement

### 1. Test de création de service
1. Créez un service via l'interface
2. Vérifiez les logs backend pour les appels d'embedding
3. Vérifiez les logs du microservice d'embedding

### 2. Test de recherche sémantique
1. Effectuez une recherche de besoin
2. Vérifiez que les résultats sont pertinents
3. Vérifiez les logs de recherche d'embedding

### 3. Test de connectivité
```powershell
# Test du microservice d'embedding
curl http://localhost:8000/health

# Test du backend Rust
curl http://localhost:3001/health
```

## ⚡ Performance

### Temps d'exécution typiques
- **Création de service** : 2-5 secondes (incluant vectorisation)
- **Recherche sémantique** : 1-3 secondes
- **Embedding par champ** : 0.5-2 secondes

### Optimisations
- **Batch processing** : Traitement en lot des embeddings
- **Timeout configurable** : 30 secondes par défaut
- **Retry automatique** : 3 tentatives en cas d'échec
- **Cache Redis** : Mise en cache des résultats

## 🔒 Sécurité

### Authentification
- **API Key** : `yukpo_embedding_key_2024` pour le microservice
- **Pinecone API Key** : Clé sécurisée pour la base vectorielle

### Variables sensibles
- Stockage sécurisé des clés API
- Variables d'environnement pour la production
- Pas de clés en dur dans le code

## 🛠️ Dépannage

### Problèmes courants

#### 1. Microservice d'embedding non accessible
```bash
# Vérifier que le service est démarré
curl http://localhost:8000/health

# Redémarrer le service
cd microservice_embedding
python main.py
```

#### 2. Erreurs Pinecone
```bash
# Vérifier la configuration Pinecone
cd microservice_embedding
python test_pinecone_config.py
```

#### 3. Timeout des embeddings
```bash
# Augmenter le timeout
export EMBEDDING_TIMEOUT_SECONDS=60
```

## 📈 Métriques de production

### Métriques à surveiller
- **Taux de succès des embeddings** : >95%
- **Temps de réponse moyen** : <3 secondes
- **Utilisation mémoire** : <512MB par service
- **Nombre de vecteurs Pinecone** : Croissance linéaire

### Alertes recommandées
- Échec de connexion au microservice d'embedding
- Timeout des appels d'embedding
- Erreurs Pinecone
- Taux de succès <90%

## 🔄 Mise à jour

### Procédure de mise à jour
1. Arrêter les services
2. Sauvegarder la configuration
3. Mettre à jour le code
4. Redémarrer avec `start_yukpo_ecosystem.ps1`
5. Vérifier les logs

---

**Note** : Cette configuration est optimisée pour la production et inclut toutes les fonctionnalités de vectorisation, recherche sémantique et sauvegarde Pinecone. 