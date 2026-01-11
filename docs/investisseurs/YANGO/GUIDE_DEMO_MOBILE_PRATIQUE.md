# 📱 GUIDE PRATIQUE : Démo Mobile sans Store (Cloud)

**Contexte :** Application Yukpo non encore disponible sur Google Play / Apple App Store  
**Besoin :** Partager/démontrer l'application aux investisseurs Yango Ventures

---

## 🎯 MÉTHODES PRATIQUES (Par ordre de facilité)

### **1. EXPO EAS BUILD (Recommandé pour React Native/Expo)** ⭐⭐⭐⭐⭐

**Le plus simple et professionnel** - Vous utilisez déjà Expo/EAS !

#### **Comment ça marche :**

```bash
cd mobile
eas build --platform android --profile preview
```

**Résultat :**
- ✅ Build dans le cloud (15-25 min)
- ✅ Lien de téléchargement sécurisé (expire dans 30 jours)
- ✅ QR code pour téléchargement direct
- ✅ Pas besoin de serveur/storage
- ✅ Analytics (qui a téléchargé)

**Avantages :**
- ✅ Très simple (une commande)
- ✅ Lien sécurisé automatique
- ✅ Pas de gestion de stockage
- ✅ Professionnel (Expressive pour investisseurs)
- ✅ Gestion automatique (expiration, analytics)

**Inconvénients :**
- ⚠️ Nécessite compte Expo (gratuit)
- ⚠️ Build prend 15-25 min

**Message type :**
```
📱 Application Yukpo - Lien de téléchargement :
https://expo.dev/artifacts/... (lien généré par EAS)

Scannez le QR code ci-dessous pour télécharger directement sur Android.
Ou téléchargez l'APK via le lien ci-dessus.

Lien valable 30 jours.
```

---

### **2. DROPBOX / GOOGLE DRIVE (Simple et direct)** ⭐⭐⭐⭐

**Méthode classique et universelle**

#### **Étapes :**

1. **Uploader l'APK** sur Dropbox ou Google Drive
2. **Créer un lien de partage**
3. **Protéger par mot de passe** (optionnel mais recommandé)
4. **Expirer après 7-30 jours**

#### **Dropbox Business (Recommandé) :**

**Avantages :**
- ✅ Simple (glisser-déposer)
- ✅ Lien sécurisé possible
- ✅ Mot de passe disponible
- ✅ Expiration automatique
- ✅ Traçabilité (analytics)

**Message type :**
```
📱 Application Yukpo (APK Android)

Lien de téléchargement : https://www.dropbox.com/s/.../yukpo-demo.apk
Mot de passe : Yukpo2026Yango (optionnel)

Fichier : Yukpo-Demo-v1.0-Android.apk (~25-50 MB)
Valide : 7 jours

Installation : Activer "Sources inconnues" puis installer.
```

#### **Google Drive (Alternative) :**

**Avantages :**
- ✅ Intégration Google Workspace
- ✅ Partage sécurisé
- ✅ Limite 15GB gratuit
- ✅ Traçabilité

---

### **3. WETRANSFER / SENDANYWHERE (Temporaire)** ⭐⭐⭐

**Pour partage rapide et temporaire**

#### **WeTransfer :**

**Avantages :**
- ✅ Simple (drag & drop)
- ✅ Lien automatique
- ✅ Expiration 7 jours (gratuit) ou 1 an (payant)
- ✅ Pas de compte requis
- ✅ Limite 2GB gratuit

**Inconvénients :**
- ⚠️ Pas de mot de passe (gratuit)
- ⚠️ Pas de traçabilité détaillée

**Utilisation :**
1. Aller sur https://wetransfer.com
2. Uploader l'APK
3. Entrer email destinataire (vc@yango.com)
4. Envoyer

**Message type :**
```
📱 Application Yukpo

J'ai partagé l'APK via WeTransfer (lien reçu par email).
Lien valable 7 jours.

Fichier : Yukpo-Demo-v1.0-Android.apk
```

---

### **4. SERVEUR PERSONNEL / VPS (Contrôle total)** ⭐⭐⭐

**Si vous avez un serveur/VPS**

#### **Méthode :**

1. **Uploader APK sur serveur** (ex: via SFTP/SCP)
2. **Créer page de téléchargement simple** (HTML)
3. **Ajouter authentification** (login/mot de passe)
4. **Gérer expiration** (manuel ou script)

**Avantages :**
- ✅ Contrôle total
- ✅ Traçabilité complète
- ✅ Personnalisable
- ✅ Pas de limites

**Inconvénients :**
- ⚠️ Nécessite serveur/VPS
- ⚠️ Plus technique
- ⚠️ Maintenance requise

**Page HTML simple :**
```html
<!DOCTYPE html>
<html>
<head>
    <title>Yukpo - Download Demo</title>
</head>
<body>
    <h1>Yukpo Mobile - Version Démo</h1>
    <p>Application Android (APK)</p>
    <a href="yukpo-demo-v1.0.apk" download>📱 Télécharger APK</a>
    <p><small>Version démo - Yango Ventures - Janvier 2026</small></p>
</body>
</html>
```

---

### **5. EMAIL DIRECT (Si APK < 25MB)** ⭐⭐

**Simple mais limité**

**Avantages :**
- ✅ Très simple
- ✅ Direct

**Inconvénients :**
- ⚠️ Limite taille (25MB généralement)
- ⚠️ Moins sécurisé
- ⚠️ Pas d'expiration automatique
- ⚠️ Bloqué par certains firewalls

**Recommandation :** Utiliser si APK < 25MB **ET** NDA signé

---

### **6. EXPO GO (Pour tests rapides)** ⭐⭐⭐⭐

**Pour démonstration interactive rapide**

#### **Comment ça marche :**

**Méthode 1 : QR Code (Expo Go)**
```bash
cd mobile
npx expo start --tunnel
```

**Résultat :**
- ✅ QR code généré
- ✅ Investisseur installe Expo Go (gratuit)
- ✅ Scanne QR code
- ✅ Application charge en direct
- ✅ Mises à jour en temps réel

**Avantages :**
- ✅ Instantané (pas de build)
- ✅ Gratuit
- ✅ Mises à jour en temps réel
- ✅ Démo interactive

**Inconvénients :**
- ⚠️ Nécessite Expo Go installé
- ⚠️ Nécessite internet actif
- ⚠️ Moins "professionnel" qu'un APK standalone

**Message type :**
```
📱 Démonstration Yukpo via Expo Go

1. Installer Expo Go depuis Google Play Store
2. Scanner le QR code ci-dessous
3. L'application se charge automatiquement

QR Code : [GÉNÉRÉ PAR EXPO]
Lien direct : exp://...

Cette méthode permet de tester l'application en temps réel.
```

---

### **7. DÉMO EN DIRECT (Vidéoconférence)** ⭐⭐⭐⭐⭐

**Le plus sûr et professionnel pour première impression**

#### **Options :**

**Option A : Screen Sharing (Votre téléphone)**
- Partagez votre écran (téléphone via câble USB + miroir écran)
- Naviguez dans l'application en direct
- Expliquez les fonctionnalités
- Questions-réponses immédiates

**Avantages :**
- ✅ Contrôle total
- ✅ Pas de partage de fichier
- ✅ Interaction directe
- ✅ Professionnel
- ✅ Pas de risque technique

**Outils :**
- Zoom / Google Meet (screen sharing)
- Scrcpy (Android vers PC, puis screen share)
- AirDroid / Vysor (miroir Android)
- iPhone : QuickTime (Mac) ou AirPlay

**Option B : Démo guidée (Partage contrôle)**
- Partagez contrôle de votre téléphone
- Investisseur peut tester en direct
- Vous guidez en même temps

---

### **8. VIDÉO DÉMO (2-3 min)** ⭐⭐⭐⭐

**Pour teaser rapide avant partage APK**

#### **Créer une vidéo :**

**Options :**
- Enregistrement écran téléphone (built-in Android/iOS)
- OBS Studio + Scrcpy (plus professionnel)
- Loom / ScreenPal (simple et rapide)

**Contenu recommandé :**
- 0:00-0:30 : Vue d'ensemble, problème résolu
- 0:30-1:30 : Fonctionnalités clés (recherche, création digitale, multi-secteurs)
- 1:30-2:00 : Interface utilisateur, design
- 2:00-2:30 : Call-to-action (discussion, financement)

**Partage :**
- YouTube (privé, lien partagé)
- Vimeo (privé)
- Google Drive / Dropbox
- Lien direct

**Message type :**
```
📹 Vidéo Démo Yukpo (2 min)

Voici une démonstration vidéo de l'application Yukpo :

Lien vidéo : https://youtube.com/watch?v=... (privé)

La vidéo montre les fonctionnalités clés :
- Création digitale commerçants (5 min)
- Recherche intelligente texte/audio/photo
- Multi-secteurs (e-commerce + services)
- Interface utilisateur complète

Disponible pour partager l'APK si vous souhaitez tester en direct.
```

---

## 🎯 MÉTHODE RECOMMANDÉE POUR YANGO (Par phase)

### **PHASE 1 : Email initial**
- ❌ Pas d'APK
- ✅ Vidéo démo (2-3 min) - **OPTIONNEL mais recommandé**
- ✅ Mention dans email : "Vidéo démo disponible sur demande"

### **PHASE 2 : Si intérêt (après réponse positive)**
- ✅ **Expo EAS Build** (lien sécurisé) - **RECOMMANDÉ**
- ✅ Ou Dropbox/Google Drive (lien protégé)
- ✅ Message : `MESSAGE_PARTAGE_APK_YANGO.txt`

### **PHASE 3 : Réunion pitch (si planifiée)**
- ✅ **Démo en direct** (screen sharing) - **FORTEMENT RECOMMANDÉ**
- ✅ + APK partagé après réunion pour tests approfondis

---

## 🚀 MÉTHODE RAPIDE : Expo EAS Build (Votre cas)

### **Étapes complètes :**

#### **1. Vérifier configuration EAS**

```bash
cd mobile
eas whoami  # Vérifier connexion
```

#### **2. Build APK preview**

```bash
eas build --platform android --profile preview
```

**Temps :** 15-25 minutes  
**Résultat :** Lien de téléchargement automatique

#### **3. Récupérer le lien**

- Dashboard Expo : https://expo.dev/accounts/hernandezlele/projects/yukpomnang-mobile-new/builds
- Ou lien direct dans terminal après build

#### **4. Partager avec Yango**

```
📱 Application Yukpo - Lien de téléchargement

Lien : https://expo.dev/artifacts/... (généré par EAS)

Installation Android :
1. Cliquer sur le lien ci-dessus
2. Télécharger l'APK
3. Activer "Sources inconnues" dans Paramètres > Sécurité
4. Installer l'application

Cette version reflète 95% de l'application finale qui sera disponible 
sur Google Play et Apple App Store après financement Seed.

Lien valable 30 jours.
```

---

## 📊 COMPARAISON DES MÉTHODES

| Méthode | Simplicité | Sécurité | Professionnel | Contrôle | Recommandé |
|---------|------------|----------|---------------|----------|------------|
| **Expo EAS Build** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ OUI |
| **Dropbox/Drive** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ✅ OUI |
| **WeTransfer** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ✅ Alternative |
| **Email direct** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⚠️ Si < 25MB |
| **Expo Go** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ✅ Tests rapides |
| **Démo en direct** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ Réunion |
| **Vidéo démo** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ Phase 1 |

---

## 🎯 STRATÉGIE RECOMMANDÉE POUR YANGO

### **Phase 1 : Email initial**
**À inclure dans email :**
```
📹 Vidéo démo disponible : [LIEN YouTube privé ou Drive]
📱 Application mobile : Disponible sur demande (après intérêt confirmé)
```

### **Phase 2 : Si intérêt confirmé**
**Méthode : Expo EAS Build** (le plus simple pour vous)
```bash
cd mobile
eas build --platform android --profile preview
# Partager le lien généré
```

**Ou Dropbox/Google Drive** (si vous préférez)
- Uploader APK
- Créer lien protégé
- Expiration 7-30 jours

### **Phase 3 : Réunion pitch**
**Démo en direct** + APK partagé après

---

## ✅ CHECKLIST PRATIQUE

### **Avant de partager l'APK :**

- [ ] Build release (pas debug)
- [ ] Vérifier secrets/API keys retirés
- [ ] Version identifiée (ex: "Demo-v1.0-Yango")
- [ ] Tester sur device Android
- [ ] Taille APK vérifiée (< 50MB idéalement)
- [ ] Lien sécurisé préparé (EAS/Dropbox/Drive)
- [ ] Message type préparé
- [ ] Instructions installation incluses

### **Méthode de partage :**

- [ ] **Expo EAS Build** (recommandé) OU
- [ ] Dropbox/Google Drive (lien protégé) OU
- [ ] WeTransfer (si temporaire)
- [ ] Message envoyé avec lien
- [ ] Suivi dans 2-3 jours

---

## 💡 CONSEILS PRATIQUES

### **1. Taille de l'APK**

- **APK typique React Native :** 25-50 MB
- **Email limit :** Généralement 25MB max
- **Recommandation :** Utiliser lien (EAS/Dropbox/Drive) plutôt qu'email si > 25MB

### **2. Installation Android**

**Problème courant :** "Sources inconnues" bloqué

**Solution :**
```
Paramètres > Sécurité > Activer "Sources inconnues"
OU
Paramètres > Applications > Installations spéciales > Activer "Installer des applications inconnues"
```

**Instructions à inclure dans message :**
```
📋 INSTALLATION ANDROID

1. Paramètres > Sécurité > Activer "Sources inconnues" (ou "Installer des applications inconnues")
2. Télécharger l'APK via le lien
3. Ouvrir le fichier téléchargé
4. Appuyer sur "Installer"
5. Attendre l'installation (30-60 secondes)
6. Ouvrir l'application

⚠️ Si erreur d'installation : Vérifier que "Sources inconnues" est bien activé
```

### **3. Si problèmes de téléchargement**

**Alternative : Démo via Expo Go**
```bash
cd mobile
npx expo start --tunnel
# Partager QR code ou lien
```

**Avantages :**
- ✅ Pas de problèmes d'installation
- ✅ Direct via Expo Go (gratuit)
- ✅ Mises à jour en temps réel

---

## 📱 MESSAGE TYPE COMPLET (Expo EAS Build)

```
Objet : 📱 Application Mobile Yukpo - Démonstration | Yango Ventures

Bonjour [Nom],

Suite à notre échange sur Yukpo, je vous partage l'application mobile pour démonstration.

📱 TÉLÉCHARGEMENT ANDROID

Lien : https://expo.dev/artifacts/... (généré par EAS)
QR Code : [Inclure QR code si possible]

Cette version reflète 95% de l'application finale qui sera disponible 
sur Google Play et Apple App Store après financement Seed.

✅ FONCTIONNALITÉS À TESTER :
- Création digitale commerçants (5 min, gratuite)
- Recherche intelligente texte/audio/photo + géolocalisation
- Multi-secteurs : e-commerce + services (santé, éducation, transport, immobilier)
- Interface utilisateur complète
- Optimisation livraison par IA

📋 INSTALLATION :
1. Cliquer sur le lien ci-dessus (ou scanner QR code)
2. Télécharger l'APK
3. Activer "Sources inconnues" : Paramètres > Sécurité > Installer des applications inconnues
4. Ouvrir le fichier téléchargé et installer
5. L'application s'ouvre automatiquement après installation

⚠️ NOTE IMPORTANTE :
- Version de démonstration (données de test incluses)
- Application fonctionnelle et opérationnelle
- Lien valable 30 jours
- Code React Native/Expo optimisé

🔒 CONFIDENTIALITÉ :
Cette application est partagée sous confidentialité dans le cadre de notre 
discussion d'investissement.

📞 SUPPORT :
Disponible pour toute question technique ou démonstration en direct.

Cordialement,
Hernandez LELE
Fondateur & CEO - Yukpo
📧 lelehernandez2007@yahoo.fr | 📱 +237 674 546895
```

---

## 🎯 RECOMMANDATION FINALE

### **Pour Yango Ventures :**

**Phase 1 (Maintenant) :**
- Email + One-Pager
- Mention : "Vidéo démo et application mobile disponibles sur demande"

**Phase 2 (Si intérêt) :**
- **Expo EAS Build** (méthode la plus simple pour vous)
- OU Dropbox/Google Drive si vous préférez
- Message : `MESSAGE_PARTAGE_APK_YANGO.txt`

**Phase 3 (Réunion pitch) :**
- Démo en direct (screen sharing)
- + APK partagé après pour tests approfondis

### **Pour vous (Expo/EAS) :**

**Commande unique :**
```bash
cd mobile
eas build --platform android --profile preview
```

**Résultat :**
- Lien de téléchargement sécurisé
- QR code pour téléchargement direct
- Expiration automatique (30 jours)
- Analytics

**Temps total :** 15-25 min de build + 5 min de partage = **30 min max**

---

**Conclusion :** **OUI, vous pouvez facilement partager l'APK** via Expo EAS Build (recommandé) ou Dropbox/Drive. C'est une pratique standard pour les investisseurs lors de due diligence.

**Dernière mise à jour :** 2026-01-10

