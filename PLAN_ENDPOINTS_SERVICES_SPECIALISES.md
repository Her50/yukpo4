# 📋 Plan d'Implémentation des Endpoints - Services Spécialisés

**Date**: 2025-01-27  
**Objectif**: Créer ~20 endpoints manquants pour les services spécialisés

---

## ✅ **ENDPOINTS DÉJÀ EXISTANTS**

### Hôpitaux
- ✅ `GET /api/hopitaux/search` - Recherche publique
- ✅ `GET /api/hopitaux/:id` - Détails publics
- ✅ `POST /api/hopitaux/:id/book` - Réservation/RDV

### Laboratoires
- ✅ `GET /api/laboratoires/search` - Recherche publique
- ✅ `GET /api/laboratoires/:id` - Détails publics
- ✅ `POST /api/laboratoires/:id/book` - Réservation/RDV

### Pharmacies
- ✅ `GET /api/pharmacies/search` - Recherche publique
- ✅ `GET /api/pharmacies/on-duty` - Pharmacies de garde
- ✅ `GET /api/pharmacies/{id}` - Détails publics

### Banques de Sang
- ✅ `GET /api/banques-sang/search` - Recherche publique
- ✅ `GET /api/banques-sang/{id}/statistics` - Statistiques

---

## 🚀 **ENDPOINTS À CRÉER**

### **Hôpitaux** (~7 endpoints)

#### 1. IA - Recommandations
- `POST /api/hopitaux/ai/recommendations`
  - Utilise `HospitalAIService::generate_hospital_recommendations()`
  - Payload: `{ symptoms, location?, user_location? }`
  - Retourne: Recommandations avec hôpitaux suggérés

#### 2. IA - Triage Urgence
- `POST /api/hopitaux/ai/triage`
  - Utilise `HospitalAIService::analyze_emergency_severity()`
  - Payload: `{ symptoms, age?, vital_signs? }`
  - Retourne: Niveau de sévérité (1-5)

#### 3. Temps d'attente
- `GET /api/hopitaux/:id/wait-times`
  - Retourne temps d'attente estimé par spécialité
  - Utilise table `hospital_analytics`

#### 4. Statut Urgences
- `GET /api/hopitaux/:id/emergency-status`
  - Retourne statut des urgences (ouvert, saturé, fermé)
  - Utilise table `hospital_emergencies`

#### 5. Consultations Client
- `GET /api/hopitaux/my-consultations`
  - Liste des consultations du client connecté
  - Utilise table `hospital_consultations`
  - Protégé JWT

#### 6. Analytics Prestataire
- `GET /api/hopitaux/:id/analytics`
  - Statistiques pour le prestataire
  - Utilise table `hospital_analytics`
  - Protégé JWT (vérifier ownership)

#### 7. Gestion Créneaux
- `POST /api/hopitaux/:id/slots`
  - Créer/modifier créneaux disponibles
  - Utilise table `hospital_slots`
  - Protégé JWT (vérifier ownership)

---

### **Pharmacies** (~7 endpoints)

#### 1. Vérification Disponibilité
- `POST /api/pharmacies/:id/check-availability`
  - Vérifie disponibilité d'un médicament
  - Payload: `{ medication_name, quantity? }`

#### 2. Réservation Médicament
- `POST /api/pharmacies/:id/reserve-medication`
  - Réserve un médicament
  - Utilise table `pharmacy_reservations`
  - Protégé JWT

#### 3. Commande
- `POST /api/pharmacies/:id/order`
  - Crée une commande de médicaments
  - Utilise table `pharmacy_orders`
  - Protégé JWT

#### 4. IA - Interactions Médicamenteuses
- `POST /api/pharmacies/ai/interactions`
  - Utilise `PharmacyAIService::check_medication_interactions()`
  - Payload: `{ medications[], age?, conditions? }`
  - Retourne: Analyse des interactions

#### 5. IA - Posologie
- `POST /api/pharmacies/ai/dosage`
  - Utilise `PharmacyAIService::suggest_medication_dosage()`
  - Payload: `{ medication_name, age?, weight?, condition? }`

#### 6. Commandes Client
- `GET /api/pharmacies/my-orders`
  - Liste des commandes du client
  - Utilise table `pharmacy_orders`
  - Protégé JWT

#### 7. Analytics Prestataire
- `GET /api/pharmacies/:id/analytics`
  - Statistiques pour le prestataire
  - Utilise table `pharmacy_analytics`
  - Protégé JWT (vérifier ownership)

---

### **Laboratoires** (~6 endpoints)

#### 1. Types d'Examens
- `GET /api/laboratoires/:id/examination-types`
  - Liste des types d'examens disponibles
  - Utilise table `lab_examination_types`

#### 2. Réservation Examen
- `POST /api/laboratoires/:id/book-examination`
  - Réserve un examen (améliore l'existant)
  - Utilise table `lab_examinations`
  - Protégé JWT

#### 3. Résultats Examen
- `GET /api/laboratoires/examinations/:id/results`
  - Récupère les résultats d'un examen
  - Utilise table `lab_examinations`
  - Protégé JWT (vérifier ownership)

#### 4. IA - Analyse Résultats
- `POST /api/laboratoires/examinations/:id/analyze`
  - Utilise `LabAIService::analyze_examination_results()`
  - Retourne: Interprétation IA des résultats

#### 5. Examens Client
- `GET /api/laboratoires/my-examinations`
  - Liste des examens du client
  - Utilise table `lab_examinations`
  - Protégé JWT

#### 6. Analytics Prestataire
- `GET /api/laboratoires/:id/analytics`
  - Statistiques pour le prestataire
  - Utilise table `lab_analytics`
  - Protégé JWT (vérifier ownership)

---

## 📊 **RÉSUMÉ**

| Service | Endpoints à créer | Priorité |
|---------|-------------------|----------|
| Hôpitaux | 7 | Haute |
| Pharmacies | 7 | Haute |
| Laboratoires | 6 | Haute |
| **TOTAL** | **20** | |

---

## 🔧 **STRUCTURE D'IMPLÉMENTATION**

1. **Créer endpoints dans contrôleurs existants**:
   - `backend/src/controllers/specialized_services_controller.rs` (hôpitaux, laboratoires)
   - `backend/src/controllers/pharmacy_controller.rs` (pharmacies)

2. **Ajouter routes dans**:
   - `backend/src/routes/specialized_services_routes.rs`

3. **Utiliser services IA créés**:
   - `HospitalAIService`
   - `PharmacyAIService`
   - `LabAIService`

4. **Utiliser nouvelles tables**:
   - `hospital_consultations`, `hospital_emergencies`, `hospital_slots`, `hospital_analytics`
   - `pharmacy_orders`, `pharmacy_reservations`, `pharmacy_analytics`
   - `lab_examinations`, `lab_examination_types`, `lab_analytics`

---

*Plan créé le : 2025-01-27*

