# 🖼️ Implémentation Recherche Image Intelligente avec IA Multi-Modèles

## 📋 Vue d'Ensemble

Ce document décrit l'implémentation complète du système de recherche par image avec analyse IA, facturation conditionnelle, et support multi-modèles (GPT-4o, Claude 3.5, Gemini).

## ✅ Fonctionnalités Implémentées

### 1. **Analyse IA Multi-Modèles** ✅
- **Service**: `intelligent_image_analysis_service.rs`
- **Prompts Dynamiques**: Adaptés à chaque catégorie de produit (vêtement, automobile, immobilier, etc.)
- **Fallback Automatique**: GPT-4o → Claude 3.5 → Gemini Pro Vision
- **Pas de Hardcoding**: Configuration basée sur `app_ia.rs` existant

### 2. **Facturation Conditionnelle** ✅
- **Formule**: `Coût_User = (Coût_IA_USD × 10) converti en devise`
- **Facturation**: UNIQUEMENT si résultats > 0
- **Multi-devises**: XAF, EUR, USD
- **Vérification Solde**: Avant l'analyse IA
- **Débit Sécurisé**: Avec vérification de disponibilité

### 3. **Toast de Confirmation** ✅
- **Mobile**: Alert avec détails de facturation
- **Frontend**: Toast react-toastify avec navigation
- **Gestion Erreurs**: Solde insuffisant, 0 résultat

### 4. **Recherche PostgreSQL Avancée** ✅
- **Migration SQL**: `20251021_add_ai_image_analysis.sql`
- **Fonction**: `search_images_by_ai_analysis()`
- **Scoring Multi-critères**:
  - Full-text sur description IA (×50)
  - Tags communs (×20)
  - Marque exacte (+100)
  - Couleur exacte (+30)
  - Catégorie identique (+40)
  - Confidence IA (×20)
- **Filtre GPS**: Support proximité géographique

### 5. **Appel IA Systématique** ✅
- **Condition**: Si `has_images = true`
- **Même si**: Texte ou audio présent
- **Intégré**: `handle_direct_search` dans `router_yukpo.rs`

### 6. **Compatibilité SQLx Offline** ✅
- **Migration**: Compatible avec `sqlx offline`
- **Requêtes**: Utilisent `sqlx::query()` au lieu de `sqlx::query!()`
- **Extraction**: Manuelle avec `try_get()` et `sqlx::Row`

---

## 📂 Fichiers Créés/Modifiés

### Backend

#### **Nouveaux Fichiers**
1. `backend/src/services/intelligent_image_analysis_service.rs`
   - Service d'analyse IA avec prompts dynamiques
   - Support multi-modèles (OpenAI, Claude, Gemini)
   - Calcul de coût utilisateur

2. `backend/migrations/20251021_add_ai_image_analysis.sql`
   - Colonnes IA dans `media` (description, tags, category, metadata)
   - Index full-text et GIN
   - Fonction `search_images_by_ai_analysis()`

#### **Fichiers Modifiés**
1. `backend/src/services/mod.rs`
   - Ajout: `pub mod intelligent_image_analysis_service;`

2. `backend/src/routers/router_yukpo.rs`
   - Intégration analyse IA dans `handle_direct_search`
   - Vérification solde avant analyse
   - Appel `IntelligentImageAnalysisService::analyze_image_multimodel`
   - Recherche SQL avec `search_images_by_ai_analysis()`
   - Facturation conditionnelle
   - Utilisation `sqlx::query()` pour offline

### Mobile

#### **Fichiers Modifiés**
1. `mobile/src/screens/HomeScreen.tsx`
   - Détection `search_method === 'image_ai'`
   - Alert de confirmation avec détails billing
   - Gestion erreur solde insuffisant
   - Navigation avec paramètres supplémentaires (`imageSearch`, `imageAnalysis`, `billing`)

### Frontend

#### **Fichiers Modifiés**
1. `frontend/src/pages/HomePage.tsx`
   - Toast de confirmation avec `react-toastify`
   - Détection `search_method === 'image_ai'`
   - Gestion erreur solde insuffisant
   - Navigation avec state enrichi

---

## 🔄 Flux Technique Complet

### **Phase 1: Upload Produit (Prestataire)**

```
FormulaireYukpoIntelligent → creer_service.rs
├─ Analyse images avec analyze_image_multimodel()
│  ├─ Prompt adapté à la catégorie (vetement, automobile, etc.)
│  ├─ Appel GPT-4o (fallback Claude/Gemini)
│  └─ Retour: ImageAnalysis + AICost
│
└─ Sauvegarde dans media
   └─ UPDATE media SET ai_description, ai_tags, ai_category, ai_metadata
```

### **Phase 2: Recherche Image (Client)**

```
HomeScreen/ChatInput → /api/search/direct → handle_direct_search()
│
├─ 1️⃣ Détection image présente
│  └─ has_images = true → Activer analyse IA
│
├─ 2️⃣ Vérification solde (SELECT credits, devise)
│  ├─ Si insuffisant → Erreur 'insufficient_credits'
│  └─ Sinon → Continuer
│
├─ 3️⃣ Analyse IA de l'image de recherche
│  ├─ IntelligentImageAnalysisService::analyze_image_multimodel()
│  ├─ Prompt: "Analyse cette image de recherche..."
│  ├─ Retour: ImageAnalysis (description, tags, marque, couleurs, search_query)
│  └─ + AICost (cost_usd, total_tokens)
│
├─ 4️⃣ Recherche PostgreSQL
│  ├─ search_images_by_ai_analysis(
│  │    search_query,
│  │    tags,
│  │    category_detected,
│  │    marque,
│  │    couleur,
│  │    gps_lat, gps_lng,
│  │    search_radius_km
│  │  )
│  └─ Retour: Résultats avec match_score, distance_km
│
├─ 5️⃣ Facturation Conditionnelle
│  ├─ SI results > 0:
│  │  ├─ user_cost = (ai_cost_usd × 10) × exchange_rate
│  │  ├─ UPDATE users SET credits = credits - user_cost
│  │  └─ billing.charged = true
│  └─ SINON:
│     └─ billing.charged = false (gratuit)
│
└─ 6️⃣ Réponse JSON
   ├─ status: "success"
   ├─ search_method: "image_ai"
   ├─ resultats: [...]
   ├─ image_analysis: {...}
   └─ billing: {charged, amount, new_balance, message}
```

### **Phase 3: Affichage & Confirmation (Client)**

```
HomeScreen/HomePage reçoit réponse
│
├─ SI billing.charged = true:
│  └─ Alert/Toast: "3 résultats - 50 XAF débités"
│
├─ SI error = 'insufficient_credits':
│  └─ Alert/Toast + Navigation → RechargeTokens
│
└─ Navigation → ResultatBesoin
   └─ Paramètres: results, imageSearch, imageAnalysis, billing
```

---

## 💰 Tarification

### **Coût IA (Exemples)**
- **GPT-4o**: $0.000005/token
- **Claude 3.5**: $0.000003/token
- **Gemini Pro**: Variable

### **Exemple Concret**

```
Image analysée: Veste Nike sportswear

1. Analyse IA:
   - Tokens: 1400 (1250 prompt image + 150 completion)
   - Coût IA: 1400 × $0.000005 = $0.007

2. Calcul utilisateur:
   - Coût utilisateur: $0.007 × 10 = $0.07
   - En XAF: $0.07 × 600 = 42 XAF
   - Arrondi: 50 XAF

3. Recherche:
   - 3 résultats trouvés → Facturer 50 XAF
   - 0 résultat trouvé → Gratuit
```

---

## 🗄️ Structure Base de Données

### **Table `media` (Modifiée)**

```sql
ALTER TABLE media
ADD COLUMN ai_description TEXT,           -- "Veste Nike noire sportswear logo swoosh"
ADD COLUMN ai_tags TEXT[],               -- ["nike", "veste", "noir", "sport"]
ADD COLUMN ai_category VARCHAR(100),     -- "vetement"
ADD COLUMN ai_metadata JSONB,            -- {"marque": "Nike", "couleurs": ["noir"]}
ADD COLUMN ai_analyzed_at TIMESTAMP,
ADD COLUMN ai_model_used VARCHAR(100),   -- "gpt-4o"
ADD COLUMN ai_confidence FLOAT;          -- 0.92
```

### **Fonction `search_images_by_ai_analysis`**

```sql
RETURNS TABLE (
    service_id INTEGER,
    media_id INTEGER,
    media_path TEXT,
    product_name TEXT,
    ai_description TEXT,
    ai_tags TEXT[],
    match_score FLOAT,
    distance_km FLOAT,
    service_data JSONB
)
```

---

## 🎯 Prompts IA par Catégorie

### **Vêtement**
```
TYPE: Vêtement
EXTRAIRE: type exact (veste/t-shirt/pantalon), marque, couleur(s), taille visible, 
style (sport/casual/formel), matière, état, motifs/logos distinctifs
```

### **Automobile**
```
TYPE: Véhicule
EXTRAIRE: marque, modèle, couleur, année approximative, type (berline/SUV), 
état, immatriculation si visible, options visibles
```

### **Immobilier**
```
TYPE: Immobilier
EXTRAIRE: type (appartement/villa), architecture, nombre de pièces estimé, 
état (neuf/rénové/ancien), environnement (urbain/rural)
```

*(+ 12 autres catégories : chaussure, électroménager, mobilier, aliments, pharmacie, bijoux, cosmétique, coiffure, etc.)*

---

## ✅ Tests de Validation

### **1. Recherche avec image seule**
```
INPUT: Image veste + GPS
EXPECTED: 
- Analyse IA activée
- Résultats filtrés par GPS
- Facturation si résultats > 0
```

### **2. Recherche image + texte**
```
INPUT: Image veste + "nike sportswear" + GPS
EXPECTED:
- Analyse IA activée (même avec texte)
- Recherche combinée
- Facturation si résultats > 0
```

### **3. Solde insuffisant**
```
INPUT: Image + Solde < 50 XAF
EXPECTED:
- Erreur 'insufficient_credits'
- Pas d'analyse IA
- Alert avec bouton "Recharger"
```

### **4. Aucun résultat**
```
INPUT: Image sans correspondance
EXPECTED:
- Analyse IA effectuée
- 0 résultat
- billing.charged = false (gratuit)
- Toast "Aucun résultat - Recherche gratuite"
```

---

## 🔧 Configuration Requise

### **Variables d'Environnement**
```env
# OpenAI (priorité 1)
OPENAI_API_KEY=sk-...

# Anthropic (fallback 1)
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini (fallback 2)
GEMINI_API_KEY=...
```

### **Extensions PostgreSQL**
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

---

## 📊 Performance

### **Analyse IA**
- **Temps moyen**: 2-5 secondes
- **Timeout**: 40 secondes (GPT-4o), 30s (autres)
- **Retry**: 2 tentatives par modèle

### **Recherche SQL**
- **Index**: GIN full-text + GIN JSONB + GIST GPS
- **Limite**: 20 résultats max
- **Cache**: Aucun (temps réel)

### **Coût Moyen**
- **Par recherche**: 40-80 XAF (selon taille image)
- **Rentabilité**: Marge 10× du coût IA

---

## 🚀 Prochaines Étapes

1. ✅ **Tests Unitaires** (service d'analyse IA)
2. ⏳ **Tests d'Intégration** (end-to-end mobile + backend)
3. ⏳ **Monitoring** (Grafana dashboards pour coûts IA)
4. ⏳ **Optimisation** (Cache des résultats similaires)
5. ⏳ **Analytics** (Tracking succès/échecs recherche image)

---

## 📝 Notes Importantes

### **SQLx Offline**
- ✅ Toutes les requêtes utilisent `sqlx::query()` au lieu de `sqlx::query!()`
- ✅ Migration compatible avec offline (pas de types complexes)
- ✅ Extraction manuelle des données avec `try_get()`

### **Multi-Modèles**
- ✅ Pas de hardcoding OpenAI
- ✅ Fallback automatique selon priorité
- ✅ Configuration centralisée dans `app_ia.rs`

### **Facturation**
- ✅ Vérification solde AVANT analyse
- ✅ Facturation UNIQUEMENT si résultats > 0
- ✅ Calcul basé sur `cost_per_token` (pas de double appel IA)

### **GPS**
- ✅ Toujours pris en compte si fourni
- ✅ Filtre par rayon (défaut 50km)
- ✅ Boost de score par proximité

---

## 👥 Équipe

- **Backend**: Rust + Axum + PostgreSQL
- **Frontend Web**: React + TypeScript + Shadcn
- **Frontend Mobile**: React Native + TypeScript
- **IA**: OpenAI GPT-4o, Claude 3.5, Gemini Pro Vision

---

**Date**: 2025-10-21
**Version**: 1.0.0
**Status**: ✅ Implémentation Complète

