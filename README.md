# Yukpo - Plateforme d'échange de services

## État actuel : Version Stable avec Optimisations IA

Cette version représente une sauvegarde complète de l'application Yukpo avec toutes les optimisations et corrections apportées.

## 🚀 Fonctionnalités principales

### Backend (Rust/Actix-web)
- API REST complète pour la gestion des services et échanges
- Système d'authentification JWT
- Intégration IA avec OpenAI pour l'assistance intelligente
- Optimisations IA professionnelles (cache sémantique, optimisation de prompts)
- Système de tokens avec tarification différenciée
- Support multimodal (images, documents)
- Vectorisation avec Pinecone
- Base de données PostgreSQL avec pgvector

### Frontend (React/TypeScript)
- Interface moderne et responsive
- Formulaire intelligent de création de services
- Système de recherche avancé
- Gestion des tokens en temps réel
- Support GPS interactif
- Dashboard utilisateur complet
- Internationalisation (FR/EN)

### Microservice Embedding (Python/FastAPI)
- Service dédié pour la génération d'embeddings
- Intégration avec sentence-transformers
- API REST pour la vectorisation de texte

## 📋 Prérequis

- Rust (latest stable)
- Node.js 18+
- Python 3.10+
- PostgreSQL 15+ avec pgvector
- Redis
- Compte OpenAI API
- Compte Pinecone

## 🛠️ Installation

### 1. Backend
```bash
cd backend
cp .env.example .env
# Configurer les variables d'environnement
cargo build --release
cargo run
```

### 2. Frontend
```bash
cd frontend
cp .env.example .env
# Configurer les variables d'environnement
npm install
npm run dev
```

### 3. Microservice Embedding
```bash
cd microservice_embedding
python -m venv venv
./venv/Scripts/activate  # Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

## 🔧 Configuration

### Variables d'environnement Backend
- `DATABASE_URL` : URL PostgreSQL
- `REDIS_URL` : URL Redis
- `OPENAI_API_KEY` : Clé API OpenAI
- `PINECONE_API_KEY` : Clé API Pinecone
- `JWT_SECRET` : Secret pour les tokens JWT

### Variables d'environnement Frontend
- `VITE_API_URL` : URL de l'API backend
- `VITE_GOOGLE_MAPS_API_KEY` : Clé API Google Maps

## 📊 Optimisations IA intégrées

- **Cache sémantique** : Réduction des appels API redondants
- **Optimisation de prompts** : Amélioration automatique des requêtes
- **Tarification dynamique** : Coûts adaptés selon le type de requête
- **Métriques en temps réel** : Suivi de la consommation et performances

## 🚀 Scripts de démarrage

- `start-yukpo.ps1` : Lance tous les services
- `start-backend.ps1` : Lance uniquement le backend
- `start-frontend.ps1` : Lance uniquement le frontend
- `start-embedding.ps1` : Lance le service d'embedding

## 📝 État des corrections

- ✅ Compilation backend corrigée
- ✅ Optimisations IA intégrées
- ✅ Middleware de tokens amélioré
- ✅ Affichage des balances utilisateur corrigé
- ✅ Formulaire intelligent fonctionnel
- ✅ Système de routing optimisé
- ✅ Gestion des erreurs améliorée

## 🔄 Version

Version stable sauvegardée le : 03/01/2025

## 📄 License

Propriétaire - Tous droits réservés 