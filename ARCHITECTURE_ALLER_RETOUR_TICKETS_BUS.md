# 🚌 Architecture Complète: Système Aller-Retour Tickets de Bus

## 📋 Vue d'Ensemble

Ce document décrit l'architecture complète du système de réservation de tickets de bus avec gestion intelligente des trajets retour.

---

## 🎯 Fonctionnalités Implémentées

### 1️⃣ **Paiement Aller Simple vs Aller-Retour**

**Formulaire prestataire (agence):**
```
[x] Aller simple uniquement
[ ] Proposer aller-retour

Si aller-retour coché:
  Prix aller simple: 5000 FCFA
  Prix aller-retour: 9000 FCFA (-10%)
```

**Client choisit:**
- Option A: Aller simple (5000 FCFA)
- Option B: Aller-retour (9000 FCFA)

**Si Option B (aller-retour):**
- Paie **9000 FCFA immédiatement**
- Réserve place aller **maintenant**
- Enregistre demande de retour avec:
  - Date retour souhaitée
  - Heure approximative
  - Flexibilité ±1-2 jours

---

### 2️⃣ **Système de Matching Automatique**

**Quand agence crée nouveau bus:**

```sql
TRIGGER: Après création d'un product type=ticket_voyage

1. Appeler fonction match_return_trip_requests(product_id)

2. Recherche dans return_trip_requests:
   ✅ Route inverse (Yaoundé → Douala si demande voulait Yaoundé → Douala)
   ✅ Date proche (±flexibilité jours)
   ✅ Assez de places disponibles
   
3. Pour chaque match trouvé:
   → Pré-réserve places automatiquement
   → Envoie notification push au client
   → Status = 'matched'
```

**Notification au client:**
```
🎫 Bus retour disponible!

Votre trajet retour:
Yaoundé → Douala
27/10/2025 à 15:00
Bus: BUS-CM-042
Compagnie: Touristique Express

✅ Déjà payé (inclus dans aller-retour)
📍 Choisissez vos places maintenant!

[Voir le bus] [Plus tard]
```

---

### 3️⃣ **Choix de Place Sans Paiement**

**Client clique "Voir le bus":**

```
→ Ouvre BusSeatSelector
→ Message: "✅ Déjà payé - Sélectionnez juste vos places"
→ Sélectionne places (même nombre que l'aller)
→ Saisit noms (proposés par défaut si identiques)
→ Confirme
→ Tickets PDF générés immédiatement
→ Places marquées "reserved" dans le bus
```

**Logique backend:**
```typescript
if (user.has_return_trip_request) {
  // Ne pas débiter
  // Juste confirmer les places
  // Générer tickets PDF
  // Marquer return_request as 'completed'
}
```

---

### 4️⃣ **Gestion Intelligente des Places Pré-Réservées**

**Problème:** Comment gérer les places déjà réservées pour le retour dans le nouveau bus?

**Solution adoptée:**

**Lors de la création du bus retour:**
```javascript
1. Bus créé avec 45 places disponibles

2. match_return_trip_requests() trouve 5 demandes:
   - User1: 2 places (déjà payé)
   - User2: 1 place (déjà payé)
   - User3: 3 places (déjà payé)
   - User4: 1 place (déjà payé)
   - User5: 2 places (déjà payé)
   Total: 9 places pré-réservées

3. Système pré-réserve intelligemment:
   → Bloque 9 places avec status 'prebooked'
   → Assignation: Places 1-9 (ou selon préférence)
   → Ces places apparaissent en ORANGE (ni vert ni gris)
   → Label: "🔔 En attente confirmation client"
   
4. Quand User1 confirme:
   → Choisit ses 2 places parmi les 9
   → Places passent de ORANGE → GRIS (reserved)
   → Les autres restent prebooked pour les autres users

5. Si user ne confirme pas sous 48h:
   → Places libérées automatiquement
   → Deviennent disponibles (vertes) pour tous
```

**Nouveau statut de siège:**
```typescript
status: 'available' | 'prebooked' | 'reserved' | 'occupied'

Couleurs:
- Vert: available (tout le monde peut réserver)
- Orange: prebooked (réservé pour user spécifique)
- Gris: reserved (confirmé et payé)
- Rouge: driver (chauffeur)
```

---

### 5️⃣ **Frais de Réservation - 500 FCFA Fixe**

**Règle:**
- **500 FCFA par réservation** (pas par ticket)
- 1 ticket = 500 FCFA frais
- 5 tickets en 1 fois = 500 FCFA frais
- 5 tickets séparément = 500 × 5 = 2500 FCFA frais

**Calcul:**
```typescript
Exemple: 3 tickets × 5000 FCFA = 15,000 FCFA
Frais: 500 FCFA (fixe)
Total: 15,500 FCFA

Stockage séparé:
{
  subtotal: 15000, // Montant tickets
  booking_fee: 500, // Frais plateforme
  total_amount: 15500
}
```

**Conversion automatique:**
```sql
calculate_booking_fee(currency):
  XAF → 500
  EUR → 1€
  USD → 1$
  XOF → 500
```

**Répartition:**
- **Agence reçoit:** 15,000 FCFA (100% du prix tickets)
- **Plateforme garde:** 500 FCFA (frais de service)

---

### 6️⃣ **Table Paiements - Tracabilité Complète**

**Table `bus_ticket_payments`:**
```sql
Champs:
- user_id → Qui a payé
- agency_user_id → Agence qui reçoit l'argent
- product_id → Le bus/voyage
- reservation_ids[] → Liste des réservations
- ticket_price → Prix unitaire
- number_of_tickets → Nombre de tickets
- subtotal → ticket_price × number
- booking_fee → 500 FCFA
- total_amount → subtotal + fee
- bus_number, departure_city, arrival_city
- departure_date, departure_time
- company_name
- payment_status → completed/refunded
- created_at → Quand payé

Permet de tracer:
✅ Qui a payé
✅ Quelle agence
✅ Quel voyage exact
✅ Quel bus
✅ Quand
✅ Combien (détaillé)
```

**Exemple requête:**
```sql
-- Revenus d'une agence ce mois
SELECT 
    SUM(subtotal) as revenus_tickets,
    SUM(booking_fee) as frais_plateforme,
    COUNT(*) as nb_paiements,
    SUM(number_of_tickets) as nb_tickets_vendus
FROM bus_ticket_payments
WHERE agency_user_id = 123
  AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW());
```

---

### 7️⃣ **Modalités Dynamiques pour Villes**

**Système existant** `custom_modalities` **déjà fonctionnel!**

**Utilisation pour villes:**
```typescript
// Champ "Ville de départ"
<EnhancedModalitySelector
  productType="ticket_voyage"
  fieldName="villes_depart"
  value={newProduct.depart}
  onSelect={(value) => setNewProduct({ ...newProduct, depart: value })}
  allowCustom={true} // ✅ Important!
/>

// Comportement:
1. Charge modalités depuis custom_modalities
2. Affiche: Douala, Yaoundé, Bafoussam, ... (de la BDD)
3. Recherche intelligente pendant frappe: "Yao" → "Yaoundé"
4. Si ville pas trouvée:
   Alert "Ajouter Kribi aux villes?"
   [Oui] → INSERT INTO custom_modalities
   → Disponible pour tous immédiatement
```

**Base de données:**
```sql
custom_modalities:
  product_type: 'ticket_voyage'
  field_name: 'villes_depart' | 'villes_arrivee'
  modality: 'Douala' | 'Yaoundé' | 'Kribi' | ...
  usage_count: 145 (auto-incrémenté)
```

**Avantages:**
- ✅ Système déjà codé et fonctionnel
- ✅ Autocomplete avec recherche
- ✅ Ajout intuitif de nouvelles villes
- ✅ Partage entre tous les prestataires
- ✅ Modalités viennent de la BDD réelle

---

### 8️⃣ **Heures de Départ - Liste Fixe**

**Liste 1h-24h:**
```typescript
heuresDepart = [
  '01:00', '02:00', '03:00', ..., '23:00', '24:00'
]

// Ou plus granulaire:
heuresDepart = [
  '00:00', '00:30', '01:00', '01:30', ...
] // Toutes les 30 min
```

**Picker natif:**
```typescript
<ProductFieldSelector
  label="Heure de départ"
  fieldName="heures_depart"
  productType="ticket_voyage"
  value={newProduct.heureDepart}
  onSelect={(value) => setNewProduct({ ...newProduct, heureDepart: value })}
  options={HEURES_DEPART} // Liste figée
/>
```

---

## 🔄 Workflow Complet Aller-Retour

### **Scénario: Client veut aller-retour Douala → Yaoundé → Douala**

**ÉTAPE 1: Réservation Aller**
```
1. Client cherche "Douala Yaoundé"
2. Trouve bus Touristique Express
   Départ: 25/10/2025 à 08:00
   Prix: 5000 FCFA (aller simple)
   Ou: 9000 FCFA (aller-retour)

3. Client choisit "Aller-retour" (économie 1000 FCFA)
4. Paie 9000 FCFA + 500 FCFA frais = 9500 FCFA total
5. Réserve place 15 pour l'aller
6. Saisit infos retour:
   - Date souhaitée: 27/10/2025
   - Heure: 15:00 (approximatif)
   - Flexibilité: ±1 jour

7. Système crée:
   - Réservation aller confirmée
   - return_trip_request (pending)
   - bus_ticket_payment (9500 FCFA dont 9000 pour agence, 500 pour plateforme)
```

**ÉTAPE 2: Agence Crée Bus Retour (2 jours plus tard)**
```
1. Agence Touristique Express crée:
   Bus Yaoundé → Douala
   Date: 27/10/2025 à 14:30
   45 places

2. TRIGGER automatique:
   match_return_trip_requests(product_id)
   
3. Trouve notre client (et peut-être d'autres):
   - Client A: 1 place, 27/10, déjà payé ✅
   - Client B: 2 places, 27/10, déjà payé ✅
   - Client C: 1 place, 26/10, déjà payé ✅ (±1 jour OK)
   Total: 4 places à pré-réserver

4. Système pré-réserve:
   - Bloque places 1-4 (ou logic intelligente)
   - Status: 'prebooked'
   - Couleur: ORANGE dans le plan
   - Label: "🔔 Client attendu"

5. Envoie 3 notifications push
```

**ÉTAPE 3: Client Reçoit Notification**
```
📱 NOTIFICATION:
"🎫 Votre bus retour est disponible!
 Yaoundé → Douala
 27/10/2025 à 14:30
 
 ✅ Déjà payé
 Choisissez vos places
 
 [Voir le bus]"
```

**ÉTAPE 4: Client Choisit sa Place**
```
1. Clique "Voir le bus"
2. Ouvre BusSeatSelector
3. Message spécial:
   "✅ Trajet retour déjà payé
    Sélectionnez simplement votre place
    Parmi les places orange réservées pour vous"

4. Voit plan:
   - Vert: Disponible pour tous
   - ORANGE: Pré-réservé pour lui (1-4)
   - Gris: Déjà réservé par autres

5. Sélectionne place 2 (orange)
6. Nom pré-rempli automatiquement
7. Confirme
8. Ticket PDF généré
9. Place 2 devient GRISE
10. Places 1, 3, 4 restent ORANGE (pour autres clients)
```

---

## 💾 Structure Base de Données

### **Table: `bus_ticket_payments`**
```sql
Tracabilité COMPLÈTE de chaque paiement:

Exemple:
{
  id: "pay_abc123",
  user_id: 42, ← QUI a payé
  agency_user_id: 15, ← QUELLE agence reçoit
  product_id: "prod_xyz",
  reservation_ids: ["res_1", "res_2", "res_3"], ← 3 tickets
  
  ticket_price: 5000, ← Prix unitaire
  number_of_tickets: 3, ← Nombre de tickets
  subtotal: 15000, ← 3 × 5000
  booking_fee: 500, ← Frais fixe
  total_amount: 15500, ← Total payé
  
  bus_number: "BUS-CM-001",
  departure_city: "Douala",
  arrival_city: "Yaoundé",
  departure_date: "25/10/2025",
  departure_time: "08:00",
  company_name: "Touristique Express",
  
  payment_status: "completed",
  created_at: "2025-10-23T14:30:00Z"
}
```

**Requêtes possibles:**
```sql
-- Tous les paiements d'un utilisateur
SELECT * FROM bus_ticket_payments WHERE user_id = 42;

-- Revenus d'une agence
SELECT 
    SUM(subtotal) as revenus_agence,
    SUM(booking_fee) as revenus_plateforme
FROM bus_ticket_payments 
WHERE agency_user_id = 15;

-- Voyages Douala-Yaoundé en octobre
SELECT * FROM bus_ticket_payments 
WHERE departure_city = 'Douala' 
  AND arrival_city = 'Yaoundé'
  AND departure_date LIKE '%/10/2025';

-- Statistiques par bus
SELECT bus_number, COUNT(*), SUM(number_of_tickets)
FROM bus_ticket_payments
GROUP BY bus_number;
```

### **Table: `return_trip_requests`**
```sql
Demandes de retour en attente:

{
  id: "ret_xyz",
  user_id: 42,
  outbound_ticket_id: "res_aller",
  outbound_payment_id: "pay_abc123",
  
  return_from: "Yaoundé", ← Destination aller
  return_to: "Douala", ← Départ aller
  preferred_return_date: "27/10/2025",
  preferred_return_time: "15:00",
  date_flexibility_days: 1, ← ±1 jour OK
  
  passenger_names: ["Jean MBARGA"],
  number_of_seats: 1,
  
  already_paid: TRUE, ← Déjà payé avec aller-retour
  paid_amount: 4500, ← Part du retour
  
  status: "pending", ← En attente de match
  
  // Après matching:
  matched_product_id: "prod_retour_xyz",
  matched_at: "2025-10-23T16:00:00Z",
  notification_sent: TRUE
}
```

### **Table: `prebooked_return_seats`**
```sql
Places bloquées pour clients retour:

{
  id: "pre_1",
  return_request_id: "ret_xyz",
  product_id: "prod_retour_xyz", ← Le bus retour
  seat_ids: ["1-2"], ← Place(s) bloquée(s)
  passenger_names: ["Jean MBARGA"],
  status: "reserved" ← Ou "confirmed" après choix
}
```

---

## 🎨 Interface Utilisateur

### **Formulaire Agence:**
```typescript
// Nouveaux champs:

☐ Proposer aller-retour
  Si coché:
    Prix aller simple: [5000] FCFA
    Prix aller-retour: [9000] FCFA
    Réduction: -10% automatique

// Villes avec modalités dynamiques:

Ville de départ: [🔍 Rechercher ou ajouter]
  → Tape "Ya" → Suggestions: Yaoundé
  → Tape "Krib" → "Kribi n'existe pas. Ajouter?"
  → Oui → Sauvegardé dans custom_modalities
  → Prochaine fois visible pour tous

Ville d'arrivée: [🔍 Rechercher ou ajouter]
  → Même système

Heure de départ: [▼ Sélectionner]
  → 00:00, 00:30, 01:00, ..., 23:30, 24:00
  → Liste fixe
```

### **Réservation Client:**
```typescript
// Si agence propose aller-retour:

💰 Choisissez votre option:

[○] Aller simple: 5,000 FCFA
[●] Aller-retour: 9,000 FCFA 💚 Économisez 1,000 FCFA!

Si aller-retour sélectionné:
  
  📅 Date retour souhaitée: [27/10/2025]
  🕐 Heure approximative: [15:00]
  📍 Flexibilité: [±1 jour] [±2 jours] [±3 jours]
  
  Résumé:
  ────────────────────────────
  Aller:  5,000 FCFA
  Retour: 4,000 FCFA
  Total tickets: 9,000 FCFA
  Frais réservation: 500 FCFA
  ────────────────────────────
  TOTAL À PAYER: 9,500 FCFA
  
  💡 Le bus retour sera automatiquement 
     proposé dès sa création par l'agence.
     Vous recevrez une notification.
```

---

## 🔔 Système de Notifications

### **Notification Push:**
```typescript
Quand bus retour matché:
→ Send push notification:

{
  title: "🎫 Bus retour disponible!",
  body: "Yaoundé → Douala, 27/10 à 14:30",
  data: {
    type: "return_trip_matched",
    request_id: "ret_xyz",
    product_id: "prod_retour",
    route: "Yaoundé → Douala",
    date: "27/10/2025",
    time: "14:30"
  },
  action: "VIEW_BUS_SEATS"
}

Tap notification:
→ Ouvre app
→ Navigate vers BusSeatSelector
→ Avec paramètre: returnTripMode=true
→ Message: "Déjà payé, choisissez places"
```

---

## 🧠 Algorithme d'Attribution Intelligente des Places

**Question:** Comment choisir quelles places pré-réserver?

**Réponse - 3 stratégies:**

### **Stratégie A: Séquentiel Simple (RECOMMANDÉE)**
```
Match trouvé: 9 places à pré-réserver
→ Bloque places 1-9 dans l'ordre
→ Premier arrivé, premier servi pour choisir
→ Simple et équitable
```

### **Stratégie B: Par Groupes**
```
User1: 3 places → Bloc 1-3
User2: 2 places → Bloc 4-5
User3: 1 place → Place 6
→ Groupes assis ensemble
→ Meilleur pour familles
```

### **Stratégie C: Optimisation Préférences**
```
Si User1 avait place fenêtre aller:
→ Propose place fenêtre retour
→ Utilise historique préférences
→ Plus complexe mais meilleure UX
```

**Je recommande Stratégie B** (groupes) car:
- Familles/amis ensemble
- Pas trop complexe
- Meilleure expérience

---

## 🚀 Plan d'Implémentation

Voulez-vous que j'implémente tout ça? Voici l'ordre:

1. ✅ **Migration SQL** (déjà créée)
2. ⏳ **API backend Rust** (endpoints retour)
3. ⏳ **Composant aller-retour** (formulaire agence)
4. ⏳ **Modalités villes dynamiques** (utiliser système existant)
5. ⏳ **Frais 500 FCFA** (calcul et affichage)
6. ⏳ **Système matching auto** (trigger + notifications)
7. ⏳ **Places pré-réservées ORANGE** (nouveau statut)
8. ⏳ **BusSeatSelector mode "déjà payé"**

**Estimé:** ~2000 lignes de code
**Temps:** 30-45 minutes

**Voulez-vous que je commence?** 🚀
