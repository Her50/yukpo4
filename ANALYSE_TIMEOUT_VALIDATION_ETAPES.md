# Analyse : Gestion des timeouts pour validation d'étapes de livraison

## 🔍 État actuel

### ✅ Ce qui existe

1. **Suggestion de proximité avec auto-confirmation** :
   - `ProximitySuggestion` avec `auto_confirm_after_seconds: Some(30)`
   - Envoyé via WebSocket quand le coursier est à moins de 50m du pickup/dropoff
   - Notification push envoyée au coursier

2. **Endpoint de confirmation** :
   - `POST /api/delivery/{id}/confirm-proximity` : Permet au coursier de confirmer manuellement

### ❌ Ce qui manque

1. **Auto-confirmation automatique** :
   - Le champ `auto_confirm_after_seconds` est envoyé mais **pas implémenté côté serveur**
   - Pas de mécanisme qui change automatiquement le statut après 30 secondes

2. **Tâche périodique de vérification** :
   - Pas de tâche background qui vérifie les livraisons en attente de confirmation
   - Pas de timeout pour les étapes critiques (ArrivalPickup, ArrivalDestination)

3. **Notifications d'alerte** :
   - Pas de notification si le coursier ne confirme pas après un délai
   - Pas d'alerte au client si le coursier est en retard

## 🎯 Solution à implémenter

### 1. Tâche périodique de vérification des timeouts

Créer une tâche qui s'exécute toutes les minutes pour :
- Vérifier les livraisons avec statut nécessitant confirmation
- Vérifier si `auto_confirm_after_seconds` a expiré
- Auto-confirmer si le délai est dépassé
- Envoyer des notifications d'alerte

### 2. Auto-confirmation côté serveur

Implémenter la logique qui :
- Stocke le timestamp de la suggestion de proximité
- Vérifie périodiquement si le délai est dépassé
- Change automatiquement le statut si pas de confirmation manuelle

### 3. Notifications d'alerte

Envoyer des notifications si :
- Le coursier ne confirme pas après X secondes (ex: 60 secondes)
- Le coursier est en retard sur une étape prévue

## 📋 Fichiers à créer/modifier

1. `backend/src/tasks/delivery_timeout_monitor.rs` (NOUVEAU)
2. `backend/src/services/delivery_service.rs` (ajout auto-confirmation)
3. `backend/src/lib.rs` (démarrer la tâche périodique)

