# Résumé Intégration Tickets Bus avec Agences de Voyage

## ✅ 1. Migration SQL - Complétée

### Fichier : `backend/migrations/20251127_integrate_bus_tickets_with_agences_voyage.sql`
- ✅ Ajout colonne `bus_products_config JSONB` à `agences_voyage`
- ✅ Fonction `search_bus_tickets_with_availability()` : Recherche tickets avec disponibilité en temps réel
- ✅ Fonction `get_bus_seat_availability()` : Obtenir places disponibles d'un produit
- ✅ Compatible SQLx offline mode
- ✅ Intégré dans `auto_migrate.rs` via `ensure_bus_tickets_integration()`
- ✅ Intégré dans `0000_create_all_tables.sql`

### Format `bus_products_config` :
```json
{
  "modeles_bus": [
    {
      "product_id": "uuid",
      "nom_modele": "Luxury VIP",
      "total_seats": 50,
      "classe": "VIP",
      "prix_base": 15000,
      "equipements": ["WiFi", "Climatisation", "Toilettes"]
    }
  ]
}
```

---

## 📋 2. À FAIRE : Contrôleur Rust

### Créer `backend/src/controllers/bus_ticket_controller.rs`
- `search_bus_tickets()` : Appelle `search_bus_tickets_with_availability()`
- `get_seat_availability()` : Appelle `get_bus_seat_availability()`
- `link_bus_product_to_agency()` : Lie un `product` (ticket_voyage) à une agence
- `update_bus_products_config()` : Met à jour `bus_products_config` d'une agence

### Routes à ajouter dans `specialized_services_routes.rs` :
- `GET /api/agences-voyage/:id/bus-tickets/search` : Recherche tickets
- `GET /api/agences-voyage/:id/bus-tickets/:product_id/availability` : Disponibilité places
- `POST /api/agences-voyage/:id/bus-tickets/link` : Lier produit à agence
- `PUT /api/agences-voyage/:id/bus-products-config` : Mettre à jour config

---

## 📋 3. À FAIRE : Améliorer Formulaires

### Mobile : `mobile/src/screens/specialized/AgenceVoyageFormScreen.tsx`
- Section "Modèles de Bus" :
  - Liste des modèles existants
  - Bouton "Ajouter un modèle"
  - Formulaire pour chaque modèle :
    - Nom modèle (ex: "Luxury VIP")
    - Nombre de places total
    - Classe (VIP, Standard, Économique)
    - Prix de base
    - Équipements (checkboxes: WiFi, Climatisation, Toilettes, etc.)
  - Configuration sièges :
    - Interface visuelle pour `bus_configuration` (rows, seatsPerRow)
    - Génération automatique de `seat_map`
  - Lien avec `product` :
    - Créer un `product` de type `ticket_voyage` pour chaque modèle
    - Stocker `product_id` dans `bus_products_config`

### Frontend : `frontend/src/pages/specialized/AgenceVoyageForm.tsx`
- Même structure que mobile
- Utiliser composants React pour interface visuelle des sièges

---

## 📋 4. À FAIRE : Enrichir Affichage Résultats

### Mobile : `mobile/src/components/specialized/AgenceVoyageResultCard.tsx`
- Afficher informations agence (nom, adresse, téléphone)
- Pour chaque ticket disponible :
  - Trajet (départ → destination)
  - Date et heure de départ
  - Modèle de bus (nom, classe)
  - Places disponibles en temps réel : `X / Y places`
  - Prix du ticket
  - Bouton "Voir places" → Ouvre sélection de sièges
  - Bouton "Réserver" → Ouvre réservation avec caution

### Composant de sélection de sièges :
- `mobile/src/components/bus/BusSeatSelector.tsx`
- Affiche plan des sièges (`seat_map`)
- Marque places réservées (rouge)
- Marque places disponibles (vert)
- Permet sélection multiple
- Affiche prix total
- Bouton "Réserver avec caution" (500 FCFA)

---

## 📋 5. Intégration avec Système Existant

### Tables existantes utilisées :
- ✅ `bus_reservations` : Réservations de places
- ✅ `bus_ticket_payments` : Paiements complets
- ✅ `return_trip_requests` : Demandes de retour
- ✅ `products` : Colonnes `bus_configuration`, `seat_map`, `total_seats`, `numero_bus`, etc.

### Fonctions SQL existantes utilisées :
- ✅ `confirm_bus_reservation()` : Confirmer après paiement
- ✅ `expire_unconfirmed_reservations()` : Expirer automatiquement
- ✅ `match_return_trip_requests()` : Matcher retours

### Utilitaires existants :
- ✅ `mobile/src/utils/busTicketPdfGenerator.ts` : Génération PDF tickets

---

## 🎯 Prochaines Étapes

1. **Créer contrôleur Rust** `bus_ticket_controller.rs`
2. **Ajouter routes** dans `specialized_services_routes.rs`
3. **Améliorer formulaire mobile** `AgenceVoyageFormScreen.tsx`
4. **Améliorer formulaire frontend** `AgenceVoyageForm.tsx`
5. **Enrichir `AgenceVoyageResultCard`** avec disponibilité
6. **Créer composant `BusSeatSelector`** pour sélection visuelle
7. **Intégrer réservation** avec système existant (`bus_reservations`)

---

## 📝 Notes Techniques

### Calcul disponibilité :
- Places disponibles = `total_seats` - `COUNT(bus_reservations WHERE status IN ('pending', 'confirmed') AND expires_at > NOW())`
- Les réservations expirées sont automatiquement libérées

### Recherche avec moment :
- La fonction `search_bus_tickets_with_availability()` filtre automatiquement :
  - Tickets avec `date_depart >= CURRENT_DATE`
  - Places disponibles >= `p_min_seats`
  - Agences dans rayon GPS si fourni

### Score de pertinence :
- +10 si places disponibles >= min_seats
- +5 si départ aujourd'hui
- +3 si départ dans 3 jours
- +5 si agence <= 10 km
- +3 si agence <= 25 km
- +8 si ville départ correspond
- +8 si ville arrivée correspond

