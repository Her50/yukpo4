# 🔒 SÉCURITÉ APK : Protection contre le Piratage

**Contexte :** Risques de sécurité lors du partage d'APK avec investisseurs  
**Objectif :** Minimiser les risques de reverse engineering, extraction de secrets, et copie non autorisée

---

## ⚠️ RISQUES RÉELS D'UN APK

### **1. REVERSE ENGINEERING (Décompilation)** ⚠️

**Qu'est-ce que c'est :**
- Extraction du code source JavaScript/TypeScript depuis l'APK
- Analyse de la structure de l'application
- Compréhension des fonctionnalités et architecture

**Risque réel :**
- ⚠️ **MOYEN** : Le code React Native/Expo est déjà "compilé" (JavaScript minifié)
- ⚠️ Un développeur expérimenté peut analyser la structure générale
- ⚠️ Impossible d'empêcher complètement l'analyse

**Impact :**
- 📉 Concurrence peut copier l'idée (mais pas le code complet)
- 📉 Compréhension de l'architecture générale

**Protection :**
- ✅ Code minifié (déjà fait par Expo)
- ✅ Obfuscation JavaScript (optionnel, mais recommandé)
- ✅ R8/ProGuard (pour code natif)
- ✅ Limiter l'accès (lien sécurisé, NDA)

---

### **2. EXTRACTION DE SECRETS (CRITIQUE)** ⚠️⚠️⚠️

**Qu'est-ce que c'est :**
- Extraction de clés API, tokens, secrets depuis le code
- Accès aux services backend sans autorisation
- Utilisation abusive des ressources (coûts)

**Risque réel :**
- ⚠️⚠️⚠️ **ÉLEVÉ** : Si secrets inclus dans l'APK
- ⚠️⚠️⚠️ Extraction facile via outils (strings, grep, décompilateurs)
- ⚠️⚠️⚠️ Peut entraîner des coûts importants si mal utilisé

**Impact :**
- 💰 Coûts API abusifs (OpenAI, Google Maps, etc.)
- 🔓 Accès non autorisé au backend
- 📉 Risque de compromission du système

**Protection (CRITIQUE) :**
- ✅ **RETIRER TOUS LES SECRETS** avant de partager l'APK
- ✅ Utiliser variables d'environnement côté serveur
- ✅ Rate limiting côté backend
- ✅ Authentification JWT obligatoire
- ✅ Monitoring des appels API

---

### **3. REDISTRIBUTION NON AUTORISÉE** ⚠️

**Qu'est-ce que c'est :**
- Partage de l'APK sans votre autorisation
- Distribution sur des stores non officiels
- Utilisation commerciale non autorisée

**Risque réel :**
- ⚠️ **MOYEN** : Peut être partagé malgré votre demande
- ⚠️ Limites légales (dépend du NDA)

**Protection :**
- ✅ NDA (Non-Disclosure Agreement)
- ✅ Watermarking de l'application (version "Demo-Yango")
- ✅ Lien sécurisé avec expiration
- ✅ Tracking (analytics) pour identifier la source
- ✅ Mentions légales dans l'app

---

### **4. COPIE DES FONCTIONNALITÉS** ⚠️

**Qu'est-ce que c'est :**
- Inspiration directe des fonctionnalités
- Copie de l'UX/UI
- Reproduction de l'algorithme

**Risque réel :**
- ⚠️ **FAIBLE-MOYEN** : L'idée peut être copiée, pas le code complet
- ⚠️ Dépend de la complexité technique
- ⚠️ IA et backend ne sont pas dans l'APK (sécurisés)

**Protection :**
- ✅ Backend et IA sur serveur (pas dans l'APK) = **PROTECTION FORTE**
- ✅ Logique métier complexe côté serveur
- ✅ Algorithmes propriétaires non exposés
- ✅ First mover advantage (votre avance)

---

## ✅ MESURES DE PROTECTION RECOMMANDÉES

### **1. AVANT DE PARTAGER L'APK (CHECKLIST CRITIQUE)**

#### **A. Retirer tous les secrets** 🔴 CRITIQUE

**Vérifier ces éléments dans `mobile/app.config.js` et `mobile/eas.json` :**

```javascript
// ❌ À RETIRER AVANT PARTAGE :
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY       // Retirer ou limiter
EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY  // Retirer ou limiter
API_SECRET_KEY                        // Retirer
JWT_SECRET                            // Retirer
DATABASE_URL                          // Retirer (si présent)
STRIPE_SECRET_KEY                     // Retirer
OPENAI_API_KEY                        // Retirer (si présent)
```

**Solution :**
```javascript
// ✅ Créer un profil "demo" dans eas.json
"demo": {
  "distribution": "internal",
  "env": {
    "EXPO_PUBLIC_API_URL": "https://yukpomnang.onrender.com",
    "EXPO_PUBLIC_ENVIRONMENT": "demo",
    // ❌ AUCUN SECRET ICI
    // Tous les appels API passent par le backend qui gère les secrets
  }
}
```

**Commande pour build sécurisé :**
```bash
cd mobile
eas build --platform android --profile demo
```

---

#### **B. Vérifier que le backend gère les secrets** ✅

**Ce qui doit être côté SERVEUR (pas dans l'APK) :**
- ✅ Clés API OpenAI/Mistral/Claude (orchestration IA)
- ✅ Clés Google Maps (si possible via proxy backend)
- ✅ Secrets JWT
- ✅ Credentials base de données
- ✅ Clés de paiement (Stripe, etc.)

**Vérification :**
- ✅ Tous les appels API passent par votre backend (`EXPO_PUBLIC_API_URL`)
- ✅ Le backend valide et authentifie les requêtes
- ✅ Rate limiting actif côté backend
- ✅ Monitoring des appels API

---

#### **C. Créer une version "Demo" avec limitations** ✅

**Recommandations :**
- ✅ Watermark "DEMO - YANGO VENTURES" visible
- ✅ Données de test uniquement (pas de données réelles)
- ✅ Limitations fonctionnelles (ex: max 10 requêtes/jour)
- ✅ Expiration automatique après 30 jours (si possible)
- ✅ Version identifiée : "Yukpo-Demo-v1.0-Yango"

**Modifications dans `app.config.js` :**
```javascript
export default {
  name: "Yukpo Demo - Yango",
  slug: "yukpomnang-mobile-new",
  version: "1.0.0-demo-yango",
  // ... reste de la config
};
```

---

#### **D. Configurer Obfuscation JavaScript (Optionnel mais recommandé)** ✅

**Expo minifie déjà le code, mais vous pouvez ajouter :**

**Option 1 : Via Metro bundler (déjà fait par Expo)**
```javascript
// metro.config.js
module.exports = {
  transformer: {
    minifierConfig: {
      // Minification agressive
      keep_classnames: false,
      keep_fnames: false,
      mangle: {
        keep_classnames: false,
        keep_fnames: false,
      },
    },
  },
};
```

**Option 2 : ProGuard/R8 (pour code natif)**
```gradle
// android/app/build.gradle
buildTypes {
  release {
    minifyEnabled true
    shrinkResources true
    proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
  }
}
```

**Note :** Expo gère déjà cela en partie, mais vous pouvez l'optimiser.

---

#### **E. Signer l'APK (Déjà fait par EAS)** ✅

**EAS signe automatiquement l'APK :**
- ✅ Signature app bundle
- ✅ Validation d'intégrité
- ✅ Traçabilité (qui a créé le build)

**Vérification :**
```bash
# Après build EAS
jarsigner -verify -verbose -certs your-app.apk
```

---

### **2. MESURES D'ACCÈS**

#### **A. Lien sécurisé avec expiration** ✅

**Recommandations :**
- ✅ Expo EAS Build : Lien expire automatiquement (30 jours)
- ✅ Dropbox/Drive : Lien avec expiration (7-30 jours)
- ✅ Mot de passe optionnel si très sensible

---

#### **B. NDA (Non-Disclosure Agreement)** ✅

**Recommandation :**
- ✅ Envoyer un NDA avant de partager l'APK
- ✅ Mention dans le message : "Application partagée sous confidentialité"

**Message type :**
```
🔒 CONFIDENTIALITÉ :

Cette application est partagée sous confidentialité dans le cadre de notre 
discussion d'investissement. 

Veuillez ne pas redistribuer, partager, ou analyser techniquement sans 
autorisation préalable.

NDA disponible sur demande si nécessaire.
```

---

#### **C. Tracking et Analytics** ✅

**Pour identifier la source en cas de fuite :**

**Option 1 : Analytics dans l'app**
```javascript
// Envoyer un événement unique au démarrage
import analytics from '@react-native-firebase/analytics';

await analytics().logEvent('app_demo_start', {
  version: 'demo-yango-v1.0',
  timestamp: Date.now(),
  // ID unique si possible
});
```

**Option 2 : Expo EAS Build Analytics**
- ✅ Expo track automatiquement les téléchargements
- ✅ Vous pouvez voir qui a téléchargé

---

#### **D. Watermarking** ✅

**Ajouter un watermark visible dans l'app :**

```javascript
// Dans votre App.tsx ou composant principal
{__DEV__ || process.env.EXPO_PUBLIC_ENVIRONMENT === 'demo' ? (
  <View style={styles.watermark}>
    <Text style={styles.watermarkText}>
      DEMO - YANGO VENTURES - CONFIDENTIEL
    </Text>
  </View>
) : null}
```

---

## 🔍 VÉRIFICATION AVANT PARTAGE

### **Checklist Sécurité APK :**

- [ ] **Tous les secrets retirés** (API keys, tokens, credentials)
- [ ] **Backend gère les secrets** (vérifié)
- [ ] **Version "demo" créée** (watermark, limitations)
- [ ] **Code minifié/obfusqué** (vérifié)
- [ ] **APK signé** (EAS le fait automatiquement)
- [ ] **Lien sécurisé avec expiration** (EAS/Dropbox)
- [ ] **NDA mentionné** (dans message)
- [ ] **Tracking configuré** (analytics)
- [ ] **Données de test uniquement** (pas de données réelles)
- [ ] **Testé sur device** (vérifier que tout fonctionne)

---

## 🛡️ PROTECTION ARCHITECTURELLE (Votre cas)

### **Avantages de votre architecture :**

#### **1. Backend Rust séparé** ✅

**Protection FORTE :**
- ✅ Logique métier sur serveur (pas dans l'APK)
- ✅ Orchestration IA côté serveur (GPT-4, Mistral, Claude)
- ✅ Algorithmes d'optimisation livraison (IA) côté serveur
- ✅ Secrets API gérés côté serveur uniquement

**Impact :**
- ✅ Un pirate ne peut pas accéder aux algorithmes IA
- ✅ Ne peut pas utiliser vos API keys directement
- ✅ Ne peut pas copier la logique métier complexe

---

#### **2. React Native/Expo** ✅

**Protection MOYENNE :**
- ✅ Code JavaScript minifié (pas de source claire)
- ✅ Code natif compilé (pas accessible facilement)
- ⚠️ Structure générale peut être analysée

**Impact :**
- ✅ Difficile d'extraire le code source exact
- ⚠️ Architecture générale visible (composants, routes)
- ✅ Idée peut être copiée, mais pas le code complet

---

#### **3. Services externes (Google Maps, etc.)** ⚠️

**Risque si clés dans l'APK :**
- ⚠️ Clés peuvent être extraites et utilisées abusivement
- ⚠️ Coûts potentiels

**Solution :**
- ✅ Utiliser proxy backend (tous les appels passent par votre serveur)
- ✅ Ou retirer les clés avant partage (limiter fonctionnalités Maps)
- ✅ Rate limiting côté backend si possible

---

## 📊 NIVEAU DE RISQUE PAR TYPE

| Type de Risque | Probabilité | Impact | Niveau Global | Protection Actuelle |
|----------------|-------------|--------|---------------|---------------------|
| **Extraction de secrets** | ⚠️ Élevée | 💰💰💰 Critique | 🔴 ÉLEVÉ | ⚠️ À vérifier |
| **Reverse engineering complet** | ⚠️ Moyenne | 📉📉 Moyen | 🟡 MOYEN | ✅ Code minifié |
| **Redistribution non autorisée** | ⚠️ Faible | 📉📉 Moyen | 🟡 MOYEN | ✅ NDA + Tracking |
| **Copie fonctionnalités** | ⚠️ Faible | 📉 Moyen | 🟢 FAIBLE | ✅ Backend protégé |

---

## ✅ RECOMMANDATIONS FINALES

### **Pour minimiser les risques :**

#### **1. AVANT DE PARTAGER (Critique)** 🔴

```bash
# Créer un profil "demo" sans secrets
# Dans eas.json, créer profil "demo-yango"

# Build sécurisé
cd mobile
eas build --platform android --profile demo-yango
```

**Vérifier :**
- ✅ Aucun secret dans `eas.json` profil "demo-yango"
- ✅ Backend gère tous les secrets
- ✅ Version identifiée : "Demo-Yango"

---

#### **2. MESURES D'ACCÈS**

- ✅ **Lien sécurisé** (EAS Build recommandé - expiration automatique)
- ✅ **NDA mentionné** dans message
- ✅ **Watermark** dans l'app
- ✅ **Tracking** (analytics)

---

#### **3. MESURES BACKEND**

- ✅ **Rate limiting** actif
- ✅ **Monitoring** des appels API
- ✅ **Authentification JWT** obligatoire
- ✅ **Alertes** si utilisation anormale

---

## 💡 RÉPONSE DIRECTE

### **L'APK local peut-il être piraté ?**

**Réponse courte :** Oui, un APK peut être analysé, **MAIS** avec les bonnes pratiques, les risques sont **MINIMISÉS**.

**Risques réels :**
1. ⚠️⚠️⚠️ **Extraction de secrets** (CRITIQUE) → **Protection : Retirer tous les secrets**
2. ⚠️ **Reverse engineering** (Moyen) → **Protection : Code minifié + Backend protégé**
3. ⚠️ **Copie idée** (Faible) → **Protection : Backend + First mover**

**Votre architecture vous protège déjà :**
- ✅ **Backend Rust séparé** = Logique métier et IA protégés
- ✅ **React Native/Expo** = Code minifié
- ✅ **Secrets côté serveur** = Pas accessibles dans l'APK

**Action immédiate :**
- ✅ Vérifier que tous les secrets sont retirés avant partage
- ✅ Créer un profil "demo" sans secrets dans `eas.json`
- ✅ Utiliser EAS Build pour lien sécurisé avec expiration

---

## 🚀 SCRIPT DE VÉRIFICATION

### **Vérifier les secrets dans l'APK :**

**Après avoir build l'APK, vous pouvez vérifier :**

```bash
# Télécharger l'APK depuis EAS
# Extraire le contenu
unzip your-app.apk -d extracted

# Chercher des secrets dans le code
grep -r "API_KEY\|SECRET\|TOKEN\|PASSWORD" extracted/

# Si aucun résultat, c'est bon ✅
# Si résultats trouvés, retirer avant partage ⚠️
```

---

## 📋 CHECKLIST COMPLÈTE

### **Avant de partager avec Yango :**

- [ ] **Créer profil "demo-yango" dans `eas.json`** (sans secrets)
- [ ] **Retirer tous les secrets** (API keys, tokens)
- [ ] **Vérifier que backend gère les secrets** (OK pour vous)
- [ ] **Ajouter watermark** "DEMO - YANGO" (optionnel mais recommandé)
- [ ] **Build avec profil demo** : `eas build --platform android --profile demo-yango`
- [ ] **Tester l'APK** sur device Android (vérifier fonctionnement)
- [ ] **Vérifier taille** (< 50MB idéalement)
- [ ] **Préparer message avec NDA** mentionné
- [ ] **Préparer lien sécurisé** (EAS génère automatiquement)
- [ ] **Configurer tracking** (analytics si possible)

---

## 🎯 CONCLUSION

**Résumé :**
- ⚠️ Un APK peut être analysé (c'est normal)
- ✅ Avec les bonnes pratiques, les risques sont **MINIMISÉS**
- ✅ Votre architecture (backend séparé) vous **PROTÈGE FORTEMENT**
- ✅ **Action critique** : Retirer tous les secrets avant partage

**Recommandation :**
1. Créer profil "demo-yango" dans `eas.json` (sans secrets)
2. Build avec ce profil
3. Tester l'APK
4. Partager via lien EAS (expiration automatique)
5. Mentionner NDA dans message

**Protection finale :**
- ✅ Backend protégé = IA et algorithmes non accessibles
- ✅ Secrets retirés = Pas de coûts abusifs
- ✅ Code minifié = Difficile à copier exactement
- ✅ NDA + Tracking = Limite redistribution

---

**Dernière mise à jour :** 2026-01-10

