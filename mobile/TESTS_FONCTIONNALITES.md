# Guide de Tests - Fonctionnalités Tickets de Voyage

## 🧪 Checklist de tests iOS et Android

### ✅ 1. Scanner QR Code

**iOS** :
- [ ] Ouvrir `BusBoardingManagementScreen`
- [ ] Taper sur "Scanner QR code ticket"
- [ ] Vérifier demande permission caméra
- [ ] Scanner un QR code valide
- [ ] Vérifier feedback haptique
- [ ] Vérifier validation réussie
- [ ] Scanner un QR code invalide
- [ ] Vérifier message d'erreur
- [ ] Tester mode torch (lampe)
- [ ] Tester saisie manuelle

**Android** :
- [ ] Même checklist que iOS
- [ ] Vérifier permissions Android
- [ ] Tester sur différentes versions Android

**Cas limites** :
- [ ] Permission refusée
- [ ] QR code déjà scanné
- [ ] Pas de connexion réseau
- [ ] QR code corrompu

---

### ✅ 2. Autocomplétion Villes

**iOS** :
- [ ] Ouvrir `BusTicketSearchScreen`
- [ ] Taper dans "Ville de départ"
- [ ] Vérifier suggestions après 2 caractères
- [ ] Sélectionner une suggestion
- [ ] Vérifier cache recherches récentes
- [ ] Tester avec ville inexistante
- [ ] Tester fallback local

**Android** :
- [ ] Même checklist que iOS
- [ ] Vérifier clavier virtuel
- [ ] Tester sur différentes tailles d'écran

**Cas limites** :
- [ ] Pas de connexion (fallback local)
- [ ] API backend indisponible
- [ ] Recherche très longue (>10 caractères)

---

### ✅ 3. Filtres et Tri

**iOS** :
- [ ] Ouvrir `BusTicketSearchScreen`
- [ ] Faire une recherche
- [ ] Taper sur "Filtres"
- [ ] Appliquer filtre prix
- [ ] Appliquer filtre horaire
- [ ] Changer tri (prix, horaire)
- [ ] Vérifier badge indicateur filtres actifs
- [ ] Réinitialiser filtres
- [ ] Combiner plusieurs filtres

**Android** :
- [ ] Même checklist que iOS

**Cas limites** :
- [ ] Aucun résultat avec filtres
- [ ] Filtres incompatibles
- [ ] Tri sur liste vide

---

### ✅ 4. Skeleton Loading

**iOS** :
- [ ] Ouvrir `BusTicketSearchScreen`
- [ ] Faire une recherche
- [ ] Vérifier skeleton pendant chargement
- [ ] Répéter pour tous les écrans :
  - [ ] BusTicketBookingScreen
  - [ ] BusTicketDetailsScreen
  - [ ] AgencyTicketManagementScreen
  - [ ] MyBusTicketsScreen

**Android** :
- [ ] Même checklist que iOS
- [ ] Vérifier performance (60fps)

---

### ✅ 5. Notifications Push

**iOS** :
- [ ] Vérifier permission notifications
- [ ] Réserver un ticket
- [ ] Vérifier notification confirmation
- [ ] Planifier rappel 24h (tester avec date proche)
- [ ] Planifier rappel 2h (tester avec date proche)
- [ ] Taper sur notification
- [ ] Vérifier navigation vers ticket
- [ ] Annuler ticket
- [ ] Vérifier annulation notifications

**Android** :
- [ ] Même checklist que iOS
- [ ] Vérifier canal de notification
- [ ] Tester sur Android 8.0+

**Cas limites** :
- [ ] Permission refusée
- [ ] App en arrière-plan
- [ ] App fermée
- [ ] Date dans le passé

---

### ✅ 6. Carte Interactive (TripMap)

**iOS** :
- [ ] Ouvrir `BusTicketBookingScreen`
- [ ] Vérifier affichage carte
- [ ] Vérifier marqueurs départ/arrivée
- [ ] Vérifier ligne de route
- [ ] Vérifier distance et durée
- [ ] Tester avec coordonnées manquantes (fallback)

**Android** :
- [ ] Même checklist que iOS
- [ ] Vérifier Google Maps intégration

**Cas limites** :
- [ ] Coordonnées invalides
- [ ] Pas de connexion
- [ ] Villes inconnues

---

### ✅ 7. Métriques et Analytics

**iOS** :
- [ ] Vérifier logs analytics en console
- [ ] Faire plusieurs actions (recherche, réservation)
- [ ] Vérifier tracking événements
- [ ] Vérifier Sentry breadcrumbs

**Android** :
- [ ] Même checklist que iOS

---

## 🔧 Configuration Backend Requise

### Endpoints à créer

1. **Autocomplétion villes**
   - `GET /api/geocoding/autocomplete?query=yaound&type=city&limit=5`
   - Retour : `{ suggestions: [{ place_id, main_text, secondary_text }] }`

2. **Push notifications**
   - `POST /api/push/register` - Enregistrer token
   - `POST /api/push/send` - Envoyer notification
   - Scheduler pour rappels automatiques

3. **Enrichissement données**
   - Modifier `GET /api/bus-tickets/search` pour inclure :
     - `duration_minutes`
     - `distance_km`
     - `departure_coordinates`
     - `arrival_coordinates`

---

## 📱 Tests de Performance

### Métriques à vérifier

- [ ] Temps chargement écran < 2s
- [ ] 60fps animations
- [ ] Pas de memory leaks
- [ ] Temps réponse API < 1s
- [ ] Taille bundle acceptable

---

## 🐛 Tests de Régression

- [ ] Anciennes fonctionnalités toujours fonctionnelles
- [ ] Pas de régression visuelle
- [ ] Compatibilité avec versions précédentes

---

*Guide créé le : 2025-01-27*


