# 📋 Prompt de Continuation - Services Spécialisés Yukpomnang

## 🎯 Contexte du Projet

**Monorepo** : `C:\Users\23767\yukpomnang2`
- **Backend** : Rust avec Axum, SQLx, PostgreSQL, pgvector, Redis
- **Frontend Mobile** : React Native (Expo SDK 52) avec TypeScript
- **Frontend Web** : React avec TypeScript, TailwindCSS
- **Base de données** : PostgreSQL Render (URL fournie dans `.env`)

**État actuel** : Phases 5, 6, 7 complétées à ~85%. Backend opérationnel, mobile/web partiellement implémentés.

---

## ✅ Ce qui est DÉJÀ IMPLÉMENTÉ

### 1. 🩸 Banque de Sang - Backend Complet

**Fichiers Backend :**
- ✅ `backend/src/controllers/blood_bank_controller.rs` - CRUD banques de sang
- ✅ `backend/src/controllers/blood_donation_matching_controller.rs` - Matching intelligent
- ✅ `backend/src/services/blood_stock_monitor.rs` - Monitoring automatique stocks
- ✅ `backend/src/main.rs` - Cron job toutes les heures pour vérifier stocks

**Fichiers Mobile :**
- ✅ `mobile/src/screens/BloodGroupManagementScreen.tsx` - Gestion groupe sanguin utilisateur
- ✅ `mobile/src/screens/specialized/BanqueSangFormScreen.tsx` - Formulaire banque de sang avec stocks

**Fonctionnalités Backend :**
- ✅ Création/mise à jour groupe sanguin utilisateur
- ✅ Gestion stocks par groupe (O+, O-, A+, A-, B+, B-, AB+, AB-)
- ✅ Détection automatique stock faible/vide
- ✅ Matching GPS avec rayon défini
- ✅ Notifications push automatiques aux donneurs
- ✅ Monitoring automatique toutes les heures

**Routes API :**
- `POST /api/blood-donation/requests` - Créer demande (vérifie stock automatiquement)
- `POST /api/blood-donation/requests/notify` - Notifier donneurs
- `GET /api/blood-donation/donor/blood-groups` - Récupérer groupes utilisateur
- `POST /api/blood-donation/donor/blood-group` - Créer/mettre à jour groupe

---

### 2. 🚌 Tickets de Voyage (Bus) - Backend Complet

**Fichiers Backend :**
- ✅ `backend/src/controllers/bus_ticket_controller.rs` - Recherche, création tickets
- ✅ `backend/src/controllers/bus_ticket_payment_controller.rs` - Paiement tickets
- ✅ `backend/src/controllers/bus_ticket_validation_controller.rs` - Validation QR/manuelle
- ✅ `backend/src/controllers/bus_seat_management_controller.rs` - Gestion sièges
- ✅ `backend/src/controllers/agency_schedule_controller.rs` - Horaires agences

**Fichiers Mobile :**
- ✅ `mobile/src/screens/ManageBusSeatsScreen.tsx` - Configuration sièges
- ✅ `mobile/src/screens/BusBoardingManagementScreen.tsx` - Contrôle embarquement
- ✅ `mobile/src/screens/MyBusTicketsScreen.tsx` - Mes tickets
- ✅ `mobile/src/components/bus/BusSeatSelector.tsx` - Sélection sièges

**Fonctionnalités Backend :**
- ✅ Recherche tickets par ville départ/arrivée, date
- ✅ Création produits bus (trajets, horaires, prix)
- ✅ Liaison bus-agence
- ✅ Réservation avec sélection sièges
- ✅ Paiement avec commission agence
- ✅ Génération QR Code pour tickets
- ✅ Validation QR Code pour embarquement
- ✅ Validation manuelle (code réservation)
- ✅ Gestion sièges bloqués/non disponibles
- ✅ Résumé embarquement (total, embarqués, en attente)

**Routes API :**
- `GET /api/bus-tickets/search` - Rechercher tickets
- `POST /api/bus-tickets/create-product` - Créer produit bus
- `POST /api/bus-tickets/link` - Lier bus à agence
- `POST /api/bus-tickets/reservations` - Réserver
- `POST /api/bus-tickets/payment` - Payer ticket
- `GET /api/bus-tickets/my-tickets` - Mes tickets
- `POST /api/bus-tickets/validate` - Valider QR Code
- `POST /api/bus-tickets/validate/manual` - Validation manuelle
- `GET /api/bus-tickets/boarding/{product_id}/summary` - Résumé embarquement
- `GET /api/bus-tickets/boarding/{product_id}/passengers` - Liste passagers

---

### 3. 💊 Pharmacies - Backend Complet

**Fichiers Backend :**
- ✅ `backend/migrations/20250128_002_add_pharmacy_products.sql` - Table produits
- ✅ `backend/src/models/pharmacy_product.rs` - Modèle produits
- ✅ `backend/src/services/pharmacy_product_service.rs` - Service produits
- ✅ `backend/src/controllers/pharmacy_product_controller.rs` - Contrôleur produits

**Fonctionnalités Backend :**
- ✅ CRUD produits (nom, prix, stock, catégorie, code-barre)
- ✅ Recherche produits avec filtres (prix, distance, disponibilité)
- ✅ Calcul budget global avec comparaison pharmacies
- ✅ **Import en masse** (bulk import) pour collecte dynamique

**Routes API :**
- `GET /api/pharmacies/products/search` - Rechercher produits
- `POST /api/pharmacies/products/budget` - Calculer budget
- `GET /api/pharmacies/{id}/products` - Produits d'une pharmacie
- `POST /api/pharmacies/products` - Créer produit
- `PATCH /api/pharmacies/products/{id}` - Modifier produit
- `DELETE /api/pharmacies/products/{id}` - Supprimer produit
- `POST /api/pharmacies/products/bulk-import` - Import en masse

---

### 4. 🏥 Autres Services Spécialisés - Complets

**Hôpitaux, Laboratoires, Covoiturages, Taxis, Agences Voyage :**
- ✅ Backend complet (création, recherche, réservations, paiements, avis, chat)
- ✅ Écrans mobile de création
- ✅ Écrans mobile de recherche
- ✅ Réservations intégrées
- ✅ Chat intégré
- ✅ Avis intégrés

---

## ⚠️ Ce qui RESTE À IMPLÉMENTER

### 1. 🩸 Banque de Sang - Complexités Restantes

#### 🔴 CRITIQUE - Mobile/Web

**Écrans Mobile Manquants :**
- [ ] `mobile/src/screens/specialized/BloodDonationRequestScreen.tsx`
  - Créer demande de don (pour banques de sang)
  - Formulaire avec groupe requis, quantité, urgence
  - Affichage matching en temps réel
  
- [ ] `mobile/src/screens/specialized/BloodDonationMatchesScreen.tsx`
  - Liste des matches pour une demande
  - Informations donneurs (distance, disponibilité)
  - Actions : contacter, notifier
  
- [ ] `mobile/src/screens/specialized/MyBloodDonationsScreen.tsx`
  - Historique dons utilisateur
  - Prochain don disponible
  - Statistiques personnelles

**Écrans Web Manquants :**
- [ ] `frontend/src/pages/specialized/BloodDonationRequestPage.tsx`
- [ ] `frontend/src/pages/specialized/BloodDonationMatchesPage.tsx`
- [ ] `frontend/src/pages/specialized/MyBloodDonationsPage.tsx`

#### 🟡 IMPORTANT - Améliorations Backend

**Complexités à Gérer :**

1. **Compatibilité Groupes Sanguins**
   - Implémenter logique de compatibilité (O- peut donner à tous, AB+ peut recevoir de tous, etc.)
   - Fichier : `backend/src/services/blood_compatibility_service.rs`
   - Fonction : `find_compatible_donors(groupe_requis) -> Vec<GroupeCompatible>`

2. **Gestion Délais Entre Dons**
   - Vérifier `last_donation_date` et `next_donation_available_date`
   - Bloquer matching si donneur pas encore disponible
   - Fichier : `backend/src/services/blood_donation_matching_controller.rs` (ligne ~150)

3. **Notifications Intelligentes**
   - Prioriser donneurs proches (rayon < 10km)
   - Notifier d'abord donneurs disponibles immédiatement
   - Délai entre notifications (éviter spam)
   - Fichier : `backend/src/controllers/blood_donation_matching_controller.rs` (fonction `notify_donors_for_request_internal`)

4. **Statistiques et Analytics**
   - Dashboard banque de sang (stocks, demandes, matches)
   - Statistiques donneurs (nombre, groupes, fréquences)
   - Fichier : `backend/src/controllers/blood_bank_controller.rs` (nouveau endpoint)

5. **Intégration GPS Matching**
   - Utiliser `gps_matching.rs` existant
   - Optimiser requêtes pour millions d'utilisateurs
   - Cache Redis pour résultats matching

**Fichiers à Modifier/Créer :**
```
backend/src/services/blood_compatibility_service.rs (NOUVEAU)
backend/src/controllers/blood_bank_controller.rs (ajouter endpoints stats)
backend/src/controllers/blood_donation_matching_controller.rs (améliorer matching)
mobile/src/screens/specialized/BloodDonationRequestScreen.tsx (NOUVEAU)
mobile/src/screens/specialized/BloodDonationMatchesScreen.tsx (NOUVEAU)
mobile/src/screens/specialized/MyBloodDonationsScreen.tsx (NOUVEAU)
frontend/src/pages/specialized/BloodDonationRequestPage.tsx (NOUVEAU)
frontend/src/pages/specialized/BloodDonationMatchesPage.tsx (NOUVEAU)
frontend/src/pages/specialized/MyBloodDonationsPage.tsx (NOUVEAU)
```

---

### 2. 🚌 Tickets de Voyage - Complexités Restantes

#### 🔴 CRITIQUE - Mobile/Web

**Écrans Mobile Manquants :**
- [ ] `mobile/src/screens/specialized/BusTicketSearchScreen.tsx`
  - Recherche avancée (départ, arrivée, date, horaire)
  - Filtres (prix, compagnie, durée)
  - Résultats avec disponibilité sièges
  
- [ ] `mobile/src/screens/specialized/BusTicketBookingScreen.tsx`
  - Sélection sièges visuelle
  - Récapitulatif réservation
  - Paiement intégré
  
- [ ] `mobile/src/screens/specialized/BusTicketDetailsScreen.tsx`
  - Détails ticket (QR Code, infos trajet)
  - Actions (annuler, modifier)

**Écrans Web Manquants :**
- [ ] `frontend/src/pages/specialized/BusTicketSearchPage.tsx`
- [ ] `frontend/src/pages/specialized/BusTicketBookingPage.tsx`
- [ ] `frontend/src/pages/specialized/BusTicketDetailsPage.tsx`

#### 🟡 IMPORTANT - Améliorations Backend

**Complexités à Gérer :**

1. **Gestion Conflits Réservations**
   - Deux utilisateurs réservent le même siège simultanément
   - Solution : Verrous Redis ou transactions SQL avec `SELECT FOR UPDATE`
   - Fichier : `backend/src/controllers/bus_ticket_controller.rs` (fonction `create_reservations`)

2. **Annulations et Remboursements**
   - Politique annulation (remboursement partiel selon délai)
   - Libération sièges automatique
   - Notification autres passagers si siège libéré
   - Fichier : `backend/src/controllers/bus_ticket_controller.rs` (nouveau endpoint)

3. **Gestion Overbooking**
   - Permettre réservations > sièges disponibles (avec liste d'attente)
   - Notifier si siège libéré
   - Fichier : `backend/src/services/bus_overbooking_service.rs` (NOUVEAU)

4. **Suivi Temps Réel**
   - Statut bus (en route, retard, annulé)
   - Notifications passagers (retard, changement)
   - Fichier : `backend/src/services/bus_tracking_service.rs` (NOUVEAU)

5. **Optimisation Requêtes**
   - Cache résultats recherche (Redis)
   - Index base de données (départ, arrivée, date)
   - Pagination pour millions de tickets

6. **Gestion Multi-Agences**
   - Une agence peut avoir plusieurs bus
   - Un bus peut être partagé entre agences
   - Commission par agence
   - Fichier : `backend/src/controllers/bus_ticket_controller.rs` (vérifier logique)

**Fichiers à Modifier/Créer :**
```
backend/src/services/bus_overbooking_service.rs (NOUVEAU)
backend/src/services/bus_tracking_service.rs (NOUVEAU)
backend/src/controllers/bus_ticket_controller.rs (ajouter annulation, améliorer réservation)
mobile/src/screens/specialized/BusTicketSearchScreen.tsx (NOUVEAU)
mobile/src/screens/specialized/BusTicketBookingScreen.tsx (NOUVEAU)
mobile/src/screens/specialized/BusTicketDetailsScreen.tsx (NOUVEAU)
frontend/src/pages/specialized/BusTicketSearchPage.tsx (NOUVEAU)
frontend/src/pages/specialized/BusTicketBookingPage.tsx (NOUVEAU)
frontend/src/pages/specialized/BusTicketDetailsPage.tsx (NOUVEAU)
```

---

### 3. 💊 Pharmacies - Mobile/Web Manquants

#### 🔴 CRITIQUE

**Écrans Mobile Manquants :**
- [ ] `mobile/src/screens/specialized/PharmacieProductSearchScreen.tsx`
  - Recherche produits avec filtres
  - Comparaison prix entre pharmacies
  - Tri (prix, distance, disponibilité)
  
- [ ] `mobile/src/screens/specialized/PharmacieProductManagementScreen.tsx`
  - Liste produits pharmacie (prestataire)
  - CRUD produits
  - Import CSV/JSON
  
- [ ] `mobile/src/components/specialized/PharmacieBudgetCalculator.tsx`
  - Liste produits avec quantités
  - Calcul budget total
  - Suggestion pharmacie moins chère

**Intégration :**
- [ ] Ajouter section "Mes Produits" dans `PharmacieFormScreen.tsx`
- [ ] Ajouter bouton "Rechercher médicament" dans `PharmacieResultCard.tsx`

**Écrans Web Manquants :**
- [ ] `frontend/src/pages/specialized/PharmacieProductSearchPage.tsx`
- [ ] `frontend/src/pages/specialized/PharmacieProductManagementPage.tsx`
- [ ] `frontend/src/pages/specialized/PharmacieBudgetPage.tsx`

**Fichiers à Créer :**
```
mobile/src/screens/specialized/PharmacieProductSearchScreen.tsx
mobile/src/screens/specialized/PharmacieProductManagementScreen.tsx
mobile/src/components/specialized/PharmacieBudgetCalculator.tsx
mobile/src/screens/specialized/PharmacieFormScreen.tsx (modifier - ajouter section produits)
mobile/src/components/specialized/PharmacieResultCard.tsx (modifier - ajouter bouton recherche)
frontend/src/pages/specialized/PharmacieProductSearchPage.tsx
frontend/src/pages/specialized/PharmacieProductManagementPage.tsx
frontend/src/pages/specialized/PharmacieBudgetPage.tsx
```

---

### 4. 🏥 Autres Services - Améliorations Optionnelles

**Hôpitaux :**
- [ ] Gestion urgences (priorité, file d'attente)
- [ ] Disponibilité spécialités en temps réel
- [ ] Temps d'attente estimé

**Laboratoires :**
- [ ] Résultats analyses en ligne
- [ ] Rappels automatiques (SMS/Email)
- [ ] Historique analyses patient

**Covoiturages :**
- [ ] Suivi GPS trajet en temps réel
- [ ] Partage trajet avec contacts
- [ ] Système de confiance (vérification identité)

**Taxis :**
- [ ] Suivi GPS course en temps réel
- [ ] Estimation temps d'arrivée
- [ ] Historique courses avec notes

---

## 🔧 Détails Techniques Importants

### Base de Données

**Tables Existantes :**
- `services` - Services spécialisés (avec `specialized_type`)
- `specialized_reservations` - Réservations
- `specialized_ratings` - Avis et ratings
- `pharmacy_products` - Produits pharmacies
- `blood_donation_requests` - Demandes de don (via fonction SQL)
- `blood_donation_matches` - Matches donneurs (via fonction SQL)
- `user_blood_groups` - Groupes sanguins utilisateurs (via fonction SQL)
- `bus_products` - Produits bus (via table `products`)
- `bus_reservations` - Réservations bus (via table `reservations`)

**Migrations à Appliquer :**
```bash
cd backend
sqlx migrate run
```

**URL Base de Données :**
```
postgresql://user:password@host:port/database
```

### Services Backend Existants

**Services à Utiliser :**
- `gps_matching.rs` - Matching géographique
- `push_notification_service.rs` - Notifications push
- `specialized_services_cache.rs` - Cache Redis
- `scalability_service.rs` - Scalabilité millions d'utilisateurs

**Patterns à Suivre :**
- Utiliser `Arc<AppState>` pour partager état
- Utiliser `AppResult<T>` pour gestion erreurs
- Utiliser `AuthenticatedUser` middleware pour routes protégées
- Utiliser Redis pour cache et verrous distribués

### Mobile - Patterns Existants

**Composants à Réutiliser :**
- `NativeCard`, `NativeButton`, `NativeInput` - Design system
- `SafeIcon` - Icônes avec fallback
- `ChatModalMobile` - Chat intégré
- `ProductCommentsSection` - Avis intégrés

**Navigation :**
- Ajouter routes dans `mobile/src/navigation/AppNavigator.tsx`
- Utiliser `navigation.navigate('ScreenName', { params })`

### Web - Patterns Existants

**Composants à Réutiliser :**
- TailwindCSS pour styles
- `ProductCommentsSection` - Avis intégrés
- Routes dans `frontend/src/App.tsx` et `frontend/src/routes/AppRoutesRegistry.ts`

---

## 🎯 Priorités d'Implémentation

### Priorité 1 : CRITIQUE
1. **Pharmacies Produits Mobile/Web** (80% backend fait)
2. **Banque de Sang Mobile/Web** (100% backend fait)
3. **Tickets Bus Mobile/Web** (100% backend fait)

### Priorité 2 : IMPORTANT
1. **Compatibilité groupes sanguins** (banque de sang)
2. **Gestion conflits réservations** (tickets bus)
3. **Annulations et remboursements** (tickets bus)

### Priorité 3 : OPTIONNEL
1. **Overbooking bus**
2. **Suivi temps réel bus**
3. **Statistiques banque de sang**
4. **Améliorations autres services**

---

## 📝 Notes Importantes

### Banque de Sang - Complexités Spécifiques

1. **Compatibilité Groupes :**
   - O- peut donner à tous (donneur universel)
   - AB+ peut recevoir de tous (receveur universel)
   - O+ peut donner à O+, A+, B+, AB+
   - A+ peut donner à A+, AB+
   - B+ peut donner à B+, AB+
   - AB- peut donner à AB+, AB-
   - A- peut donner à A+, A-, AB+, AB-
   - B- peut donner à B+, B-, AB+, AB-

2. **Délais Entre Dons :**
   - Hommes : 2 mois minimum
   - Femmes : 3 mois minimum
   - Vérifier `next_donation_available_date` avant matching

3. **Notifications :**
   - Prioriser donneurs < 10km
   - Limiter à 10-20 notifications par demande
   - Espacer notifications (éviter spam)

### Tickets Bus - Complexités Spécifiques

1. **Conflits Réservations :**
   - Utiliser `SELECT FOR UPDATE` ou verrous Redis
   - Timeout réservation (15 minutes pour paiement)
   - Libération automatique si non payé

2. **Annulations :**
   - Remboursement 100% si > 24h avant départ
   - Remboursement 50% si 12-24h avant
   - Pas de remboursement si < 12h
   - Libération siège immédiate

3. **Overbooking :**
   - Permettre réservations > sièges (ex: 50 sièges, 55 réservations)
   - Liste d'attente automatique
   - Notifier si siège libéré

---

## 🚀 Commandes Utiles

**Backend :**
```bash
cd backend
cargo check
cargo build
cargo run
sqlx migrate run
```

**Mobile :**
```bash
cd mobile
npm install
npm run dev
```

**Web :**
```bash
cd frontend
npm install
npm run dev
```

---

## ✅ Checklist Finale

### Banque de Sang
- [ ] Écrans mobile (3 écrans)
- [ ] Pages web (3 pages)
- [ ] Service compatibilité groupes
- [ ] Amélioration matching (délais, priorités)
- [ ] Dashboard statistiques

### Tickets Bus
- [ ] Écrans mobile (3 écrans)
- [ ] Pages web (3 pages)
- [ ] Gestion conflits réservations
- [ ] Annulations et remboursements
- [ ] Overbooking (optionnel)
- [ ] Suivi temps réel (optionnel)

### Pharmacies
- [ ] Écrans mobile (2 écrans + composant)
- [ ] Pages web (3 pages)
- [ ] Intégration dans formulaire existant

---

**Date de création** : 2025-01-28
**Dernière mise à jour** : 2025-01-28
**État** : Backend 95%, Mobile/Web 60%

