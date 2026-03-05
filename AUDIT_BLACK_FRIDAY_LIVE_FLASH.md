# AUDIT COMPLET : Black Friday, Live Streaming, Flash/Promotions

**Date** : 2026-03-05  
**Systèmes audités** : Black Friday (Global Promo), Live Streaming, Flash Promotions  
**Périmètre** : Backend (routes, controllers, services, DB) + Mobile (écrans, UX création, UX participation)

---

## 1. SYSTÈME BLACK FRIDAY (Global Promo)

### 1.1 Backend — ✅ OPÉRATIONNEL

| Composant | Fichier | Statut |
|-----------|---------|--------|
| Routes | `backend/src/routes/global_promo_routes.rs` | ✅ 12 routes (publiques + protégées) |
| Controller | `backend/src/controllers/global_promo_controller.rs` | ✅ CRUD complet |
| Intégration | `backend/src/lib.rs` | ✅ Mergé dans `build_app()` |

**Routes publiques** :
- `GET /api/global-promos/events` — Lister les événements
- `GET /api/global-promos/events/{id}` — Détails + entrées d'un événement
- `GET /api/global-promos/catalog` — Catalogue global (avec feature flag)

**Routes protégées (JWT)** :
- `POST /api/global-promos/events` — Créer un événement
- `PUT /api/global-promos/events/{id}` — Modifier un événement
- `POST /api/global-promos/entries` — Ajouter une entrée
- `POST /api/global-promos/entries/{id}/review` — Revoir une entrée
- `POST /api/global-promos/entries/bulk-review` — Revue en masse
- `POST /api/global-promos/entries/{id}/regenerate-snapshot` — Régénérer snapshot
- `GET /api/global-promos/my/events` — Mes événements
- `GET /api/global-promos/my/entries` — Mes entrées
- `POST /api/global-promos/events/{id}/submit` — Soumettre à un événement

**Fonctionnalités** : Création/modification d'événements, soumission par prestataires, revue admin (individuelle + bulk), snapshots, catalogue avec feature flag, notifications.

### 1.2 Mobile — ✅ OPÉRATIONNEL (3 écrans)

| Écran | Fichier | Rôle | Statut |
|-------|---------|------|--------|
| Admin Manager | `GlobalPromoManagerScreen.tsx` | Gestion campagnes (admin) | ✅ |
| Soumission | `GlobalPromoSubmissionScreen.tsx` | Prestataire soumet son service | ✅ |
| Catalogue | `GlobalPromoCatalogScreen.tsx` | Utilisateur browse les promos | ✅ |

**Navigation** : Tous enregistrés dans `AppNavigator.tsx` avec SafeArea.

**UX Création (Admin)** :
- Formulaire complet : nom, thème, slug, description, dates, config (couleur, bannière)
- Stats campagnes live/programmées
- Filtrage entrées par statut (all/pending/approved/rejected)
- Approbation individuelle et bulk

**UX Soumission (Prestataire)** :
- Sélection campagne ouverte
- Formulaire : ID service, prix promo, % réduction, stock, note
- Historique des demandes

**UX Participation (Utilisateur)** :
- Bannière Black Friday
- Recherche + filtres (tous/en ligne/live/les deux)
- Cartes produits avec images, badges, prix promo, % réduction
- Pagination infinie
- Navigation vers ServiceDetail

### 1.3 Problèmes identifiés

| # | Sévérité | Problème | Impact |
|---|----------|----------|--------|
| BF-1 | ⚠️ Mineur | `GlobalPromoSubmissionScreen` demande l'ID service manuellement (pas de sélecteur) | UX friction pour les prestataires |
| BF-2 | ℹ️ Info | Pas de notification push quand une campagne démarre | Les utilisateurs doivent vérifier manuellement |

---

## 2. SYSTÈME LIVE STREAMING

### 2.1 Backend — ✅ OPÉRATIONNEL

| Composant | Fichier | Statut |
|-----------|---------|--------|
| Routes | `backend/src/routes/live_routes.rs` | ✅ 12 routes (publiques + protégées) |
| Controller | `backend/src/controllers/live_controller.rs` | ✅ Sessions, flash sales, replays, analytics |
| Service | `backend/src/services/live_stream_service.rs` | ✅ LiveKit integration, tokens, provisioning |
| Intégration | `backend/src/lib.rs` | ✅ Mergé dans `build_app()` |

**Routes protégées** :
- `POST /api/live/start` — Démarrer une session live
- `POST /api/live/{id}/replay` — Enregistrer un replay
- `POST /api/live/{id}/flash-sale` — Configurer une vente flash
- `POST /api/live/{id}/flash-sale/{sale_id}/reserve` — Réserver (avec queue)
- `GET /api/live/{id}/flash-sale/reservations` — Mes réservations
- `GET /api/live/{id}/commentaries` — Commentaires (protégé)

**Routes publiques** :
- `GET /api/live/upcoming` — Sessions à venir
- `GET /api/live/{id}` — Détails d'une session
- `GET /api/live/{id}/join` — Info de connexion (token LiveKit)
- `GET /api/live/{id}/flash-sales` — Ventes flash du live
- `GET /api/live/{id}/commentaries/public` — Commentaires publics
- `GET /api/live/{id}/analytics` — Analytics

**Fonctionnalités clés** :
- **LiveKit** : Provisioning de rooms, ingress RTMP/WHIP, tokens d'accès (host vs viewer)
- **Flash Sales** : Configuration, réservation avec système de queue anti-DDoS
- **Replays** : Enregistrement URL, storage provider, durée, taille
- **Analytics** : Viewers (HLS/WebRTC), watch time, conversions, revenue

### 2.2 Mobile — ⚠️ PARTIELLEMENT OPÉRATIONNEL

| Composant | Fichier | Rôle | Statut |
|-----------|---------|------|--------|
| Player | `LiveStreamPlayer.tsx` | Lecture HLS/WebRTC | ✅ |
| Chat | `LiveChatModal.tsx` | Chat temps réel | ✅ |
| Flash Sales | `FlashSaleScreen.tsx` | Ventes flash pendant live | ✅ |
| Conférences | `ConferencesLivesScreen.tsx` | Lives scolaires | ✅ |
| Service | `liveStreamingService.ts` | API client | ✅ |
| Service | `liveKitService.ts` | LiveKit client (chat, gifts) | ✅ |

**Navigation** : `FlashSale` et `ConferencesList` enregistrés dans AppNavigator.

### 2.3 Problèmes identifiés

| # | Sévérité | Problème | Impact |
|---|----------|----------|--------|
| LIVE-1 | 🔴 **CRITIQUE** | **Pas d'écran mobile pour DÉMARRER un live (host)** | Un prestataire ne peut PAS lancer un live depuis l'app mobile. L'API `POST /api/live/start` existe mais aucun écran mobile ne l'appelle. |
| LIVE-2 | 🔴 **CRITIQUE** | **Pas d'écran de listing des lives à venir** (côté utilisateur général) | Les utilisateurs n'ont pas d'écran dédié pour découvrir les lives (seulement `ConferencesLivesScreen` pour le scolaire) |
| LIVE-3 | ⚠️ Important | `LiveStreamPlayer` utilise `expo-av` Video + HLS — pas de WebRTC natif | Latence plus élevée qu'un TikTok (HLS = 5-15s de delay vs WebRTC < 1s) |
| LIVE-4 | ⚠️ Important | Chat modal basique : pas de réactions en overlay, pas de viewer count en temps réel | Loin du niveau TikTok (réactions flottantes, compteur live, etc.) |
| LIVE-5 | ⚠️ Important | Gifts system implémenté dans le code mais pas de monétisation réelle (pas de paiement) | Les gifts sont envoyés mais pas liés à un système de tokens/paiement |
| LIVE-6 | ℹ️ Info | `ConferencesLivesScreen.handleJoinConference` affiche un Alert au lieu de rejoindre le live | "L'intégration LiveKit mobile sera disponible prochainement" |

**Gap TikTok-level** : Le système est architecturalement solide (LiveKit, HLS, flash sales, replays, analytics) mais l'UX mobile est incomplète. Il manque les éléments clés d'une expérience TikTok : écran de création de live, feed vertical de lives, réactions flottantes, viewer count animé, WebRTC pour latence sub-seconde.

---

## 3. SYSTÈME FLASH / PROMOTIONS

### 3.1 Backend — ✅ OPÉRATIONNEL

| Composant | Fichier | Statut |
|-----------|---------|--------|
| Routes | `backend/src/routes/flash_promo_routes.rs` | ✅ 4 routes |
| Controller | `backend/src/controllers/flash_promo_controller.rs` | ✅ CRUD + enrichissement |
| Intégration | `backend/src/lib.rs` | ✅ Mergé dans `build_app()` |

**Routes** :
- `GET /api/flash-promos/active` — Promos actives (public, paginé)
- `POST /api/flash-promos` — Créer une promo (protégé)
- `GET /api/flash-promos/service/{id}` — Promos d'un service (protégé)
- `DELETE /api/flash-promos/service/{id}/{promo_id}` — Supprimer (protégé)

**Modèle de données** (stocké dans `services.data` JSONB) :
- `discount_type` : percentage | fixed | free
- `discount_value` : montant ou pourcentage
- `availability` : online | live | both
- `stock_cap` : limite de stock
- `live_session_id` : lien vers session live
- `product_indexes` : produits spécifiques ou tous
- `starts_at` / `ends_at` : dates de validité

### 3.2 Mobile — ⚠️ PARTIELLEMENT OPÉRATIONNEL

| Écran | Fichier | Rôle | Statut |
|-------|---------|------|--------|
| Création | `CreateFlashPromoScreen.tsx` | Prestataire crée une promo | ✅ |
| Liste active | `FlashPromosActiveScreen.tsx` | Browse les promos actives | ✅ |

**UX Création** : Complet — sélection produits, type de réduction, dates, stock, disponibilité.

**UX Participation** : La page `FlashPromosActiveScreen` affiche correctement les promos actives avec badges et temps restant.

### 3.3 Problèmes identifiés

| # | Sévérité | Problème | Impact |
|---|----------|----------|--------|
| FLASH-1 | 🔴 **CRITIQUE** | **`ProductCard.tsx` n'affiche AUCUNE indication de promotion** | Quand un utilisateur cherche un produit/service, les résultats ne montrent pas si un produit est en promo. Le flag `en_promotion` est passé par `ResultatBesoinScreen` mais `ProductCard` ne l'utilise jamais visuellement. |
| FLASH-2 | 🔴 **CRITIQUE** | **Le backend `rechercher_besoin.rs` n'enrichit PAS les produits avec les données de flash promo** | La recherche ne joint pas la table flash_promos. Les flags `en_promotion`, `promotion_active` dans `ResultatBesoinScreen` sont toujours `false` car le backend ne fournit pas cette info. |
| FLASH-3 | ⚠️ Important | Le tri prioritaire promo dans `ResultatBesoinScreen` (lignes 394-399, 1182-1187) est inopérant | Le tri booste les produits avec `en_promotion=true`, mais ce flag n'est jamais `true` car le backend ne le fournit pas (voir FLASH-2). |

---

## 4. RÉSUMÉ DES CORRECTIONS REQUISES

### 🔴 Critiques (à corriger immédiatement)

1. **FLASH-1 + FLASH-2** : Ajouter un badge promo visible dans `ProductCard.tsx` ET enrichir les résultats de recherche avec les flash promos actives depuis le backend.

2. **LIVE-1** : Créer un écran `StartLiveScreen.tsx` permettant au prestataire de démarrer un live depuis l'app mobile.

3. **LIVE-2** : Créer un écran `LivesListScreen.tsx` listant les lives à venir et en cours pour tous les utilisateurs.

### ⚠️ Importants (à planifier)

4. **LIVE-3** : Migrer vers `@livekit/react-native` pour WebRTC natif (latence < 1s).
5. **LIVE-4** : Ajouter réactions flottantes, viewer count animé, et overlay TikTok-style.
6. **LIVE-5** : Intégrer les gifts avec le système de tokens/paiement existant.
7. **BF-1** : Ajouter un sélecteur de services dans `GlobalPromoSubmissionScreen`.

### ℹ️ Mineurs

8. **BF-2** : Notifications push pour démarrage de campagne.
9. **LIVE-6** : Remplacer l'Alert par une vraie connexion LiveKit dans `ConferencesLivesScreen`.

---

## 5. ARCHITECTURE GLOBALE

```
┌─────────────────────────────────────────────────────────────┐
│                      MOBILE (React Native)                   │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ Black Friday │ Live Stream  │ Flash Promo  │ Search Results │
│              │              │              │                │
│ • Manager    │ • Player     │ • Create     │ • ProductCard  │
│ • Submit     │ • Chat       │ • Active     │   (MANQUE      │
│ • Catalog    │ • FlashSale  │              │    badge promo)│
│              │ • MANQUE:    │              │                │
│              │   StartLive  │              │                │
│              │   LivesList  │              │                │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────┘
       │              │              │                │
       ▼              ▼              ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Rust / Axum)                      │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ global_promo │ live_        │ flash_promo_ │ rechercher_    │
│ _routes ✅   │ routes ✅    │ routes ✅    │ besoin ⚠️      │
│              │              │              │ (pas de join   │
│ global_promo │ live_        │ flash_promo_ │  flash_promos) │
│ _controller  │ controller   │ controller   │                │
│ ✅           │ ✅           │ ✅           │                │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────┘
       │              │              │                │
       ▼              ▼              ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│               PostgreSQL + LiveKit + Redis                    │
│  services.data (JSONB flash_promos) | live_sessions          │
│  global_promo_events | global_promo_entries                   │
│  service_products | media | autocomplete_characteristics      │
└─────────────────────────────────────────────────────────────┘
```

---

*Rapport généré le 2026-03-05. Prochaine étape : implémenter les corrections critiques FLASH-1, FLASH-2, LIVE-1, LIVE-2.*
