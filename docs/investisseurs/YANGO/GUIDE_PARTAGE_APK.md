# 📱 GUIDE : Partage de l'APK avec Investisseurs Yango Ventures

**Date :** Janvier 2026  
**Contexte :** Due diligence avec Yango Ventures  
**Application :** Yukpo Mobile (React Native/Expo)

---

## ✅ EST-CE QUE VOUS POUVEZ ENVOYER L'APK ?

### **OUI, MAIS avec précautions et bonnes pratiques**

**Risque :** Faible à modéré selon la méthode de partage  
**Avantage :** Démontre le produit opérationnel, réduit les risques perçus, accélère due diligence  
**Recommandation :** **OUI, après Phase 1 (email + one-pager) et si intérêt confirmé**

---

## ⚠️ RISQUES À CONSIDÉRER

### **1. Risques Techniques**

| Risque | Niveau | Mitigation |
|--------|--------|------------|
| **APK reverse-engineered** | Faible-Moyen | Signer APK, utiliser ProGuard/R8, ne pas inclure secrets |
| **Code source extrait** | Moyen | Code déjà protégé si build release, React Native minifié |
| **Secrets/API keys exposés** | Élevé ⚠️ | **CRITIQUE : Vérifier avant envoi** |
| **Infrastructure backend exposée** | Faible | Backend séparé, URLs ne révèlent pas l'architecture complète |

### **2. Risques Business**

| Risque | Niveau | Mitigation |
|--------|--------|------------|
| **Idée copiée** | Faible | Premier avantage + produit complexe, exécution difficile |
| **Stratégie exposée** | Faible | Informations déjà dans documents de financement |
| **Données utilisateurs** | Faible | APK ne contient pas de données utilisateurs |
| **Concurrence** | Faible | Yango Ventures = investisseur, pas concurrent |

### **3. Risques Légaux**

| Risque | Niveau | Mitigation |
|--------|--------|------------|
| **NDA manquant** | Moyen ⚠️ | **Recommandé : Demander NDA avant partage APK** |
| **Propriété intellectuelle** | Faible | Vous restez propriétaire, APK = démo |
| **Violation confidentialité** | Faible | Si NDA signé, risque minimal |

---

## 🎯 RECOMMANDATIONS STRATÉGIQUES

### **QUAND ENVOYER L'APK ?**

#### ✅ **Moment Optimal : Phase 2-3 (Si intérêt confirmé)**

| Phase | Action | Envoi APK ? |
|-------|--------|-------------|
| **Phase 1 : Email initial** | Email + One-Pager | ❌ NON |
| **Phase 2 : Si intérêt** | Package complet + Réunion pitch | ✅ **OUI (avec préparation)** |
| **Phase 3 : Due diligence** | Documents financiers + Réunion | ✅ **OUI (fortement recommandé)** |
| **Phase 4 : Term sheet** | Négociation | ✅ **OUI (avec NDA signé)** |

**Recommandation :** Envoyer l'APK **après la première réunion positive** (Phase 2-3), quand l'intérêt est confirmé et avant due diligence approfondie.

---

## 🛡️ PRÉPARATION AVANT ENVOI

### **CHECKLIST SÉCURITÉ (À faire AVANT envoi)**

- [ ] **Vérifier secrets/API keys** : Scanner l'APK pour secrets hardcodés
- [ ] **Retirer données de test sensibles** : Pas de données utilisateurs réelles
- [ ] **Build release (pas debug)** : Code minifié, ProGuard activé
- [ ] **Version démo/test** : Considérer version avec données mock si besoin
- [ ] **Signer APK** : Utiliser keystore de production (ou test)
- [ ] **Vérifier URLs backend** : URLs publiques OK, pas d'IPs internes
- [ ] **Désactiver fonctionnalités sensibles** : Si nécessaire, version limitée pour démo
- [ ] **Version et date** : Identifier clairement (ex: "Yukpo-Demo-v1.0-Yango-2026-01-10")

---

## 📋 MÉTHODES DE PARTAGE RECOMMANDÉES (par sécurité)

### **1. Méthode RECOMMANDÉE : Lien de téléchargement sécurisé**

**Avantages :**
- ✅ Contrôle d'accès (login/mot de passe)
- ✅ Traçabilité (qui a téléchargé)
- ✅ Révocable (peut supprimer le lien)
- ✅ Expiration automatique

**Implémentation :**
```
Option 1 : Dropbox Business / Google Drive (lien protégé par mot de passe)
Option 2 : Service dédié (WeTransfer Business, SendAnywhere)
Option 3 : Votre propre serveur avec authentification
```

**Message type :**
> "Je vous partage l'APK de démonstration via un lien sécurisé. L'application reflète 95% de la version finale qui sera disponible sur Google Play et Apple App Store. Le lien est valable 7 jours et protégé par mot de passe."

---

### **2. Méthode ALTERNATIVE : Email avec pièce jointe (si < 25MB)**

**Avantages :**
- ✅ Simple et direct
- ✅ Traçable (email reçu)

**Inconvénients :**
- ⚠️ Moins sécurisé
- ⚠️ Limite taille (généralement 25MB max)

**Recommandation :** Utiliser si APK < 25MB **ET** NDA signé

---

### **3. Méthode SÉCURISÉE : Build Expo EAS (Recommandé pour React Native)**

**Avantages :**
- ✅ Build professionnel et optimisé
- ✅ Lien de téléchargement Expo géré
- ✅ Version de test isolée
- ✅ Expiration automatique
- ✅ Analytics de téléchargement

**Commande :**
```bash
eas build --platform android --profile preview
# Génère un lien de téléchargement sécurisé
```

**Message type :**
> "Je vous partage un lien de build de test via Expo. Cette version reflète 95% de l'application finale. Vous pouvez installer directement sur Android via le lien (expire dans 30 jours)."

---

## 📝 MESSAGE TYPE POUR ENVOI APK

### **Option 1 : Avec lien sécurisé (Recommandé)**

```
Bonjour [Nom],

Merci pour l'intérêt porté à Yukpo. Comme discuté, je vous partage l'application mobile pour démonstration.

📱 APPLICATION MOBILE YUKPO
- Lien de téléchargement sécurisé : [LIEN]
- Mot de passe : [MOT DE PASSE]
- Validité : 7 jours

⚠️ NOTE IMPORTANTE
- Cette version reflète 95% de l'application finale
- Version de démonstration (données de test incluses)
- L'application finale sera disponible sur Google Play et Apple App Store après financement
- N'hésitez pas à tester toutes les fonctionnalités

🔒 CONFIDENTIALITÉ
Cette application est partagée sous confidentialité. Si vous n'avez pas encore signé notre NDA, je vous invite à le faire avant installation.

📋 INSTALLATION ANDROID
1. Activer "Sources inconnues" dans Paramètres > Sécurité
2. Télécharger l'APK via le lien
3. Installer l'application
4. La première ouverture peut prendre quelques secondes (téléchargement des ressources)

Disponible pour toute question ou démo en direct.

Cordialement,
Hernandez LELE
```

### **Option 2 : Version courte (Si NDA déjà signé)**

```
Bonjour,

Comme convenu, voici l'application mobile Yukpo pour démonstration :

📱 Lien de téléchargement : [LIEN]
- Version : Yukpo-Demo-v1.0-Android
- Cette version reflète 95% de l'application finale
- Disponible sur Google Play / Apple App Store après financement

Installation Android : Activer "Sources inconnues" puis installer l'APK.

Disponible pour toute question.

Cordialement,
Hernandez LELE
```

---

## 🔒 SÉCURISATION SPÉCIFIQUE APK

### **1. Vérifier les Secrets (CRITIQUE)**

**Commandes pour vérifier :**
```bash
# Scanner pour API keys, tokens, etc.
grep -r "api_key\|API_KEY\|secret\|SECRET\|password\|PASSWORD" android/app/src/
grep -r "sk-\|pk_\|Bearer\|token\|TOKEN" android/app/src/

# Vérifier les variables d'environnement
cat android/app/build.gradle | grep -i "buildConfigField"
```

**À RETIRER avant build release :**
- ❌ API keys hardcodées
- ❌ Tokens d'authentification
- ❌ Mots de passe
- ❌ URLs backend internes
- ❌ Clés de chiffrement

**Solution :** Utiliser variables d'environnement ou fichier de config non versionné

---

### **2. Build Release Optimisé**

**Android :**
```bash
# Build release signé
cd android
./gradlew assembleRelease

# Ou via Expo EAS (Recommandé)
eas build --platform android --profile production
```

**Vérifications :**
- ✅ Code minifié
- ✅ ProGuard/R8 activé (obfuscation)
- ✅ APK signé avec keystore
- ✅ Pas de logs de debug
- ✅ Version name/code corrects

---

### **3. Version de Démo (Optionnel mais recommandé)**

**Avantages d'une version démo :**
- ✅ Données mock incluses (pas besoin de backend)
- ✅ Fonctionnalités principales démontrables
- ✅ Pas de connexion backend requise
- ✅ Contrôle total sur l'expérience

**Si vous créez une version démo :**
```
- Données de test préchargées
- Comptes de démonstration inclus
- Mode offline disponible
- Pas d'appels API réels (ou API de test séparée)
```

---

## 📊 COMPARAISON : APK vs Version Store

### **L'APK reflète-t-il 95% de la version finale ?**

| Aspect | APK Actuel | Version Store Finale | Différence |
|--------|------------|---------------------|------------|
| **Code source** | ✅ Même code | ✅ Même code | 0% |
| **Fonctionnalités** | ✅ 95% identiques | ✅ 100% | 5% (optimisations) |
| **Design/UI** | ✅ Identique | ✅ Identique | 0% |
| **Performance** | ✅ Optimisé | ✅ Plus optimisé | Améliorations mineures |
| **Signature** | Test/Release | Production | Signing différent |
| **Distribution** | Manuel (APK) | Store (Play/App Store) | Méthode différente |
| **Mises à jour** | Manuel | Automatique | Système OTA |

**Conclusion :** OUI, l'APK reflète **effectivement 95%** de la version finale. Les différences sont principalement :
- Signature de production vs test
- Optimisations finales mineures
- Système de distribution (store vs manuel)
- Updates OTA (Over-The-Air) pour stores

---

## 🎯 STRATÉGIE RECOMMANDÉE POUR YANGO

### **Timeline de Partage**

| Étape | Document/Produit | Quand |
|-------|------------------|-------|
| **Phase 1** | Email + One-Pager | ✅ Maintenant |
| **Phase 2 (Si intérêt)** | Executive Summary + Document complet | Semaine 2-3 |
| **Phase 2-3 (Réunion pitch)** | **APK Mobile** | **Après première réunion positive** |
| **Phase 3 (Due diligence)** | Financial Summary + Code review (si demandé) | Semaine 3-4 |
| **Phase 4 (Term sheet)** | Accès complet (avec NDA) | Semaine 6-8 |

### **Message à Yango lors du partage :**

```
Bonjour [Nom],

Suite à notre échange, je vous partage l'application mobile Yukpo pour démonstration.

📱 APPLICATION YUKPO (ANDROID)
Lien : [LIEN SÉCURISÉ]
Cette version reflète 95% de l'application finale qui sera disponible sur 
Google Play et Apple App Store après financement Seed.

FONCTIONNALITÉS À TESTER :
✅ Création digitale commerçants (5 min)
✅ Recherche intelligente texte/audio/photo
✅ Géolocalisation précise
✅ Multi-secteurs (e-commerce + services)
✅ Interface utilisateur complète

NOTE : Application en mode démonstration avec données de test.

Disponible pour une démo en direct ou toute question technique.

Cordialement,
Hernandez LELE
```

---

## ⚖️ RISQUES vs AVANTAGES

### **AVANTAGES d'envoyer l'APK :**

| Avantage | Impact | Poids |
|----------|--------|-------|
| **Démontre produit opérationnel** | Élevé | ⭐⭐⭐⭐⭐ |
| **Réduit risque perçu** | Élevé | ⭐⭐⭐⭐⭐ |
| **Accélère due diligence** | Moyen | ⭐⭐⭐⭐ |
| **Différenciation vs concurrents** | Moyen | ⭐⭐⭐⭐ |
| **Confiance accrue** | Élevé | ⭐⭐⭐⭐⭐ |
| **Preuve d'exécution** | Élevé | ⭐⭐⭐⭐⭐ |

### **RISQUES d'envoyer l'APK :**

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Code copié** | Très faible | Faible | Reverse engineering difficile, NDA |
| **Idée volée** | Très faible | Faible | Premier avantage, exécution complexe |
| **Secrets exposés** | Moyen ⚠️ | Élevé | **Vérification avant envoi (CRITIQUE)** |
| **Concurrence** | Très faible | Faible | Yango = investisseur, pas concurrent |

**Conclusion :** Les avantages l'emportent largement sur les risques si :
1. ✅ Secrets vérifiés et retirés
2. ✅ NDA signé (recommandé)
3. ✅ Partage via lien sécurisé
4. ✅ Moment approprié (Phase 2-3)

---

## 🔐 CHECKLIST AVANT ENVOI APK

### **Sécurité Technique**

- [ ] Scan pour secrets/API keys (aucun trouvé)
- [ ] Build release (pas debug)
- [ ] ProGuard/R8 activé (obfuscation)
- [ ] APK signé correctement
- [ ] Pas de logs de debug
- [ ] URLs backend publiques (pas IPs internes)
- [ ] Version identifiée (ex: "Demo-v1.0-Yango")

### **Sécurité Business**

- [ ] NDA signé (recommandé fortement)
- [ ] Moment approprié (Phase 2-3, intérêt confirmé)
- [ ] Partage via lien sécurisé (pas email direct si > 25MB)
- [ ] Lien avec expiration (7-30 jours)
- [ ] Mot de passe sur lien (si service le permet)
- [ ] Traçabilité (savoir qui télécharge)

### **Préparation**

- [ ] Message type préparé
- [ ] Instructions d'installation incluses
- [ ] Fonctionnalités à tester listées
- [ ] Version démo avec données mock (optionnel)
- [ ] Support disponible (réponses aux questions)

---

## 💡 ALTERNATIVES SI RISQUE TROP ÉLEVÉ

### **Option 1 : Build Expo EAS (Recommandé)**

**Avantages :**
- ✅ Build professionnel géré par Expo
- ✅ Lien de téléchargement sécurisé
- ✅ Expiration automatique
- ✅ Analytics

**Commande :**
```bash
eas build --platform android --profile preview --non-interactive
```

---

### **Option 2 : Démo en direct (vidéoconférence)**

**Avantages :**
- ✅ Contrôle total
- ✅ Présentation guidée
- ✅ Pas de partage de fichiers
- ✅ Interaction directe

**À organiser si :**
- Préférence pour présentation guidée
- Questions techniques nombreuses
- Besoin d'explications détaillées

---

### **Option 3 : Vidéo démo (2-3 min)**

**Avantages :**
- ✅ Pas de partage de code
- ✅ Contrôle du message
- ✅ Reutilisable
- ✅ Professionnel

**À créer si :**
- Hésitation sur partage APK
- Besoin de teaser rapide
- Plusieurs investisseurs à contacter

---

## 📞 RECOMMANDATION FINALE

### **✅ OUI, ENVOYEZ L'APK, MAIS :**

1. **Timing :** Après Phase 1 (email + one-pager) **ET** intérêt confirmé (Phase 2-3)
2. **Sécurité :** Vérifier secrets, build release, NDA recommandé
3. **Méthode :** Lien sécurisé (Dropbox/Drive/Expo EAS) plutôt qu'email direct
4. **Message :** Inclure instructions, fonctionnalités à tester, note sur version
5. **Support :** Être disponible pour questions techniques

### **📱 Méthode Recommandée :**

**Expo EAS Build (si React Native/Expo) :**
```bash
eas build --platform android --profile preview
# Génère un lien de téléchargement sécurisé avec expiration
```

**Ou Dropbox/Google Drive (lien protégé par mot de passe)**

---

## ✅ ACTION IMMÉDIATE

1. **Vérifier l'APK actuel :** Scanner pour secrets, tester sur device
2. **Préparer build release** : Version optimisée et sécurisée
3. **Créer lien sécurisé** : Via Expo EAS, Dropbox, ou Google Drive
4. **Préparer message** : Utiliser le template ci-dessus
5. **Attendre intérêt confirmé** : Après Phase 1, lors de Phase 2-3

---

**Dernière mise à jour :** 2026-01-10  
**Statut :** ✅ OUI, envoyer APK avec précautions après intérêt confirmé

