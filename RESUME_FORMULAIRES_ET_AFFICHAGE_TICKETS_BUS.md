# Résumé Formulaires et Affichage Tickets Bus

## ✅ COMPLÉTÉ

### 1. Composant BusModelForm
- ✅ **Fichier** : `mobile/src/components/bus/BusModelForm.tsx`
- ✅ Formulaire modal pour créer/modifier un modèle de bus
- ✅ Champs : nom, classe, nombre de places, prix de base, équipements
- ✅ Configuration sièges optionnelle (rows, seatsPerRow, firstRowSeats)
- ✅ Calcul automatique du nombre total de places

### 2. Formulaire AgenceVoyageFormScreen amélioré
- ✅ Section "Modèles de bus" ajoutée
- ✅ Affichage conditionnel si `peut_emettre_tickets_bus = true`
- ✅ Liste des modèles existants avec actions (éditer, supprimer)
- ✅ Bouton "Ajouter" pour créer un nouveau modèle
- ✅ Intégration du composant `BusModelForm`

---

## 📋 RESTE À FAIRE

### 3. Améliorer handleSubmit dans AgenceVoyageFormScreen
- [ ] Après création de l'agence, créer les `products` de type `ticket_voyage` pour chaque modèle
- [ ] Appeler API `POST /api/bus-tickets/link` pour lier chaque produit à l'agence
- [ ] Gérer les erreurs et afficher les succès

### 4. Enrichir AgenceVoyageResultCard
- [ ] Modifier l'interface pour accepter les données de tickets bus
- [ ] Afficher les tickets disponibles avec :
  - Trajet (départ → destination)
  - Date et heure de départ
  - Modèle de bus (nom, classe)
  - **Places disponibles en temps réel** : `X / Y places`
  - Prix du ticket
  - Bouton "Voir places" → Ouvre sélection de sièges
  - Bouton "Réserver" → Ouvre réservation avec caution

### 5. Créer composant BusSeatSelector
- [ ] **Fichier** : `mobile/src/components/bus/BusSeatSelector.tsx`
- [ ] Affiche plan des sièges (`seat_map` depuis `product`)
- [ ] Marque places réservées (rouge) vs disponibles (vert)
- [ ] Permet sélection multiple
- [ ] Affiche prix total
- [ ] Bouton "Réserver avec caution" (500 FCFA)
- [ ] Intègre avec système existant `bus_reservations`

### 6. Créer composant BusTicketCard
- [ ] **Fichier** : `mobile/src/components/bus/BusTicketCard.tsx`
- [ ] Affiche un ticket bus individuel avec toutes les infos
- [ ] Utilisé dans `AgenceVoyageResultCard` pour chaque ticket disponible

### 7. Améliorer formulaire frontend
- [ ] **Fichier** : `frontend/src/pages/specialized/AgenceVoyageForm.tsx`
- [ ] Même structure que mobile
- [ ] Composants React pour interface visuelle des sièges

---

## 🎯 Prochaines Étapes Prioritaires

1. **Compléter handleSubmit** :
   - Créer produits après création agence
   - Lier produits à agence via API

2. **Créer BusTicketCard** :
   - Composant réutilisable pour afficher un ticket
   - Intégrer dans AgenceVoyageResultCard

3. **Créer BusSeatSelector** :
   - Plan visuel interactif
   - Intégration réservation

4. **Tester le flux complet** :
   - Créer agence avec modèles
   - Rechercher tickets
   - Voir disponibilité
   - Réserver places

---

## 📝 Notes Techniques

### Structure données ticket bus dans ResultCard :
```typescript
interface BusTicketData {
    product_id: string;
    product_name: string;
    bus_model_name?: string;
    total_seats?: number;
    available_seats: number;
    reserved_seats: number;
    bus_number?: string;
    departure_city?: string;
    arrival_city?: string;
    departure_date?: string;
    departure_time?: string;
    ticket_price?: number;
    currency?: string;
    bus_configuration?: any;
    seat_map?: any;
    distance_km?: number;
    relevance_score: number;
}
```

### API à utiliser :
- `GET /api/bus-tickets/search` : Recherche tickets
- `GET /api/bus-tickets/:product_id/availability` : Disponibilité places
- `POST /api/bus-tickets/link` : Lier produit à agence
- `POST /api/bus-reservations` : Créer réservation (système existant)

