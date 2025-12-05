# 📚 Documentation API - Services Spécialisés

**Date**: 2025-01-27  
**Version**: 1.0  
**Base URL**: `https://api.yukpomnang.com` (ou URL backend configurée)

---

## 🔐 **AUTHENTIFICATION**

Tous les endpoints protégés nécessitent un **JWT token** dans le header :

```
Authorization: Bearer <token>
```

---

## 🏥 **HÔPITAUX / CLINIQUES**

### **1. Recherche Hôpitaux (Public)**

**GET** `/api/hopitaux/search`

**Query Parameters** :
- `ville` (string, optional) : Ville de recherche
- `quartier` (string, optional) : Quartier de recherche
- `lat` (number, optional) : Latitude GPS
- `lng` (number, optional) : Longitude GPS
- `max_distance_km` (number, optional) : Distance maximale en km
- `urgences_disponible` (boolean, optional) : Filtrer par urgences disponibles
- `prestation` (string, optional) : Prestation médicale recherchée
- `page` (number, optional, default: 1) : Numéro de page
- `limit` (number, optional, default: 20) : Nombre de résultats par page

**Réponse** :
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1,
        "nom": "Hôpital Central",
        "type_etablissement": "Hôpital",
        "adresse": "123 Rue Principale",
        "ville": "Douala",
        "urgences_disponible": true,
        "is_available_now": true,
        "distance_km": 2.5
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "total_pages": 3
    }
  }
}
```

---

### **2. Détails Hôpital (Public)**

**GET** `/api/hopitaux/:id`

**Réponse** :
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nom": "Hôpital Central",
    "type_etablissement": "Hôpital",
    "user_id": 123,
    "adresse": "123 Rue Principale",
    "ville": "Douala",
    "urgences_disponible": true,
    "prestations_medicales": ["Cardiologie", "Pédiatrie"],
    "telephone": "+237 123 456 789",
    "is_available_now": true
  }
}
```

---

### **3. Recommandations IA (Protégé)**

**POST** `/api/hopitaux/ai/recommendations`

**Body** :
```json
{
  "symptoms": "Fièvre, maux de tête, fatigue",
  "location": {
    "lat": 4.0511,
    "lng": 9.7679
  },
  "urgency_level": 2
}
```

**Réponse** :
```json
{
  "success": true,
  "data": {
    "recommendation": {
      "hospital_ids": [1, 5, 12],
      "specialties": ["Médecine générale", "Urgences"],
      "urgency_level": 2,
      "recommendations": "Consultez un médecin dans les 24h",
      "advice": "Repos et hydratation recommandés"
    }
  }
}
```

---

### **4. Analyse Sévérité Urgence (Protégé)**

**POST** `/api/hopitaux/ai/emergency-severity`

**Body** :
```json
{
  "symptoms": "Douleur thoracique, essoufflement",
  "vital_signs": {
    "heart_rate": 120,
    "blood_pressure": "140/90"
  }
}
```

**Réponse** :
```json
{
  "success": true,
  "data": {
    "analysis": {
      "severity_level": 4,
      "is_critical": true,
      "suggested_action": "Appeler les urgences immédiatement",
      "time_to_treatment_minutes": 15,
      "reasoning": "Symptômes cardiaques critiques détectés"
    }
  }
}
```

---

### **5. Temps d'Attente (Public)**

**GET** `/api/hopitaux/:id/wait-times`

**Réponse** :
```json
{
  "success": true,
  "data": {
    "wait_times": [
      {
        "specialty": "Cardiologie",
        "avg_wait_time_minutes": 45,
        "max_wait_time_minutes": 90,
        "consultation_count": 12
      }
    ]
  }
}
```

---

### **6. Statut Urgences (Public)**

**GET** `/api/hopitaux/:id/emergency-status`

**Réponse** :
```json
{
  "success": true,
  "data": {
    "status": "busy",
    "critical_count": 3,
    "moderate_count": 8,
    "low_count": 5,
    "total_patients": 16,
    "avg_wait_time_minutes": 35
  }
}
```

---

### **7. Mes Consultations (Protégé)**

**GET** `/api/hopitaux/my-consultations`

**Query Parameters** :
- `page` (number, optional, default: 1)
- `limit` (number, optional, default: 20)
- `status` (string, optional) : "pending", "confirmed", "completed"

**Réponse** :
```json
{
  "success": true,
  "data": {
    "consultations": [
      {
        "id": "uuid",
        "hospital_id": 1,
        "hospital_name": "Hôpital Central",
        "specialty": "Cardiologie",
        "consultation_date": "2025-01-28T10:00:00Z",
        "status": "confirmed",
        "notes": "Consultation de routine"
      }
    ],
    "page": 1,
    "limit": 20
  }
}
```

---

### **8. Analytics Hôpital (Protégé - Prestataire uniquement)**

**GET** `/api/hopitaux/:id/analytics`

**Headers** : `Authorization: Bearer <token>`

**Query Parameters** :
- `period` (string, optional) : "7d", "30d", "90d" (default: "30d")

**Réponse** :
```json
{
  "success": true,
  "data": {
    "analytics": {
      "total_consultations": 450,
      "consultations_7d": 35,
      "consultations_30d": 120,
      "avg_wait_time_minutes": 42,
      "specialties_count": 8
    }
  }
}
```

**Erreur si non propriétaire** :
```json
{
  "success": false,
  "error": "Accès refusé. Seul le propriétaire peut voir les analytics."
}
```

---

### **9. Gestion Créneaux (Protégé - Prestataire uniquement)**

**POST** `/api/hopitaux/:id/slots`

**Body** :
```json
{
  "slot_date": "2025-01-28",
  "slot_time": "10:00",
  "specialty": "Cardiologie",
  "doctor_id": 5,
  "duration_minutes": 30,
  "action": "create"
}
```

**Actions** : `"create"`, `"update"`, `"delete"`

**Réponse** :
```json
{
  "success": true,
  "data": {
    "slot_id": "uuid",
    "message": "Créneau créé avec succès"
  }
}
```

---

## 💊 **PHARMACIES**

### **1. Recherche Pharmacies (Public)**

**GET** `/api/pharmacies/search`

**Query Parameters** : Similaires à hôpitaux

**Réponse** : Similaire à recherche hôpitaux

---

### **2. Détails Pharmacie (Public)**

**GET** `/api/pharmacies/:id`

**Réponse** : Similaire à détails hôpital

---

### **3. Vérifier Disponibilité Médicament (Protégé)**

**POST** `/api/pharmacies/:id/medications/check-availability`

**Body** :
```json
{
  "medication_name": "Paracétamol 500mg"
}
```

**Réponse** :
```json
{
  "success": true,
  "data": {
    "available": true,
    "medication": {
      "name": "Paracétamol 500mg",
      "dci": "Paracétamol",
      "stock_quantity": 150,
      "price": 500,
      "requires_prescription": false
    },
    "requested_quantity": 1
  }
}
```

---

### **4. Réserver Médicament (Protégé)**

**POST** `/api/pharmacies/:id/medications/reserve`

**Body** :
```json
{
  "medication_name": "Paracétamol 500mg",
  "quantity": 2
}
```

**Réponse** :
```json
{
  "success": true,
  "data": {
    "reservation_id": "uuid",
    "expiry_time": "2025-01-28T18:00:00Z",
    "message": "Réservation créée avec succès"
  }
}
```

---

### **5. Créer Commande (Protégé)**

**POST** `/api/pharmacies/:id/order`

**Body** :
```json
{
  "medications": [
    {
      "name": "Paracétamol 500mg",
      "quantity": 2
    }
  ],
  "delivery_method": "pickup",
  "delivery_address": "123 Rue Principale"
}
```

**Réponse** :
```json
{
  "success": true,
  "data": {
    "order_id": "uuid",
    "total_amount": "1000",
    "status": "pending"
  }
}
```

---

### **6. Vérifier Interactions IA (Protégé)**

**POST** `/api/pharmacies/ai/interactions`

**Body** :
```json
{
  "medications": ["Paracétamol", "Ibuprofène"],
  "age": 35,
  "medical_conditions": ["Hypertension"]
}
```

**Réponse** :
```json
{
  "success": true,
  "data": {
    "interaction": {
      "severity": "moderate",
      "description": "Interaction modérée détectée",
      "recommendation": "Consulter un médecin avant prise simultanée",
      "alternative_suggestions": ["Paracétamol seul", "Ibuprofène seul"]
    }
  }
}
```

---

### **7. Suggérer Posologie IA (Protégé)**

**POST** `/api/pharmacies/ai/dosage`

**Body** :
```json
{
  "medication_name": "Paracétamol",
  "age": 35,
  "weight": 70,
  "medical_condition": "Fièvre"
}
```

**Réponse** :
```json
{
  "success": true,
  "data": {
    "dosage": {
      "dosage": "500mg",
      "frequency": "Toutes les 6 heures",
      "duration": "3-5 jours",
      "precautions": ["Ne pas dépasser 4g/jour"],
      "warnings": ["Contre-indiqué en cas d'insuffisance hépatique"]
    }
  }
}
```

---

### **8. Mes Commandes (Protégé)**

**GET** `/api/pharmacies/my-orders`

**Query Parameters** :
- `page` (number, optional)
- `limit` (number, optional)
- `status` (string, optional) : "pending", "processing", "ready", "delivered"

**Réponse** :
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "uuid",
        "pharmacy_id": 1,
        "pharmacy_name": "Pharmacie Centrale",
        "status": "ready",
        "total_amount": "5000",
        "delivery_method": "pickup",
        "created_at": "2025-01-27T10:00:00Z"
      }
    ],
    "page": 1,
    "limit": 20
  }
}
```

---

### **9. Analytics Pharmacie (Protégé - Prestataire uniquement)**

**GET** `/api/pharmacies/:id/analytics`

**Réponse** :
```json
{
  "success": true,
  "data": {
    "analytics": {
      "total_orders": 1250,
      "orders_7d": 45,
      "orders_30d": 180,
      "total_revenue": "2500000",
      "avg_order_value": "2000"
    }
  }
}
```

---

## 🔬 **LABORATOIRES / IMAGERIE**

### **1. Recherche Laboratoires (Public)**

**GET** `/api/laboratoires/search`

**Query Parameters** : Similaires à hôpitaux

---

### **2. Détails Laboratoire (Public)**

**GET** `/api/laboratoires/:id`

---

### **3. Types d'Examens Disponibles (Public)**

**GET** `/api/laboratoires/:id/examination-types`

**Réponse** :
```json
{
  "success": true,
  "data": {
    "examination_types": [
      {
        "id": 1,
        "name": "Numération formule sanguine",
        "category": "Biologie",
        "price": "5000",
        "duration_minutes": 30,
        "requires_fasting": true,
        "preparation_instructions": "Jeûne de 12h requis"
      }
    ]
  }
}
```

---

### **4. Réserver Examen (Protégé)**

**POST** `/api/laboratoires/:id/examinations/book`

**Body** :
```json
{
  "examination_type_id": 1,
  "notes": "Examen de routine"
}
```

**Réponse** :
```json
{
  "success": true,
  "data": {
    "examination_id": "uuid",
    "message": "Réservation créée avec succès"
  }
}
```

---

### **5. Résultats Examen (Protégé)**

**GET** `/api/laboratoires/examinations/:examinationId/results`

**Réponse** :
```json
{
  "success": true,
  "data": {
    "examination_id": "uuid",
    "results": {
      "hemoglobin": "14.5 g/dL",
      "white_blood_cells": "7000 /μL"
    },
    "status": "completed",
    "completed_at": "2025-01-27T14:00:00Z"
  }
}
```

---

### **6. Analyser Résultats IA (Protégé)**

**POST** `/api/laboratoires/examinations/:examinationId/analyze`

**Body** :
```json
{
  "patient_age": 35,
  "patient_sex": "M"
}
```

**Réponse** :
```json
{
  "success": true,
  "data": {
    "analysis": {
      "interpretation": "Résultats dans les normes",
      "anomalies_detected": [],
      "confidence_level": 0.95,
      "recommendations": "Aucune action requise",
      "complementary_examinations": []
    }
  }
}
```

---

### **7. Mes Examens (Protégé)**

**GET** `/api/laboratoires/my-examinations`

**Query Parameters** :
- `page` (number, optional)
- `limit` (number, optional)
- `status` (string, optional) : "pending", "scheduled", "completed"

**Réponse** :
```json
{
  "success": true,
  "data": {
    "examinations": [
      {
        "id": "uuid",
        "laboratory_id": 1,
        "laboratory_name": "Labo Central",
        "examination_type": "Numération formule sanguine",
        "status": "completed",
        "scheduled_date": "2025-01-27T10:00:00Z",
        "created_at": "2025-01-25T08:00:00Z"
      }
    ],
    "page": 1,
    "limit": 20
  }
}
```

---

### **8. Analytics Laboratoire (Protégé - Prestataire uniquement)**

**GET** `/api/laboratoires/:id/analytics`

**Réponse** :
```json
{
  "success": true,
  "data": {
    "analytics": {
      "total_examinations": 850,
      "examinations_7d": 28,
      "examinations_30d": 95,
      "completed_count": 820,
      "examination_types_count": 15
    }
  }
}
```

---

## 🩸 **BANQUES DE SANG**

### **1. Recherche Banques de Sang (Public)**

**GET** `/api/banques-sang/search`

---

### **2. Détails Banque de Sang (Public)**

**GET** `/api/banques-sang/:id`

---

### **3. Prévision Demande (Protégé - Prestataire uniquement)**

**POST** `/api/banques-sang/ai/demand-forecast`

**Body** :
```json
{
  "blood_group": "O+",
  "location": {
    "lat": 4.0511,
    "lng": 9.7679
  }
}
```

---

## 📊 **CODES DE STATUT HTTP**

- `200 OK` : Requête réussie
- `201 Created` : Ressource créée avec succès
- `400 Bad Request` : Données invalides
- `401 Unauthorized` : Token manquant ou invalide
- `403 Forbidden` : Accès refusé (non propriétaire)
- `404 Not Found` : Ressource non trouvée
- `500 Internal Server Error` : Erreur serveur

---

## 🔒 **SÉCURITÉ**

### **Endpoints Protégés** :
- Tous les endpoints `/ai/*` nécessitent authentification
- Tous les endpoints `/my-*` nécessitent authentification
- Tous les endpoints `/analytics` nécessitent authentification + vérification propriétaire
- Tous les endpoints de gestion (création, modification, suppression) nécessitent authentification

### **Vérification Propriétaire** :
Les endpoints analytics vérifient que `user_id === establishment.user_id` avant de retourner les données.

---

## 📝 **FORMATS DE DONNÉES**

### **Dates** :
- Format ISO 8601 : `"2025-01-27T10:00:00Z"`

### **Coordonnées GPS** :
- Format : `"lat,lng"` (ex: `"4.0511,9.7679"`)

### **Montants** :
- Format : String avec décimales (ex: `"5000.00"`)
- Devise : XAF (Franc CFA)

---

*Documentation créée le : 2025-01-27*  
*Version : 1.0*

