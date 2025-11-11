# 📋 CONFIGURATION COMPLÈTE - Variables d'environnement

## 🎯 **Résumé des plateformes**
- **Render.com** : Variables backend (Rust)
- **Netlify.com** : Variables frontend (React/Vite)

---

## 🚀 **RENDER.COM - Backend (Rust)**

### ⚡ **CRITIQUES - Configuration minimale**
```bash
# Base de données (REQUIS)
DATABASE_URL=postgresql://username:password@host:port/database
MONGODB_URL=mongodb://username:password@host:port/database
REDIS_URL=redis://username:password@host:port/database

# JWT Sécurité (REQUIS)
JWT_SECRET=your_super_secret_jwt_key_64_chars_minimum_required

# IA Principale (REQUIS - DÉJÀ AJOUTÉ ✅)
OPENAI_API_KEY=sk-proj-...
```

### 🤖 **IA & APIs - Optionnelles mais recommandées**
```bash
# IA Alternatives (fallback)
MISTRAL_API_KEY=...
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
DEEPSEEK_API_KEY=...
# Optionnel : surcharge avancée
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat

# Voix premium (optionnel)
PREMIUM_TTS_ENDPOINT=https://tts.yukpo.ai/v1/voice
PREMIUM_TTS_API_KEY=...
PREMIUM_TTS_VOICE=yukpo-premium-fr

# IA Locale (Ollama)
OLLAMA_URL=http://localhost:11434

# Autres IA
COHERE_API_KEY=...
HUGGINGFACE_API_KEY=hf-...

# Pinecone (Vector DB)
PINECONE_API_KEY=...
PINECONE_INDEX=service-embeddings
PINECONE_ENV=us-east-1-aws
```

> 🧠 **Ordre de fallback IA** : GPT (OpenAI) ➜ Claude (Anthropic) ➜ Gemini (Google) ➜ DeepSeek ➜ autres modèles (Mistral, Cohere, Ollama).

### 🌍 **Services Google**
```bash
# Google Maps & Geocoding
GOOGLE_MAPS_API_KEY=...
GOOGLE_TRANSLATE_API_KEY=...
```

### ⚙️ **Configuration application**
```bash
# API Yukpo interne
YUKPO_API_KEY=yukpo_embedding_key_2024
EMBEDDING_API_KEY=yukpo_embedding_key_2024

# Services
EMBEDDING_API_URL=http://localhost:8000
EMBEDDING_SERVICE_URL=http://localhost:8000
AI_SERVICE_URL=https://api.openai.com/v1
UPLOAD_BASE_URL=https://yukpomnang.onrender.com

# Optimisations
ENABLE_AI_OPTIMIZATIONS=true

# Environnement
ENVIRONMENT=production
RUST_LOG=info
LOG_FORMAT=json
```

### 🔧 **Configuration avancée (optionnel)**
```bash
# Timeouts
EMBEDDING_TIMEOUT_SECONDS=60
EMBEDDING_MAX_RETRIES=3
REQUEST_TIMEOUT=30
DATABASE_TIMEOUT=10

# Cache sémantique
SEMANTIC_CACHE_THRESHOLD=0.85
SEMANTIC_CACHE_PRO_CONFIDENCE=0.9
SEMANTIC_CACHE_PRO_PRODUCTION_THRESHOLD=0.95
SEMANTIC_CACHE_PRO_DEV_THRESHOLD=0.8

# Matching & Scores
ECHANGE_MATCH_THRESHOLD=0.75
FINAL_SCORE_THRESHOLD=0.7
MATCHING_MIN_SCORE_THRESHOLD=0.6
MATCHING_EARLY_STOP_THRESHOLD=0.9
MATCHING_BATCH_SIZE=50
MATCHING_MAX_CANDIDATES=100
MATCHING_DUPLICATE_PROTECTION_DELAY=300
MATCHING_ENABLE_REPUTATION_CACHE=true
MATCHING_REPUTATION_CACHE_TTL=3600

# Base de données optimisation
DB_POOL_SIZE=10
DB_CONNECT_TIMEOUT=30
DB_ACQUIRE_TIMEOUT=30
DB_IDLE_TIMEOUT=600
DB_MAX_QUERY_SIZE=1048576
DB_ENABLE_PREPARED_STATEMENTS=true
DB_ENABLE_SLOW_QUERY_LOG=true
DB_SLOW_QUERY_THRESHOLD=1000

# Cache configuration
CACHE_DEFAULT_TTL=3600
CACHE_SERVICES_TTL=7200
CACHE_USERS_TTL=1800
CACHE_EXCHANGES_TTL=3600
CACHE_MAX_MEMORY_SIZE=536870912
CACHE_MAX_ENTRIES=10000

# API Rate Limiting
API_RATE_LIMIT_PER_MINUTE=100
API_MAX_PAYLOAD_SIZE=10485760
API_REQUEST_TIMEOUT=30
API_ENABLE_COMPRESSION=true
API_ENABLE_RESPONSE_CACHE=true
API_RESPONSE_CACHE_TTL=300

# Background workers
BACKGROUND_CACHE_CLEANUP_INTERVAL=3600
BACKGROUND_SERVICE_DEACTIVATION_INTERVAL=86400
BACKGROUND_SCORE_UPDATE_INTERVAL=1800
BACKGROUND_WORKER_COUNT=4

# GPU Detection
CUDA_VISIBLE_DEVICES=0
GPU_AVAILABLE=true
NVIDIA_VISIBLE_DEVICES=0
GPU_TYPE=nvidia
CUDA_HOME=/usr/local/cuda
CUDA_PATH=/usr/local/cuda
GPU_MEMORY_GB=8

# Recherche avancée
SEARCH_MAX_RESULTS=50
SEARCH_DEFAULT_LANGUAGE=fr
SEARCH_TITLE_BOOST=2.0
SEARCH_MIN_FULLTEXT_SCORE=0.1
SEARCH_DEFAULT_RADIUS_KM=20
SEARCH_DEFAULT_LAT=4.0
SEARCH_DEFAULT_LON=9.7
SEARCH_PRIORITY_CATEGORIES=coiffure,mécanique,électronique
SEARCH_PRIORITY_LOCATIONS=Douala,Yaoundé
SEARCH_PROFILE=balanced
```

---

## 🌐 **NETLIFY.COM - Frontend (React/Vite)**

### ⚡ **CRITIQUES - Configuration minimale**
```bash
# API Backend (REQUIS)
VITE_API_BASE_URL=https://yukpomnang.onrender.com

# Google Maps (REQUIS pour cartes)
VITE_APP_GOOGLE_MAPS_API_KEY=...

# Configuration app
VITE_APP_ENV=production
VITE_APP_DEBUG=false
```

### 📱 **Configuration complète recommandée**
```bash
# API URLs
VITE_API_BASE_URL=https://yukpomnang.onrender.com
VITE_APP_API_URL=https://yukpomnang.onrender.com
VITE_APP_EMBEDDING_URL=https://yukpomnang.onrender.com

# Google Services
VITE_APP_GOOGLE_MAPS_API_KEY=...

# IA Services (frontend)
VITE_APP_AI_SERVICE_URL=https://api.openai.com/v1
VITE_APP_PINECONE_API_KEY=... (si utilisé côté client)

# Configuration app
VITE_APP_ENV=production
VITE_APP_DEBUG=false
VITE_APP_YUKPO_API_KEY=yukpo_frontend_key_2024

# Interface
VITE_APP_TITLE=Yukpo - Services Intelligents
VITE_APP_DESCRIPTION=Plateforme de services intelligents avec IA
```

---

## 🛠️ **PROCÉDURES DE CONFIGURATION**

### **1. Configuration Render.com (Backend)**
```bash
# Dashboard : https://dashboard.render.com
# Service : yukpomnang (backend)
# Onglet : Environment

# Variables CRITIQUES à ajouter :
DATABASE_URL=postgresql://...       # Votre DB PostgreSQL
MONGODB_URL=mongodb://...           # Votre DB MongoDB  
JWT_SECRET=...                      # Générer une clé 64 chars
OPENAI_API_KEY=sk-proj-...         # ✅ DÉJÀ AJOUTÉ
GOOGLE_MAPS_API_KEY=...            # Pour géocodage backend
```

### **2. Configuration Netlify.com (Frontend)**
```bash
# Dashboard : https://app.netlify.com
# Site : yukpomnang-app
# Settings > Environment variables

# Variables CRITIQUES à ajouter :
VITE_API_BASE_URL=https://yukpomnang.onrender.com
VITE_APP_GOOGLE_MAPS_API_KEY=...   # Même clé que backend
VITE_APP_ENV=production
VITE_APP_DEBUG=false
```

---

## 🔑 **Où obtenir les clés API**

### **🤖 IA**
- **OpenAI** : https://platform.openai.com/api-keys
- **Mistral** : https://console.mistral.ai/api-keys/
- **Google Gemini** : https://aistudio.google.com/app/apikey
- **Anthropic** : https://console.anthropic.com/account/keys

### **🌍 Google**
- **Google Maps** : https://console.cloud.google.com/apis/credentials
- **Google Translate** : https://console.cloud.google.com/apis/credentials

### **🗄️ Bases de données**
- **PostgreSQL** : Render, Railway, Neon, Supabase
- **MongoDB** : MongoDB Atlas (gratuit)
- **Redis** : Redis Labs, Upstash

### **🔒 JWT Secret**
```bash
# Générer une clé sécurisée
openssl rand -hex 32
# Ou utiliser : https://generate-secret.vercel.app/32
```

---

## ⚡ **Configuration express (5 minutes)**

### **Minimum viable pour que ça marche :**
```bash
# RENDER.COM (Backend)
DATABASE_URL=postgresql://...
JWT_SECRET=...
OPENAI_API_KEY=sk-proj-...         # ✅ DÉJÀ FAIT

# NETLIFY.COM (Frontend) 
VITE_API_BASE_URL=https://yukpomnang.onrender.com
VITE_APP_GOOGLE_MAPS_API_KEY=...
VITE_APP_ENV=production
```

---

## 🎯 **Priorités de configuration**

### **🔥 URGENT (Application cassée sans ça)**
1. ✅ OPENAI_API_KEY (déjà fait)
2. ❌ DATABASE_URL (PostgreSQL)
3. ❌ JWT_SECRET
4. ❌ VITE_APP_GOOGLE_MAPS_API_KEY

### **⚠️ IMPORTANT (Fonctionnalités limitées)**
5. MONGODB_URL
6. GOOGLE_MAPS_API_KEY (backend)
7. VITE_API_BASE_URL

### **✨ OPTIONNEL (Améliorations)**
8. MISTRAL_API_KEY, GEMINI_API_KEY (IA alternatives)
9. REDIS_URL (cache)
10. Variables d'optimisation

---

**🚨 Action immédiate** : Configurez les variables **URGENT** pour que l'application fonctionne complètement ! 