# 🧪 Guide de Test - Yukpomnang Mobile

## 📱 Accès à l'Application

### Option 1: Expo Go (Recommandé)
1. **Téléchargez Expo Go** sur votre téléphone :
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Scannez le QR code** qui apparaît dans votre terminal

3. **L'application se charge** automatiquement sur votre téléphone

### Option 2: Navigateur Web
- Ouvrez le lien fourni dans le terminal dans votre navigateur
- L'application fonctionne en mode web

---

## 🔍 Tests à Effectuer

### 1. Authentification
- [ ] **Page de connexion** : Interface claire et fonctionnelle
- [ ] **Page d'inscription** : Formulaire complet
- [ ] **Connexion** : Test avec des identifiants valides
- [ ] **Inscription** : Création d'un nouveau compte
- [ ] **Déconnexion** : Fonctionne correctement

### 2. Géolocalisation
- [ ] **Permission de localisation** : Demande automatique
- [ ] **Récupération de position** : Coordonnées GPS précises
- [ ] **Affichage de la position** : Nom de lieu lisible
- [ ] **Mise à jour de position** : Suivi en temps réel

### 3. Services
- [ ] **Liste des services** : Affichage correct
- [ ] **Recherche de services** : Fonctionne avec des mots-clés
- [ ] **Filtres par catégorie** : Tri efficace
- [ ] **Détails d'un service** : Informations complètes
- [ ] **Création de service** : Formulaire fonctionnel

### 4. Chat IA
- [ ] **Interface de chat** : Design intuitif
- [ ] **Envoi de messages** : Réponses de l'IA
- [ ] **Suggestions intelligentes** : Recommandations pertinentes
- [ ] **Historique des conversations** : Sauvegarde des messages

### 5. Navigation
- [ ] **Menu principal** : Accès à tous les écrans
- [ ] **Navigation entre écrans** : Fluide et rapide
- [ ] **Retour en arrière** : Bouton retour fonctionnel
- [ ] **Écrans de chargement** : Indicateurs visuels

### 6. Performance
- [ ] **Temps de chargement** : Rapide et acceptable
- [ ] **Fluidité** : Pas de lag ou de freeze
- [ ] **Mémoire** : Pas de fuite mémoire
- [ ] **Battery** : Consommation raisonnable

---

## 🐛 Signaler un Bug

### Informations à fournir
1. **Description du problème** : Ce qui ne fonctionne pas
2. **Étapes pour reproduire** : Comment reproduire le bug
3. **Comportement attendu** : Ce qui devrait se passer
4. **Comportement observé** : Ce qui se passe réellement
5. **Capture d'écran** : Si possible
6. **Appareil** : Modèle et version OS
7. **Version de l'app** : Version testée

### Exemple de rapport
```
🐛 Bug: La géolocalisation ne fonctionne pas

📱 Appareil: iPhone 12, iOS 15.0
📱 App: Yukpomnang Mobile v1.0.0
🌐 Plateforme: Expo Go

📝 Description:
La géolocalisation ne récupère pas la position de l'utilisateur.

🔄 Étapes pour reproduire:
1. Ouvrir l'application
2. Aller sur l'écran d'accueil
3. Attendre la récupération de position
4. Observer que la position n'est pas affichée

✅ Comportement attendu:
La position GPS devrait être affichée avec le nom du lieu.

❌ Comportement observé:
Aucune position n'est affichée, même après plusieurs secondes.

📸 Capture d'écran:
[Insérer capture d'écran]
```

---

## ✅ Checklist de Validation

### Fonctionnalités Core
- [ ] Authentification complète
- [ ] Géolocalisation fonctionnelle
- [ ] Services accessibles
- [ ] Chat IA opérationnel
- [ ] Navigation fluide

### Interface Utilisateur
- [ ] Design cohérent avec le frontend
- [ ] Responsive sur différents écrans
- [ ] Animations fluides
- [ ] Messages d'erreur clairs
- [ ] Indicateurs de chargement

### Performance
- [ ] Chargement rapide
- [ ] Pas de crash
- [ ] Mémoire stable
- [ ] Réseau optimisé
- [ ] Cache efficace

### Compatibilité
- [ ] iOS (si testé)
- [ ] Android (si testé)
- [ ] Différentes tailles d'écran
- [ ] Orientations portrait/paysage
- [ ] Mode sombre/clair

---

## 📞 Support

### En cas de problème
1. **Consultez les logs** dans le terminal
2. **Vérifiez la connexion** Internet
3. **Redémarrez l'application**
4. **Contactez le support** :
   - Email: support@yukpomnang.com
   - Discord: [Serveur Yukpomnang](https://discord.gg/yukpomnang)

### Ressources utiles
- **Documentation Expo**: [docs.expo.dev](https://docs.expo.dev)
- **Guide React Native**: [reactnative.dev](https://reactnative.dev)
- **Troubleshooting Expo**: [docs.expo.dev/troubleshooting](https://docs.expo.dev/troubleshooting)

---

## 🎯 Prochaines Étapes

### Après les tests
1. **Corriger les bugs** identifiés
2. **Optimiser les performances**
3. **Améliorer l'interface**
4. **Ajouter des fonctionnalités**
5. **Préparer la production**

### Déploiement en production
1. **Build natif** avec EAS
2. **Tests approfondis**
3. **Soumission aux stores**
4. **Monitoring des performances**

