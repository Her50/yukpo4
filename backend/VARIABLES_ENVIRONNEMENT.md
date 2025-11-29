# 🔧 Guide Complet des Variables d'Environnement

## 📋 Vue d'ensemble

Ce document liste **toutes les variables d'environnement** nécessaires pour le backend Yukpomnang, organisées par priorité.

---

## 🔴 PRIORITÉ 1 - OBLIGATOIRES

L'application **ne démarrera pas** sans ces variables.

### 1. `DATABASE_URL`
**Type:** String  
**Format:** `postgresql://user:password@host:port/database`  
**Exemple:** `postgresql://yukpo_user:password123@localhost:5432/yukpomnang`  
**Description:** URL de connexion à la base de données PostgreSQL principale.

**Où l'obtenir:**
- Render.com: Dans votre service PostgreSQL, onglet "Info" → "Internal Database URL"
- Neon.tech: Dashboard → Connection String
- Supabase: Project Settings → Database → Connection String

---

### 2. `JWT_SECRET`
**Type:** String (minimum 32 caractères, recommandé 64+)  
**Format:** Chaîne aléatoire  
**Exemple:** `BtKUxxb1AqrkMbqsz0VE3s4wuGahybpyJreiruDQp3MhN8R56jGaA5I8Qc832C8t`  
**Description:** Secret pour signer et vérifier les tokens JWT. **CRITIQUE pour la sécurité.**

**⚠️ IMPORTANT:**
- Doit être une valeur **très longue et aléatoire**
- Ne JAMAIS utiliser la même valeur en développement et production
- Ne JAMAIS commiter dans git

**Générer une clé:**
```bash
# Linux/Mac
openssl rand -hex 32

# Windows PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | % {[char]$_})

# Ou utiliser un générateur en ligne: https://generate-secret.vercel.app/64
```

---

## 🟠 PRIORITÉ 2 - FORTEMENT RECOMMANDÉES

Sans ces variables, certaines fonctionnalités ne fonctionneront pas correctement.

### 3. `REDIS_URL`
**Type:** String  
**Format:** `redis://user:password@host:port/db` ou `rediss://` pour TLS  
**Exemple:** `redis://localhost:6379/0`  
**Description:** URL Redis pour le cache, rate limiting et anti-brute-force.

**⚠️ SÉCURITÉ:**
- Si Redis est indisponible, le rate limiting et anti-brute-force sont désactivés
- Pour Upstash, utiliser `rediss://` (avec double 's') pour TLS

**Où l'obtenir:**
- Upstash: Dashboard → Redis → Connection String
- Render.com: Service Redis → Internal Redis URL
- Local: `redis://localhost:6379/0`

---

### 4. `MONGODB_URL`
**Type:** String  
**Format:** `mongodb://user:password@host:port/database`  
**Exemple:** `mongodb://localhost:27017/yukpomnang`  
**Description:** URL MongoDB pour l'historique des interactions.

**Par défaut:** `mongodb://localhost:27017` (si non défini)

**Où l'obtenir:**
- MongoDB Atlas: Clusters → Connect → Connection String
- Render.com: Service MongoDB → Internal MongoDB URL

---

### 5. `ALLOWED_ORIGINS`
**Type:** String (liste séparée par virgules)  
**Format:** `https://domain1.com,https://domain2.com`  
**Exemple:** `https://yukpomnang.com,https://app.yukpomnang.com`  
**Description:** Liste des origines autorisées pour CORS. **CRITIQUE pour la sécurité.**

**⚠️ SÉCURITÉ:**
- Ne mettre **QUE** vos domaines de production
- Pas d'espaces dans la liste
- En développement, localhost est ajouté automatiquement

**Exemple:**
```bash
ALLOWED_ORIGINS=https://yukpomnang.com,https://app.yukpomnang.com,https://staging.yukpomnang.com
```

---

## 🤖 PRIORITÉ 3 - IA (Au moins une requise)

Au moins une clé API IA est nécessaire pour les fonctionnalités d'intelligence artificielle.

### 6. `OPENAI_API_KEY` ⭐ RECOMMANDÉ
**Type:** String  
**Format:** `sk-proj-...`  
**Description:** Clé API OpenAI pour GPT-4, GPT-3.5, etc. **Utilisée en priorité.**

**Où l'obtenir:**
1. Aller sur https://platform.openai.com/api-keys
2. Se connecter ou créer un compte
3. Cliquer sur "Create new secret key"
4. Copier la clé (commence par `sk-proj-` ou `sk-`)

**Coûts:** Payant selon utilisation (voir tarifs OpenAI)

---

### 7. `MISTRAL_API_KEY` (Optionnel - Fallback)
**Type:** String  
**Description:** Clé API Mistral AI (utilisée si OpenAI indisponible)

**Où l'obtenir:** https://console.mistral.ai/

---

### 8. `GEMINI_API_KEY` (Optionnel - Fallback)
**Type:** String  
**Description:** Clé API Google Gemini (utilisée si OpenAI indisponible)

**Où l'obtenir:** https://makersuite.google.com/app/apikey

---

### 9. `ANTHROPIC_API_KEY` (Optionnel - Fallback)
**Type:** String  
**Format:** `sk-ant-...`  
**Description:** Clé API Anthropic Claude (utilisée si OpenAI indisponible)

**Où l'obtenir:** https://console.anthropic.com/

---

## 🔐 PRIORITÉ 4 - OAuth (Si utilisé)

### 10. `GOOGLE_CLIENT_ID` (Optionnel)
**Type:** String  
**Description:** Client ID Google pour OAuth. **Requis si vous utilisez Google OAuth.**

**Où l'obtenir:**
1. Aller sur https://console.cloud.google.com/apis/credentials
2. Créer un projet ou sélectionner un projet existant
3. Créer des identifiants OAuth 2.0
4. Copier le Client ID

---

### 11. `FACEBOOK_APP_ID` (Optionnel)
**Type:** String  
**Description:** App ID Facebook pour OAuth. **Requis si vous utilisez Facebook OAuth.**

### 12. `FACEBOOK_APP_SECRET` (Optionnel)
**Type:** String  
**Description:** App Secret Facebook pour OAuth. **Requis si vous utilisez Facebook OAuth.**

**Où l'obtenir:**
1. Aller sur https://developers.facebook.com/apps/
2. Créer une application ou sélectionner une existante
3. Aller dans Settings → Basic
4. Copier App ID et App Secret

---

## 🌍 PRIORITÉ 5 - Services Google

### 13. `GOOGLE_MAPS_API_KEY` (Recommandé)
**Type:** String  
**Description:** Clé API Google Maps pour la géolocalisation.

**Où l'obtenir:**
1. Aller sur https://console.cloud.google.com/apis/credentials
2. Créer une clé API
3. Activer les APIs: Maps JavaScript API, Geocoding API

---

### 14. `GOOGLE_TRANSLATE_API_KEY` (Optionnel)
**Type:** String  
**Description:** Clé API Google Translate pour les traductions.

---

## ⚙️ PRIORITÉ 6 - Configuration Application

### 15. `ENVIRONMENT`
**Type:** String  
**Valeurs:** `production`, `development`, `staging`  
**Défaut:** `production`  
**Description:** Environnement d'exécution.

---

### 16. `RUST_LOG`
**Type:** String  
**Valeurs:** `trace`, `debug`, `info`, `warn`, `error`  
**Défaut:** `info`  
**Description:** Niveau de logging.

---

### 17. `LOG_FORMAT`
**Type:** String  
**Valeurs:** `plain`, `json`  
**Défaut:** `plain`  
**Description:** Format des logs (JSON recommandé en production).

---

## 📦 Liste Complète par Catégorie

### 🔴 Obligatoires (2)
- ✅ `DATABASE_URL`
- ✅ `JWT_SECRET`

### 🟠 Fortement Recommandées (3)
- ⭐ `REDIS_URL`
- ⭐ `MONGODB_URL`
- ⭐ `ALLOWED_ORIGINS`

### 🤖 IA (Au moins 1 requise)
- ⭐ `OPENAI_API_KEY` (recommandé)
- `MISTRAL_API_KEY`
- `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`
- `DEEPSEEK_API_KEY`
- `OLLAMA_URL`

### 🔐 OAuth (Optionnel)
- `GOOGLE_CLIENT_ID`
- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`

### 🌍 Services Google (Optionnel)
- ⭐ `GOOGLE_MAPS_API_KEY` (recommandé)
- `GOOGLE_TRANSLATE_API_KEY`

### ⚙️ Configuration (Optionnel)
- `ENVIRONMENT`
- `RUST_LOG`
- `LOG_FORMAT`
- `YUKPO_API_KEY`
- `UPLOAD_STORAGE_PATH`
- `DB_POOL_SIZE`
- Et 30+ autres...

---

## 🚀 Configuration Rapide

### Minimum Viable (3 variables)

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=$(openssl rand -hex 32)
ALLOWED_ORIGINS=https://yukpomnang.com
```

### Configuration Recommandée (8 variables)

```bash
# Obligatoires
DATABASE_URL=postgresql://...
JWT_SECRET=...

# Fortement recommandées
REDIS_URL=redis://...
MONGODB_URL=mongodb://...
ALLOWED_ORIGINS=https://yukpomnang.com

# IA
OPENAI_API_KEY=sk-proj-...

# Google
GOOGLE_MAPS_API_KEY=...
```

### Configuration Complète

Voir le fichier `.env.example` pour toutes les variables.

---

## 🔧 Génération de JWT_SECRET

### Linux/Mac
```bash
openssl rand -hex 32
```

### Windows PowerShell
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | % {[char]$_})
```

### En ligne
- https://generate-secret.vercel.app/64
- https://randomkeygen.com/

---

## ✅ Vérification

Pour vérifier que toutes les variables obligatoires sont définies:

```bash
# Linux/Mac
source .env
echo $DATABASE_URL
echo $JWT_SECRET

# Windows PowerShell
Get-Content .env | Select-String "DATABASE_URL"
Get-Content .env | Select-String "JWT_SECRET"
```

---

## 📝 Notes Importantes

1. **Ne JAMAIS commiter `.env`** dans git
2. **`.env.example`** est un template - copiez-le vers `.env`
3. En production (Render.com), utilisez les variables d'environnement du dashboard
4. Les valeurs par défaut sont indiquées dans le code si applicable
5. Certaines variables sont optionnelles mais améliorent les performances

---

**Dernière mise à jour:** 2025-01-27

