# 🧪 Guide de Test - Améliorations ChatModal

Ce guide détaille les tests à effectuer pour valider les nouvelles fonctionnalités du chat.

---

## 📋 Prérequis

### Backend
1. Exécuter la migration :
```bash
cd backend
sqlx migrate run
```

2. Vérifier que les routes de réactions sont enregistrées dans `lib.rs` :
```rust
// Ajouter dans create_app()
.merge(chat_reactions_routes::create_chat_reactions_router())
```

3. Redémarrer le serveur :
```bash
cargo run
```

### Frontend
1. Installer les dépendances :
```bash
cd mobile
npm install expo-haptics
```

2. Vérifier que tous les composants sont importés correctement dans `ChatModalMobile.tsx`

---

## ✅ Checklist de Tests

### 1. Réactions aux Messages ⭐⭐⭐

#### Test 1.1 : Ajouter une réaction
- [ ] Ouvrir une conversation
- [ ] Long press sur un message
- [ ] Vérifier que le picker de réactions s'affiche
- [ ] Sélectionner un emoji (ex: ❤️)
- [ ] Vérifier que la réaction apparaît sous le message
- [ ] Vérifier que le compteur affiche "1"

#### Test 1.2 : Ajouter plusieurs réactions
- [ ] Ajouter une deuxième réaction (ex: 👍) sur le même message
- [ ] Vérifier que les deux réactions s'affichent
- [ ] Vérifier que les compteurs sont corrects

#### Test 1.3 : Retirer une réaction
- [ ] Cliquer sur une réaction que vous avez ajoutée
- [ ] Vérifier que la réaction disparaît
- [ ] Vérifier que le compteur diminue

#### Test 1.4 : Voir les détails d'une réaction
- [ ] Long press sur une réaction avec plusieurs utilisateurs
- [ ] Vérifier que la modal de détails s'ouvre
- [ ] Vérifier que la liste des utilisateurs s'affiche correctement

#### Test 1.5 : Synchronisation entre appareils
- [ ] Ouvrir la même conversation sur 2 appareils
- [ ] Ajouter une réaction sur l'appareil 1
- [ ] Vérifier que la réaction apparaît sur l'appareil 2 (via WebSocket)

---

### 2. Messages Vocaux avec Waveform ⭐⭐⭐

#### Test 2.1 : Enregistrer un message vocal
- [ ] Appuyer sur le bouton microphone
- [ ] Vérifier que l'enregistrement démarre
- [ ] Parler pendant quelques secondes
- [ ] Arrêter l'enregistrement
- [ ] Vérifier que le message vocal s'affiche avec waveform

#### Test 2.2 : Lire un message vocal
- [ ] Cliquer sur le bouton play d'un message vocal
- [ ] Vérifier que la lecture démarre
- [ ] Vérifier que la waveform s'anime pendant la lecture
- [ ] Vérifier que la barre de progression avance
- [ ] Vérifier que le temps s'affiche correctement

#### Test 2.3 : Pause/Reprendre
- [ ] Lancer la lecture d'un message vocal
- [ ] Cliquer sur pause
- [ ] Vérifier que la lecture s'arrête
- [ ] Reprendre la lecture
- [ ] Vérifier que ça reprend au bon endroit

---

### 3. Double Check (Lu/Non Lu) ⭐⭐

#### Test 3.1 : Statut d'envoi
- [ ] Envoyer un message
- [ ] Vérifier qu'un seul check (✓) apparaît immédiatement

#### Test 3.2 : Statut livré
- [ ] Attendre que le message soit livré
- [ ] Vérifier que deux checks (✓✓) apparaissent

#### Test 3.3 : Statut lu
- [ ] Demander au destinataire d'ouvrir la conversation
- [ ] Vérifier que les checks deviennent bleus (✓✓ bleu)

#### Test 3.4 : Timestamp
- [ ] Vérifier que l'heure s'affiche correctement
- [ ] Vérifier le format (HH:MM)

---

### 4. Swipe Actions ⭐⭐⭐

#### Test 4.1 : Swipe gauche (Répondre)
- [ ] Swiper un message vers la gauche
- [ ] Vérifier que l'icône de réponse apparaît
- [ ] Vérifier le haptic feedback
- [ ] Relâcher
- [ ] Vérifier que le bandeau de réponse s'affiche

#### Test 4.2 : Swipe droite (Supprimer)
- [ ] Swiper votre propre message vers la droite
- [ ] Vérifier que l'icône de suppression apparaît
- [ ] Vérifier le haptic feedback
- [ ] Relâcher
- [ ] Vérifier que le message est supprimé

#### Test 4.3 : Swipe sur message d'autrui
- [ ] Essayer de swiper un message du prestataire vers la droite
- [ ] Vérifier que l'action de suppression n'apparaît pas

---

### 5. Groupement par Date ⭐⭐

#### Test 5.1 : Séparateurs de date
- [ ] Ouvrir une conversation avec des messages de plusieurs jours
- [ ] Vérifier que les séparateurs de date s'affichent
- [ ] Vérifier le format ("Aujourd'hui", "Hier", "Lundi", etc.)

#### Test 5.2 : Scroll avec séparateurs
- [ ] Scroller dans une longue conversation
- [ ] Vérifier que les séparateurs restent visibles
- [ ] Vérifier qu'ils ne se chevauchent pas avec les messages

---

### 6. Intégration Générale

#### Test 6.1 : Performance
- [ ] Ouvrir une conversation avec 100+ messages
- [ ] Vérifier que le scroll est fluide (60fps)
- [ ] Vérifier qu'il n'y a pas de lag

#### Test 6.2 : Connexion/Reconnexion
- [ ] Couper la connexion internet
- [ ] Vérifier que l'indicateur "Hors ligne" s'affiche
- [ ] Rétablir la connexion
- [ ] Vérifier que la reconnexion se fait automatiquement

#### Test 6.3 : Multiples conversations
- [ ] Ouvrir plusieurs conversations en parallèle
- [ ] Vérifier que les réactions sont isolées par conversation
- [ ] Vérifier qu'il n'y a pas de mélange de données

---

## 🐛 Tests de Régression

### Vérifier que les fonctionnalités existantes fonctionnent toujours :

- [ ] Envoi de messages texte
- [ ] Envoi d'images
- [ ] Envoi de fichiers
- [ ] Mentions (@)
- [ ] Réponses/citations
- [ ] Édition de messages
- [ ] Suppression de messages
- [ ] Appels audio/vidéo
- [ ] Commandes depuis le chat
- [ ] Négociations de prix

---

## 📱 Tests Spécifiques par Plateforme

### iOS

#### Test iOS 1 : Haptic Feedback
- [ ] Vérifier que le haptic feedback fonctionne sur tous les swipes
- [ ] Vérifier l'intensité (léger pour réponse, moyen pour suppression)

#### Test iOS 2 : Animations
- [ ] Vérifier que toutes les animations sont fluides
- [ ] Vérifier qu'il n'y a pas de saccades

#### Test iOS 3 : Safe Area
- [ ] Vérifier que le chat s'affiche correctement sur iPhone avec encoche
- [ ] Vérifier que le clavier ne cache pas l'input

### Android

#### Test Android 1 : Haptic Feedback
- [ ] Vérifier que le haptic feedback fonctionne (peut varier selon le modèle)
- [ ] Tester sur différents modèles si possible

#### Test Android 2 : Back Button
- [ ] Appuyer sur le bouton retour Android
- [ ] Vérifier que le modal se ferme correctement

#### Test Android 3 : Permissions
- [ ] Vérifier les permissions microphone pour les messages vocaux
- [ ] Vérifier les permissions stockage pour les images/fichiers

---

## 🔍 Tests de Cas Limites

### Test Limite 1 : Messages très longs
- [ ] Envoyer un message de 500+ caractères
- [ ] Vérifier que l'affichage est correct
- [ ] Vérifier que les réactions s'affichent correctement

### Test Limite 2 : Beaucoup de réactions
- [ ] Ajouter 10+ réactions différentes sur un message
- [ ] Vérifier que toutes s'affichent
- [ ] Vérifier que le layout ne casse pas

### Test Limite 3 : Messages vocaux très longs
- [ ] Enregistrer un message vocal de 5+ minutes
- [ ] Vérifier que la waveform s'affiche correctement
- [ ] Vérifier que la lecture fonctionne

### Test Limite 4 : Connexion instable
- [ ] Simuler une connexion instable (throttling réseau)
- [ ] Vérifier que les réactions sont synchronisées quand la connexion revient

---

## 📊 Métriques à Surveiller

### Performance
- Temps de chargement initial : < 500ms
- FPS pendant le scroll : 60fps constant
- Temps de réponse aux interactions : < 100ms

### Réseau
- Taille des messages WebSocket : < 1KB par message
- Latence de synchronisation des réactions : < 500ms

### Mémoire
- Utilisation mémoire avec 1000 messages : < 100MB
- Pas de fuites mémoire après fermeture du modal

---

## 🚨 Bugs Connus à Vérifier

### Bug 1 : Réactions non synchronisées
- **Symptôme** : Les réactions n'apparaissent pas sur tous les appareils
- **Vérification** : Tester avec 2+ appareils connectés simultanément

### Bug 2 : Waveform ne s'affiche pas
- **Symptôme** : Les messages vocaux n'ont pas de waveform
- **Vérification** : Vérifier que les données de waveform sont générées

### Bug 3 : Swipe conflictuel avec scroll
- **Symptôme** : Le swipe active le scroll
- **Vérification** : Tester le swipe horizontal vs scroll vertical

---

## ✅ Critères de Validation

Le test est réussi si :

1. ✅ Toutes les fonctionnalités de base fonctionnent
2. ✅ Aucune régression sur les fonctionnalités existantes
3. ✅ Performance acceptable (< 500ms chargement, 60fps scroll)
4. ✅ Pas de crash ou d'erreur critique
5. ✅ Synchronisation WebSocket fonctionnelle
6. ✅ UX fluide et intuitive

---

## 📝 Rapport de Test

Template de rapport :

```
Date: [DATE]
Testeur: [NOM]
Plateforme: iOS/Android
Version: [VERSION]

Résultats:
- Réactions: ✅/❌
- Waveform: ✅/❌
- Double check: ✅/❌
- Swipe actions: ✅/❌
- Groupement date: ✅/❌

Bugs trouvés:
1. [DESCRIPTION]
2. [DESCRIPTION]

Performance:
- Temps chargement: [MS]
- FPS moyen: [FPS]
- Mémoire: [MB]

Notes:
[NOTES]
```

---

## 🎯 Prochaines Étapes

Après validation des tests :

1. ✅ Corriger les bugs identifiés
2. ✅ Optimiser les performances si nécessaire
3. ✅ Préparer la release
4. ✅ Documenter les nouvelles fonctionnalités pour les utilisateurs

