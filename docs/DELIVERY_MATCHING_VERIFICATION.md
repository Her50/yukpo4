# Vérification du Matching de Livraison

## ✅ Éléments Vérifiés et Implémentés

### 1. Temps de préparation (`preparation_time_minutes`)

**Statut**: ✅ **Implémenté dans le matching, ajouté au modal de configuration**

- **Backend**:
  - Le champ `preparation_time_minutes` est stocké dans `product_delivery_config` (ligne 519 `delivery_routes.rs`)
  - Il est utilisé dans le calcul du temps total estimé lors du matching des coursiers (ligne 2896 `delivery_routes.rs`)
  - Le calcul inclut : `temps_vers_pickup + preparation_time_minutes + temps_livraison`

- **Frontend**:
  - ✅ **NOUVEAU**: Le champ `preparation_time_minutes` a été ajouté au modal `ProductDeliveryConfigModal`
  - Le champ est requis et validé (doit être ≥ 0, 0 = instantané)
  - Exemples suggérés : repas (15-30 min), commandes sur mesure (60-120 min)

### 2. Configuration de livraison

**Statut**: ✅ **Complète**

- Tous les champs nécessaires sont présents :
  - Adresse de départ (pickup_address, GPS)
  - Type de véhicule requis (required_vehicle_type_id)
  - Poids et volume (weight_kg, volume_cm3)
  - Options spéciales (isothermal, fragile)
  - **NOUVEAU**: Temps de préparation (preparation_time_minutes)
  - Plages horaires (pickup_availability_schedule)
  - Instructions de départ
  - Mode de facturation

---

## ⚠️ Éléments Manquants ou à Améliorer

### 1. Vérification de la plage horaire lors du matching

**Statut**: ❌ **NON IMPLÉMENTÉ**

**Problème actuel**:
- La `pickup_availability_schedule` est stockée dans la configuration
- MAIS elle n'est **pas vérifiée** lors de la création d'une livraison ou lors du matching des coursiers
- Un coursier peut être assigné même si le produit n'est pas disponible au moment de la commande

**Impact**:
- Un coursier peut arriver au point de pickup alors que le marchand n'est pas disponible
- Pas de validation que la livraison peut être préparée dans les plages horaires configurées

**Solution recommandée**:

1. **Lors de la création d'une livraison** (`/api/delivery/create`):
   - Charger la configuration du produit (`product_delivery_config`)
   - Vérifier que l'heure de commande actuelle + `preparation_time_minutes` tombe dans une plage horaire valide
   - Vérifier le jour de la semaine (lundi = 0, dimanche = 6)
   - Retourner une erreur si le produit n'est pas disponible

2. **Dans le matching des coursiers** (`/api/delivery/couriers/available`):
   - Filtrer les coursiers qui peuvent arriver au pickup pendant une plage horaire disponible
   - Calculer : `heure_actuelle + temps_vers_pickup + preparation_time_minutes` doit être dans une plage horaire
   - Inclure un champ `earliest_available_pickup_time` dans la réponse pour informer le client

3. **Fonction helper à créer** (backend):
```rust
fn is_pickup_available(
    schedule: &Value, // pickup_availability_schedule
    requested_time: DateTime<Utc>,
    preparation_time_minutes: i32,
) -> bool {
    // 1. Extraire le jour de la semaine (0 = lundi, 6 = dimanche)
    // 2. Trouver les plages horaires pour ce jour
    // 3. Vérifier si requested_time + preparation_time_minutes tombe dans une plage
    // 4. Retourner true/false
}
```

### 2. Priorités pour le matching

**Statut**: ⚠️ **Partiellement implémenté**

**Actuellement**:
- Les coursiers sont triés par :
  1. Distance au pickup (ASC)
  2. Rating moyen (DESC)
  3. Nombre de livraisons complétées (DESC)

**À améliorer**:
- Ajouter la disponibilité horaire comme critère prioritaire
- Prioriser les coursiers qui peuvent arriver pendant les plages horaires disponibles
- Considérer le temps de préparation pour calculer le meilleur créneau

### 3. Affichage des disponibilités au client

**Statut**: ❌ **NON IMPLÉMENTÉ**

**Recommandation**:
- Afficher les prochaines plages horaires disponibles dans `OrderDeliveryModal`
- Permettre au client de choisir un créneau de livraison souhaité
- Calculer le temps total : `temps_préparation + temps_livraison` pour chaque créneau

---

## 📋 Plan d'Action Recommandé

### Priorité 1 : Vérification de la plage horaire lors de la création
- [ ] Créer la fonction `is_pickup_available()` dans `delivery_service.rs`
- [ ] Intégrer la vérification dans `create_delivery()` ou dans le handler `/api/delivery/create`
- [ ] Tester avec différents scénarios (hors plage, dans plage, préparation longue)

### Priorité 2 : Amélioration du matching
- [ ] Filtrer les coursiers disponibles selon les plages horaires
- [ ] Calculer `earliest_available_pickup_time` pour chaque coursier
- [ ] Ajouter ce champ dans la réponse de `/api/delivery/couriers/available`

### Priorité 3 : Interface utilisateur
- [ ] Afficher les plages horaires disponibles dans `OrderDeliveryModal`
- [ ] Permettre la sélection d'un créneau préféré
- [ ] Afficher l'estimation : "Disponible dans X minutes" ou "Disponible demain à Y heures"

---

## 🧪 Tests à Effectuer

1. **Test temps de préparation**:
   - Produit avec `preparation_time_minutes = 0` (instantané)
   - Produit avec `preparation_time_minutes = 30` (repas)
   - Vérifier que le temps total inclut bien la préparation

2. **Test plages horaires**:
   - Commande pendant une plage horaire valide
   - Commande en dehors des plages horaires (doit échouer)
   - Commande le dimanche si seulement ouvert en semaine

3. **Test matching**:
   - Vérifier que seuls les coursiers pouvant arriver pendant les plages disponibles sont retournés
   - Vérifier le calcul de `earliest_available_pickup_time`

---

## 📝 Notes Techniques

### Format de `pickup_availability_schedule`
```json
{
  "monday": [{"start": "08:00", "end": "18:00"}],
  "tuesday": [{"start": "08:00", "end": "18:00"}],
  "wednesday": [{"start": "08:00", "end": "12:00"}, {"start": "14:00", "end": "18:00"}],
  ...
}
```

### Calcul du temps total
```
temps_total = temps_coursier_vers_pickup + preparation_time_minutes + temps_pickup_vers_client
```

### Vérification de disponibilité
```
heure_pickup_possible = heure_actuelle + temps_coursier_vers_pickup + preparation_time_minutes
disponible = heure_pickup_possible ∈ plages_horaires[jour_semaine]
```




