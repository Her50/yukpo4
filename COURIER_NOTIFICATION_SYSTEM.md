# Système de Notification pour Coursiers - Analyse et Améliorations Nécessaires

## 🔍 Analyse du Système Actuel

### ✅ Ce qui existe déjà :
1. **Matching automatique** : Le système trouve les coursiers à proximité et assigne automatiquement le meilleur
2. **Notification au coursier assigné** : Une notification est envoyée au coursier qui a été assigné automatiquement
3. **Statut `AwaitingCourierConfirmation`** : Le statut attend la confirmation du coursier

### ❌ Ce qui manque :
1. **Notifications à plusieurs coursiers** : Actuellement, seul le meilleur coursier est notifié après assignation automatique
2. **Notifications sonores persistantes** : Pas de système de notification sonore répétée pour attirer l'attention
3. **Arrêt automatique des notifications** : Pas de mécanisme pour arrêter les notifications chez les autres coursiers quand un coursier accepte

## 🎯 Système à Implémenter

### 1. Notification à Plusieurs Coursiers (Broadcast)

**Avant l'assignation automatique**, notifier les 5-10 meilleurs coursiers dans le rayon :
- Trouver les coursiers à proximité (déjà fait)
- Notifier les N meilleurs (par exemple 5-10) au lieu d'assigner automatiquement
- Chaque coursier reçoit une notification avec les détails de la course
- Les coursiers peuvent accepter ou refuser

### 2. Notifications Sonores Persistantes

Pour que les coursiers sur moto puissent s'apercevoir de la demande :
- Utiliser un son personnalisé pour les notifications de livraison
- Répéter la notification toutes les X secondes (par exemple 30s) tant qu'aucun coursier n'a accepté
- Utiliser `time_to_live` et `priority: "high"` dans les push notifications
- Sur mobile, utiliser un canal de notification dédié avec son persistant

### 3. Arrêt Automatique des Notifications

Quand un coursier accepte la course :
- Mettre à jour le statut de la livraison à `Accepted`
- Arrêter toutes les notifications en cours pour cette livraison
- Notifier les autres coursiers que la course a été prise (optionnel)
- Annuler les notifications répétées programmées

## 📋 Modifications à Apporter

### Backend (`backend/src/services/delivery_service.rs`)

1. **Modifier `attempt_auto_matching`** :
   - Au lieu d'assigner automatiquement, notifier plusieurs coursiers
   - Créer une fonction `notify_available_couriers` qui envoie des notifications à plusieurs coursiers
   - Stocker la liste des coursiers notifiés dans les métadonnées

2. **Créer une fonction de notification persistante** :
   - `notify_couriers_with_persistent_sound` : Envoie des notifications sonores répétées
   - Utilise un système de tâches planifiées pour répéter les notifications

3. **Créer une fonction d'arrêt des notifications** :
   - `stop_delivery_notifications` : Arrête toutes les notifications pour une livraison
   - Appelée quand un coursier accepte ou quand la livraison est annulée

### Backend (`backend/src/routes/delivery_routes.rs`)

1. **Modifier `update_delivery_status`** :
   - Quand le statut passe à `Accepted`, appeler `stop_delivery_notifications`
   - Arrêter toutes les notifications en cours

2. **Créer un endpoint pour accepter une course** :
   - `POST /api/delivery/{id}/accept` : Permet à un coursier d'accepter une course
   - Vérifie que le coursier a bien été notifié
   - Assigne le coursier et arrête les notifications

### Backend (`backend/src/services/push_notification_service.rs`)

1. **Créer une fonction pour notifications persistantes** :
   - `send_persistent_delivery_notification` : Envoie des notifications avec son répété
   - Utilise `time_to_live` et `priority: "high"`
   - Configure un canal Android dédié pour les notifications de livraison

### Mobile (`mobile/src/components/PushNotificationManager.tsx`)

1. **Gérer les notifications de livraison** :
   - Détecter les notifications de type `delivery_available`
   - Jouer un son persistant
   - Afficher une notification persistante avec boutons "Accepter" / "Refuser"

2. **Créer un composant de notification persistante** :
   - `PersistentDeliveryNotification` : Affiche une notification qui reste visible
   - Boutons d'action pour accepter/refuser
   - Son répété jusqu'à acceptation ou expiration

## 🚀 Plan d'Implémentation

### Phase 1 : Notifications à Plusieurs Coursiers
1. Modifier `attempt_auto_matching` pour notifier plusieurs coursiers
2. Créer la fonction `notify_available_couriers`
3. Stocker les coursiers notifiés dans les métadonnées

### Phase 2 : Notifications Sonores Persistantes
1. Créer `send_persistent_delivery_notification`
2. Implémenter le système de répétition des notifications
3. Configurer les canaux Android/iOS pour les notifications de livraison

### Phase 3 : Arrêt Automatique
1. Créer `stop_delivery_notifications`
2. Modifier `update_delivery_status` pour arrêter les notifications
3. Créer l'endpoint d'acceptation de course

### Phase 4 : Interface Mobile
1. Gérer les notifications persistantes dans `PushNotificationManager`
2. Créer le composant `PersistentDeliveryNotification`
3. Implémenter les actions accepter/refuser

## 📝 Notes Techniques

- **Son personnalisé** : Créer un fichier audio pour les notifications de livraison
- **Canal Android** : Utiliser un canal de notification dédié avec son persistant
- **iOS** : Utiliser `mutableContent` pour les notifications modifiables
- **Time to Live** : Configurer un TTL approprié pour les notifications répétées
- **Base de données** : Stocker les coursiers notifiés pour pouvoir les notifier de l'annulation

