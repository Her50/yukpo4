# 📚 Documentation API : Améliorations Workflow de Livraison

## Vue d'ensemble

Cette documentation décrit les nouvelles API endpoints implémentées pour améliorer le workflow de livraison, incluant la gestion des commandes, la disponibilité des produits, les statistiques prestataire et les produits similaires.

---

## 🔐 Authentification

Toutes les routes (sauf mention contraire) nécessitent une authentification via Bearer Token :

```
Authorization: Bearer <token>
```

---

## 📦 Gestion des Commandes

### 1. Créer une commande

**Endpoint:** `POST /api/orders`

**Description:** Crée une nouvelle commande pour un produit. Vérifie automatiquement la disponibilité et retourne des produits similaires si le produit n'est pas disponible.

**Body:**
```json
{
  "delivery_id": "uuid-optional",
  "service_id": 123,
  "product_index": 0,
  "client_user_id": 456,
  "provider_user_id": 789,
  "validation_timeout_minutes": 30,
  "conversation_id": "uuid-optional"
}
```

**Réponse Succès (200):**
```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "delivery_id": "uuid",
    "service_id": 123,
    "product_index": 0,
    "client_user_id": 456,
    "provider_user_id": 789,
    "status": "pending",
    "preparation_time_minutes": 15,
    "estimated_ready_at": "2025-01-20T14:30:00Z",
    "validation_deadline": "2025-01-20T14:00:00Z",
    "created_at": "2025-01-20T13:30:00Z",
    "updated_at": "2025-01-20T13:30:00Z"
  }
}
```

**Réponse Produit Non Disponible (400):**
```json
{
  "success": false,
  "error": "Produit non disponible",
  "error_type": "BadRequestWithData",
  "data": {
    "similar_products": [
      {
        "service_id": 124,
        "product_index": 0,
        "name": "Produit similaire",
        "description": "Description",
        "price": 5000,
        "currency": "FCFA",
        "image_url": "https://...",
        "similarity_score": 0.85
      }
    ]
  }
}
```

---

### 2. Valider une commande

**Endpoint:** `POST /api/orders/:order_id/validate`

**Description:** Le prestataire valide une commande. Si le produit est `is_immediately_available`, le statut passe directement à "ready" et le matching coursier démarre immédiatement.

**Body:**
```json
{
  "estimated_ready_at": "2025-01-20T15:00:00Z" // Optionnel
}
```

**Réponse (200):**
```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "status": "validated", // ou "ready" si is_immediately_available
    "validated_at": "2025-01-20T14:00:00Z",
    "validated_by": 789
  }
}
```

---

### 3. Rejeter une commande

**Endpoint:** `POST /api/orders/:order_id/reject`

**Description:** Le prestataire rejette une commande avec une raison.

**Body:**
```json
{
  "reason": "Produit en rupture de stock"
}
```

**Réponse (200):**
```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "status": "rejected",
    "rejected_at": "2025-01-20T14:00:00Z",
    "rejection_reason": "Produit en rupture de stock"
  }
}
```

---

### 4. Obtenir les détails d'une commande

**Endpoint:** `GET /api/orders/:order_id`

**Description:** Récupère les détails complets d'une commande.

**Réponse (200):**
```json
{
  "order": {
    "id": "uuid",
    "delivery_id": "uuid",
    "service_id": 123,
    "product_index": 0,
    "client_user_id": 456,
    "provider_user_id": 789,
    "status": "pending",
    "preparation_time_minutes": 15,
    "estimated_ready_at": "2025-01-20T14:30:00Z",
    "validated_at": null,
    "rejected_at": null,
    "validation_deadline": "2025-01-20T14:00:00Z",
    "created_at": "2025-01-20T13:30:00Z",
    "updated_at": "2025-01-20T13:30:00Z"
  }
}
```

---

### 5. Obtenir les commandes en attente (Prestataire)

**Endpoint:** `GET /api/orders/provider/pending`

**Description:** Récupère toutes les commandes en attente pour le prestataire authentifié.

**Query Parameters:**
- `status` (optionnel): Filtrer par statut (`pending`, `validated`, `ready`, `rejected`, `cancelled`)

**Réponse (200):**
```json
{
  "orders": [
    {
      "id": "uuid",
      "service_id": 123,
      "product_index": 0,
      "status": "pending",
      "preparation_time_minutes": 15,
      "validation_deadline": "2025-01-20T14:00:00Z",
      "created_at": "2025-01-20T13:30:00Z"
    }
  ]
}
```

---

### 6. Obtenir les commandes du client

**Endpoint:** `GET /api/orders/client/my-orders`

**Description:** Récupère toutes les commandes du client authentifié.

**Réponse (200):**
```json
{
  "orders": [
    {
      "id": "uuid",
      "service_id": 123,
      "product_index": 0,
      "status": "validated",
      "estimated_ready_at": "2025-01-20T14:30:00Z",
      "created_at": "2025-01-20T13:30:00Z"
    }
  ]
}
```

---

### 7. Obtenir les produits similaires pour une commande

**Endpoint:** `GET /api/orders/:order_id/similar`

**Description:** Récupère les produits similaires pour une commande (utile après un rejet).

**Réponse (200):**
```json
{
  "similar_products": [
    {
      "service_id": 124,
      "product_index": 0,
      "name": "Produit similaire",
      "description": "Description",
      "price": 5000,
      "currency": "FCFA",
      "image_url": "https://...",
      "similarity_score": 0.85
    }
  ]
}
```

---

## 📊 Analytics Prestataire

### 1. Statistiques des commandes

**Endpoint:** `GET /api/provider/:provider_id/analytics/orders`

**Description:** Récupère les statistiques des commandes par statut.

**Query Parameters:**
- `period_start` (optionnel): Date de début (ISO 8601)
- `period_end` (optionnel): Date de fin (ISO 8601)

**Réponse (200):**
```json
{
  "order_stats": {
    "total": 150,
    "pending": 10,
    "validated": 80,
    "ready": 40,
    "rejected": 15,
    "cancelled": 5,
    "by_status": {
      "pending": 10,
      "validated": 80,
      "ready": 40,
      "rejected": 15,
      "cancelled": 5
    }
  }
}
```

---

### 2. Métriques délais de préparation

**Endpoint:** `GET /api/provider/:provider_id/analytics/preparation-time`

**Description:** Récupère les métriques des délais de préparation.

**Réponse (200):**
```json
{
  "preparation_time_stats": {
    "average_minutes": 25.5,
    "median_minutes": 20.0,
    "min_minutes": 5,
    "max_minutes": 120,
    "by_product": [
      {
        "service_id": 123,
        "product_index": 0,
        "average_minutes": 15.0,
        "order_count": 50
      }
    ]
  }
}
```

---

### 3. Analyse des rejets

**Endpoint:** `GET /api/provider/:provider_id/analytics/rejections`

**Description:** Analyse des rejets avec raisons et fréquences.

**Réponse (200):**
```json
{
  "rejection_stats": {
    "total_rejections": 15,
    "rejection_rate": 10.0,
    "reasons": [
      {
        "reason": "Produit en rupture de stock",
        "count": 8,
        "percentage": 53.3
      }
    ],
    "by_product": [
      {
        "service_id": 123,
        "product_index": 0,
        "rejection_count": 5,
        "rejection_rate": 10.0
      }
    ]
  }
}
```

---

### 4. Analyse des annulations

**Endpoint:** `GET /api/provider/:provider_id/analytics/cancellations`

**Description:** Analyse complète des annulations (timeout, rejet, etc.).

**Réponse (200):**
```json
{
  "cancellation_stats": {
    "total_cancellations": 20,
    "cancellation_rate": 13.3,
    "by_type": {
      "timeout": 10,
      "rejected": 5,
      "provider_cancelled": 3,
      "courier_unavailable": 2
    },
    "by_product": [
      {
        "service_id": 123,
        "product_index": 0,
        "total_orders": 50,
        "total_cancellations": 8,
        "cancellation_rate": 16.0,
        "timeout_cancellations": 5,
        "rejected_cancellations": 3
      }
    ],
    "top_reasons": [
      {
        "reason": "Timeout validation",
        "count": 10
      }
    ],
    "evolution": [
      {
        "date": "2025-01-20",
        "cancellation_rate": 12.5,
        "total_cancellations": 5
      }
    ],
    "high_cancellation_products": [
      {
        "service_id": 123,
        "product_index": 0,
        "cancellation_rate": 25.0
      }
    ]
  }
}
```

---

### 5. Performance par produit

**Endpoint:** `GET /api/provider/:provider_id/analytics/product-performance`

**Description:** Performance détaillée par produit.

**Réponse (200):**
```json
{
  "product_performance_stats": [
    {
      "service_id": 123,
      "product_index": 0,
      "total_orders": 50,
      "average_preparation_minutes": 15.0,
      "validation_rate": 90.0,
      "cancellation_rate": 10.0,
      "rejection_rate": 5.0
    }
  ]
}
```

---

### 6. Dashboard complet

**Endpoint:** `GET /api/provider/:provider_id/analytics/dashboard`

**Description:** Récupère toutes les données analytics en une seule requête.

**Réponse (200):**
```json
{
  "dashboard_data": {
    "order_stats": { ... },
    "preparation_time_stats": { ... },
    "rejection_stats": { ... },
    "cancellation_stats": { ... },
    "penalties_stats": { ... },
    "product_performance": [ ... ],
    "immediate_availability_stats": { ... }
  }
}
```

---

## 🚚 Configuration Livraison

### 1. Obtenir la configuration d'un produit

**Endpoint:** `GET /api/delivery/config/:service_id/:product_index`

**Description:** Récupère la configuration de livraison d'un produit.

**Réponse (200):**
```json
{
  "config": {
    "id": 1,
    "service_id": 123,
    "product_index": 0,
    "is_immediately_available": true,
    "preparation_time_minutes": 15,
    "max_preparation_time_minutes": 30,
    "availability_days": [1, 2, 3, 4, 5],
    "pickup_address": "123 Rue de la Paix, Douala",
    "is_configured": true,
    "cancellation_rate": 5.0
  }
}
```

---

### 2. Obtenir les lieux de pickup (adresses textuelles)

**Endpoint:** `GET /api/delivery/config/:config_id/pickup-locations`

**Description:** Récupère les adresses textuelles des lieux de pickup (pas de coordonnées GPS brutes).

**Réponse (200):**
```json
{
  "addresses": [
    "123 Rue de la Paix, Douala",
    "456 Avenue du Commerce, Yaoundé"
  ]
}
```

---

## 📦 Gestion du Stock

### 1. Mettre à jour le stock

**Endpoint:** `PUT /api/delivery/stock/:config_id`

**Body:**
```json
{
  "location_id": 1,
  "quantity": 50
}
```

**Réponse (200):**
```json
{
  "success": true,
  "message": "Stock mis à jour"
}
```

---

### 2. Supprimer un lieu de stock

**Endpoint:** `DELETE /api/delivery/stock/:config_id/location/:location_id`

**Réponse (200):**
```json
{
  "success": true,
  "message": "Lieu de stock supprimé"
}
```

---

## 🔐 Vérification Coursier

### 1. Générer un code de vérification

**Endpoint:** `GET /api/delivery/:delivery_id/verification-code`

**Description:** Génère un code PIN à 6 chiffres et un QR code pour le prestataire afin de vérifier l'identité du coursier.

**Réponse (200):**
```json
{
  "verification_code": "123456",
  "qr_code_url": "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=123456",
  "expires_at": "2025-01-20T14:30:00Z"
}
```

---

### 2. Vérifier le coursier

**Endpoint:** `POST /api/delivery/:delivery_id/verify-courier`

**Description:** Le prestataire vérifie l'identité du coursier en entrant le code PIN.

**Body:**
```json
{
  "pin": "123456"
}
```

**Réponse Succès (200):**
```json
{
  "success": true,
  "verified": true,
  "message": "Coursier vérifié avec succès"
}
```

**Réponse Échec (400):**
```json
{
  "success": false,
  "verified": false,
  "message": "Code PIN invalide ou expiré"
}
```

---

## 🔍 Produits Similaires

### 1. Rechercher des produits similaires

**Endpoint:** `GET /api/delivery/products/:service_id/:product_index/similar`

**Description:** Recherche des produits similaires basés sur `autocomplete_characteristics` et descriptions.

**Query Parameters:**
- `limit` (optionnel, défaut: 10): Nombre de résultats

**Réponse (200):**
```json
{
  "similar_products": [
    {
      "service_id": 124,
      "product_index": 0,
      "name": "Produit similaire",
      "description": "Description",
      "price": 5000,
      "currency": "FCFA",
      "image_url": "https://...",
      "similarity_score": 0.85
    }
  ]
}
```

---

## ⚠️ Codes d'Erreur

| Code | Description |
|------|-------------|
| 400 | Bad Request - Données invalides |
| 401 | Unauthorized - Token manquant ou invalide |
| 403 | Forbidden - Accès refusé |
| 404 | Not Found - Ressource non trouvée |
| 500 | Internal Server Error - Erreur serveur |

---

## 📝 Notes Importantes

1. **Disponibilité immédiate** : Si `is_immediately_available = TRUE`, le statut passe directement à "ready" après validation et le matching coursier démarre immédiatement.

2. **Timeouts** : Les commandes avec `validation_deadline` expirée sont automatiquement annulées par le système.

3. **Adresses textuelles** : Toutes les routes retournent des adresses textuelles, jamais de coordonnées GPS brutes.

4. **Produits similaires** : La recherche utilise `autocomplete_characteristics` et descriptions pour trouver des produits similaires.

5. **Stats périodiques** : Les statistiques de catégories et d'annulation sont recalculées automatiquement toutes les 24h.

---

## 🔄 Workflow Complet

1. **Client crée une commande** → `POST /api/orders`
2. **Si produit non disponible** → Retourne produits similaires
3. **Prestataire reçoit notification** → Voir commandes en attente
4. **Prestataire valide** → `POST /api/orders/:id/validate`
5. **Si immédiatement disponible** → Statut "ready", matching coursier démarre
6. **Sinon** → Statut "validated", attente préparation
7. **Quand prêt** → Statut "ready", matching coursier démarre
8. **Coursier assigné** → Prestataire peut vérifier avec code PIN

---

## 📚 Références

- Document d'analyse : `ANALYSE_WORKFLOW_LIVRAISON_AMELIORATIONS.md`
- Prompt d'implémentation : `PROMPT_IMPLEMENTATION_AMELIORATIONS_LIVRAISON.md`

