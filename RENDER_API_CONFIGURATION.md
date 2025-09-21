# 🔧 Configuration des API Keys sur Render.com

## 🚨 **Problèmes identifiés dans l'application**

D'après les logs de votre application, nous avons identifié ces problèmes :

1. **❌ OpenAI non utilisé** pour la création de services
2. **❌ Erreur 400** sur `/api/services/last` 
3. **❌ Erreur 500** sur l'envoi GPS
4. **❌ Contacts précédents** non chargés

## 📋 **Variables d'environnement requises**

Votre backend Rust nécessite ces variables d'environnement sur Render.com :

### 🤖 **Clés API IA (Critiques)**
```bash
OPENAI_API_KEY=sk-proj-... # OpenAI GPT-4o, GPT-4o-mini, GPT-3.5-turbo
MISTRAL_API_KEY=...        # Mistral AI (fallback)
GEMINI_API_KEY=...         # Google Gemini Pro (fallback) 
ANTHROPIC_API_KEY=...      # Claude 3.5 Sonnet (fallback)
```

### 🗄️ **Base de données**
```bash
DATABASE_URL=postgresql://...  # PostgreSQL principal
MONGODB_URL=mongodb://...      # MongoDB pour l'historique
REDIS_URL=redis://...          # Cache Redis
```

### 🔐 **Sécurité**
```bash
JWT_SECRET=...                 # Secret JWT (générer une clé forte)
YUKPO_API_KEY=...             # Clé API interne Yukpo
```

### ⚙️ **Configuration supplémentaire**
```bash
ENABLE_AI_OPTIMIZATIONS=true
EMBEDDING_API_URL=http://localhost:8000
EMBEDDING_TIMEOUT_SECONDS=60
EMBEDDING_MAX_RETRIES=3
```

## 🚀 **Configuration sur Render.com**

### **Étape 1 : Accès au Dashboard**
1. Allez sur https://dashboard.render.com
2. Connectez-vous à votre compte
3. Sélectionnez votre service **"yukpomnang"**

### **Étape 2 : Configuration des variables**
1. Dans votre service, cliquez sur l'onglet **"Environment"**
2. Ajoutez chaque variable en cliquant **"Add Environment Variable"**
3. **Important** : Cochez "Secret" pour les clés API

### **Étape 3 : Obtenir les clés API**

#### 🤖 **OpenAI (PRIORITÉ 1)**
- Site : https://platform.openai.com/api-keys
- Créez une nouvelle clé : "Yukpomnang Production"
- Format : `sk-proj-...`
- **Cette clé est CRITIQUE pour les fonctionnalités IA**

#### 🧠 **Mistral AI** (optionnel)
- Site : https://console.mistral.ai/api-keys/
- Créez une clé API
- Format : Standard API key

#### 🔍 **Google Gemini** (optionnel)
- Site : https://aistudio.google.com/app/apikey
- Créez une clé API
- Activez l'API Gemini Pro

#### 🎭 **Anthropic Claude** (optionnel)  
- Site : https://console.anthropic.com/account/keys
- Créez une clé API
- Format : `sk-ant-...`

### **Étape 4 : Variables essentielles minimum**

Si vous n'avez pas toutes les clés, ajoutez au minimum :

```bash
# MINIMUM REQUIS pour corriger les problèmes
OPENAI_API_KEY=sk-proj-[VOTRE_CLE_OPENAI]
DATABASE_URL=[VOTRE_URL_POSTGRESQL]  
JWT_SECRET=[GENERER_UNE_CLE_FORTE]
YUKPO_API_KEY=yukpo_embedding_key_2024
ENABLE_AI_OPTIMIZATIONS=true
```

## 🔧 **Génération du JWT Secret**

```bash
# Générer une clé JWT sécurisée (64 caractères)
openssl rand -hex 32
# Ou utilisez un générateur en ligne sécurisé
```

## 🚀 **Redéploiement**

### **Option 1 : Redéploiement automatique**
Après avoir ajouté les variables, Render redéploiera automatiquement.

### **Option 2 : Redéploiement manuel**  
1. Dans votre service, cliquez **"Manual Deploy"**
2. Sélectionnez **"Deploy latest commit"**
3. Attendez la fin du build

## ✅ **Vérification post-déploiement**

### **1. Vérifiez les logs Render**
```bash
# Dans les logs, vous devriez voir :
✅ OpenAI API Key configured
✅ Database connection established  
✅ IA models initialized
```

### **2. Testez l'application**
- Créez un nouveau service → OpenAI devrait être utilisé
- Vérifiez que les erreurs 400/500 ont disparu
- Testez le GPS tracking

### **3. Monitoring**
- URL de test : https://yukpomnang.onrender.com/healthz
- Logs en temps réel dans le dashboard Render

## 🎯 **Correction des problèmes spécifiques**

### **❌ OpenAI non utilisé**
**Cause** : `OPENAI_API_KEY` manquante
**Solution** : Ajouter la clé OpenAI sur Render

### **❌ Erreur 400 `/api/services/last`**
**Cause** : Problème JWT ou base de données  
**Solution** : Vérifier `JWT_SECRET` et `DATABASE_URL`

### **❌ Erreur 500 GPS**
**Cause** : Problème de consentement GPS ou DB
**Solution** : Vérifier la table `users` et la colonne `gps_consent`

### **❌ Contacts précédents non chargés**
**Cause** : Endpoint `/api/services/last` en erreur
**Solution** : Corriger l'authentification JWT

## 💰 **Coûts approximatifs API**

- **OpenAI GPT-4o** : ~$0.005 par requête
- **Mistral** : ~$0.002 par requête  
- **Gemini** : ~$0.001 par requête
- **Claude** : ~$0.003 par requête

## 🔄 **Après configuration**

1. ✅ Les services utilisent OpenAI pour la génération
2. ✅ Plus d'erreur 400/500 dans les logs
3. ✅ GPS tracking fonctionnel
4. ✅ Contacts précédents chargés
5. ✅ WebSockets sécurisés (déjà corrigé)

---

**🚨 IMPORTANT** : Configurez au minimum **OPENAI_API_KEY** pour résoudre le problème principal mentionné. 