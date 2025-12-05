# 🔐 VARIABLES D'ENVIRONNEMENT - KYC & VÉRIFICATION IDENTITÉ

**Date**: 2025-01-29  
**Objectif**: Lister toutes les variables nécessaires pour la vérification d'identité (KYC) des conducteurs Taxi/Covoiturage

---

## ✅ SERVICE KYC INTÉGRÉ

Votre application a un **service KYC complet** qui supporte plusieurs providers de vérification d'identité :

- ✅ **Onfido**
- ✅ **Jumio**
- ✅ **Sumsub** ⭐ (Votre question)
- ✅ **Veriff**
- ✅ **Persona**
- ✅ **Manual** (Vérification manuelle par admin)

---

## 🔑 VARIABLES D'ENVIRONNEMENT REQUISES

### **1. Provider KYC (OBLIGATOIRE)**

```bash
# Choisir le provider (un seul à la fois)
KYC_PROVIDER=sumsub
```

**Options disponibles** :
- `onfido` - Onfido
- `jumio` - Jumio
- `sumsub` - Sumsub ⭐ (Recommandé)
- `veriff` - Veriff
- `persona` - Persona
- `manual` - Vérification manuelle (pas de clé API nécessaire)

⚠️ **Par défaut** : Si non défini → `manual` (vérification manuelle)

---

### **2. SUMSUB (Votre cas) ⭐**

```bash
# Provider
KYC_PROVIDER=sumsub

# Clés API Sumsub (OBLIGATOIRES si provider = sumsub)
SUMSUB_APP_TOKEN=your_sumsub_app_token_here
SUMSUB_SECRET_KEY=your_sumsub_secret_key_here
```

**Où obtenir** :
1. Aller sur https://sumsub.com/
2. Créer un compte ⚠️ **Exige une adresse email professionnelle** (@entreprise.com)
3. Dans le Dashboard → **Settings** → **API** → **Access Tokens**
4. Copier :
   - **App Token** → `SUMSUB_APP_TOKEN`
   - **Secret Key** → `SUMSUB_SECRET_KEY`

⚠️ **PROBLÈME** : Sumsub exige un email professionnel pour l'inscription.  
📖 **Voir** : `SOLUTIONS_KYC_EMAIL_PRO.md` pour les alternatives sans email pro.

---

### **3. AUTRES PROVIDERS (Optionnels)**

#### **ONFIDO**
```bash
KYC_PROVIDER=onfido
ONFIDO_API_KEY=your_onfido_api_key
ONFIDO_WEBHOOK_TOKEN=your_onfido_webhook_token  # Optionnel
```

#### **JUMIO**
```bash
KYC_PROVIDER=jumio
JUMIO_API_KEY=your_jumio_api_key
JUMIO_API_SECRET=your_jumio_api_secret
JUMIO_WEBHOOK_TOKEN=your_jumio_webhook_token  # Optionnel
```

#### **VERIFF**
```bash
KYC_PROVIDER=veriff
VERIFF_API_KEY=your_veriff_api_key
VERIFF_API_SECRET=your_veriff_api_secret
```

#### **PERSONA**
```bash
KYC_PROVIDER=persona
PERSONA_API_KEY=your_persona_api_key
PERSONA_WEBHOOK_SECRET=your_persona_webhook_secret
```

---

## 🔗 WEBHOOKS (Optionnel mais recommandé)

Les webhooks permettent de recevoir les résultats de vérification automatiquement.

### **URLs des webhooks** (déjà configurées dans le backend) :

```
POST /api/kyc/webhook/sumsub
POST /api/kyc/webhook/onfido
POST /api/kyc/webhook/jumio
POST /api/kyc/webhook/veriff
POST /api/kyc/webhook/persona
```

### **Configuration dans Sumsub Dashboard** :

1. Allez dans **Settings** → **Webhooks**
2. Ajoutez l'URL : `https://yukpomnang.onrender.com/api/kyc/webhook/sumsub`
3. Sélectionnez les événements :
   - ✅ `reviewCompleted`
   - ✅ `reviewPending`
   - ✅ `reviewRejected`

---

## 📋 CONFIGURATION COMPLÈTE POUR SUMSUB

### **Variables minimales (OBLIGATOIRES)** :

```bash
# Provider
KYC_PROVIDER=sumsub

# Clés API Sumsub
SUMSUB_APP_TOKEN=sbxu_...
SUMSUB_SECRET_KEY=your_secret_key_here
```

### **Variables optionnelles (Améliorations)** :

```bash
# IA pour analyse automatique des documents (si disponible)
OPENAI_API_KEY=sk-...  # Pour extraction automatique de numéros de document
# ou
ANTHROPIC_API_KEY=sk-...  # Alternative
# ou
GEMINI_API_KEY=...  # Alternative
```

---

## 🎯 UTILISATION DANS TAXI/COVOITURAGE

### **Endpoints disponibles** :

1. **Soumission document KYC** :
   ```
   POST /api/kyc/submit
   ```

2. **Vérification conducteur Taxi** :
   ```
   POST /api/taxis/:id/verify-driver
   ```

3. **Vérification conducteur Covoiturage** :
   ```
   POST /api/covoiturages/:id/verify-driver
   ```

### **Workflow** :

1. **Conducteur soumet document** (carte identité, permis, etc.)
2. **Service KYC envoie à Sumsub** (si configuré)
3. **Sumsub vérifie** le document
4. **Webhook reçoit le résultat** automatiquement
5. **Status mis à jour** dans la base de données
6. **Conducteur vérifié** ✅

---

## 📊 TABLEAU RÉCAPITULATIF

| Variable | Requis | Provider | Description |
|----------|--------|----------|-------------|
| `KYC_PROVIDER` | ✅ **OUI** | Tous | Provider choisi (sumsub, onfido, etc.) |
| `SUMSUB_APP_TOKEN` | ⚠️ Si sumsub | Sumsub | Token d'application Sumsub |
| `SUMSUB_SECRET_KEY` | ⚠️ Si sumsub | Sumsub | Clé secrète Sumsub |
| `ONFIDO_API_KEY` | ⚠️ Si onfido | Onfido | Clé API Onfido |
| `JUMIO_API_KEY` | ⚠️ Si jumio | Jumio | Clé API Jumio |
| `VERIFF_API_KEY` | ⚠️ Si veriff | Veriff | Clé API Veriff |
| `PERSONA_API_KEY` | ⚠️ Si persona | Persona | Clé API Persona |
| `OPENAI_API_KEY` | ⚠️ Optionnel | Tous | Pour extraction automatique IA |

---

## 🚀 CONFIGURATION SUR RENDER.COM

### **Étapes** :

1. **Allez sur** : https://dashboard.render.com
2. **Sélectionnez** votre service backend
3. **Onglet** : "Environment"
4. **Ajoutez** les variables :

```bash
# Provider (OBLIGATOIRE)
KYC_PROVIDER=sumsub

# Sumsub (OBLIGATOIRE si provider = sumsub)
SUMSUB_APP_TOKEN=votre_token_ici
SUMSUB_SECRET_KEY=votre_secret_key_ici
```

5. **Cochez "Secret"** pour les clés sensibles

---

## 🔍 VÉRIFICATION QUE TOUT FONCTIONNE

### **1. Vérifier dans les logs** :

Au démarrage du backend, vous devriez voir :

```
[KYCService] ✅ Clé API Sumsub configurée
[KYCService] Provider: Sumsub
```

### **2. Tester la soumission** :

```bash
POST /api/kyc/submit
{
  "document_type": "identity_card",
  "file_url": "https://...",
  "metadata": {
    "user_id": 123,
    "service_type": "taxi"
  }
}
```

### **3. Vérifier le webhook** :

- Configurez le webhook dans Sumsub Dashboard
- Soumettez un document
- Vérifiez les logs backend pour voir la réception

---

## ⚠️ IMPORTANT

### **Sans variables configurées** :

- ✅ Le service fonctionne quand même
- ⚠️ Mode **"manual"** activé par défaut
- ⚠️ Vérification manuelle par admin uniquement
- ⚠️ Pas de vérification automatique

### **Avec variables configurées** :

- ✅ Vérification automatique par le provider
- ✅ Webhooks automatiques
- ✅ Status mis à jour automatiquement
- ✅ Meilleure expérience utilisateur

---

## 📝 RÉSUMÉ

### ✅ **VARIABLES MINIMALES POUR SUMSUB** :

```bash
KYC_PROVIDER=sumsub
SUMSUB_APP_TOKEN=votre_token
SUMSUB_SECRET_KEY=votre_secret_key
```

### ✅ **ACTION IMMÉDIATE** :

1. **Obtenir les clés Sumsub** : https://sumsub.com/
2. **Ajouter dans Render.com** : Environment variables
3. **Configurer webhook** : Dans Sumsub Dashboard
4. **Tester** : Soumission d'un document

---

## 🎯 CONCLUSION

**OUI**, il y a bien un système de vérification d'identité (KYC) intégré avec support pour **Sumsub** et autres providers.

**Variables à configurer** :
- ✅ `KYC_PROVIDER=sumsub`
- ✅ `SUMSUB_APP_TOKEN=...`
- ✅ `SUMSUB_SECRET_KEY=...`

**Endpoints disponibles** :
- ✅ `/api/kyc/submit` - Soumission document
- ✅ `/api/taxis/:id/verify-driver` - Vérification taxi
- ✅ `/api/covoiturages/:id/verify-driver` - Vérification covoiturage
- ✅ `/api/kyc/webhook/sumsub` - Webhook Sumsub

**Status** : Service **100% intégré**, il ne manque que les variables d'environnement ! ✅

