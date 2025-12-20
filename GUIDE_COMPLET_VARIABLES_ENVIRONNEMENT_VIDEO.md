# 📋 Guide Complet - Variables d'Environnement Module Vidéo

## 🎯 Date: 2025-01-27

Ce guide détaille **toutes** les variables d'environnement nécessaires pour que le module de création vidéo de Yukpo soit opérationnel.

---

## 📍 LÉGENDE

- **📍 Backend** : Variable à placer dans `.env` du backend Rust
- **📍 Mobile (Expo)** : Variable à placer dans `app.config.js` ou `.env` mobile
- **📍 Les deux** : Variable nécessaire dans les deux environnements

---

## 🤖 VARIABLES IA (Backend)

### 1. OPENAI_API_KEY

**📍 Backend**

**Description:** Clé API OpenAI pour GPT-4, GPT-4 Vision, DALL-E, Whisper (transcription audio, génération storyboard, analyse médias)

**Guide d'obtention détaillé:**

**Étape 1 : Accéder au site OpenAI**
1. Ouvrir votre navigateur et aller sur **https://platform.openai.com/**
2. Si vous n'avez pas de compte, cliquer sur **"Sign up"** (créer un compte)
   - Entrer votre email
   - Vérifier votre email
   - Créer un mot de passe
   - Accepter les conditions d'utilisation
3. Si vous avez déjà un compte, cliquer sur **"Log in"** (se connecter)

**Étape 2 : Accéder aux clés API**
1. Une fois connecté, cliquer sur votre **avatar/icône de profil** en haut à droite
2. Dans le menu déroulant, cliquer sur **"API keys"** ou aller directement sur **https://platform.openai.com/api-keys**
3. Vous verrez la liste de vos clés API existantes (si vous en avez)

**Étape 3 : Créer une nouvelle clé API**
1. Cliquer sur le bouton **"+ Create new secret key"** (créer une nouvelle clé secrète)
2. Une fenêtre popup s'ouvre
3. **Nommer la clé** (ex: "Yukpo Video Production" ou "Yukpomnang Backend")
   - Ce nom vous aide à identifier la clé plus tard
4. Cliquer sur **"Create secret key"** (créer la clé secrète)

**Étape 4 : Copier et sauvegarder la clé**
1. **⚠️ CRITIQUE:** La clé s'affiche UNE SEULE FOIS dans une fenêtre popup
2. La clé commence par `sk-proj-` ou `sk-` suivi d'une longue chaîne de caractères
3. **Copier immédiatement** la clé complète (Ctrl+C ou Cmd+C)
4. **Coller dans un endroit sûr** (fichier texte, gestionnaire de mots de passe, etc.)
5. Cliquer sur **"Done"** (terminé) dans la popup
6. **⚠️ ATTENTION:** Si vous fermez la popup sans copier, vous devrez créer une nouvelle clé

**Étape 5 : Ajouter des crédits (si nécessaire)**
1. Si c'est votre première clé, vous devrez peut-être ajouter des crédits
2. Aller dans **"Billing"** (facturation) dans le menu
3. Cliquer sur **"Add payment method"** (ajouter un moyen de paiement)
4. Entrer vos informations de carte bancaire
5. Choisir un montant de crédit initial (minimum généralement $5-10)

**Exemple de clé générée:**
```
sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Usage dans le code:**
- `backend/src/services/app_ia.rs` - Modèles: `openai-gpt4o`, `openai-gpt4o-vision`, `openai-whisper`
- `backend/src/services/audio_transcription_service.rs` - Transcription audio (Whisper)
- Timeout: **120 secondes** pour génération vidéo complète

**💡 IMPORTANT - Utilisations multiples:**
- ✅ **Texte (GPT)** : Génération de scripts, storyboards, descriptions
- ✅ **Images (DALL-E)** : Génération d'images pour vidéos
- ✅ **Audio (Whisper)** : Transcription audio → texte
- ✅ **Vidéo (Sora)** : Peut utiliser cette clé OU `SORA_API_KEY` (voir section génération vidéo)

**Exemple:**
```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**📝 Note:** C'est la **même clé** pour tous les services OpenAI (GPT, Whisper, DALL-E, Sora). Vous n'avez pas besoin de clés séparées!

---

### 2. ANTHROPIC_API_KEY

**📍 Backend**

**Description:** Clé API Anthropic pour Claude (analyse médias avancée, génération de scripts)

**Guide d'obtention détaillé:**

**Étape 1 : Accéder au site Anthropic**
1. Ouvrir votre navigateur et aller sur **https://console.anthropic.com/**
2. Si vous n'avez pas de compte, cliquer sur **"Sign up"** (créer un compte)
   - Entrer votre email
   - Vérifier votre email
   - Créer un mot de passe
3. Si vous avez déjà un compte, cliquer sur **"Log in"** (se connecter)

**Étape 2 : Accéder aux clés API**
1. Une fois connecté, cliquer sur votre **avatar/icône de profil** en haut à droite
2. Dans le menu, cliquer sur **"Settings"** (paramètres)
3. Dans la barre latérale gauche, cliquer sur **"API Keys"** ou aller directement sur **https://console.anthropic.com/settings/keys**

**Étape 3 : Créer une nouvelle clé API**
1. Cliquer sur le bouton **"+ Create Key"** (créer une clé)
2. Une fenêtre popup s'ouvre
3. **Nommer la clé** (ex: "Yukpo Video Claude" ou "Yukpomnang Backend")
4. Cliquer sur **"Create Key"** (créer la clé)

**Étape 4 : Copier et sauvegarder la clé**
1. **⚠️ CRITIQUE:** La clé s'affiche UNE SEULE FOIS
2. La clé commence par `sk-ant-api03-` suivi d'une longue chaîne de caractères
3. **Copier immédiatement** la clé complète
4. **Coller dans un endroit sûr**
5. Cliquer sur **"Done"** (terminé)

**Étape 5 : Ajouter des crédits (si nécessaire)**
1. Aller dans **"Billing"** (facturation) dans le menu
2. Ajouter un moyen de paiement si nécessaire
3. Les crédits sont généralement nécessaires pour utiliser l'API

**Exemple de clé générée:**
```
sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Usage dans le code:**
- `backend/src/services/app_ia.rs` - Modèle: `anthropic-claude-3-5-sonnet`
- Timeout: **120 secondes** pour génération vidéo complète

**Exemple:**
```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 3. GEMINI_API_KEY

**📍 Backend**

**Description:** Clé API Google Gemini pour analyse multimodale (images, vidéos, audio)

**Guide d'obtention détaillé:**

**Étape 1 : Accéder au site Google AI Studio**
1. Ouvrir votre navigateur et aller sur **https://aistudio.google.com/app/apikey**
2. **Se connecter** avec votre compte Google (Gmail)
   - Si vous n'avez pas de compte Google, créer un compte Gmail d'abord

**Étape 2 : Créer une clé API**
1. Une fois connecté, vous verrez la page "Get API key"
2. Cliquer sur le bouton **"Create API Key"** (créer une clé API)
3. Une fenêtre popup s'ouvre avec deux options:
   - **"Create API key in new project"** (créer dans un nouveau projet) - **RECOMMANDÉ**
   - **"Create API key in existing project"** (créer dans un projet existant)

**Étape 3 : Sélectionner ou créer un projet**
1. Si vous choisissez **"Create API key in new project"**:
   - Un nouveau projet Google Cloud sera créé automatiquement
   - Le nom par défaut sera "My Project" ou similaire
2. Si vous choisissez **"Create API key in existing project"**:
   - Sélectionner un projet existant dans la liste déroulante
   - Ou créer un nouveau projet en cliquant sur **"New Project"**

**Étape 4 : Copier la clé API**
1. Une fois le projet sélectionné, la clé API est générée automatiquement
2. La clé commence par `AIzaSy` suivi d'une longue chaîne de caractères
3. **Copier immédiatement** la clé complète
4. **Coller dans un endroit sûr**
5. Cliquer sur **"Done"** (terminé) ou fermer la popup

**Étape 5 : Activer l'API Generative Language API (IMPORTANT)**
1. Aller sur **https://console.cloud.google.com/**
2. Sélectionner le **même projet** que celui utilisé pour créer la clé API
3. Dans la barre de recherche en haut, taper **"Generative Language API"**
4. Cliquer sur **"Generative Language API"** dans les résultats
5. Cliquer sur le bouton **"Enable"** (activer) si l'API n'est pas encore activée
6. Attendre quelques secondes que l'activation soit complète

**⚠️ IMPORTANT:** Sans activer cette API, votre clé ne fonctionnera pas!

**Exemple de clé générée:**
```
AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Usage dans le code:**
- `backend/src/services/app_ia.rs` - Modèle: `gemini-pro-vision`
- Timeout: **120 secondes** pour génération vidéo complète

**Exemple:**
```env
GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 4. MISTRAL_API_KEY

**📍 Backend**

**Description:** Clé API Mistral AI pour génération de contenu (scripts, descriptions)

**Guide d'obtention détaillé:**

**Étape 1 : Accéder au site Mistral AI**
1. Ouvrir votre navigateur et aller sur **https://console.mistral.ai/**
2. Cliquer sur **"Sign Up"** (s'inscrire) ou **"Log In"** (se connecter)
3. Si vous n'avez pas de compte:
   - Entrer votre email
   - Créer un mot de passe
   - Vérifier votre email
4. Si vous avez déjà un compte, se connecter

**Étape 2 : Accéder aux clés API**
1. Une fois connecté, aller sur **https://console.mistral.ai/api-keys**
   - Ou cliquer sur **"API Keys"** dans le menu de navigation
2. Vous verrez la liste de vos clés API existantes (si vous en avez)

**Étape 3 : Créer une nouvelle clé API**
1. Cliquer sur le bouton **"+ Create API Key"** (créer une clé API)
2. Une fenêtre popup ou une nouvelle page s'ouvre
3. **Nommer la clé** (ex: "Yukpo Video Mistral" ou "Yukpomnang Backend")
4. Cliquer sur **"Create"** (créer) ou **"Generate"** (générer)

**Étape 4 : Récupérer la clé API**
1. La clé API est générée et affichée
2. **⚠️ CRITIQUE:** La clé s'affiche UNE SEULE FOIS
3. **Copier immédiatement** la clé API complète
4. **Coller dans un endroit sûr**
5. Cliquer sur **"Done"** (terminé) ou fermer la popup

**Étape 5 : Ajouter des crédits (si nécessaire)**
1. Aller dans **"Billing"** (facturation) dans le menu
2. Ajouter un moyen de paiement si nécessaire
3. Les crédits sont généralement nécessaires pour utiliser l'API

**Usage dans le code:**
- `backend/src/services/app_ia.rs` - Modèles: `mistral-large`, `mistral-medium`
- Timeout: **120 secondes** pour génération vidéo complète

**Exemple:**
```env
MISTRAL_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 5. DEEPSEEK_API_KEY

**📍 Backend**

**Description:** Clé API DeepSeek pour analyse et génération de contenu

**Guide d'obtention détaillé:**

**Étape 1 : Accéder au site DeepSeek**
1. Ouvrir votre navigateur et aller sur **https://platform.deepseek.com/**
2. Cliquer sur **"Sign Up"** (s'inscrire) ou **"Log In"** (se connecter)
3. Si vous n'avez pas de compte:
   - Entrer votre email
   - Créer un mot de passe
   - Vérifier votre email
4. Si vous avez déjà un compte, se connecter

**Étape 2 : Accéder aux clés API**
1. Une fois connecté, aller sur **https://platform.deepseek.com/api_keys**
   - Ou cliquer sur **"API Keys"** dans le menu de navigation
2. Vous verrez la liste de vos clés API existantes (si vous en avez)

**Étape 3 : Créer une nouvelle clé API**
1. Cliquer sur le bouton **"+ Create API Key"** (créer une clé API) ou **"New API Key"**
2. Une fenêtre popup ou une nouvelle page s'ouvre
3. **Nommer la clé** (ex: "Yukpo Video DeepSeek" ou "Yukpomnang Backend")
4. Cliquer sur **"Create"** (créer) ou **"Generate"** (générer)

**Étape 4 : Récupérer la clé API**
1. La clé API est générée et affichée
2. La clé commence généralement par `sk-` suivi d'une longue chaîne
3. **⚠️ CRITIQUE:** La clé s'affiche UNE SEULE FOIS
4. **Copier immédiatement** la clé API complète
5. **Coller dans un endroit sûr**
6. Cliquer sur **"Done"** (terminé) ou fermer la popup

**Étape 5 : Ajouter des crédits (si nécessaire)**
1. Aller dans **"Billing"** (facturation) dans le menu
2. Ajouter un moyen de paiement si nécessaire
3. Les crédits sont généralement nécessaires pour utiliser l'API

**Usage dans le code:**
- `backend/src/services/app_ia.rs` - Modèle: `deepseek-chat`
- Timeout: **120 secondes** pour génération vidéo complète

**Exemple:**
```env
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 6. COHERE_API_KEY

**📍 Backend**

**Description:** Clé API Cohere pour génération de texte et analyse

**Guide d'obtention détaillé:**

**Étape 1 : Accéder au site Cohere**
1. Ouvrir votre navigateur et aller sur **https://dashboard.cohere.com/**
2. Cliquer sur **"Sign Up"** (s'inscrire) ou **"Log In"** (se connecter)
3. Si vous n'avez pas de compte:
   - Entrer votre email
   - Créer un mot de passe
   - Vérifier votre email
4. Si vous avez déjà un compte, se connecter

**Étape 2 : Accéder aux clés API**
1. Une fois connecté, aller sur **https://dashboard.cohere.com/api-keys**
   - Ou cliquer sur **"API Keys"** dans le menu de navigation
2. Vous verrez la liste de vos clés API existantes (si vous en avez)

**Étape 3 : Créer une nouvelle clé API**
1. Cliquer sur le bouton **"+ Create API Key"** (créer une clé API) ou **"New API Key"**
2. Une fenêtre popup ou une nouvelle page s'ouvre
3. **Nommer la clé** (ex: "Yukpo Video Cohere" ou "Yukpomnang Backend")
4. Cliquer sur **"Create"** (créer) ou **"Generate"** (générer)

**Étape 4 : Récupérer la clé API**
1. La clé API est générée et affichée
2. **⚠️ CRITIQUE:** La clé s'affiche UNE SEULE FOIS
3. **Copier immédiatement** la clé API complète
4. **Coller dans un endroit sûr**
5. Cliquer sur **"Done"** (terminé) ou fermer la popup

**Étape 5 : Ajouter des crédits (si nécessaire)**
1. Aller dans **"Billing"** (facturation) dans le menu
2. Ajouter un moyen de paiement si nécessaire
3. Les crédits sont généralement nécessaires pour utiliser l'API

**Usage dans le code:**
- `backend/src/services/app_ia.rs` - Modèle: `cohere-command`
- Timeout: **120 secondes** pour génération vidéo complète

**Exemple:**
```env
COHERE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 7. OLLAMA_BASE_URL (Optionnel)

**📍 Backend**

**Description:** URL de base pour Ollama (IA locale, optionnel)

**Guide d'obtention:**
1. **Installer Ollama:** https://ollama.ai/download
2. **Démarrer Ollama** localement
3. **URL par défaut:** `http://localhost:11434`
4. **Pour production:** Configurer un serveur Ollama dédié

**Usage dans le code:**
- `backend/src/services/app_ia.rs` - Modèles: `ollama-mistral`, `ollama-llama2`
- Timeout: **120 secondes** pour génération vidéo complète

**Exemple:**
```env
OLLAMA_BASE_URL=http://localhost:11434
```

---

## 🎨 VARIABLES IA GÉNÉRATIVE (Backend)

### 📊 RÉSUMÉ: Clés API pour IA Générative

**Question fréquente:** "Est-ce que j'ai besoin de clés séparées pour générer des sons, vidéos, etc.?"

**Réponse:** Ça dépend du type de contenu généré!

| Type de contenu | Clé API utilisée | Même que OpenAI? |
|----------------|------------------|------------------|
| **Texte (GPT)** | `OPENAI_API_KEY` | ✅ OUI - C'est la même |
| **Images (DALL-E)** | `OPENAI_API_KEY` | ✅ OUI - C'est la même |
| **Transcription audio (Whisper)** | `OPENAI_API_KEY` | ✅ OUI - C'est la même |
| **Génération vidéo (Sora)** | `OPENAI_API_KEY` ou `SORA_API_KEY` | ⚠️ Peut utiliser la même OU clé séparée |
| **Génération vidéo (Runway)** | `RUNWAY_API_KEY` | ❌ NON - Clé séparée requise |
| **Génération vidéo (Pika)** | `PIKA_API_KEY` | ❌ NON - Clé séparée requise |
| **Text-to-Speech (TTS)** | `PREMIUM_TTS_API_KEY` | ❌ NON - Clé séparée requise |
| **Génération audio/sons** | `PREMIUM_AUDIO_API_KEY` | ❌ NON - Clé séparée requise |

**💡 En résumé:**
- ✅ **OpenAI (GPT, Whisper, DALL-E, Sora)** → **UNE SEULE clé** (`OPENAI_API_KEY`) pour tout!
- ❌ **Runway, Pika, TTS, Audio** → **Clés séparées** nécessaires

---

### 🎬 Génération Vidéo IA

#### RUNWAY_API_KEY & RUNWAY_API_URL

**📍 Backend**

**Description:** Clé API Runway ML pour génération vidéo à partir de texte

**Guide d'obtention détaillé:**

**Étape 1 : Accéder au site Runway ML**
1. Ouvrir votre navigateur et aller sur **https://runwayml.com/**
2. Cliquer sur **"Sign Up"** (s'inscrire) ou **"Log In"** (se connecter) en haut à droite
3. Si vous n'avez pas de compte:
   - Entrer votre email
   - Créer un mot de passe
   - Vérifier votre email
4. Si vous avez déjà un compte, se connecter

**Étape 2 : Accéder aux paramètres**
1. Une fois connecté, cliquer sur votre **avatar/icône de profil** en haut à droite
2. Dans le menu déroulant, cliquer sur **"Settings"** (paramètres)
3. Ou aller directement sur **https://runwayml.com/settings**

**Étape 3 : Créer une clé API**
1. Dans les paramètres, chercher la section **"API Keys"** ou **"API Access"**
2. Cliquer sur **"Create API Key"** (créer une clé API) ou **"Generate New Key"**
3. **Nommer la clé** (ex: "Yukpo Video Editor")
4. Cliquer sur **"Create"** (créer) ou **"Generate"** (générer)

**Étape 4 : Récupérer la clé API**
1. La clé API est générée et affichée
2. **⚠️ IMPORTANT:** La clé s'affiche généralement UNE SEULE FOIS
3. **Copier immédiatement** la clé API complète
4. **Coller dans un endroit sûr**

**Étape 5 : Comprendre les limites**
- Runway ML propose généralement un plan gratuit avec des crédits limités
- Pour usage en production, vérifier les tarifs sur le site

**Exemple:**
```env
RUNWAY_API_URL=https://api.runwayml.com/v1
RUNWAY_API_KEY=your-runway-api-key-here
```

---

#### PIKA_API_KEY & PIKA_API_URL

**📍 Backend**

**Description:** Clé API Pika Labs pour génération vidéo courte

**Guide d'obtention détaillé:**

**Étape 1 : Accéder au site Pika Labs**
1. Ouvrir votre navigateur et aller sur **https://pika.art/**
2. Cliquer sur **"Sign Up"** (s'inscrire) ou **"Log In"** (se connecter)
3. Si vous n'avez pas de compte:
   - Entrer votre email
   - Créer un mot de passe
   - Vérifier votre email
4. Si vous avez déjà un compte, se connecter

**Étape 2 : Accéder aux paramètres API**
1. Une fois connecté, cliquer sur votre **avatar/icône de profil** en haut à droite
2. Dans le menu, cliquer sur **"Settings"** (paramètres)
3. Chercher la section **"API"** ou **"API Keys"**

**Étape 3 : Créer une clé API**
1. Dans la section API, cliquer sur **"Create API Key"** (créer une clé API)
2. **Nommer la clé** (ex: "Yukpo Video Editor")
3. Cliquer sur **"Create"** (créer) ou **"Generate"** (générer)

**Étape 4 : Récupérer la clé API**
1. La clé API est générée et affichée
2. **⚠️ IMPORTANT:** La clé s'affiche généralement UNE SEULE FOIS
3. **Copier immédiatement** la clé API complète
4. **Coller dans un endroit sûr**

**Étape 5 : Comprendre les limites**
- Pika Labs propose généralement un plan gratuit avec des crédits limités
- Pour usage en production, vérifier les tarifs sur le site

**Exemple:**
```env
PIKA_API_URL=https://api.pika.art/v1
PIKA_API_KEY=your-pika-api-key-here
```

---

#### SORA_API_KEY & SORA_API_URL

**📍 Backend**

**Description:** Clé API Sora (OpenAI) pour génération vidéo

**⚠️ IMPORTANT - Vérification du code:**

D'après le code source (`backend/src/services/generative_video_service.rs` et `backend/src/config/broll_config.rs`), le code utilise **explicitement** `SORA_API_KEY` et `SORA_API_URL`.

**Le code actuel nécessite:**
- `SORA_API_URL` - URL de l'API Sora
- `SORA_API_KEY` - Clé API pour Sora

**💡 Note technique:**
- Sora est un produit OpenAI, donc vous pouvez utiliser la **même clé** que `OPENAI_API_KEY`
- Mais le code actuel **ne fait pas de fallback automatique** vers `OPENAI_API_KEY`
- Vous devez donc configurer `SORA_API_KEY` explicitement (même si c'est la même valeur que `OPENAI_API_KEY`)

**Exemple (recommandé):**
```env
# Utiliser la même clé OpenAI pour Sora
SORA_API_URL=https://api.openai.com/v1/video/generations
SORA_API_KEY=sk-proj-...  # Même valeur que OPENAI_API_KEY
```

**Exemple (clé séparée si vous préférez):**
```env
SORA_API_URL=https://api.openai.com/v1/video/generations
SORA_API_KEY=sk-proj-...  # Clé différente de OPENAI_API_KEY (optionnel)
```

**📝 Code source:**
- `backend/src/services/generative_video_service.rs:259-266` - Utilise `SORA_API_KEY`
- `backend/src/config/broll_config.rs:52-53` - Lit `SORA_API_KEY` depuis l'environnement

---

### 🎤 Text-to-Speech (TTS) & Audio

#### PREMIUM_TTS_API_KEY & PREMIUM_TTS_ENDPOINT

**📍 Backend**

**Description:** Clé API pour service TTS premium (ElevenLabs, etc.) pour générer de la voix à partir de texte

**Guide d'obtention détaillé:**

**Étape 1 : Accéder au site ElevenLabs**
1. Ouvrir votre navigateur et aller sur **https://elevenlabs.io/**
2. Cliquer sur **"Sign Up"** (s'inscrire) ou **"Log In"** (se connecter) en haut à droite
3. Si vous n'avez pas de compte:
   - Entrer votre email
   - Créer un mot de passe
   - Vérifier votre email
4. Si vous avez déjà un compte, se connecter

**Étape 2 : Accéder au profil**
1. Une fois connecté, cliquer sur votre **avatar/icône de profil** en haut à droite
2. Dans le menu déroulant, cliquer sur **"Profile"** (profil)
3. Ou aller directement sur **https://elevenlabs.io/app/settings/api-keys**

**Étape 3 : Créer une clé API**
1. Dans la page du profil, chercher la section **"API Keys"** (clés API)
2. Cliquer sur **"Create API Key"** (créer une clé API) ou **"+ Add API Key"**
3. **Nommer la clé** (ex: "Yukpo Video TTS")
4. Cliquer sur **"Create"** (créer) ou **"Generate"** (générer)

**Étape 4 : Récupérer la clé API**
1. La clé API est générée et affichée
2. **⚠️ IMPORTANT:** La clé s'affiche généralement UNE SEULE FOIS
3. **Copier immédiatement** la clé API complète
4. **Coller dans un endroit sûr**
5. Cliquer sur **"Done"** (terminé) ou fermer la popup

**Étape 5 : Comprendre les limites**
- ElevenLabs propose généralement un plan gratuit avec des caractères limités par mois
- Pour usage en production, vérifier les tarifs sur le site

**Exemple:**
```env
PREMIUM_TTS_ENDPOINT=https://api.elevenlabs.io/v1/text-to-speech
PREMIUM_TTS_API_KEY=your-elevenlabs-api-key
PREMIUM_TTS_VOICE=yukpo-premium-fr
```

---

#### PREMIUM_AUDIO_API_KEY & PREMIUM_AUDIO_ENDPOINT

**📍 Backend**

**Description:** Clé API pour génération audio/sons (Dolby, AudioShake, etc.)

**Guide d'obtention:**
1. **Dolby.io:** https://dolby.io/
2. **Créer un compte**
3. **Aller dans:** API Keys
4. **Créer une clé API**
5. **Copier la clé**

**Exemple:**
```env
PREMIUM_AUDIO_ENDPOINT=https://api.dolby.io/v1/audio
PREMIUM_AUDIO_API_KEY=your-dolby-api-key
```

---

**📝 Note:** Ces clés sont **optionnelles**. Si vous ne les configurez pas, l'application utilisera des alternatives gratuites ou des fallbacks.

---

### 🎵 Transcription Audio (Whisper)

#### OPENAI_API_KEY (pour Whisper)

**📍 Backend**

**Description:** Clé API OpenAI utilisée pour la transcription audio via Whisper API

**Usage dans le code:**
- `backend/src/services/audio_transcription_service.rs` - Transcription audio → texte
- Utilise le modèle `whisper-1` d'OpenAI
- Format: `audio/m4a`, `audio/mp3`, `audio/wav`, etc.

**Exemple:**
```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**💡 Note:** C'est la **même clé** que pour GPT-4, DALL-E, etc. Vous n'avez pas besoin d'une clé séparée pour Whisper.

**⚠️ IMPORTANT:** Si `OPENAI_API_KEY` n'est pas configurée, le service retourne un message par défaut `[Audio non transcrit - API non configurée]`. Il n'y a **pas de fallback vers Hugging Face** implémenté dans le code actuel.

---

### 🎚️ Audio Premium (Mastering & Enhancement)

#### PREMIUM_AUDIO_ENABLED

**📍 Backend**

**Description:** Activer/désactiver les services audio premium (Dolby, AudioShake, Auphonic)

**Valeurs:**
- `true` - Activer les services premium
- `false` - Désactiver (utiliser mastering local avec ffmpeg)

**Exemple:**
```env
PREMIUM_AUDIO_ENABLED=true
```

---

#### PREMIUM_AUDIO_PROVIDER

**📍 Backend**

**Description:** Choisir le provider audio premium à utiliser

**Valeurs possibles:**
- `dolby` - Dolby.io (recommandé pour qualité professionnelle)
- `audioshake` - AudioShake (pour séparation de stems)
- `auphonic` - Auphonic (pour mastering automatique)
- `dual` - Mode dual (essaye Dolby, puis Auphonic, puis AudioShake en fallback)

**Exemple:**
```env
PREMIUM_AUDIO_PROVIDER=dolby
```

---

#### PREMIUM_AUDIO_TIMEOUT_SECS

**📍 Backend**

**Description:** Timeout pour les jobs de mastering audio premium (en secondes)

**Valeur par défaut:** `900` (15 minutes)

**Exemple:**
```env
PREMIUM_AUDIO_TIMEOUT_SECS=900
```

---

#### PREMIUM_AUDIO_MAX_RETRIES

**📍 Backend**

**Description:** Nombre maximum de tentatives en cas d'échec d'un job audio premium

**Valeur par défaut:** `3`

**Exemple:**
```env
PREMIUM_AUDIO_MAX_RETRIES=3
```

---

#### PREMIUM_AUDIO_WEBHOOK_SECRET

**📍 Backend**

**Description:** Secret pour valider les webhooks des providers audio premium

**Exemple:**
```env
PREMIUM_AUDIO_WEBHOOK_SECRET=your-webhook-secret-here
```

---

#### PREMIUM_AUDIO_STORAGE_PREFIX

**📍 Backend**

**Description:** Préfixe pour le stockage des fichiers audio masterisés

**Valeur par défaut:** `services/audio/masters`

**Exemple:**
```env
PREMIUM_AUDIO_STORAGE_PREFIX=services/audio/masters
```

---

#### PREMIUM_AUDIO_KEEP_LOCAL_COPY

**📍 Backend**

**Description:** Conserver une copie locale des fichiers audio après upload vers le stockage cloud

**Valeurs:**
- `true` - Conserver la copie locale
- `false` - Supprimer après upload (recommandé pour économiser l'espace)

**Exemple:**
```env
PREMIUM_AUDIO_KEEP_LOCAL_COPY=false
```

---

### 🎧 Dolby.io Configuration

#### DOLBY_API_KEY

**📍 Backend**

**Description:** Clé API Dolby.io pour mastering audio professionnel

**Guide d'obtention détaillé:**

**Étape 1 : Accéder au site Dolby.io**
1. Ouvrir votre navigateur et aller sur **https://dolby.io/**
2. Cliquer sur **"Sign Up"** (s'inscrire) ou **"Log In"** (se connecter) en haut à droite
3. Si vous n'avez pas de compte:
   - Entrer votre email
   - Créer un mot de passe
   - Vérifier votre email
4. Si vous avez déjà un compte, se connecter

**Étape 2 : Accéder au Dashboard**
1. Une fois connecté, cliquer sur **"Dashboard"** dans le menu principal
2. Ou aller directement sur **https://dolby.io/dashboard**

**Étape 3 : Créer des clés API**
1. Dans le Dashboard, aller dans la section **"API Keys"** ou **"Credentials"**
2. Cliquer sur **"Create API Key"** (créer une clé API) ou **"Generate New Key"**
3. Une fenêtre popup s'ouvre

**Étape 4 : Récupérer l'API Key et API Secret**
1. Dolby.io génère **deux valeurs**:
   - **API Key** (clé API) - commence généralement par des lettres/chiffres
   - **API Secret** (secret API) - une longue chaîne de caractères
2. **⚠️ CRITIQUE:** Ces valeurs s'affichent UNE SEULE FOIS
3. **Copier immédiatement** les deux valeurs
4. **Coller dans un endroit sûr**
5. Cliquer sur **"Done"** (terminé) ou fermer la popup

**Étape 5 : Ajouter un moyen de paiement (si nécessaire)**
1. Pour utiliser l'API Dolby.io, vous devrez peut-être ajouter un moyen de paiement
2. Aller dans **"Billing"** (facturation) dans le Dashboard
3. Ajouter une carte bancaire si demandé

**Exemple:**
```env
DOLBY_API_KEY=your-dolby-api-key-here
```

---

#### DOLBY_API_SECRET

**📍 Backend**

**Description:** Secret API Dolby.io (nécessaire avec DOLBY_API_KEY)

**Guide d'obtention détaillé:**

**⚠️ IMPORTANT:** Le **DOLBY_API_SECRET** est généré en même temps que le **DOLBY_API_KEY** lors de la création des credentials Dolby.io.

**Étapes:**
1. Voir le guide **DOLBY_API_KEY** ci-dessus
2. Lors de la création des credentials, Dolby.io génère **automatiquement** les deux valeurs:
   - **API Key** → `DOLBY_API_KEY`
   - **API Secret** → `DOLBY_API_SECRET`
3. **Copier les deux valeurs** en même temps
4. **⚠️ CRITIQUE:** Si vous fermez la popup sans copier le Secret, vous devrez régénérer les credentials

**Exemple:**
```env
DOLBY_API_SECRET=your-dolby-api-secret-here
```

---

#### DOLBY_BASE_URL

**📍 Backend**

**Description:** URL de base de l'API Dolby.io

**Valeur par défaut:** `https://api.dolby.com`

**Exemple:**
```env
DOLBY_BASE_URL=https://api.dolby.com
```

---

#### DOLBY_ENHANCE_PRESET

**📍 Backend**

**Description:** Preset de mastering Dolby à utiliser

**Valeurs possibles:**
- `music` - Pour musique (défaut)
- `speech` - Pour voix/parole
- `podcast` - Pour podcasts

**Exemple:**
```env
DOLBY_ENHANCE_PRESET=music
```

---

#### DOLBY_WEBHOOK_SIGNATURE_SECRET

**📍 Backend**

**Description:** Secret pour valider les webhooks Dolby.io

**Exemple:**
```env
DOLBY_WEBHOOK_SIGNATURE_SECRET=your-dolby-webhook-secret
```

---

### 🎼 AudioShake Configuration

#### AUDIOSHAKE_API_KEY

**📍 Backend**

**Description:** Clé API AudioShake pour séparation de stems audio (vocals, drums, bass, etc.)

**Guide d'obtention détaillé:**

**Étape 1 : Accéder au site AudioShake**
1. Ouvrir votre navigateur et aller sur **https://www.audioshake.ai/**
2. Cliquer sur **"Sign Up"** (s'inscrire) ou **"Get Started"** (commencer)
3. Si vous n'avez pas de compte:
   - Entrer votre email
   - Créer un mot de passe
   - Vérifier votre email
4. Si vous avez déjà un compte, cliquer sur **"Log In"** (se connecter)

**Étape 2 : Accéder à la section API**
1. Une fois connecté, aller dans votre **Dashboard** ou **Account Settings** (paramètres du compte)
2. Chercher la section **"API Keys"** ou **"API Access"**
3. Si vous ne voyez pas cette section, contacter le support AudioShake

**Étape 3 : Créer une clé API**
1. Cliquer sur **"Create API Key"** (créer une clé API) ou **"Generate New Key"**
2. Une fenêtre popup ou une nouvelle page s'ouvre
3. **Nommer la clé** (ex: "Yukpo Video Editor")

**Étape 4 : Récupérer la clé API**
1. La clé API est générée et affichée
2. **⚠️ IMPORTANT:** La clé s'affiche généralement UNE SEULE FOIS
3. **Copier immédiatement** la clé API complète
4. **Coller dans un endroit sûr**

**Étape 5 : Comprendre les limites**
- AudioShake propose généralement un plan gratuit limité pour tester
- Pour usage en production, vérifier les tarifs sur le site

**Exemple:**
```env
AUDIOSHAKE_API_KEY=your-audioshake-api-key-here
```

---

#### AUDIOSHAKE_BASE_URL

**📍 Backend**

**Description:** URL de base de l'API AudioShake

**Valeur par défaut:** `https://api.audioshake.ai`

**Exemple:**
```env
AUDIOSHAKE_BASE_URL=https://api.audioshake.ai
```

---

#### AUDIOSHAKE_ENABLE_STEMS

**📍 Backend**

**Description:** Activer la séparation de stems (vocals, drums, bass, etc.)

**Valeurs:**
- `true` - Activer la séparation de stems
- `false` - Désactiver (défaut)

**Exemple:**
```env
AUDIOSHAKE_ENABLE_STEMS=true
```

---

#### AUDIOSHAKE_STEMS

**📍 Backend**

**Description:** Liste des stems à extraire (séparés par virgule)

**Valeurs possibles:** `vocals`, `drums`, `bass`, `piano`, `guitar`, etc.

**Valeur par défaut:** `vocals`

**Exemple:**
```env
AUDIOSHAKE_STEMS=vocals,drums,bass
```

---

#### AUDIOSHAKE_WEBHOOK_SECRET

**📍 Backend**

**Description:** Secret pour valider les webhooks AudioShake

**Exemple:**
```env
AUDIOSHAKE_WEBHOOK_SECRET=your-audioshake-webhook-secret
```

---

### 🎙️ Auphonic Configuration

#### AUPHONIC_USERNAME

**📍 Backend**

**Description:** Nom d'utilisateur Auphonic (celui que vous utilisez pour vous connecter)

**Guide d'obtention détaillé:**

**Étape 1 : Créer un compte Auphonic**
1. Ouvrir votre navigateur et aller sur **https://auphonic.com/**
2. Cliquer sur **"Sign Up"** (s'inscrire) ou **"Register"** (s'enregistrer)
3. Remplir le formulaire:
   - Entrer votre email
   - Créer un nom d'utilisateur (c'est votre `AUPHONIC_USERNAME`)
   - Créer un mot de passe
   - Vérifier votre email

**Étape 2 : Récupérer votre nom d'utilisateur**
1. Votre **nom d'utilisateur** est celui que vous avez choisi lors de l'inscription
2. C'est aussi celui que vous utilisez pour vous connecter
3. **Notez-le** car il sera utilisé comme `AUPHONIC_USERNAME`

**Exemple:**
```env
AUPHONIC_USERNAME=your-auphonic-username
```

---

#### AUPHONIC_API_KEY

**📍 Backend**

**Description:** Clé API Auphonic pour mastering automatique

**Guide d'obtention détaillé:**

**Étape 1 : Se connecter à Auphonic**
1. Aller sur **https://auphonic.com/**
2. Cliquer sur **"Log In"** (se connecter)
3. Entrer votre **nom d'utilisateur** et **mot de passe**

**Étape 2 : Accéder à la section API**
1. Une fois connecté, aller dans votre **Dashboard**
2. Dans le menu, chercher **"API"** ou **"API Access"**
3. Ou aller directement sur **https://auphonic.com/api**

**Étape 3 : Créer une clé API**
1. Dans la section API, chercher **"Create API Key"** ou **"Generate API Key"**
2. Cliquer sur le bouton pour créer une nouvelle clé
3. **Nommer la clé** (ex: "Yukpo Video Editor")

**Étape 4 : Récupérer la clé API**
1. La clé API est générée et affichée
2. **⚠️ IMPORTANT:** La clé s'affiche généralement UNE SEULE FOIS
3. **Copier immédiatement** la clé API complète
4. **Coller dans un endroit sûr**

**Exemple:**
```env
AUPHONIC_API_KEY=your-auphonic-api-key-here
```

---

#### AUPHONIC_BASE_URL

**📍 Backend**

**Description:** URL de base de l'API Auphonic

**Valeur par défaut:** `https://api.auphonic.com`

**Exemple:**
```env
AUPHONIC_BASE_URL=https://api.auphonic.com
```

---

#### AUPHONIC_PRESET

**📍 Backend**

**Description:** Preset Auphonic à utiliser pour le mastering

**Exemple:**
```env
AUPHONIC_PRESET=your-preset-name
```

---

#### AUPHONIC_OUTPUT_FORMAT

**📍 Backend**

**Description:** Format de sortie audio (wav, mp3, etc.)

**Exemple:**
```env
AUPHONIC_OUTPUT_FORMAT=wav
```

---

#### AUPHONIC_WEBHOOK_SECRET

**📍 Backend**

**Description:** Secret pour valider les webhooks Auphonic

**Exemple:**
```env
AUPHONIC_WEBHOOK_SECRET=your-auphonic-webhook-secret
```

---

#### AUPHONIC_POLL_INTERVAL_SECS

**📍 Backend**

**Description:** Intervalle de polling pour vérifier le statut des jobs Auphonic (en secondes)

**Valeur par défaut:** `5`

**Exemple:**
```env
AUPHONIC_POLL_INTERVAL_SECS=5
```

---

### 🎬 YouTube (OAuth pour upload vidéos - PAS pour audio)

#### YOUTUBE_CLIENT_ID

**📍 Backend**

**Description:** Client ID YouTube OAuth pour upload de vidéos (utilisé dans `social_connector_controller.rs`)

**⚠️ IMPORTANT:** Cette variable est pour l'authentification OAuth YouTube (upload de vidéos), **PAS pour l'audio**.

**Guide d'obtention détaillé:**

**Étape 1 : Accéder à Google Cloud Console**
1. Ouvrir votre navigateur et aller sur **https://console.cloud.google.com/**
2. **Se connecter** avec votre compte Google (Gmail)
   - Si vous n'avez pas de compte Google, créer un compte Gmail d'abord

**Étape 2 : Créer ou sélectionner un projet**
1. En haut de la page, à côté de "Google Cloud", cliquer sur le **sélecteur de projet**
2. Cliquer sur **"New Project"** (nouveau projet)
3. Remplir le formulaire:
   - **Project name:** "Yukpomnang" ou "Yukpo Video"
   - **Organization (optionnel):** Laisser par défaut
   - **Location (optionnel):** Laisser par défaut
4. Cliquer sur **"Create"** (créer)
5. Attendre quelques secondes que le projet soit créé
6. **Sélectionner le projet** dans le sélecteur en haut

**Étape 3 : Activer l'API YouTube Data API v3**
1. Dans la barre de recherche en haut, taper **"YouTube Data API v3"**
2. Cliquer sur **"YouTube Data API v3"** dans les résultats
3. Cliquer sur le bouton **"Enable"** (activer)
4. Attendre quelques secondes que l'API soit activée
5. **⚠️ IMPORTANT:** Sans activer cette API, votre OAuth ne fonctionnera pas!

**Étape 4 : Configurer l'écran de consentement OAuth**
1. Aller dans **"APIs & Services"** → **"OAuth consent screen"** dans le menu de gauche
2. Sélectionner **"External"** (externe) pour la plupart des cas
3. Cliquer sur **"Create"** (créer)
4. Remplir le formulaire:
   - **App name:** "Yukpomnang Video Editor"
   - **User support email:** Votre email
   - **Developer contact information:** Votre email
5. Cliquer sur **"Save and Continue"** (enregistrer et continuer)
6. Dans **"Scopes"**, cliquer sur **"Add or Remove Scopes"**
   - Cocher: `https://www.googleapis.com/auth/youtube.upload`
   - Cocher: `https://www.googleapis.com/auth/youtube.force-ssl`
7. Cliquer sur **"Update"** puis **"Save and Continue"**
8. Dans **"Test users"** (utilisateurs de test), ajouter votre email si nécessaire
9. Cliquer sur **"Save and Continue"** puis **"Back to Dashboard"**

**Étape 5 : Créer les credentials OAuth 2.0**
1. Aller dans **"APIs & Services"** → **"Credentials"** dans le menu de gauche
2. Cliquer sur **"+ Create Credentials"** (créer des credentials)
3. Sélectionner **"OAuth client ID"** dans le menu déroulant
4. Si c'est la première fois, vous devrez configurer l'écran de consentement (voir étape 4)

**Étape 6 : Configurer le Client OAuth**
1. **Application type:** Sélectionner **"Web application"** (application web)
2. **Name:** Entrer un nom (ex: "Yukpomnang YouTube OAuth")
3. **Authorized redirect URIs:** Ajouter:
   - `https://yukpomnang.onrender.com/api/social/youtube/callback`
   - Pour développement local: `http://localhost:3001/api/social/youtube/callback`
4. Cliquer sur **"Create"** (créer)

**Étape 7 : Récupérer le Client ID et Client Secret**
1. Une fenêtre popup s'ouvre avec:
   - **Your Client ID:** Une longue chaîne se terminant par `.apps.googleusercontent.com`
   - **Your Client Secret:** Une chaîne commençant par `GOCSPX-`
2. **⚠️ CRITIQUE:** Ces valeurs s'affichent UNE SEULE FOIS
3. **Copier immédiatement** les deux valeurs
4. **Coller dans un endroit sûr**
5. Cliquer sur **"OK"** (d'accord)

**Exemple de Client ID:**
```
123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
```

**Exemple de Client Secret:**
```
GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Exemple:**
```env
YOUTUBE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
```

---

#### YOUTUBE_CLIENT_SECRET

**📍 Backend**

**Description:** Client Secret YouTube OAuth (utilisé avec YOUTUBE_CLIENT_ID)

**Guide d'obtention détaillé:**

**⚠️ IMPORTANT:** Le **YOUTUBE_CLIENT_SECRET** est généré en même temps que le **YOUTUBE_CLIENT_ID** lors de la création des credentials OAuth dans Google Cloud Console.

**Étapes:**
1. Voir le guide **YOUTUBE_CLIENT_ID** ci-dessus (Étape 7)
2. Lors de la création du Client OAuth, Google génère **automatiquement** les deux valeurs:
   - **Client ID** → `YOUTUBE_CLIENT_ID`
   - **Client Secret** → `YOUTUBE_CLIENT_SECRET`
3. **Copier les deux valeurs** en même temps depuis la popup
4. **⚠️ CRITIQUE:** Si vous fermez la popup sans copier le Secret, vous devrez créer un nouveau Client OAuth

**Exemple:**
```env
YOUTUBE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

#### YOUTUBE_REDIRECT_URI

**📍 Backend**

**Description:** URI de redirection pour OAuth YouTube

**Exemple:**
```env
YOUTUBE_REDIRECT_URI=https://yukpomnang.onrender.com/api/social/youtube/callback
```

**📝 Note YouTube Audio:** Le service `youtube_audio_service.rs` accepte un `api_key` optionnel mais **ne l'utilise pas réellement** - il utilise une bibliothèque statique de tracks. Aucune variable d'environnement n'est nécessaire pour l'audio YouTube actuellement.

---

### 🎵 Spotify (Service activé - Variables d'environnement requises)

**📍 Backend**

**Description:** Clés API Spotify pour rechercher et intégrer de la musique dans les vidéos

**✅ STATUT:** Le service est maintenant **activé** dans le code (`backend/src/state.rs`). Les variables d'environnement sont lues automatiquement au démarrage.

**Guide d'obtention détaillé:**

**Étape 1 : Accéder au site Spotify Developer**
1. Ouvrir votre navigateur et aller sur **https://developer.spotify.com/**
2. Cliquer sur **"Log In"** (se connecter) en haut à droite
3. **Se connecter** avec votre compte Spotify
   - Si vous n'avez pas de compte Spotify, créer un compte gratuit sur **https://www.spotify.com/signup**

**Étape 2 : Créer une application**
1. Une fois connecté, aller sur **https://developer.spotify.com/dashboard**
2. Cliquer sur le bouton **"Create an app"** (créer une application)
3. Remplir le formulaire:
   - **App name:** "Yukpomnang Video Editor" (ou "Yukpo Music Integration")
   - **App description:** "Music integration for video creation platform"
   - **Website (optionnel):** https://yukpomnang.com
   - **Redirect URI (optionnel):** https://yukpomnang.onrender.com/api/spotify/callback
   - **Cocher les cases:** "I understand and agree to Spotify's Developer Terms of Service"
4. Cliquer sur **"Save"** (enregistrer)

**Étape 3 : Récupérer le Client ID et Client Secret**
1. Une fois l'application créée, vous êtes redirigé vers la page de l'application
2. Sur cette page, vous verrez:
   - **Client ID:** Une chaîne de caractères (ex: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)
   - **Client Secret:** Cliquer sur le bouton **"View client secret"** (afficher le secret client)
     - ⚠️ **ATTENTION:** Le Client Secret s'affiche UNE SEULE FOIS
     - **Copier immédiatement** le Client Secret
     - **Coller dans un endroit sûr**

**Étape 4 : Configurer les permissions (optionnel mais recommandé)**
1. Dans la page de l'application, aller dans l'onglet **"Users and Access"** (utilisateurs et accès)
2. Vous pouvez ajouter des utilisateurs qui auront accès à l'application
3. Pour un usage personnel, cette étape n'est pas nécessaire

**Étape 5 : Comprendre les limites de l'API**
- L'API Spotify utilise le **Client Credentials Flow** (pas besoin d'authentification utilisateur)
- Les tracks retournés ont des **preview URLs** (30 secondes) - pas de téléchargement complet
- Pour usage commercial, vérifier les conditions d'utilisation Spotify

**Variables à configurer:**
```env
SPOTIFY_CLIENT_ID=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
SPOTIFY_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Exemple de Client ID:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

**Exemple de Client Secret:**
```
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**📝 Note technique:** Le service utilise automatiquement ces variables au démarrage. Si les variables ne sont pas configurées, le service Spotify sera `None` et ne sera pas disponible, mais l'application continuera de fonctionner normalement.

---

## 🎬 VARIABLES STOCK MEDIA (Backend)

### 📊 COMPARAISON: Unsplash vs Pexels vs Pixabay

Votre application utilise **3 services de stock media** pour avoir le maximum de choix. Voici les différences:

| Caractéristique | **Unsplash** | **Pexels** | **Pixabay** |
|----------------|--------------|------------|-------------|
| **Type de contenu** | 📷 Photos uniquement | 📷 Photos + 🎥 **Vidéos** | 📷 Photos + 🎥 Vidéos |
| **Limite gratuite** | 50 req/heure | 200 req/heure | **5000 req/heure** ⭐ |
| **Limite payante** | 5000/heure | **Illimité** | 5000/heure (gratuit suffit!) |
| **Qualité photos** | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐ Très bon | ⭐⭐⭐ Bon |
| **Vidéos disponibles** | ❌ Non | ✅ **Oui (grande collection)** | ✅ Oui |
| **Format clé** | Access Key (Client-ID) | API Key directe | API Key directe |
| **Rôle principal** | Meilleures photos | **Vidéos de stock** | **Backup/Fallback (100x plus de quota!)** |
| **Pourquoi l'inclure?** | Qualité premium | Vidéos essentielles | **Sécurité + Grande limite** |

**💡 Pourquoi avoir les 3 services?**

1. **Unsplash** → Meilleures photos haute qualité pour images statiques
2. **Pexels** → **Vidéos de stock** (essentiel pour votre module vidéo!) + photos
3. **Pixabay** → Backup avec très grande limite (5000/heure), photos + vidéos

**Résultat:** Si un service est indisponible ou à court de quota, les autres prennent le relais automatiquement!

---

### 8. UNSPLASH_ACCESS_KEY

**📍 Backend**

**Description:** Clé d'accès Unsplash pour rechercher et utiliser des images de stock libres de droits dans vos vidéos

**🎯 Rôle technique de cette variable dans votre application:**

La variable `UNSPLASH_ACCESS_KEY` permet à votre backend de :

1. **S'authentifier auprès de l'API Unsplash**
   - Sans cette clé, le backend ne peut pas faire de requêtes à Unsplash
   - La clé est envoyée dans le header HTTP: `Authorization: Client-ID {votre_clé}`

2. **Rechercher des images de stock professionnelles**
   - Recherche par mots-clés (ex: "restaurant", "coiffure", "mécanique")
   - Filtres: orientation (paysage/portrait), couleur, taille, etc.
   - Retourne des URLs d'images haute qualité libres de droits

3. **Enrichir automatiquement les vidéos générées**
   - Quand l'IA génère une vidéo pour un service, elle peut automatiquement chercher des images Unsplash pertinentes
   - Les images sont intégrées dans la vidéo pour la rendre plus professionnelle

**🔧 Comment ça fonctionne techniquement:**

```
Utilisateur crée une vidéo
    ↓
Backend analyse le type de service
    ↓
Backend appelle StockMediaService avec UNSPLASH_ACCESS_KEY
    ↓
Service fait une requête à https://api.unsplash.com/search/photos
    ↓
Unsplash retourne des images pertinentes
    ↓
Images intégrées dans la vidéo générée
```

**📡 Endpoint API exposé:**
- `GET /api/stock-media/search?query=restaurant&provider=unsplash`
- Permet au frontend/mobile de rechercher des images directement

**Exemple concret:** Quand un utilisateur crée une vidéo pour son service de restaurant, l'IA peut automatiquement chercher et ajouter des images d'Unsplash (photos de plats, intérieur de restaurant, etc.) au lieu d'utiliser seulement les photos de l'utilisateur.

**Guide d'obtention détaillé:**

**Étape 1 : Accéder au site Unsplash Developers**
1. Ouvrir votre navigateur et aller sur **https://unsplash.com/developers**
2. Si vous n'avez pas de compte Unsplash:
   - Cliquer sur **"Join"** (rejoindre) ou **"Sign up"** (s'inscrire)
   - Créer un compte avec votre email
   - Vérifier votre email
3. Si vous avez déjà un compte, cliquer sur **"Log in"** (se connecter)

**Étape 2 : Accéder à la section Applications**
1. Une fois connecté, aller sur **https://unsplash.com/oauth/applications**
   - Ou cliquer sur votre **avatar** → **"Your apps"** (vos applications)
2. Vous verrez la liste de vos applications existantes (si vous en avez)

**Étape 3 : Créer une nouvelle application**
1. Si vous voyez **"No connected applications"** ou une liste vide:
   - Chercher le bouton **"New Application"** ou **"Create a new application"**
   - Cliquer dessus pour ouvrir le formulaire
2. Si vous avez déjà des applications:
   - Cliquer sur le bouton **"+ New Application"** (nouvelle application) en haut à droite

**Étape 4 : Remplir le formulaire**
1. **Application name:** Entrer un nom (ex: "Yukpo Video Editor" ou "Yukpomnang Video")
2. **Description:** Entrer une description (ex: "Platform for creating promotional videos with AI-powered stock media integration")
3. **Note:** Le champ "Website URL" n'apparaît plus dans le formulaire Unsplash moderne - ce n'est plus nécessaire
4. Cliquer sur **"Create application"** (créer l'application)

**Étape 5 : Récupérer l'Access Key**
1. Après création, vous êtes redirigé vers la page de votre application
2. Sur cette page, vous verrez **deux clés**:
   - **Access Key** (aussi appelée "Client ID" ou "Application ID") ⬅️ **C'EST CELLE-CI QU'IL VOUS FAUT!**
   - **Secret Key** (aussi appelée "Client Secret") - **NE PAS UTILISER** pour l'API simple
3. **Copier l'Access Key** (c'est une longue chaîne de caractères)
4. **Coller dans un endroit sûr**

**⚠️ IMPORTANT:** 
- Pour l'API Unsplash simple (recherche d'images), utilisez uniquement l'**Access Key**
- La Secret Key est uniquement utilisée pour OAuth (authentification utilisateur) que vous n'utilisez pas dans votre cas

**Étape 6 : Comprendre les limites**
- **Limite gratuite:** 50 requêtes/heure
- **Limite payante:** 5000 requêtes/heure
- Pour la production avec beaucoup d'utilisateurs, envisagez le plan payant

**Usage dans le code:**
- `backend/src/services/stock_media_service.rs` - Service de recherche d'images
- Utilisé automatiquement lors de la génération de vidéos
- Recherche multi-providers (Unsplash + Pexels + Pixabay)

**Exemple de configuration:**
```env
UNSPLASH_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**🔍 Note technique:** 
- Le code utilise cette clé avec le header `Authorization: Client-ID {votre_access_key}`
- C'est bien l'**Access Key** (pas la Secret Key) qu'il faut utiliser
- La variable d'environnement s'appelle `UNSPLASH_ACCESS_KEY` dans votre backend

---

### 9. PEXELS_API_KEY

**📍 Backend**

**Description:** Clé API Pexels pour vidéos et images libres de droits

**🔍 DIFFÉRENCE avec UNSPLASH_ACCESS_KEY:**

| Caractéristique | **Unsplash** | **Pexels** |
|----------------|--------------|------------|
| **Type de contenu** | 📷 **Photos uniquement** | 📷 Photos + 🎥 **Vidéos** |
| **Limite gratuite** | 50 requêtes/heure | **200 requêtes/heure** (4x plus!) |
| **Limite payante** | 5000/heure | **Illimité** |
| **Format clé** | Access Key (Client-ID) | API Key directe |
| **Authentification** | `Client-ID {key}` | `{key}` directement |
| **Spécialité** | Photos haute qualité | Vidéos de stock |

**💡 Pourquoi avoir les deux?**

Votre application utilise **les deux services en parallèle** pour:
- **Unsplash**: Meilleures photos pour images statiques
- **Pexels**: **Vidéos de stock** pour enrichir les vidéos + photos de backup
- **Résultat**: Plus de choix, meilleure qualité, fallback si un service est indisponible

**Guide d'obtention détaillé:**

**Étape 1 : Accéder au site Pexels API**
1. Ouvrir votre navigateur et aller sur **https://www.pexels.com/api/**
2. Si vous n'avez pas de compte Pexels:
   - Cliquer sur **"Get Started"** (commencer) ou **"Sign up"** (s'inscrire)
   - Créer un compte avec votre email
   - Vérifier votre email
3. Si vous avez déjà un compte, cliquer sur **"Log in"** (se connecter)

**Étape 2 : Créer une clé API**
1. Une fois connecté, aller sur **https://www.pexels.com/api/new/**
   - Ou cliquer sur **"Your API Key"** dans le menu
2. Vous verrez un formulaire pour créer une nouvelle clé API

**Étape 3 : Remplir le formulaire**
1. **Application name:** Entrer un nom (ex: "Yukpo Video Editor" ou "Yukpomnang Video")
2. **Website (optionnel):** Entrer votre site web (ex: https://yukpomnang.com)
3. **Description (optionnel):** Décrire l'utilisation de l'API
4. **Accepter les conditions d'utilisation** en cochant la case
5. Cliquer sur **"Create API Key"** (créer la clé API)

**Étape 4 : Récupérer la clé API**
1. Après création, la clé API s'affiche immédiatement
2. **⚠️ IMPORTANT:** La clé s'affiche UNE SEULE FOIS
3. **Copier immédiatement** la clé API complète
4. **Coller dans un endroit sûr**
5. **Note:** Pexels fournit une seule clé (contrairement à Unsplash qui fournit Access Key + Secret Key)

**Étape 5 : Comprendre les limites**
- **Limite gratuite:** 200 requêtes/heure (plus généreux qu'Unsplash)
- **Plan payant:** Illimité
- **⚠️ IMPORTANT:** Pexels est le seul qui fournit des **vidéos de stock**, donc essentiel pour votre module vidéo

**Exemple de clé générée:**
```
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Usage dans le code:**
- `backend/src/services/stock_media_service.rs`
- Endpoint: `https://api.pexels.com/v1/search`
- Recherche photos ET vidéos (contrairement à Unsplash)

**Exemple:**
```env
PEXELS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 10. PIXABAY_API_KEY

**📍 Backend**

**Description:** Clé API Pixabay pour images et vidéos libres de droits

**🎯 Pourquoi Pixabay est inclus (3ème service)?**

Pixabay a un **avantage unique** qui justifie son inclusion:

| Caractéristique | Pixabay |
|----------------|---------|
| **Limite gratuite** | **5000 requêtes/heure** ⬅️ **100x plus qu'Unsplash!** |
| **Type de contenu** | Photos + Vidéos |
| **Rôle dans l'app** | **Backup/Fallback de sécurité** |

**💡 Stratégie multi-providers dans votre code:**

Le code recherche automatiquement dans **TOUS les providers disponibles en parallèle**:

```rust
// Si Unsplash échoue ou est à court de quota → Pexels prend le relais
// Si Pexels échoue ou est à court de quota → Pixabay prend le relais
// Résultat: Plus de résultats et fiabilité maximale!
```

**Exemples de cas d'usage:**

1. **Quota épuisé:**
   - Unsplash: 50/heure épuisé ❌
   - Pexels: 200/heure épuisé ❌  
   - **Pixabay: 5000/heure disponible ✅** → Continue de fonctionner!

2. **Recherche large:**
   - L'application cherche dans les 3 services simultanément
   - Combine les résultats = **plus de choix pour l'utilisateur**

3. **Résilience:**
   - Si un service est down → les autres continuent
   - Pas d'interruption du service

**📊 Comparaison des limites gratuites:**
- Unsplash: 50/heure (limité rapidement)
- Pexels: 200/heure (bon mais limité)
- **Pixabay: 5000/heure** (pratiquement illimité pour la plupart des cas)

**Guide d'obtention détaillé:**

**Étape 1 : Accéder au site Pixabay API**
1. Ouvrir votre navigateur et aller sur **https://pixabay.com/api/docs/**
2. Si vous n'avez pas de compte Pixabay:
   - Cliquer sur **"Join"** (rejoindre) ou **"Sign up"** (s'inscrire)
   - Créer un compte gratuit avec votre email
   - Vérifier votre email
3. Si vous avez déjà un compte, cliquer sur **"Log in"** (se connecter)

**Étape 2 : Accéder à la section API**
1. Une fois connecté, aller sur **https://pixabay.com/api/docs/**
2. Chercher la section **"Get API Key"** ou **"Create API Key"**
3. Cliquer sur le bouton **"Get API Key"** ou **"Create API Key"**

**Étape 3 : Remplir le formulaire (si demandé)**
1. **Application name:** Entrer un nom (ex: "Yukpo Video Editor")
2. **Website (optionnel):** Entrer votre site web (ex: https://yukpomnang.com)
3. **Description (optionnel):** Décrire l'utilisation de l'API
4. **Accepter les conditions d'utilisation** en cochant la case
5. Cliquer sur **"Create API Key"** (créer la clé API)

**Étape 4 : Récupérer la clé API**
1. Après création, la clé API s'affiche
2. Le format de la clé est: `xxxxxxx-xxxxxxx` (deux parties séparées par un tiret)
3. **Copier immédiatement** la clé API complète
4. **Coller dans un endroit sûr**

**Étape 5 : Comprendre les limites**
- **Limite gratuite:** 5000 requêtes/heure (largement suffisant pour la plupart des cas!)
- Pas de limite payante nécessaire dans la plupart des cas
- **Recommandé** même si vous avez Unsplash + Pexels (pour la sécurité et le fallback)

**Exemple de clé générée:**
```
12345678-1234567890abcdef
```

**Usage dans le code:**
- `backend/src/services/stock_media_service.rs`
- Endpoint: `https://pixabay.com/api/`
- Recherche automatique si configuré (fallback intelligent)

**Exemple:**
```env
PIXABAY_API_KEY=12345678-1234567890abcdef
```

**🔍 Note technique:**
- Le code vérifie automatiquement si chaque provider est disponible
- Si Pixabay est configuré, il sera utilisé en parallèle avec Unsplash/Pexels
- Augmente considérablement la fiabilité et le nombre de résultats

---

## 🎨 VARIABLES BLENDER 3D (Backend)

### 11. BLENDER_PATH

**📍 Backend**

**Description:** Chemin vers l'exécutable Blender pour rendu 3D AR

**🚀 Installation automatique (RECOMMANDÉ):**

Un script PowerShell est disponible pour télécharger et installer Blender automatiquement:

```powershell
# Depuis la racine du projet
.\telecharger-installer-blender.ps1
```

Ce script va:
- ✅ Télécharger Blender 4.0 depuis le site officiel
- ✅ L'installer automatiquement
- ✅ Configurer le chemin dans `backend/.env`
- ✅ Vérifier l'installation

**📥 Installation manuelle:**

Si vous préférez installer manuellement:

1. **Télécharger Blender:** https://www.blender.org/download/
   - Version recommandée: **Blender 4.0** ou plus récente
   - Choisissez la version **Windows 64-bit**

2. **Installer Blender** sur votre système

3. **Trouver le chemin d'installation:**
   - **Windows:** `C:\Program Files\Blender Foundation\Blender 4.0\blender.exe`
   - **Linux:** `/usr/bin/blender` ou `/opt/blender/blender`
   - **macOS:** `/Applications/Blender.app/Contents/MacOS/Blender`

4. **Vérifier l'installation:**
   ```bash
   blender --version
   ```
   
   Devrait afficher quelque chose comme: `Blender 4.0.0`

**⚠️ IMPORTANT - PRODUCTION (Render/AWS/Linux):**

**Le chemin Windows NE FONCTIONNE PAS en production!**

En production (Render, AWS, etc.), les serveurs utilisent **Linux**, pas Windows. Vous devez:

### Option 1: Installer Blender dans le Dockerfile (RECOMMANDÉ)

Ajoutez dans votre `backend/Dockerfile` ou `backend/Dockerfile.cloud`:

```dockerfile
# Installer Blender pour Linux
RUN apt-get update && apt-get install -y \
    wget \
    && wget https://download.blender.org/release/Blender4.0/blender-4.0.0-linux-x64.tar.xz \
    && tar -xf blender-4.0.0-linux-x64.tar.xz \
    && mv blender-4.0.0-linux-x64 /opt/blender \
    && rm blender-4.0.0-linux-x64.tar.xz \
    && ln -s /opt/blender/blender /usr/local/bin/blender \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
```

Puis dans Render/AWS, configurez:
```env
BLENDER_PATH=/usr/local/bin/blender
```

### Option 2: Utiliser un buildpack Render avec Blender

Si vous utilisez Render, créez un fichier `render.yaml` ou ajoutez dans les build commands:

```yaml
buildCommand: |
  apt-get update && apt-get install -y wget &&
  wget https://download.blender.org/release/Blender4.0/blender-4.0.0-linux-x64.tar.xz &&
  tar -xf blender-4.0.0-linux-x64.tar.xz &&
  mv blender-4.0.0-linux-x64 /opt/blender &&
  ln -s /opt/blender/blender /usr/local/bin/blender &&
  cd backend && cargo build --release
```

### Option 3: Chemin standard Linux (si Blender est déjà installé)

Si Blender est déjà installé sur le serveur:
```env
BLENDER_PATH=/usr/bin/blender
# ou
BLENDER_PATH=/opt/blender/blender
```

**📋 Configuration selon l'environnement:**

| Environnement | Chemin BLENDER_PATH |
|---------------|---------------------|
| **Windows (local)** | `C:\Program Files\Blender Foundation\Blender 4.0\blender.exe` |
| **Linux (production)** | `/usr/local/bin/blender` ou `/opt/blender/blender` |
| **Docker** | `/usr/local/bin/blender` (après installation dans Dockerfile) |
| **Render** | `/usr/local/bin/blender` (après installation dans buildCommand) |
| **AWS EC2** | `/usr/local/bin/blender` (après installation via apt/yum) |

**Usage dans le code:**
- `backend/src/services/gpu_render_service.rs`
- `scripts/blender/render_ar_scene.py`

**Exemples de configuration:**

**Local (Windows):**
```env
BLENDER_PATH=C:\Program Files\Blender Foundation\Blender 4.0\blender.exe
```

**Production (Render/AWS/Linux):**
```env
BLENDER_PATH=/usr/local/bin/blender
```

---

### 12. BLENDER_RENDER_SAMPLES

**📍 Backend**

**Description:** Nombre d'échantillons (samples) pour le rendu Blender - contrôle la **qualité vs vitesse** du rendu 3D

**🎯 Rôle technique:**

Les "samples" (échantillons) sont le nombre de fois que Blender calcule la lumière pour chaque pixel lors du rendu. C'est un compromis entre:

- **Qualité** : Plus de samples = meilleure qualité (moins de bruit, ombres plus lisses, reflets plus réalistes)
- **Vitesse** : Plus de samples = rendu plus long

**📊 Impact visuel:**

| Samples | Qualité | Temps de rendu | Usage |
|---------|---------|---------------|-------|
| **32-64** | ⭐⭐ Basse (bruit visible) | ⚡⚡⚡ Très rapide (secondes) | Preview/test rapide |
| **128-256** | ⭐⭐⭐⭐ Bonne | ⚡⚡ Rapide (minutes) | **Production recommandé** |
| **512-1024** | ⭐⭐⭐⭐⭐ Excellente | ⚡ Lent (10-30 min) | Haute qualité |
| **2048+** | ⭐⭐⭐⭐⭐ Parfaite | 🐌 Très lent (heures) | Cinéma/professionnel |

**💡 Exemple concret:**

Pour un rendu AR d'un produit 3D:
- **64 samples** : Rendu en 5 secondes, mais image granuleuse avec du bruit
- **256 samples** : Rendu en 2-3 minutes, image propre et professionnelle ✅ **RECOMMANDÉ**
- **1024 samples** : Rendu en 15-20 minutes, qualité parfaite mais trop long pour production

**Valeurs recommandées:**
- **Preview rapide (développement):** `64` - Pour tester rapidement
- **Production (recommandé):** `256` - Bon compromis qualité/vitesse ⭐
- **Haute qualité:** `512` - Si vous avez le temps
- **Cinéma:** `1024+` - Qualité maximale (rarement nécessaire)

**⚠️ IMPORTANT:**
- **Render.com** : Utilisez `256` (les serveurs sont limités en CPU)
- **AWS/Azure avec GPU** : Vous pouvez monter à `512` ou `1024`
- **Local (Windows)** : Testez avec `64` d'abord, puis `256` pour production

**Exemple:**
```env
BLENDER_RENDER_SAMPLES=256
```

**🔧 Ajustement selon performance:**

Si les rendus sont trop lents:
- Réduisez à `128` ou `64`
- Activez le GPU: `BLENDER_USE_GPU=true`

Si la qualité n'est pas suffisante:
- Augmentez à `512` ou `1024`
- Vérifiez que `BLENDER_USE_GPU=true` est activé

---

### 13. BLENDER_USE_GPU

**📍 Backend**

**Description:** Activer le rendu GPU pour Blender (CUDA, OptiX, Metal)

**🎯 Rôle technique:**

Cette variable indique à Blender d'utiliser le GPU (carte graphique) au lieu du CPU pour le rendu 3D. Le GPU est **10-50x plus rapide** que le CPU pour le rendu.

**⚠️ IMPORTANT - Support GPU par plateforme:**

| Plateforme | GPU disponible? | Valeur recommandée |
|------------|----------------|-------------------|
| **Render.com** | ❌ **NON** (pas de GPU) | `false` ⬅️ **OBLIGATOIRE** |
| **AWS EC2 (standard)** | ❌ NON | `false` |
| **AWS EC2 (G4/G5)** | ✅ OUI (NVIDIA) | `true` |
| **Azure (standard)** | ❌ NON | `false` |
| **Azure (NC-series)** | ✅ OUI (NVIDIA) | `true` |
| **Local (Windows avec GPU)** | ✅ OUI | `true` |

**💡 Pour Render.com:**

```env
BLENDER_USE_GPU=false
```

**Pourquoi `false` sur Render?**
- Render.com ne fournit **pas de GPU** sur leurs services web standards
- Si vous mettez `true`, Blender cherchera un GPU qui n'existe pas
- Le rendu utilisera automatiquement le CPU (mais plus lent)

**💡 Pour AWS/Azure avec GPU:**

Si vous utilisez des instances avec GPU (AWS G4/G5, Azure NC-series):

```env
BLENDER_USE_GPU=true
```

**Valeurs:**
- `true` - Utiliser GPU si disponible (fallback CPU si GPU absent)
- `false` - Forcer l'utilisation du CPU uniquement

**Exemples selon l'environnement:**

**Render.com (OBLIGATOIRE):**
```env
BLENDER_USE_GPU=false
```

**AWS EC2 avec GPU (G4/G5):**
```env
BLENDER_USE_GPU=true
CUDA_VISIBLE_DEVICES=0
GPU_AVAILABLE=true
```

**Azure avec GPU (NC-series):**
```env
BLENDER_USE_GPU=true
CUDA_VISIBLE_DEVICES=0
GPU_AVAILABLE=true
```

**Local (Windows avec NVIDIA):**
```env
BLENDER_USE_GPU=true
```

---

### 14. AR_RENDER_OUTPUT_DIR

**📍 Backend**

**Description:** Répertoire où Blender sauvegarde les fichiers de rendu AR (vidéos, images, thumbnails)

**🎯 Rôle technique:**

Cette variable définit le **dossier de stockage** où Blender écrit les fichiers générés:
- Vidéos de preview AR (`.mp4`)
- Images/thumbnails (`.jpg`, `.png`)
- Fichiers temporaires de rendu

**Le répertoire est créé automatiquement** si il n'existe pas (le code fait `create_dir_all`).

**📁 Valeurs recommandées selon l'environnement:**

| Environnement | Valeur recommandée | Explication |
|---------------|-------------------|-------------|
| **Render.com** | `/tmp/ar_renders` | Temporaire (effacé au redémarrage) |
| **AWS ECS/Fargate** | `/tmp/ar_renders` | Temporaire, ou utilisez S3 pour persistance |
| **Azure ACI** | `/tmp/ar_renders` | Temporaire, ou utilisez Azure Storage |
| **Docker local** | `/tmp/ar_renders` ou `./storage/ar_previews` | Temporaire ou persistant |
| **Local (Windows)** | `C:\yukpo\ar_renders` | Répertoire persistant |

**⚠️ IMPORTANT - Render.com:**

Sur Render, utilisez `/tmp/ar_renders` car:
- `/tmp` est le seul répertoire accessible en écriture
- Les fichiers sont temporaires (effacés au redémarrage)
- Pour persistance, configurez un upload vers S3/Cloudflare R2 après rendu

**💡 Valeur par défaut:**

Si vous ne configurez pas cette variable, le code utilise par défaut:
```
storage/ar_previews
```

**Exemples:**

**Render.com (recommandé):**
```env
AR_RENDER_OUTPUT_DIR=/tmp/ar_renders
```

**AWS/Azure (temporaire):**
```env
AR_RENDER_OUTPUT_DIR=/tmp/ar_renders
```

**Local Windows:**
```env
AR_RENDER_OUTPUT_DIR=C:\yukpo\ar_renders
```

**Local Linux/Mac:**
```env
AR_RENDER_OUTPUT_DIR=/var/yukpo/ar_renders
```

**Docker:**
```env
AR_RENDER_OUTPUT_DIR=/tmp/ar_renders
```

**📝 Note:** Le répertoire est créé automatiquement, vous n'avez pas besoin de le créer manuellement.

---

## 🎥 VARIABLES GPU (Backend)

### ⚠️ INSTALLATION CUDA - IMPORTANT

**CUDA n'est PAS nécessaire pour Render.com!**

CUDA (Compute Unified Device Architecture) est le framework NVIDIA pour utiliser les GPUs. Il est **uniquement nécessaire** si vous utilisez des GPUs NVIDIA.

**📊 Besoin de CUDA selon l'environnement:**

| Environnement | GPU disponible? | CUDA nécessaire? | Installation |
|---------------|----------------|-------------------|--------------|
| **Render.com** | ❌ NON | ❌ **NON** | **PAS BESOIN** ⬅️ |
| **AWS EC2 standard** | ❌ NON | ❌ NON | PAS BESOIN |
| **AWS EC2 G4/G5** | ✅ OUI (NVIDIA) | ✅ OUI | Pré-installé ou Dockerfile |
| **Azure standard** | ❌ NON | ❌ NON | PAS BESOIN |
| **Azure NC-series** | ✅ OUI (NVIDIA) | ✅ OUI | Pré-installé ou Dockerfile |
| **Local sans GPU** | ❌ NON | ❌ NON | PAS BESOIN |
| **Local avec GPU NVIDIA** | ✅ OUI | ✅ OUI | Installer manuellement |

**💡 Pour Render.com:**

**PAS BESOIN d'installer CUDA** car:
- Render ne fournit pas de GPU
- Blender utilisera le CPU (plus lent mais fonctionne)
- Les Dockerfiles actuels sont corrects (pas de CUDA)

**💡 Pour AWS/Azure avec GPU:**

Si vous utilisez des instances avec GPU (AWS G4/G5, Azure NC-series):
- **CUDA est généralement PRÉ-INSTALLÉ** sur les images de machines virtuelles avec GPU
- **Vous n'avez PAS besoin d'installer CUDA manuellement** dans la plupart des cas
- Les images Azure NC-series incluent déjà CUDA et les drivers NVIDIA
- Pour Docker, utilisez une image de base avec CUDA: `nvidia/cuda:11.8-runtime-ubuntu20.04`
- Les Dockerfiles actuels devraient être modifiés pour utiliser une image de base avec CUDA si vous utilisez des containers

**📝 Note importante pour Azure:**

Quand vous basculez vers Azure avec GPU (NC-series):
- ✅ CUDA est **déjà installé** sur la VM
- ✅ Vous n'avez **pas besoin** d'installer CUDA manuellement
- ⚠️ Mais vous devez configurer les variables d'environnement GPU
- ⚠️ Et utiliser une image Docker avec CUDA si vous utilisez des containers

**📝 Résumé:**

- **Render.com** : ❌ Pas besoin de CUDA
- **AWS/Azure avec GPU** : ✅ CUDA nécessaire (généralement pré-installé)
- **Local avec GPU** : ✅ Installer CUDA manuellement

---

### 15. CUDA_VISIBLE_DEVICES

**📍 Backend**

**Description:** Spécifier quels GPUs NVIDIA utiliser (multi-GPU) - **UNIQUEMENT si vous avez des GPUs**

**🎯 Rôle technique:**

Cette variable contrôle quels GPUs NVIDIA sont visibles et utilisables par CUDA. Utile quand vous avez plusieurs GPUs et voulez choisir lesquels utiliser.

**⚠️ IMPORTANT - Render.com:**

**❌ NE PAS CONFIGURER sur Render!**

Render.com ne fournit **pas de GPU**, donc cette variable n'a aucun effet et n'est **pas nécessaire**.

**💡 Quand utiliser cette variable:**

| Environnement | GPU disponible? | Valeur à utiliser |
|---------------|----------------|-------------------|
| **Render.com** | ❌ NON | **NE PAS CONFIGURER** ⬅️ |
| **AWS EC2 standard** | ❌ NON | NE PAS CONFIGURER |
| **AWS EC2 G4/G5 (1 GPU)** | ✅ OUI | `CUDA_VISIBLE_DEVICES=0` |
| **AWS EC2 G4/G5 (2 GPUs)** | ✅ OUI | `CUDA_VISIBLE_DEVICES=0,1` |
| **Azure NC-series (1 GPU)** | ✅ OUI | `CUDA_VISIBLE_DEVICES=0` |
| **Local (1 GPU)** | ✅ OUI | `CUDA_VISIBLE_DEVICES=0` |
| **Local (2+ GPUs)** | ✅ OUI | `CUDA_VISIBLE_DEVICES=0,1` |

**📊 Explication des valeurs:**

- `0` - Utiliser uniquement le GPU #0 (premier GPU)
- `0,1` - Utiliser les GPUs #0 et #1 (2 GPUs en parallèle)
- `0,1,2,3` - Utiliser 4 GPUs en parallèle
- `1` - Utiliser uniquement le GPU #1 (ignorer GPU #0)

**💡 Exemples:**

**AWS/Azure avec 1 GPU:**
```env
CUDA_VISIBLE_DEVICES=0
BLENDER_USE_GPU=true
```

**AWS/Azure avec 2 GPUs:**
```env
CUDA_VISIBLE_DEVICES=0,1
BLENDER_USE_GPU=true
```

**Local Windows avec 1 GPU:**
```env
CUDA_VISIBLE_DEVICES=0
BLENDER_USE_GPU=true
```

**Render.com:**
```env
# NE PAS AJOUTER cette variable
# Render n'a pas de GPU
```

---

### 16. GPU_AVAILABLE

**📍 Backend**

**Description:** Indiquer au code qu'un GPU est disponible dans l'environnement

**🎯 Rôle technique:**

Cette variable indique à votre application Rust qu'un GPU est disponible. Le code utilise cette variable (avec d'autres comme `CUDA_VISIBLE_DEVICES`) pour:
- Détecter si un GPU est disponible
- Activer les optimisations GPU
- Choisir entre CPU et GPU pour le traitement

**⚠️ IMPORTANT - Ne pas confondre:**

- `GPU_AVAILABLE=true` → **Indique** qu'un GPU existe (variable d'environnement)
- Installation CUDA → **Installe** les drivers et bibliothèques GPU (généralement pré-installé)

**📊 Configuration selon l'environnement:**

| Environnement | GPU disponible? | GPU_AVAILABLE | CUDA à installer? |
|---------------|----------------|---------------|-------------------|
| **Render.com** | ❌ NON | `false` ou **NE PAS CONFIGURER** | ❌ NON |
| **AWS EC2 standard** | ❌ NON | `false` | ❌ NON |
| **AWS EC2 G4/G5** | ✅ OUI | `true` | ❌ NON (pré-installé) |
| **Azure standard** | ❌ NON | `false` | ❌ NON |
| **Azure NC-series** | ✅ OUI | `true` | ❌ NON (pré-installé) ⬅️ |
| **Local avec GPU** | ✅ OUI | `true` | ✅ OUI (installer manuellement) |

**💡 Pour Azure avec GPU (NC-series):**

```env
GPU_AVAILABLE=true
CUDA_VISIBLE_DEVICES=0
BLENDER_USE_GPU=true
GPU_TYPE=nvidia
```

**Important:** CUDA est **déjà installé** sur les VMs Azure NC-series, vous n'avez **pas besoin** de l'installer!

**💡 Pour Render.com:**

```env
# NE PAS CONFIGURER ou mettre false
GPU_AVAILABLE=false
```

**Valeurs:**
- `true` - GPU disponible (configurez aussi `CUDA_VISIBLE_DEVICES` et `BLENDER_USE_GPU=true`)
- `false` - CPU uniquement (ou ne pas configurer)

**Exemples:**

**Render.com:**
```env
# NE PAS AJOUTER ou mettre false
GPU_AVAILABLE=false
```

**Azure NC-series (avec GPU):**
```env
GPU_AVAILABLE=true
CUDA_VISIBLE_DEVICES=0
BLENDER_USE_GPU=true
GPU_TYPE=nvidia
```

**AWS G4/G5 (avec GPU):**
```env
GPU_AVAILABLE=true
CUDA_VISIBLE_DEVICES=0
BLENDER_USE_GPU=true
GPU_TYPE=nvidia
```

---

### 17. GPU_TYPE

**📍 Backend**

**Description:** Type de GPU disponible (nvidia, intel, apple, amd)

**🎯 Rôle technique:**

Cette variable indique le type de GPU disponible. Le code peut détecter automatiquement le type, mais vous pouvez le spécifier explicitement.

**⚠️ IMPORTANT - Render.com:**

**❌ NE PAS CONFIGURER sur Render!**

Render.com ne fournit **pas de GPU**, donc cette variable n'a aucun effet et n'est **pas nécessaire**.

**💡 Valeurs possibles:**

- `nvidia` - GPU NVIDIA (CUDA) - **Le plus commun**
- `intel` - GPU Intel (QuickSync)
- `apple` - GPU Apple (Metal)
- `amd` - GPU AMD (ROCm)

**📊 Configuration selon l'environnement:**

| Environnement | GPU disponible? | GPU_TYPE à utiliser |
|---------------|----------------|---------------------|
| **Render.com** | ❌ NON | **NE PAS CONFIGURER** ⬅️ |
| **AWS EC2 standard** | ❌ NON | NE PAS CONFIGURER |
| **AWS EC2 G4/G5** | ✅ OUI (NVIDIA) | `nvidia` |
| **Azure standard** | ❌ NON | NE PAS CONFIGURER |
| **Azure NC-series** | ✅ OUI (NVIDIA) | `nvidia` ⬅️ |
| **Local avec GPU NVIDIA** | ✅ OUI | `nvidia` |
| **Local avec GPU Intel** | ✅ OUI | `intel` |
| **Mac avec GPU Apple** | ✅ OUI | `apple` |

**💡 Exemples:**

**Azure NC-series (avec GPU NVIDIA):**
```env
GPU_TYPE=nvidia
GPU_AVAILABLE=true
CUDA_VISIBLE_DEVICES=0
BLENDER_USE_GPU=true
```

**AWS G4/G5 (avec GPU NVIDIA):**
```env
GPU_TYPE=nvidia
GPU_AVAILABLE=true
CUDA_VISIBLE_DEVICES=0
BLENDER_USE_GPU=true
```

**Render.com:**
```env
# NE PAS AJOUTER cette variable
# Render n'a pas de GPU
```

**Local Mac:**
```env
GPU_TYPE=apple
GPU_AVAILABLE=true
```

**📝 Note:** Le code peut détecter automatiquement le type de GPU si vous ne spécifiez pas cette variable, mais il est recommandé de la configurer explicitement pour éviter les erreurs de détection.

---

### 18. GPU_MEMORY_GB

**📍 Backend**

**Description:** Mémoire GPU disponible en GB (optionnel, pour optimisation)

**Exemple:**
```env
GPU_MEMORY_GB=24
```

---

### 19. NVIDIA_VISIBLE_DEVICES

**📍 Backend**

**Description:** Alternative à CUDA_VISIBLE_DEVICES pour Docker

**Exemple:**
```env
NVIDIA_VISIBLE_DEVICES=all
```

---

### 20. INTEL_GPU_AVAILABLE

**📍 Backend**

**Description:** Activer GPU Intel (QuickSync)

**Exemple:**
```env
INTEL_GPU_AVAILABLE=true
```

---

### 21. APPLE_SILICON_AVAILABLE

**📍 Backend**

**Description:** Activer GPU Apple Silicon (Metal)

**Exemple:**
```env
APPLE_SILICON_AVAILABLE=true
```

---

### 22. AMD_GPU_AVAILABLE

**📍 Backend**

**Description:** Activer GPU AMD (VAAPI)

**Exemple:**
```env
AMD_GPU_AVAILABLE=true
```

---

## 🗄️ VARIABLES BASE DE DONNÉES (Backend)

### 23. DATABASE_URL

**📍 Backend**

**Description:** URL de connexion PostgreSQL avec pgvector et imgsmlr

**Format:**
```
postgresql://username:password@host:port/database
```

**Guide d'obtention:**
1. **Créer une base PostgreSQL** (local ou cloud)
2. **Installer extensions:**
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS imgsmlr;
   ```
3. **Construire l'URL:**
   - **Local:** `postgresql://postgres:password@localhost:5432/yukpomnang`
   - **Render:** `postgresql://user:pass@host:port/db`
   - **AWS RDS:** `postgresql://user:pass@rds-endpoint:5432/db`

**Exemple:**
```env
DATABASE_URL=postgresql://user:password@host:port/database
```

---

### 24. SQLX_OFFLINE

**📍 Backend**

**Description:** Mode offline pour SQLx (utiliser sqlx-data.json)

**Valeurs:**
- `true` - Mode offline (production)
- `false` - Mode online (développement)

**Exemple:**
```env
SQLX_OFFLINE=true
```

---

## 🔴 VARIABLES REDIS (Backend)

### 25. REDIS_URL

**📍 Backend**

**Description:** URL de connexion Redis pour collaboration temps réel et cache

**Format:**
```
redis://username:password@host:port
# ou
rediss://username:password@host:port (TLS)
```

**Guide d'obtention:**
1. **Créer une instance Redis** (local ou cloud)
2. **Local:** `redis://localhost:6379`
3. **Cloud (Upstash, Redis Cloud, etc.):**
   - Créer un compte
   - Créer une base de données
   - Copier l'URL de connexion

**Exemple:**
```env
REDIS_URL=redis://localhost:6379
# ou cloud:
REDIS_URL=rediss://default:password@redis-xxxxx.upstash.io:6379
```

---

## 🔐 VARIABLES AUTHENTIFICATION (Backend)

### 26. JWT_SECRET

**📍 Backend**

**Description:** Secret pour signer les tokens JWT

**Génération:**
```bash
# Linux/macOS:
openssl rand -base64 32

# Windows PowerShell:
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**Exemple:**
```env
JWT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 27. JWT_EXPIRATION_HOURS

**📍 Backend**

**Description:** Durée de validité des tokens JWT (en heures)

**Exemple:**
```env
JWT_EXPIRATION_HOURS=24
```

---

## ☁️ VARIABLES STOCKAGE (Backend)

### 28. AWS_ACCESS_KEY_ID

**📍 Backend**

**Description:** Clé d'accès AWS pour S3 (stockage vidéos)

**Guide d'obtention:**
1. **Site:** https://aws.amazon.com/
2. **Créer un compte AWS** (ou se connecter)
3. **Aller dans:** IAM → Users (ou https://console.aws.amazon.com/iam/)
4. **Créer un utilisateur** (ou utiliser existant)
5. **Attacher la politique:** `AmazonS3FullAccess` (ou politique personnalisée)
6. **Aller dans:** Security credentials → Create access key
7. **Type:** Application running outside AWS
8. **Copier:** Access Key ID et Secret Access Key
9. **⚠️ IMPORTANT:** Sauvegarder les deux clés immédiatement

**Exemple:**
```env
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
```

---

### 29. AWS_SECRET_ACCESS_KEY

**📍 Backend**

**Description:** Clé secrète AWS pour S3

**Guide d'obtention:**
- Voir **AWS_ACCESS_KEY_ID** (même processus)

**Exemple:**
```env
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

---

### 30. AWS_S3_BUCKET_NAME

**📍 Backend**

**Description:** Nom du bucket S3 pour stocker les vidéos

**Guide d'obtention:**
1. **Aller dans:** S3 → Buckets (ou https://console.aws.amazon.com/s3/)
2. **Créer un bucket** (ou utiliser existant)
3. **Nommer le bucket** (ex: `yukpo-videos-prod`)
4. **Configurer les permissions** (CORS, public read si nécessaire)

**Exemple:**
```env
AWS_S3_BUCKET_NAME=yukpo-videos-prod
```

---

### 31. AWS_S3_REGION

**📍 Backend**

**Description:** Région AWS pour S3 (ex: us-east-1, eu-west-1)

**Exemple:**
```env
AWS_S3_REGION=eu-west-1
```

---

### 32. CLOUDFLARE_R2_ACCOUNT_ID (Alternative à S3)

**📍 Backend**

**Description:** ID de compte Cloudflare R2

**Guide d'obtention:**
1. **Site:** https://dash.cloudflare.com/
2. **Se connecter** à Cloudflare
3. **Aller dans:** R2 → Overview
4. **Créer un bucket R2** (ou utiliser existant)
5. **Aller dans:** Manage R2 API Tokens
6. **Créer un token API**
7. **Copier:** Account ID (visible dans l'URL ou Overview)

**Exemple:**
```env
CLOUDFLARE_R2_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 33. CLOUDFLARE_R2_ACCESS_KEY_ID

**📍 Backend**

**Description:** Clé d'accès R2

**Guide d'obtention:**
- Voir **CLOUDFLARE_R2_ACCOUNT_ID** (même processus, créer token API)

**Exemple:**
```env
CLOUDFLARE_R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 34. CLOUDFLARE_R2_SECRET_ACCESS_KEY

**📍 Backend**

**Description:** Clé secrète R2

**Guide d'obtention:**
- Voir **CLOUDFLARE_R2_ACCOUNT_ID** (même processus)

**Exemple:**
```env
CLOUDFLARE_R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 35. CLOUDFLARE_R2_BUCKET_NAME

**📍 Backend**

**Description:** Nom du bucket R2

**Exemple:**
```env
CLOUDFLARE_R2_BUCKET_NAME=yukpo-videos-prod
```

---

## 📱 VARIABLES MOBILE (Expo)

### 36. EXPO_PUBLIC_API_URL

**📍 Mobile (Expo)**

**Description:** URL de l'API backend

**Où configurer:**
- `mobile/app.config.js` dans `extra.apiUrl`
- Ou `.env` avec `EXPO_PUBLIC_` prefix

**Exemple:**
```javascript
// app.config.js
extra: {
  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api.yukpo.com',
}
```

**Ou .env:**
```env
EXPO_PUBLIC_API_URL=https://api.yukpo.com
```

---

### 37. EXPO_PUBLIC_WS_URL

**📍 Mobile (Expo)**

**Description:** URL WebSocket pour collaboration temps réel

**Exemple:**
```javascript
// app.config.js
extra: {
  wsUrl: process.env.EXPO_PUBLIC_WS_URL || 'wss://ws.yukpo.com',
}
```

---

### 38. EXPO_PUBLIC_ENVIRONMENT

**📍 Mobile (Expo)**

**Description:** Environnement (development, staging, production)

**Exemple:**
```javascript
// app.config.js
extra: {
  environment: process.env.EXPO_PUBLIC_ENVIRONMENT || 'development',
}
```

---

## ⚙️ VARIABLES CONFIGURATION (Backend)

### 39. RUST_ENV

**📍 Backend**

**Description:** Environnement Rust (development, staging, production)

**Exemple:**
```env
RUST_ENV=production
```

---

### 40. PORT

**📍 Backend**

**Description:** Port du serveur backend

**Exemple:**
```env
PORT=3000
```

---

### 41. LOG_LEVEL

**📍 Backend**

**Description:** Niveau de log (trace, debug, info, warn, error)

**Exemple:**
```env
LOG_LEVEL=info
```

---

### 42. MAX_UPLOAD_SIZE_MB

**📍 Backend**

**Description:** Taille maximale d'upload vidéo (en MB)

**Exemple:**
```env
MAX_UPLOAD_SIZE_MB=500
```

---

### 43. VIDEO_GENERATION_TIMEOUT_SECONDS

**📍 Backend**

**Description:** Timeout pour génération vidéo complète (en secondes)

**⚠️ IMPORTANT:** Augmenter à **300-600 secondes** (5-10 minutes) pour vidéos longues

**Exemple:**
```env
VIDEO_GENERATION_TIMEOUT_SECONDS=600
```

---

### 44. AI_REQUEST_TIMEOUT_SECONDS

**📍 Backend**

**Description:** Timeout pour requêtes IA individuelles (en secondes)

**⚠️ IMPORTANT:** Augmenter à **120 secondes** pour génération vidéo

**Exemple:**
```env
AI_REQUEST_TIMEOUT_SECONDS=120
```

---

### 45. YUKPO_PLUGIN_DIR

**📍 Backend**

**Description:** Répertoire pour plugins vidéo

**Exemple:**
```env
YUKPO_PLUGIN_DIR=./plugins
```

---

## 📋 FICHIER .env COMPLET BACKEND

```env
# ============================================
# 🤖 VARIABLES IA
# ============================================
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MISTRAL_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
COHERE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OLLAMA_BASE_URL=http://localhost:11434

# ============================================
# 🎬 STOCK MEDIA
# ============================================
UNSPLASH_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PEXELS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PIXABAY_API_KEY=xxxxxxxxxxxx-xxxxxxxxxxxx

# ============================================
# 🎤 AUDIO - TRANSCRIPTION
# ============================================
# OPENAI_API_KEY est déjà défini ci-dessus (utilisé aussi pour Whisper)
# ⚠️ NOTE: HUGGINGFACE_API_KEY n'est PAS utilisé pour la transcription dans le code actuel

# ============================================
# 🎤 AUDIO - TEXT-TO-SPEECH (TTS)
# ============================================
PREMIUM_TTS_ENDPOINT=https://api.elevenlabs.io/v1/text-to-speech
PREMIUM_TTS_API_KEY=your-elevenlabs-api-key
PREMIUM_TTS_VOICE=yukpo-premium-fr

# ============================================
# 🎚️ AUDIO - PREMIUM MASTERING
# ============================================
PREMIUM_AUDIO_ENABLED=true
PREMIUM_AUDIO_PROVIDER=dolby
PREMIUM_AUDIO_TIMEOUT_SECS=900
PREMIUM_AUDIO_MAX_RETRIES=3
PREMIUM_AUDIO_WEBHOOK_SECRET=your-webhook-secret-here
PREMIUM_AUDIO_STORAGE_PREFIX=services/audio/masters
PREMIUM_AUDIO_KEEP_LOCAL_COPY=false

# ============================================
# 🎧 DOLBY.IO CONFIGURATION
# ============================================
DOLBY_API_KEY=your-dolby-api-key-here
DOLBY_API_SECRET=your-dolby-api-secret-here
DOLBY_BASE_URL=https://api.dolby.com
DOLBY_ENHANCE_PRESET=music
DOLBY_WEBHOOK_SIGNATURE_SECRET=your-dolby-webhook-secret

# ============================================
# 🎼 AUDIOSHAKE CONFIGURATION
# ============================================
AUDIOSHAKE_API_KEY=your-audioshake-api-key-here
AUDIOSHAKE_BASE_URL=https://api.audioshake.ai
AUDIOSHAKE_ENABLE_STEMS=false
AUDIOSHAKE_STEMS=vocals
AUDIOSHAKE_WEBHOOK_SECRET=your-audioshake-webhook-secret

# ============================================
# 🎙️ AUPHONIC CONFIGURATION
# ============================================
AUPHONIC_USERNAME=your-auphonic-username
AUPHONIC_API_KEY=your-auphonic-api-key-here
AUPHONIC_BASE_URL=https://api.auphonic.com
AUPHONIC_PRESET=your-preset-name
AUPHONIC_OUTPUT_FORMAT=wav
AUPHONIC_WEBHOOK_SECRET=your-auphonic-webhook-secret
AUPHONIC_POLL_INTERVAL_SECS=5

# ============================================
# 🎬 YOUTUBE OAUTH (Upload vidéos - PAS pour audio)
# ============================================
YOUTUBE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
YOUTUBE_REDIRECT_URI=https://yukpomnang.onrender.com/api/social/youtube/callback

# ============================================
# 🎵 SPOTIFY (Service activé - Variables requises)
# ============================================
SPOTIFY_CLIENT_ID=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
SPOTIFY_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ============================================
# 🎨 BLENDER 3D
# ============================================
BLENDER_PATH=/usr/bin/blender
BLENDER_RENDER_SAMPLES=256
BLENDER_USE_GPU=true
AR_RENDER_OUTPUT_DIR=/var/yukpo/ar_renders

# ============================================
# 🎥 GPU
# ============================================
CUDA_VISIBLE_DEVICES=0,1
GPU_AVAILABLE=true
GPU_TYPE=nvidia
GPU_MEMORY_GB=24
NVIDIA_VISIBLE_DEVICES=all
INTEL_GPU_AVAILABLE=false
APPLE_SILICON_AVAILABLE=false
AMD_GPU_AVAILABLE=false

# ============================================
# 🗄️ BASE DE DONNÉES
# ============================================
DATABASE_URL=postgresql://user:pass@host:port/db
SQLX_OFFLINE=true

# ============================================
# 🔴 REDIS
# ============================================
REDIS_URL=redis://localhost:6379

# ============================================
# 🔐 AUTHENTIFICATION
# ============================================
JWT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
JWT_EXPIRATION_HOURS=24

# ============================================
# ☁️ STOCKAGE (AWS S3 ou Cloudflare R2)
# ============================================
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_S3_BUCKET_NAME=yukpo-videos-prod
AWS_S3_REGION=eu-west-1

# Alternative R2:
# CLOUDFLARE_R2_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# CLOUDFLARE_R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# CLOUDFLARE_R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# CLOUDFLARE_R2_BUCKET_NAME=yukpo-videos-prod

# ============================================
# ⚙️ CONFIGURATION
# ============================================
RUST_ENV=production
PORT=3000
LOG_LEVEL=info
MAX_UPLOAD_SIZE_MB=500
VIDEO_GENERATION_TIMEOUT_SECONDS=600
AI_REQUEST_TIMEOUT_SECONDS=120
YUKPO_PLUGIN_DIR=./plugins
```

---

## 📱 FICHIER app.config.js COMPLET MOBILE

```javascript
export default {
  expo: {
    name: "Yukpo",
    slug: "yukpo",
    version: "1.0.0",
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api.yukpo.com',
      wsUrl: process.env.EXPO_PUBLIC_WS_URL || 'wss://ws.yukpo.com',
      environment: process.env.EXPO_PUBLIC_ENVIRONMENT || 'production',
    },
    ios: {
      bundleIdentifier: "com.yukpo.app",
      infoPlist: {
        NSCameraUsageDescription: "Yukpo a besoin d'accéder à votre caméra pour créer des vidéos AR.",
        NSLocationWhenInUseUsageDescription: "Yukpo a besoin de votre localisation pour les services de livraison.",
      },
    },
    android: {
      package: "com.yukpo.app",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_EXTERNAL_STORAGE",
      ],
      metaData: {
        "com.google.ar.core": {
          value: "required",
        },
      },
    },
  },
};
```

---

## ✅ CHECKLIST DE CONFIGURATION

### Backend
- [ ] Toutes les clés IA configurées (OpenAI, Anthropic, Gemini, etc.)
- [ ] Stock media configuré (Unsplash, Pexels, Pixabay)
- [ ] Blender installé et configuré
- [ ] GPU configuré (si disponible)
- [ ] Base de données PostgreSQL avec extensions
- [ ] Redis configuré
- [ ] JWT secret généré
- [ ] Stockage configuré (S3 ou R2)
- [ ] Timeouts augmentés pour génération vidéo (600s)

### Mobile
- [ ] API URL configurée
- [ ] WebSocket URL configurée
- [ ] Permissions iOS/Android configurées
- [ ] ARCore meta-data configurée (Android)

---

## ⚠️ NOTES IMPORTANTES

1. **Timeouts IA:** Les timeouts sont maintenant configurés à **120 secondes** pour les requêtes IA individuelles et **600 secondes** pour la génération vidéo complète.

2. **Sécurité:** Ne jamais commiter les fichiers `.env` dans Git. Utiliser `.env.example` comme template.

3. **Production:** Utiliser des variables d'environnement sécurisées (AWS Secrets Manager, HashiCorp Vault, etc.)

4. **Coûts IA:** Surveiller l'utilisation des APIs IA pour éviter les dépassements de budget.

---

**Date:** 2025-01-27  
**Total Variables:** 70+ variables d'environnement (incluant toutes les variables audio pour le montage vidéo)

