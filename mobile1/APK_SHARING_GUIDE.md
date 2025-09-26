# 📱 Guide de Partage d'APK - Yukpomnang Mobile

## 🎯 Objectif

Ce guide vous explique comment partager l'APK de production de Yukpomnang Mobile avec d'autres personnes pour qu'elles puissent tester l'application sur leurs smartphones Android.

## 🏗️ Construction de l'APK

### Option 1: Build Rapide (Recommandé)
```bash
cd mobile
.\scripts\quick-build-apk.ps1
```

### Option 2: Build Complet
```bash
cd mobile
.\scripts\build-production-apk.ps1
```

## 📲 Partage de l'APK

### 1. Téléchargement
- **Lien fourni par EAS** : Après le build, vous recevrez un lien de téléchargement
- **Téléchargez l'APK** sur votre ordinateur
- **Vérifiez la taille** : L'APK fait environ 50-100 MB

### 2. Méthodes de partage

#### 📧 Email
- **Taille limite** : 25 MB (Gmail), 50 MB (Outlook)
- **Solution** : Utilisez Google Drive, Dropbox, ou WeTransfer
- **Instructions** : Incluez le guide d'installation

#### ☁️ Cloud Storage
- **Google Drive** : Partagez le lien avec les testeurs
- **Dropbox** : Partagez le lien avec les testeurs
- **OneDrive** : Partagez le lien avec les testeurs

#### 💬 Messaging
- **WhatsApp** : Partagez le fichier directement
- **Telegram** : Partagez le fichier directement
- **Discord** : Partagez le fichier directement

#### 🔗 Lien direct
- **EAS Build** : Partagez directement le lien de téléchargement
- **Avantage** : Pas besoin de télécharger d'abord

## 📱 Installation sur Android

### Instructions pour les testeurs

#### 1. Autoriser l'installation d'applications inconnues
- **Android 8+** : Paramètres > Applications > Accès spécial > Installer des applications inconnues
- **Android 7-** : Paramètres > Sécurité > Sources inconnues

#### 2. Télécharger l'APK
- **Depuis le lien** : Ouvrir le lien dans le navigateur
- **Depuis le fichier** : Transférer l'APK sur le téléphone

#### 3. Installer l'APK
- **Ouvrir le fichier** : Taper sur l'APK téléchargé
- **Confirmer l'installation** : Accepter les permissions
- **Attendre l'installation** : 1-2 minutes

#### 4. Lancer l'application
- **Icône Yukpomnang** : Apparaît dans le menu des applications
- **Premier lancement** : Accepter les permissions (localisation, etc.)

## ⚠️ Permissions requises

### Permissions Android
- **Localisation** : Pour la géolocalisation
- **Caméra** : Pour la prise de photos
- **Stockage** : Pour sauvegarder les images
- **Internet** : Pour l'accès à l'API

### Permissions iOS
- **Localisation** : Pour la géolocalisation
- **Caméra** : Pour la prise de photos
- **Photos** : Pour accéder à la galerie

## 🧪 Tests recommandés

### Fonctionnalités à tester
- [ ] **Authentification** : Login/Register
- [ ] **Géolocalisation** : Récupération de position
- [ ] **Services** : Liste et recherche
- [ ] **Chat IA** : Interaction avec l'IA
- [ ] **Navigation** : Tous les écrans
- [ ] **Performance** : Temps de chargement

### Appareils de test
- **Android 8+** : Recommandé
- **Android 7** : Compatible
- **Android 6** : Limité
- **iOS** : Non compatible (APK Android uniquement)

## 🔧 Dépannage

### Problèmes courants

#### 1. "Application non installée"
- **Cause** : Permissions d'installation non autorisées
- **Solution** : Autoriser les sources inconnues

#### 2. "Erreur d'installation"
- **Cause** : APK corrompu ou incompatible
- **Solution** : Télécharger à nouveau l'APK

#### 3. "Application ne se lance pas"
- **Cause** : Permissions manquantes
- **Solution** : Vérifier les permissions dans les paramètres

#### 4. "Erreur de connexion"
- **Cause** : Problème de réseau ou API
- **Solution** : Vérifier la connexion Internet

### Solutions
1. **Redémarrer l'application**
2. **Vérifier la connexion Internet**
3. **Vérifier les permissions**
4. **Contacter le support**

## 📊 Suivi des tests

### Informations à collecter
- **Appareil** : Modèle et version Android
- **Version de l'APK** : Version testée
- **Bugs rencontrés** : Description détaillée
- **Performance** : Temps de chargement, fluidité
- **Fonctionnalités** : Ce qui fonctionne/ne fonctionne pas

### Rapport de test
```
📱 Appareil: Samsung Galaxy S21, Android 12
📱 APK: Yukpomnang v1.0.0
🌐 Réseau: WiFi 4G

✅ Fonctionnalités qui marchent:
- Authentification
- Géolocalisation
- Services

❌ Problèmes rencontrés:
- Chat IA ne répond pas
- Lenteur sur certains écrans

📸 Captures d'écran: [Inclure si possible]
```

## 🔄 Mises à jour

### Nouvelle version
1. **Construire un nouvel APK** avec les corrections
2. **Partager le nouvel APK** avec les testeurs
3. **Informer des changements** dans la nouvelle version
4. **Collecter les retours** sur les améliorations

### Versioning
- **v1.0.0** : Version initiale
- **v1.0.1** : Corrections de bugs
- **v1.1.0** : Nouvelles fonctionnalités
- **v2.0.0** : Version majeure

## 📞 Support

### Pour les développeurs
- **Email** : support@yukpomnang.com
- **Discord** : [Serveur Yukpomnang](https://discord.gg/yukpomnang)
- **GitHub** : [Issues](https://github.com/yukpomnang/mobile/issues)

### Pour les testeurs
- **Email** : support@yukpomnang.com
- **WhatsApp** : [Groupe de test](https://wa.me/group-link)
- **Telegram** : [Canal de test](https://t.me/yukpomnang-test)

## 🎯 Prochaines étapes

### Après les tests
1. **Corriger les bugs** identifiés
2. **Optimiser les performances**
3. **Améliorer l'interface**
4. **Préparer la version finale**

### Déploiement en production
1. **Build final** avec toutes les corrections
2. **Tests approfondis** sur différents appareils
3. **Soumission aux stores** (Google Play, App Store)
4. **Monitoring des performances**

---

## 💡 Conseils

### Pour les développeurs
- **Testez sur différents appareils** avant de partager
- **Documentez les changements** entre les versions
- **Collectez les retours** des testeurs
- **Corrigez les bugs** rapidement

### Pour les testeurs
- **Testez toutes les fonctionnalités**
- **Signalez les bugs** avec des détails
- **Incluez des captures d'écran** si possible
- **Testez sur différents réseaux** (WiFi, 4G)

---

**🎉 Votre APK est prêt à être partagé ! Bon test !**

