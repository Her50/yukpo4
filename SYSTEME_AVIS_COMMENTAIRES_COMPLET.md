# 📝 SYSTÈME COMPLET D'AVIS, COMMENTAIRES ET RÉPONSES - PRODUITS

## 🎯 OBJECTIF

Permettre à **TOUS LES UTILISATEURS** (clients et prestataires) de :
1. **Noter un produit** (1 à 5 étoiles)
2. **Laisser un commentaire/avis** sur un produit
3. **Répondre aux commentaires** d'autres utilisateurs avec indexation claire
4. **Voir tous les avis et leurs réponses** hiérarchiquement

---

## 🏗️ ARCHITECTURE

### 1. **Base de données** (PostgreSQL)

#### Table `service_reviews` (améliorée)
```sql
CREATE TABLE service_reviews (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    review_text TEXT,
    reply_to_review_id INTEGER REFERENCES service_reviews(id) ON DELETE CASCADE,  -- ✅ NOUVEAU
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Colonnes clés** :
- `reply_to_review_id` : ID de l'avis auquel on répond (NULL pour avis principal)

#### Vue `service_reviews_with_replies`
```sql
CREATE OR REPLACE VIEW service_reviews_with_replies AS
SELECT 
    r.*,
    u.name as user_name,
    u.avatar_url as user_avatar,
    rr.id as reply_to_id,
    rr.user_id as reply_to_user_id,
    rr.review_text as reply_to_text,
    ru.name as reply_to_user_name
FROM service_reviews r
LEFT JOIN users u ON r.user_id = u.id
LEFT JOIN service_reviews rr ON r.reply_to_review_id = rr.id
LEFT JOIN users ru ON rr.user_id = ru.id;
```

#### Fonctions PostgreSQL

**`get_service_reviews_with_replies(service_id, limit, offset)`**
- Récupère tous les avis d'un service
- Inclut les infos de l'avis parent si c'est une réponse
- Compte le nombre de réponses par avis

**`get_review_replies(review_id, limit)`**
- Récupère toutes les réponses à un avis spécifique
- Triées par date (ASC) pour affichage chronologique

---

## 📱 FRONTEND MOBILE

### 1. **ProductCard.tsx** — ✅ DÉJÀ IMPLÉMENTÉ

**Fonctionnalités** :
- ⭐ Affichage de la notation moyenne (badge doré)
- 💬 Section "Avis et Commentaires" toujours visible
- ✍️ Formulaire de notation (1-5 étoiles) + commentaire
- 📋 Liste des avis récents (3 premiers)
- 👍 Bouton "Utile" par avis
- 🔄 Rechargement automatique après publication

**Visuel** :
```
┌─────────────────────────────────────┐
│  [IMAGE PRODUIT]              🇨🇲    │
└─────────────────────────────────────┘

  ⭐⭐⭐⭐⭐ 4.8 (23 avis)

  💬 Avis et Commentaires [23]

  ┌─────────────────────────────────┐
  │ ✍️ Donnez votre avis             │
  │ ⭐⭐⭐⭐⭐                        │
  │ [Votre commentaire...]          │
  │ [Envoyer]                       │
  └─────────────────────────────────┘

  📝 Jean Dupont  ⭐⭐⭐⭐⭐  Il y a 2j
     Excellent produit, livraison rapide !
     👍 Utile (5)  💬 Répondre

     └→ Marie Kouassi  Il y a 1j
        Merci pour votre avis positif !
        👍 Utile (2)

  📝 Paul Nkolo  ⭐⭐⭐  Il y a 1 sem
     Bon produit mais un peu cher
     👍 Utile (3)  💬 Répondre

  [Voir tous les avis (23)]
```

### 2. **ServiceRating.tsx** — ✅ DÉJÀ EXISTANT

**Fonctionnalités actuelles** :
- Affichage de la note moyenne
- Formulaire de notation (étoiles + commentaire)
- Liste des avis avec nom d'utilisateur, date, note
- Bouton "Utile" par avis

**À AJOUTER** :
- ✅ Bouton "Répondre" sur chaque avis
- ✅ Formulaire de réponse (avec référence à l'avis parent)
- ✅ Affichage hiérarchique des réponses (indentées)
- ✅ Compteur de réponses par avis

---

## 🔧 BACKEND (RUST)

### 1. **Endpoints API**

#### `GET /api/services/:id/reviews`
**Réponse** :
```json
{
  "success": true,
  "data": {
    "average_rating": 4.8,
    "total_reviews": 23,
    "reviews": [
      {
        "id": 123,
        "user_id": 45,
        "user_name": "Jean Dupont",
        "user_avatar": "https://...",
        "rating": 5,
        "comment": "Excellent produit !",
        "created_at": "2025-11-03T10:30:00Z",
        "reply_to_review_id": null,
        "reply_to_user_name": null,
        "reply_to_text": null,
        "reply_count": 1
      },
      {
        "id": 124,
        "user_id": 78,
        "user_name": "Marie Kouassi",
        "user_avatar": "https://...",
        "rating": 0,
        "comment": "Merci pour votre avis !",
        "created_at": "2025-11-04T08:15:00Z",
        "reply_to_review_id": 123,
        "reply_to_user_name": "Jean Dupont",
        "reply_to_text": "Excellent produit !",
        "reply_count": 0
      }
    ]
  }
}
```

#### `POST /api/services/:id/reviews`
**Body** :
```json
{
  "rating": 5,              // 1-5 (ou 0 si c'est une réponse sans note)
  "comment": "Excellent !",
  "reply_to_review_id": 123 // ✅ NOUVEAU : ID de l'avis parent (optionnel)
}
```

**Réponse** :
```json
{
  "success": true,
  "message": "Avis publié avec succès",
  "review_id": 125
}
```

#### `GET /api/reviews/:review_id/replies`
**Réponse** :
```json
{
  "success": true,
  "data": [
    {
      "reply_id": 124,
      "user_id": 78,
      "user_name": "Marie Kouassi",
      "user_avatar": "https://...",
      "rating": 0,
      "reply_text": "Merci !",
      "created_at": "2025-11-04T08:15:00Z"
    }
  ]
}
```

---

## 🎨 AMÉLIORATIONS UX

### 1. **Indexation claire des réponses**
- Indentation visuelle (└→)
- Référence à l'auteur parent ("En réponse à @Jean Dupont")
- Couleur différente pour les réponses

### 2. **Système de notation intelligent**
- Notation obligatoire pour avis principal (1-5 étoiles)
- Notation optionnelle pour réponses (peut être 0 = pas de note)
- Affichage de la moyenne uniquement sur les avis principaux

### 3. **Pagination et chargement**
- Charger 3 avis principaux par défaut
- Bouton "Voir tous les avis" → ouvre modal/screen dédié
- Charger les réponses à la demande (bouton "Voir les X réponses")

### 4. **Actions sur les avis**
- 👍 **Utile** : Marquer un avis comme utile
- 💬 **Répondre** : Ouvrir formulaire de réponse
- 🚨 **Signaler** : Signaler un avis inapproprié (future feature)

---

## 📊 STATISTIQUES

### Notation agrégée (avis principaux uniquement)
```sql
SELECT 
    AVG(rating) as average_rating,
    COUNT(*) as total_reviews
FROM service_reviews
WHERE service_id = :service_id
  AND reply_to_review_id IS NULL;  -- Exclure les réponses
```

### Distribution des notes
```sql
SELECT 
    rating,
    COUNT(*) as count
FROM service_reviews
WHERE service_id = :service_id
  AND reply_to_review_id IS NULL
GROUP BY rating
ORDER BY rating DESC;
```

**Affichage** :
```
⭐⭐⭐⭐⭐ (15) ████████████████████  75%
⭐⭐⭐⭐   (3)  ████                  15%
⭐⭐⭐     (2)  ██                    10%
⭐⭐       (0)                         0%
⭐         (0)                         0%
```

---

## ✅ LISTE DE VÉRIFICATION

### Backend
- [x] Migration `20251104_003_add_review_replies_system.sql`
- [ ] Mettre à jour `POST /api/services/:id/reviews` pour gérer `reply_to_review_id`
- [ ] Mettre à jour `GET /api/services/:id/reviews` pour inclure les réponses
- [ ] Créer `GET /api/reviews/:review_id/replies`
- [ ] Exclure les réponses du calcul de la note moyenne

### Frontend Mobile
- [x] Afficher badge de notation moyenne dans `ProductCard`
- [x] Section "Avis et Commentaires" toujours visible
- [x] Formulaire de notation + commentaire dans `ServiceRating`
- [ ] Bouton "Répondre" sur chaque avis
- [ ] Formulaire de réponse avec référence à l'avis parent
- [ ] Affichage hiérarchique des réponses (indentation)
- [ ] Compteur de réponses ("Voir les 3 réponses")
- [ ] Chargement des réponses à la demande

### UX
- [ ] Couleur distincte pour les réponses vs avis principaux
- [ ] Animation de chargement des réponses
- [ ] Confirmation avant publication
- [ ] Toast de succès après publication
- [ ] Gestion des erreurs (réseau, validation)

---

## 🚀 PROCHAINES ÉTAPES

1. **Implémenter les endpoints backend** pour les réponses
2. **Améliorer ServiceRating.tsx** pour gérer les réponses
3. **Créer ReviewsScreen.tsx** pour afficher tous les avis en plein écran
4. **Ajouter notifications** quand quelqu'un répond à votre avis
5. **Système de modération** pour signaler les avis inappropriés

---

**Date** : 2025-11-04  
**Version** : 1.0  
**Statut** : ✅ Structure de base implémentée, système de réponses en cours

