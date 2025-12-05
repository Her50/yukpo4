# 📋 Résumé des Expériences Utilisateurs Réelles - Flash Sales & Black Friday

**Date**: 2025-01-28  
**Basé sur**: Code source réel du projet Yukpomnang (backend Rust/Axum, frontend React, mobile React Native)

---

## 🎯 EXPÉRIENCE CLIENT (Frontend Web)

### 1. **Flash Sales dans un Live** (`LiveViewerPage.tsx`)

#### Parcours réel :
1. **Accès au live** : L'utilisateur accède à `/live/:sessionId` via `LiveViewerPage.tsx`
2. **Affichage des flash sales** : Les flash sales sont affichés dans une section dédiée à droite de la vidéo live
3. **Réservation** : 
   - Clic sur le bouton "Réserver" d'un flash sale
   - Appel API : `POST /api/live/flash-sales/{flashSaleId}/reservations` avec `quantity: 1`
   - **IMPORTANT** : Avec la nouvelle implémentation, cette route retourne maintenant un **ticket ID** au lieu de traiter immédiatement
   - L'utilisateur reçoit un ticket avec statut `pending`
4. **Suivi du statut** : 
   - Nouvelle route disponible : `GET /api/live/flash-sales/tickets/{ticket_id}`
   - Statuts possibles : `pending`, `confirmed`, `failed`, `out_of_stock`
5. **Mise à jour en temps réel** : 
   - WebSocket disponible : `ws://host/ws/flash-sale/:flash_sale_id`
   - Reçoit les mises à jour de stock en temps réel
   - Affiche les commentaires automatiques (host ou AI voice)

#### Code réel :
```typescript
// frontend/src/pages/LiveViewerPage.tsx:302
const handleReserveFlashSale = async (sale: LiveFlashSale) => {
    const updated = await reserveFlashSaleSlot(sale.id);
    // Met à jour l'état local avec le nouveau stock
    setDetails((prev) => ({
        ...prev,
        flash_sales: replaceSale(prev.flash_sales, updated),
    }));
    toast.success('Réservation enregistrée !');
};
```

**Note** : Le code frontend actuel appelle encore l'ancienne API synchrone. Il faudra mettre à jour pour utiliser le système de tickets.

---

### 2. **Catalogue Black Friday** (`GlobalPromoCatalog.tsx`)

#### Parcours réel :
1. **Accès** : Page `/promo/global` (ou via lien "🔥 Voir toutes les promos Black Friday" sur HomePage)
2. **Filtres disponibles** :
   - Recherche textuelle (nom de service, description)
   - Disponibilité : `all`, `online`, `live`, `both`
   - Réduction minimale (%)
   - Tri : `priority`, `ending_soon`, `recent`, `newest_event`
3. **Pagination** : 24 items par page avec navigation précédent/suivant
4. **Affichage** :
   - Image du service (depuis `product.snapshot.images[0]`)
   - Titre, description, prix promo, pourcentage de réduction
   - Badges : "En live maintenant", "Live imminent", type de disponibilité
   - Lien vers la page détaillée du service

#### Code réel :
```typescript
// frontend/src/pages/promo/GlobalPromoCatalog.tsx:45
const data = await fetchGlobalPromoCatalog({
    page,
    pageSize: 24,
    availability: availability === 'all' ? undefined : availability,
    search: keyword || undefined,
    sort,
    highlightedOnly: sort === 'priority',
});
```

**Performance** : Le catalogue utilise maintenant la vue matérialisée `global_promo_catalog_cache` pour des requêtes ultra-rapides.

---

## 👨‍💼 EXPÉRIENCE PRESTATAIRE (Frontend Web)

### 1. **Configuration de Flash Sales** (`GoLivePage.tsx`)

#### Parcours réel :
1. **Accès** : Page `/go-live` (nécessite d'être connecté et avoir une session live)
2. **Création de flash sales** :
   - Formulaire avec champs :
     - `service_id` : Sélection d'un service
     - `promo_price_cfa` : Prix promotionnel
     - `stock_target` : Stock disponible
     - `start_at` / `end_at` : Dates de début/fin
     - `commentary_mode` : `host` ou `ai_voice`
     - `commentary_interval_seconds` : Intervalle entre commentaires (min 15s)
     - `ai_voice_profile` : Profil de voix IA (si mode AI)
3. **Enregistrement** : 
   - Appel API : `POST /api/live/{sessionId}/flash-sales` avec tableau d'items
   - Retourne la liste des flash sales configurés
4. **Affichage** : Liste des flash sales configurés avec statut, stock restant, etc.

#### Code réel :
```typescript
// frontend/src/pages/GoLivePage.tsx:267
const handleFlashSalesSave = async () => {
    const items: FlashSaleInput[] = flashSalesDrafts.map(draft => ({
        service_id: Number(draft.serviceId),
        promo_price_cfa: Number(draft.promoPrice),
        stock_target: Number(draft.stockTarget),
        start_at: draft.startAt,
        end_at: draft.endAt,
        commentary_mode: draft.commentaryMode as 'host' | 'ai_voice',
        commentary_interval_seconds: Number(draft.commentaryInterval),
        ai_voice_profile: draft.aiVoiceProfile || null,
    }));
    const saved = await configureFlashSales(result.session.id, items);
    setConfiguredFlashSales(saved);
};
```

---

### 2. **Gestion des Promotions Globales** (`GlobalPromoManager.tsx`)

#### Parcours réel :
1. **Accès** : Composant admin accessible depuis le dashboard
2. **Création d'événement** :
   - Formulaire avec : `slug`, `theme`, `display_name`, `description`, `starts_at`, `ends_at`
   - Exemple : "Black Friday national" avec slug `black-friday-2025`
3. **Soumission d'entrée** :
   - Sélection d'un service
   - Configuration : `discount_percentage`, `promo_price_cfa`, `stock_cap`, `availability`
   - Statut initial : `draft` ou `pending_review`
4. **Review/Approbation** (admin) :
   - Approuver/rejeter en masse ou individuellement
   - Définir `highlighted` et `priority_score` pour la mise en avant
   - Statuts : `draft` → `pending_review` → `approved` → `published`

#### Code réel :
```typescript
// frontend/src/components/admin/GlobalPromoManager.tsx:122
const handleCreateEntry = async () => {
    await upsertGlobalPromoEntry(selectedEventId, {
        serviceId: entryForm.serviceId,
        discountPercentage: entryForm.discountPercentage,
        promoPriceCfa: entryForm.promoPriceCfa,
        stockCap: entryForm.stockCap,
        availability: entryForm.availability,
    });
};
```

---

## 📱 EXPÉRIENCE MOBILE

### État actuel du code mobile :

**❌ Pas d'écran dédié pour Flash Sales**  
- Aucun screen `*FlashSale*.tsx` trouvé
- Aucun composant de réservation de flash sale

**✅ Composants existants liés** :
- `VideoFeedScreen.tsx` : Affiche les lives mais pas les flash sales
- `GlobalPromoHighlights.tsx` : Composant pour afficher les promos globales (utilisé dans `HomeScreen.tsx`)
- Types `GlobalPromo.ts` : Définitions TypeScript pour les promos globales

**⚠️ Action requise** : 
- Créer un écran de réservation de flash sale
- Intégrer le système de tickets pour les réservations
- Ajouter WebSocket pour les mises à jour en temps réel

---

## 🔧 BACKEND - API Réelles

### Flash Sales

#### Routes disponibles :
1. **`POST /api/live/{sessionId}/flash-sales`** : Configurer des flash sales
2. **`GET /api/live/{sessionId}/flash-sales`** : Récupérer les flash sales d'une session
3. **`POST /api/live/flash-sales/{flashSaleId}/reservations`** : **NOUVEAU** - Soumettre une réservation (retourne un ticket)
4. **`GET /api/live/flash-sales/tickets/{ticketId}`** : **NOUVEAU** - Vérifier le statut d'un ticket
5. **`GET /api/live/flash-sales/{flashSaleId}/reservations`** : Liste des réservations
6. **`GET /api/live/flash-sales/{flashSaleId}/commentaries`** : Commentaires d'un flash sale
7. **`POST /api/live/flash-sales/{flashSaleId}/commentaries`** : Poster un commentaire
8. **`GET /api/live/flash-sales`** : Liste tous les flash sales actifs
9. **`WS /ws/flash-sale/:flash_sale_id`** : WebSocket pour mises à jour temps réel

### Global Promos (Black Friday)

#### Routes disponibles :
1. **`GET /api/global-promos/events`** : Liste des événements
2. **`POST /api/global-promos/events`** : Créer un événement
3. **`PUT /api/global-promos/events/{eventId}`** : Mettre à jour un événement
4. **`GET /api/global-promos/events/{eventId}/entries`** : Entrées d'un événement
5. **`POST /api/global-promos/events/{eventId}/entries`** : Soumettre une entrée
6. **`GET /api/global-promos/catalog`** : **NOUVEAU** - Catalogue optimisé avec cache
   - Paramètres : `page`, `page_size`, `highlighted_only`, `availability`, `search`, `sort`
7. **`POST /api/global-promos/entries/{entryId}/review`** : Review d'une entrée
8. **`POST /api/global-promos/entries/bulk-review`** : Review en masse
9. **`GET /api/me/global-promos/events`** : Mes événements et entrées

---

## ⚡ OPTIMISATIONS IMPLÉMENTÉES

### Redis Cache
- **Flash Sale Cache** : Stock disponible et résumés en cache Redis
- **Global Promo Cache** : Pages de catalogue mises en cache avec hash de requête

### Redis Streams
- **File d'attente de réservations** : Les réservations sont traitées de manière asynchrone via Redis Streams
- **Worker de traitement** : `FlashSaleQueueWorker` traite les réservations par batch

### Redis Pub/Sub
- **Mises à jour temps réel** : WebSocket utilise Redis Pub/Sub pour diffuser les mises à jour de stock

### Base de données
- **Index optimisés** : 8 nouveaux index pour accélérer les requêtes
- **Vue matérialisée** : `global_promo_catalog_cache` pour le catalogue Black Friday
- **Refresh automatique** : Vue rafraîchie toutes les 30 secondes

---

## 📊 STATISTIQUES ET MÉTRIQUES

### Données disponibles dans le code :
- **Flash Sales** : `available_stock`, `reserved_count`, `status`, `start_at`, `end_at`
- **Global Promos** : `total` (nombre d'entrées), `page`, `pageSize`, `hasMore`
- **Réservations** : `quantity`, `reserved_at`, `user_id`

### Métriques non implémentées (à ajouter) :
- Taux de conversion flash sales
- Temps moyen de traitement des réservations
- Nombre de vues/clics sur les promos
- Taux de succès des réservations

---

## ✅ POINTS VALIDÉS

1. ✅ **Migrations appliquées** : Tous les index et la vue matérialisée sont créés dans la DB Render
2. ✅ **Backend fonctionnel** : Services, controllers, workers, WebSocket implémentés
3. ✅ **Frontend Web** : Pages LiveViewer, GoLive, GlobalPromoCatalog, GlobalPromoManager fonctionnelles
4. ⚠️ **Frontend Web à mettre à jour** : Adapter `LiveViewerPage` pour utiliser le système de tickets
5. ❌ **Mobile** : Pas d'écran dédié pour flash sales (à créer)

---

## 🚀 PROCHAINES ÉTAPES RECOMMANDÉES

1. **Mettre à jour le frontend web** pour utiliser le système de tickets de réservation
2. **Créer les écrans mobiles** pour flash sales et black friday
3. **Ajouter des métriques** pour le monitoring
4. **Tests de charge** pour valider la scalabilité
5. **Documentation API** pour les développeurs

---

**Note** : Ce résumé est basé uniquement sur le code source réel du projet. Toutes les fonctionnalités mentionnées existent dans le code et sont opérationnelles (sauf mention contraire).

