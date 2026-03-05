# Audit complet : Black Friday / Flash Promo / Live

**Date** : Audit réalisé en mars 2026  
**Périmètre** : Backend (Rust/Axum), Mobile (React Native), Frontend Web (React), DB (PostgreSQL), UX

---

## 1. Architecture générale — Cartographie des 3 systèmes

Le système promotionnel se compose de **3 sous-systèmes distincts** :

| Système | But | Stockage | Portée |
|---|---|---|---|
| **Flash Promo** (catalogue) | Promotions temporaires sur les produits d'un prestataire | JSONB dans `services.data` | Catalogue en ligne |
| **Live Flash Sale** | Ventes flash pendant un live streaming | Tables dédiées (`live_flash_sales`, etc.) | Pendant un live |
| **Global Promo / Black Friday** | Campagnes promotionnelles fédérées (type Black Friday) | Tables dédiées (`global_promo_events`, etc.) | Plateforme entière |

---

## 2. Inventaire des fichiers audités

### Backend
| Fichier | Rôle |
|---|---|
| `backend/src/routes/flash_promo_routes.rs` | Routes API Flash Promo |
| `backend/src/controllers/flash_promo_controller.rs` | Logique Flash Promo (CRUD) |
| `backend/src/routes/live_routes.rs` | Routes API Live + Live Flash Sales |
| `backend/src/controllers/live_controller.rs` | Logique Live sessions |
| `backend/src/services/live_flash_sale_service.rs` | Service métier Live Flash Sales (1263 lignes) |
| `backend/src/services/flash_sale_cache.rs` | Cache Redis pour flash sales |
| `backend/src/models/live_model.rs` | Modèles / structs Live |
| `backend/src/routes/global_promo_routes.rs` | Routes API Global Promo (Black Friday) |
| `backend/src/controllers/global_promo_controller.rs` | Logique Global Promo |

### Mobile
| Fichier | Rôle |
|---|---|
| `mobile/src/screens/FlashSaleScreen.tsx` | Écran ventes flash live (réservation) |
| `mobile/src/screens/FlashPromosActiveScreen.tsx` | Écran flash promos actives (catalogue) |
| `mobile/src/screens/CreateFlashPromoScreen.tsx` | Formulaire de création flash promo |
| `mobile/src/screens/LiveHostScreen.tsx` | Écran hôte du live |
| `mobile/src/screens/StartLiveScreen.tsx` | Démarrer un live |
| `mobile/src/screens/LivesListScreen.tsx` | Liste des lives |
| `mobile/src/screens/promo/GlobalPromoManagerScreen.tsx` | Admin Black Friday |
| `mobile/src/services/flashSaleService.ts` | Service API flash sales |

### Frontend Web
| Fichier | Rôle |
|---|---|
| `frontend/src/pages/LivesPage.tsx` | Liste des lives (web) |
| `frontend/src/pages/LiveViewerPage.tsx` | Viewer live + flash sales (web) |
| `frontend/src/pages/promo/GlobalPromoCatalog.tsx` | Catalogue Black Friday (web) |

### DB Migrations
| Fichier | Tables |
|---|---|
| `00000015_create_flash_sales_tables.sql` | `live_flash_sales`, `live_flash_sale_reservations`, `live_flash_sale_commentaries` |
| `20251111001_002_create_live_flash_sales.sql` | Idem (duplicate) |
| `20251115002_create_global_promo_platform.sql` | `global_promo_events`, `global_promo_entries`, `global_promo_products` |

---

## 3. BUGS identifiés

### BUG-1 (CRITIQUE) — Schéma DB incohérent : migrations en double avec colonnes différentes

Les tables `live_flash_sales`, `live_flash_sale_reservations` et `live_flash_sale_commentaries` sont définies dans **2 fichiers de migration différents** avec des **schémas incompatibles** :

**`00000015_create_flash_sales_tables.sql` :**
- `live_flash_sale_reservations` : colonnes `reservation_status`, `expires_at`, `confirmed_at`, `cancelled_at`
- `live_flash_sale_commentaries` : colonnes `user_id`, `comment_text`

**`20251111001_002_create_live_flash_sales.sql` :**
- `live_flash_sale_reservations` : colonnes `quantity` (avec CHECK > 0), `reserved_at` — **PAS** de `reservation_status`, `expires_at`, etc.
- `live_flash_sale_commentaries` : colonnes `created_by` (VARCHAR CHECK), `message`, `metadata` — **PAS** de `user_id`, `comment_text`

Le code Rust (`live_flash_sale_service.rs`) utilise le schéma de la **2ème migration** (`reserved_at`, `quantity`, `created_by`, `message`, `metadata`). Si la 1ère migration s'exécute en premier, le code plantera à l'exécution car les colonnes n'existent pas.

**Impact** : Crash possible en production selon l'ordre d'exécution des migrations.

**Recommandation** : Supprimer `00000015_create_flash_sales_tables.sql` ou le marquer comme obsolète. Garder uniquement `20251111001_002_create_live_flash_sales.sql`.

---

### BUG-2 (CRITIQUE) — `LiveHostScreen.tsx` : le bouton "Vente Flash" est un placeholder

```tsx
// LiveHostScreen.tsx lignes 140-152
onPress={() => {
  Alert.alert(
    'Vente Flash',
    'Cette fonctionnalité sera bientôt disponible!',
    [{ text: 'OK' }]
  );
}}
```

Le bouton "Vente Flash" dans l'écran hôte du live affiche simplement une alerte "bientôt disponible". **Le prestataire ne peut pas configurer de vente flash depuis le live**. Il doit le faire avant via l'API, ce qui est contre-intuitif.

**Impact** : Fonctionnalité core du live commerce non accessible depuis l'interface principale.

---

### BUG-3 (MAJEUR) — `StartLiveScreen.tsx` : données de services mockées en dur

```tsx
// StartLiveScreen.tsx lignes 36-45
useEffect(() => {
  if (user?.id) {
    // TODO: Fetch user's services from API
    // For now, using mock data
    setUserServices([
      { id: 1, title: 'Restaurant Le Gourmet' },
      { id: 2, title: 'Boutique Mode Élégante' },
      { id: 3, title: 'Service de Nettoyage Pro' },
    ]);
  }
}, [user]);
```

Les services affichés dans le sélecteur de service sont **des données hardcodées**. Les vrais services de l'utilisateur ne sont jamais chargés depuis l'API. Le prestataire ne peut donc **jamais** lier correctement son live à son propre service.

**Impact** : Impossible de lier un live à un vrai service → les ventes flash live sont inutilisables via ce flow mobile.

---

### BUG-4 (MAJEUR) — `LiveHostScreen.tsx` : `userId: 0` pour le chat

```tsx
// LiveHostScreen.tsx ligne 256
<LiveChatModal
  visible={showChat}
  sessionId={sessionId}
  userId={0} // Host user ID
  onClose={() => setShowChat(false)}
/>
```

Le `userId` de l'hôte est toujours `0` au lieu de l'ID réel de l'utilisateur connecté. Les messages envoyés par l'hôte seront donc attribués à un utilisateur inexistant ou incorrect.

---

### BUG-5 (MAJEUR) — `LiveHostScreen.tsx` : viewer count simulé aléatoirement

```tsx
// LiveHostScreen.tsx lignes 78-81
const viewerInterval = setInterval(() => {
  setViewerCount(prev => prev + Math.floor(Math.random() * 3));
}, 5000);
```

Le nombre de spectateurs est **incrémenté aléatoirement** côté client au lieu d'être récupéré depuis le backend. Ce nombre ne décroît jamais et ne reflète pas la réalité.

---

### BUG-6 (MOYEN) — `FlashPromosActiveScreen.tsx` : l'API endpoint n'est pas le bon

```tsx
// flashSaleService.ts ligne 68
const response = await apiGet<...>('/api/live/flash-sales');
```

`fetchActiveFlashSales()` appelle `/api/live/flash-sales` qui **n'existe pas** dans les routes définies (`live_routes.rs`). Les routes existantes sont :
- `/api/live/{id}/flash-sales` (nécessite un session ID)
- `/api/flash-promos/active` (flash promos catalogue, pas live flash sales)

L'écran `FlashSaleScreen.tsx` appelle `fetchActiveFlashSales()` quand il n'y a pas de `sessionId`, ce qui devrait échouer.

---

### BUG-7 (MOYEN) — `FlashPromosActiveScreen.tsx` : pas de mise à jour en temps réel

Le temps restant (`formatTimeRemaining`) est calculé une seule fois au rendu. Il n'y a **aucun timer** pour mettre à jour le compteur en temps réel, contrairement à `FlashSaleScreen.tsx` qui utilise un `setInterval` de 1s. Les utilisateurs voient un temps restant figé.

---

### BUG-8 (MOYEN) — Flash Promo stocké en JSONB dans `services.data`

Les flash promos du catalogue ne sont **pas** dans une table dédiée. Elles sont stockées dans le champ JSONB `data.promotion.flash_promos` de la table `services`. Cela implique :
- Pas de contraintes d'intégrité (dates, valeurs)
- Pas d'index pour les requêtes de filtrage
- Risque de corruption silencieuse des données
- Le endpoint `get_active_flash_promos` doit scanner **tous** les services pour trouver les promos actives

---

### BUG-9 (MOYEN) — `CreateFlashPromoScreen.tsx` : `@ts-nocheck` désactive TypeScript

La première ligne du fichier est `// @ts-nocheck`. Cela signifie que **toutes les erreurs de type sont ignorées**, y compris des bugs potentiels. Les types des props, des paramètres de route et des réponses API ne sont pas vérifiés.

---

### BUG-10 (MINEUR) — `FlashSaleCache` : `increment_reserved_stock` utilise `DECRBY` sur le stock disponible

La méthode s'appelle `increment_reserved_stock` mais effectue un `DECRBY` (décrémente le stock disponible). Le nom est trompeur et peut induire en erreur lors de la maintenance. De plus, si la clé n'existe pas dans Redis (TTL de 1s expiré), `DECRBY` créera la clé avec la valeur `0 - quantity` = valeur négative.

---

### BUG-11 (MINEUR) — `LiveHostScreen.tsx` : fuite de mémoire du `viewerInterval`

```tsx
const viewerInterval = setInterval(() => { ... }, 5000);
return () => clearInterval(viewerInterval);
```

Le `return` est dans le corps de `startLive()`, pas dans un `useEffect`. Le cleanup function n'est jamais appelé, causant une fuite de mémoire (le setInterval tourne indéfiniment même après déconnexion).

---

### BUG-12 (MINEUR) — `GlobalPromoManagerScreen.tsx` : dates saisies en texte brut

Les champs de date pour créer un événement sont des `TextInput` où l'utilisateur doit taper `YYYY-MM-DDTHH:mm` manuellement. Aucun `DateTimePicker` n'est utilisé contrairement à `CreateFlashPromoScreen.tsx`.

---

## 4. Fonctionnalités manquantes

### FM-1 (CRITIQUE) — Pas d'écran mobile LiveViewer pour les spectateurs

Il n'existe **aucun** fichier `LiveViewerScreen.tsx` dans le mobile. La navigation pointe vers `'LiveViewerScreen'` mais aucun composant n'est enregistré dans `AppNavigator.tsx` pour ce nom. Le frontend web a un `LiveViewerPage.tsx` complet, mais les utilisateurs mobiles ne peuvent **pas regarder un live**.

---

### FM-2 (CRITIQUE) — Pas de WebSocket / temps réel pour les mises à jour de stock

Le backend utilise Redis pub/sub pour broadcaster les mises à jour de stock (`broadcast_stock_update`), mais :
- **Mobile** : Aucun client WebSocket ou SSE n'est implémenté. Les mises à jour de stock ne sont visibles qu'après un pull-to-refresh manuel.
- **Frontend web** : Aucun abonnement WebSocket non plus. Les commentaires sont pollés toutes les 15 secondes.

Pour un système de vente flash en live, c'est un **manquement critique**. Les utilisateurs voient des stocks obsolètes et risquent de tenter des réservations sur des produits déjà épuisés.

---

### FM-3 (MAJEUR) — Pas de lien entre Flash Promo (catalogue) et Live Flash Sale

Les deux systèmes de promotion sont **complètement déconnectés** :
- `Flash Promo` : stocké dans JSONB, gestion via `/api/flash-promos/*`
- `Live Flash Sale` : tables dédiées, gestion via `/api/live/*/flash-sales`

Un prestataire ne peut pas convertir une flash promo catalogue en vente flash live, ni vice-versa. La colonne `availability` ("online"/"live"/"both") dans Flash Promo est un indicateur passif sans logique de synchronisation.

---

### FM-4 (MAJEUR) — Pas de gestion des paiements / conversion

Le système de réservation (`reserve_flash_sale`) crée un ticket mais n'effectue **aucun** paiement. Il n'y a pas de :
- Intégration avec un système de paiement (mobile money, carte, etc.)
- Conversion de la réservation en commande
- Expiration automatique des réservations non payées (la contrainte `UNIQUE(flash_sale_id, user_id)` empêche même une 2ème tentative)

Les analytics (`LiveSessionAnalytics`) ont des champs `conversions` et `revenue_cfa` mais ils ne sont **jamais incrémentés** dans le code.

---

### FM-5 (MAJEUR) — `GlobalPromoSubmissionScreen` jamais auditée (écran prestataire)

L'écran `GlobalPromoSubmissionScreen` est enregistré dans la navigation mais n'a pas pu être trouvé/vérifié en détail. C'est l'écran où les prestataires soumettent leurs produits à une campagne Black Friday.

---

### FM-6 (MOYEN) — Pas de notification push pour les flash promos catalogue

Le backend envoie des notifications pour les `live_flash_sales` (via `process_timers`), mais les `flash_promos` catalogue n'ont **aucun** système de notification. Les utilisateurs ne sont pas alertés quand une nouvelle promo catalogue apparaît.

---

### FM-7 (MOYEN) — Pas d'historique des réservations utilisateur

Il n'existe aucun endpoint ni écran pour qu'un utilisateur consulte l'historique de ses réservations de ventes flash. Le seul moyen est `get_flash_sale_ticket_status` pour un ticket spécifique.

---

### FM-8 (MOYEN) — Pas de modération / contrôle d'accès pour `create_global_promo_event`

N'importe quel utilisateur authentifié peut créer un événement Global Promo (Black Friday). La fonction `ensure_admin_role` n'est appelée que pour `review_global_promo_entry` et `review_global_promo_entries_bulk`, pas pour la création d'événements.

---

### FM-9 (MINEUR) — Pas de partage social des flash promos

Aucun bouton de partage (WhatsApp, Facebook, etc.) n'est présent sur `FlashPromosActiveScreen` ni sur `FlashSaleScreen`. Pour un système promotionnel, le partage viral est essentiel.

---

## 5. Problèmes UX

### UX-1 (CRITIQUE) — Incohérence des 2 écrans de promos

L'utilisateur a accès à **2 écrans différents** pour des concepts similaires :
- `FlashPromosActiveScreen` ("⚡ Flash Promotionnels") — promos catalogue avec `ProductCard`
- `FlashSaleScreen` ("🔥 Ventes Flash") — ventes flash live avec réservation

Ces 2 écrans ont des designs, interactions et données **complètement différents**. L'utilisateur ne comprend pas la différence entre "Flash Promotionnel" et "Vente Flash". Il devrait y avoir une **vue unifiée** ou au minimum une explication claire.

---

### UX-2 (MAJEUR) — `FlashPromosActiveScreen` : navigation vers le service, pas vers le produit

Quand l'utilisateur tape sur une promo, il est redirigé vers `ServiceDetail` avec un paramètre `highlightPromo`. Mais :
- Il n'est pas redirigé directement vers le produit en promotion
- Le paramètre `highlightPromo` n'est probablement pas géré côté `ServiceDetail`
- L'utilisateur doit ensuite chercher le produit dans la page du service

---

### UX-3 (MAJEUR) — `CreateFlashPromoScreen` : pas de preview avant création

Le formulaire de création ne montre **aucun aperçu** de ce à quoi ressemblera la promotion côté utilisateur. Le prestataire remplit le formulaire à l'aveugle et ne peut pas vérifier le rendu final.

---

### UX-4 (MAJEUR) — `LiveHostScreen` : pas de caméra ni de vrai streaming

L'écran hôte montre un placeholder avec une icône vidéo et le texte "Live en cours...". Il n'y a **aucune intégration caméra** réelle. Le prestataire ne peut pas réellement diffuser de vidéo depuis l'application mobile. Il doit utiliser un outil RTMP externe.

---

### UX-5 (MOYEN) — Absence de countdown / urgence visuelle pour les flash sales

L'écran `FlashSaleScreen` affiche un badge avec le temps restant, mais :
- Pas d'animation de compte à rebours
- Pas de changement de couleur quand le temps est presque écoulé
- Pas de vibration/son à la fin
- Le badge n'est pas assez proéminent pour créer un sentiment d'urgence (essentiel en live commerce)

---

### UX-6 (MOYEN) — `LivesListScreen` : "Host ID: {item.host_user_id}" affiché brut

L'identifiant numérique de l'hôte est affiché tel quel au lieu du nom du prestataire. L'API `list_upcoming_sessions` ne renvoie probablement pas le nom de l'hôte.

---

### UX-7 (MOYEN) — `GlobalPromoCatalog.tsx` (web) : filtrage client + serveur redondant

Le catalogue fait un appel API avec des filtres (`availability`, `search`, `sort`), mais applique **aussi** un filtrage côté client (`filteredItems`). Le filtrage client re-filtre par `keyword`, `availability` et `minDiscount` alors que le serveur a déjà filtré. Cela peut donner des résultats incohérents et est source de confusion dans la maintenance.

---

### UX-8 (MINEUR) — Texte du bouton "Se connecter" dans `FlashSaleScreen`

Si l'utilisateur n'est pas connecté, le bouton affiche "Se connecter" mais le bouton reste activé visuellement (même couleur que "Réserver"). Il devrait avoir un style différent pour indiquer qu'il s'agit d'une action différente.

---

### UX-9 (MINEUR) — `FlashPromosActiveScreen` : pas de skeleton loading

Le chargement initial montre un simple `ActivityIndicator` centré. Un skeleton loading avec des cartes placeholder donnerait une meilleure perception de performance.

---

## 6. Problèmes de sécurité

### SEC-1 (MAJEUR) — `create_global_promo_event` : pas de vérification admin

Tout utilisateur authentifié peut créer un événement promotionnel global (Black Friday). Seule la review des entrées nécessite un rôle admin. Un prestataire malveillant pourrait créer de faux événements promotionnels.

---

### SEC-2 (MOYEN) — `flash_promo_controller.rs` : pas de rate limiting

Le endpoint `create_flash_promo` n'a aucun rate limiting. Un prestataire pourrait créer un nombre illimité de flash promos, polluant le catalogue visible par tous les utilisateurs.

---

### SEC-3 (MOYEN) — `reserve_flash_sale` : contrainte UNIQUE empêche re-tentative

La contrainte `UNIQUE(flash_sale_id, user_id)` sur `live_flash_sale_reservations` empêche un utilisateur de re-réserver s'il a déjà une réservation. Si sa première réservation a échoué ou été annulée, il ne pourra **pas** réessayer (sauf suppression manuelle en DB).

---

## 7. Problèmes de performance

### PERF-1 (MAJEUR) — `get_active_flash_promos` scanne tous les services

Le endpoint public `/api/flash-promos/active` exécute un `SELECT * FROM services` puis parse le JSONB de chaque service pour trouver les flash promos actives. Sans index JSONB, c'est un full table scan sur tous les services de la plateforme.

---

### PERF-2 (MOYEN) — `FlashSaleCache` TTL de 1 seconde

Le TTL du cache stock Redis est de **1 seconde**. C'est essentiellement inutile : le cache expire avant même que la prochaine requête n'arrive dans la plupart des cas. Soit supprimer le cache, soit augmenter le TTL à 5-10s avec invalidation sur write.

---

### PERF-3 (MINEUR) — `process_timers` exécute des requêtes IA par flash sale

La fonction `generate_ai_commentary` génère des commentaires IA pour chaque flash sale active. Si beaucoup de flash sales sont en cours simultanément, cela peut saturer les APIs IA et le réseau.

---

## 8. Recommandations prioritaires

### Priorité 1 — Corriger les bugs bloquants
1. **Supprimer la migration dupliquée** `00000015_create_flash_sales_tables.sql`
2. **Implémenter le chargement des vrais services** dans `StartLiveScreen.tsx`
3. **Créer `LiveViewerScreen.tsx`** pour le mobile (port du `LiveViewerPage.tsx` web)
4. **Connecter le bouton Vente Flash** de `LiveHostScreen` à `configure_flash_sales`
5. **Fixer `fetchActiveFlashSales`** pour utiliser le bon endpoint API

### Priorité 2 — Implémenter le temps réel
6. **Ajouter WebSocket/SSE** pour les mises à jour de stock en live
7. **Ajouter un timer** sur `FlashPromosActiveScreen` pour le countdown

### Priorité 3 — Unifier l'expérience
8. **Fusionner ou clarifier** `FlashPromosActiveScreen` et `FlashSaleScreen`
9. **Migrer les flash promos** du JSONB vers une table dédiée
10. **Ajouter `ensure_admin_role`** à `create_global_promo_event`

### Priorité 4 — Améliorer l'UX
11. **Intégrer la caméra** dans `LiveHostScreen` (expo-camera ou react-native-camera)
12. **Afficher le nom de l'hôte** au lieu du `host_user_id`
13. **Ajouter le partage social** sur les écrans de promotions
14. **Ajouter un système de paiement** post-réservation

---

## 9. Résumé des constats

| Catégorie | Critique | Majeur | Moyen | Mineur | Total |
|---|---|---|---|---|---|
| **Bugs** | 2 | 4 | 4 | 3 | **13** |
| **Fonctionnalités manquantes** | 2 | 4 | 3 | 1 | **10** |
| **Problèmes UX** | 1 | 3 | 3 | 2 | **9** |
| **Sécurité** | 1 | 1 | 1 | 0 | **3** |
| **Performance** | 1 | 1 | 1 | 0 | **3** |
| **Total** | **7** | **13** | **12** | **6** | **38** |

Le système Black Friday / Flash Promo / Live est **fonctionnel dans sa structure backend** mais présente des **lacunes majeures côté mobile** (pas de viewer live, services mockés, bouton flash sale placeholder) et des **incohérences architecturales** (2 systèmes de promo déconnectés, migrations en double, stockage JSONB vs tables). Le système de Global Promo (Black Friday) est le plus complet et le mieux structuré des trois.
