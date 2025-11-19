# 🚀 PROMPT COMPLET : Implémentation Plan d'Améliorations Système de Livraison Intelligent

## 📋 CONTEXTE DU PROJET

**Monorepo Yukpomnang** : `C:\Users\23767\yukpomnang2`

**Stack technique** :
- **Backend** : Rust avec Axum, SQLx, PostgreSQL (avec pgvector et imgsmlr)
- **Frontend Web** : React avec TypeScript, TailwindCSS
- **Mobile** : React Native avec Expo, TypeScript
- **Base de données** : PostgreSQL sur Render (`DATABASE_URL` fournie, `SQLX_OFFLINE=true`)

**Document de référence** : `PLAN_COMPLET_AMELIORATIONS_LIVRAISON.md` (2392 lignes)

---

## 🎯 OBJECTIF

Implémenter toutes les améliorations décrites dans le plan complet d'améliorations du système de livraison intelligent, en suivant les règles de développement et contraintes spécifiques ci-dessous.

---

## ⚠️ CONTRAINTES CRITIQUES

### **0. Vérification de l'Existant (TRÈS IMPORTANT - À FAIRE EN PREMIER)**

**⚠️ AVANT TOUTE MODIFICATION, IL EST OBLIGATOIRE DE :**

1. ✅ **Rechercher dans le code existant** si la fonctionnalité n'existe pas déjà
   - Utiliser `codebase_search` pour rechercher des fonctionnalités similaires
   - Utiliser `grep` pour chercher des patterns, noms de fonctions, classes, composants
   - Vérifier les fichiers dans les dossiers pertinents (`backend/src/services/`, `mobile/src/`, `frontend/src/`)

2. ✅ **Vérifier les tables de base de données existantes**
   - Vérifier si les tables nécessaires existent déjà
   - Vérifier les schémas SQL existants dans `backend/migrations/`
   - Vérifier les modèles Rust dans `backend/src/models/`

3. ✅ **Vérifier les endpoints API existants**
   - Rechercher dans `backend/src/routes/` et `backend/src/controllers/`
   - Vérifier si un endpoint similaire existe déjà
   - Éviter de créer des endpoints en double

4. ✅ **Vérifier les composants Frontend/Mobile existants**
   - Rechercher dans `frontend/src/components/` et `mobile/src/components/`
   - Rechercher dans `frontend/src/pages/` et `mobile/src/screens/`
   - Réutiliser les composants existants plutôt que d'en créer de nouveaux

5. ✅ **Vérifier les services/utilitaires existants**
   - Vérifier `backend/src/services/` pour services similaires
   - Vérifier `mobile/src/services/` et `frontend/src/services/`
   - Réutiliser la logique existante quand c'est possible

6. ✅ **Vérifier les hooks personnalisés existants**
   - Rechercher dans `mobile/src/hooks/` et `frontend/src/hooks/`
   - Réutiliser les hooks existants plutôt que de dupliquer la logique

**Exemple de vérification systématique** :
```rust
// AVANT de créer une nouvelle fonction calculate_distance() :
// 1. Chercher : haversine_distance, calculate_distance, distance
// 2. Vérifier : backend/src/services/delivery_service.rs
// 3. Résultat : Fonction haversine_distance() existe déjà → UTILISER l'existante
```

**Risques de non-vérification** :
- ❌ Doublons de code (même logique implémentée plusieurs fois)
- ❌ Endpoints API dupliqués (confusion, maintenance difficile)
- ❌ Tables de base de données dupliquées (incohérence de données)
- ❌ Composants UI dupliqués (design incohérent)
- ❌ Services dupliqués (complexité inutile)

**Action requise** :
- ✅ Toujours commencer par une recherche complète dans le codebase
- ✅ Documenter ce qui existe déjà avant de créer du nouveau
- ✅ Préférer l'extension de l'existant plutôt que la création de nouveau

---

### **1. Migrations SQLx - Mode Offline (TRÈS IMPORTANT)**

**⚠️ TOUTES les migrations créées DOIVENT :**

1. ✅ **Respecter SQLx en mode offline** (`SQLX_OFFLINE=true`)
   - Créer les fichiers SQL dans `backend/migrations/` avec le format : `YYYYMMDDHHMMSS_description.sql`
   - Utiliser `sqlx migrate add description` pour générer le fichier

2. ✅ **Être intégrées dans `auto_migrate`**
   - Localiser le fichier `backend/src/main.rs` ou `backend/src/lib.rs` qui contient `auto_migrate()`
   - Vérifier que les migrations sont bien exécutées automatiquement au démarrage

3. ✅ **Être insérées dans `000..all..`**
   - Localiser le fichier de migration globale (probablement `backend/migrations/000_all.sql` ou similaire)
   - Y ajouter toutes les nouvelles migrations SQL dans l'ordre chronologique
   - Format attendu : `\i migrations/YYYYMMDDHHMMSS_description.sql`

4. ✅ **Régénérer sqlx-data.json**
   - Après chaque migration, exécuter : `cargo sqlx prepare -- --lib`
   - Vérifier que `sqlx-data.json` est mis à jour

**Structure attendue** :

1. **Créer fichier SQL séparé** :
```sql
-- backend/migrations/20240101120000_add_product_delivery_config.sql
CREATE TABLE IF NOT EXISTS product_delivery_config (
    -- schéma complet
);
```

2. **Ajouter dans le fichier principal** :
```sql
-- backend/migrations/0000_create_all_tables.sql
-- Ajouter à la fin du fichier (copier le contenu complet) :
CREATE TABLE IF NOT EXISTS product_delivery_config (
    -- schéma complet (même contenu que dans le fichier séparé)
);
```

3. **Vérifier auto_migrate.rs** :
   - Si la migration est critique et doit être exécutée automatiquement au démarrage
   - Ajouter une fonction dans `backend/src/migrations/auto_migrate.rs` si nécessaire
   - Vérifier que `run_auto_migrations()` appelle cette fonction

**Important** : Le fichier `0000_create_all_tables.sql` semble être le fichier principal qui contient toutes les migrations consolidées. TOUTES les nouvelles migrations doivent y être ajoutées en plus du fichier séparé.

### **2. Composant de Rechargement (TRÈS IMPORTANT)**

**⚠️ Pour la partie financière (réservation/vérification solde)** :

Quand le client doit recharger son compte (solde insuffisant) :

1. ✅ **Utiliser le composant EXISTANT** : `RechargeTokensPage` / `RechargeTokensScreen`
   - **Web** : `frontend/src/pages/RechargeTokensPage.tsx`
   - **Mobile** : `mobile/src/screens/RechargeTokensScreen.tsx`

2. ✅ **Ne PAS créer de nouveau composant de recharge**
   - Ouvrir le composant existant en modal
   - Passer le montant minimum à recharger comme paramètre optionnel
   - Après rechargement réussi → Retry la création de livraison

3. ✅ **Exemple d'utilisation** :
```typescript
// Dans le composant de vérification solde (mobile ou web)

const handleInsufficientBalance = (requiredAmount: number, currentBalance: number) => {
    // Ouvrir le composant de recharge existant
    // Navigation vers RechargeTokensPage/RechargeTokensScreen
    // Passer amountToRecharge = requiredAmount - currentBalance
    
    navigation.navigate('RechargeTokens', {
        minimumAmount: requiredAmount - currentBalance,
        onRechargeSuccess: () => {
            // Retry création livraison après rechargement
            retryDeliveryCreation();
        }
    });
};
```

---

## 📊 PLAN D'IMPLÉMENTATION (33 Améliorations)

### **Phase 1 : Fondations (Critique)** - Priorité 🔴 Haute

1. ✅ **Systématisation infos livraison** (obligatoire pour activation produit)
   - Migration : Table `product_delivery_config`
   - Backend : Validation configuration obligatoire
   - Frontend/Mobile : Formulaire configuration lors création produit
   - Voir Section 1 du plan

2. ✅ **Matching seulement quand client commande** (pas à la création vidéo)
   - Backend : Modifier `delivery_service.rs` pour enlever `enqueue_delivery_matching` immédiat
   - Matching déclenché seulement après `assign_delivery_recipient`
   - Voir Section 2 du plan

3. ✅ **Flux commande client direct** (modal automatique)
   - Frontend/Mobile : Modal `OrderDeliveryModal` qui s'ouvre automatiquement
   - Endpoint : `POST /api/delivery/client-order`
   - Auto-remplissage adresses par défaut
   - Voir Section 3 du plan

---

### **Phase 2 : UX Améliorée** - Priorité 🟡 Moyenne

4. ✅ **Auto-remplissage adresses** (depuis base de données + GPS courant)
   - Frontend/Mobile : Charger adresses par défaut utilisateur
   - GPS courant si pas d'adresse enregistrée
   - Voir Section 3 du plan

5. ✅ **Modification adresses à tout moment**
   - UI : Bouton "Modifier" pour pickup/dropoff
   - Backend : Endpoint pour mise à jour adresses livraison
   - Voir Section 3 du plan

6. ✅ **Formulaire persistant si infos manquantes** (notification prestataire)
   - Backend : Notification automatique si config livraison manquante
   - Frontend/Mobile : Formulaire persistant affiché jusqu'à complétion
   - Voir Section 4 du plan

---

### **Phase 3 : Intelligence Avancée** - Priorité 🔴 Haute

7. ✅ **Plages horaires prestataire/client** + Matching intelligent
   - Migration : Tables `product_delivery_config` (pickup_availability_schedule) et `client_delivery_preferences`
   - Backend : Service de matching intelligent avec contraintes horaires
   - Frontend/Mobile : Interface pour définir plages horaires
   - Voir Section 5 du plan

---

### **Phase 4 : Extensions** - Priorité 🟢 Basse

8. ✅ **Navigation vidéos liées** (chaînage de vidéos)
   - Migration : Table `video_links`
   - Backend : Endpoints `POST /api/videos/links`, `GET /api/videos/{id}/links`
   - Frontend/Mobile : Composant `VideoLinksPanel`
   - Voir Section 6 du plan

9. ✅ **Externalisation API publique** (WhatsApp, Facebook)
   - Backend : Endpoint public `POST /api/external/delivery`
   - Documentation API publique
   - Voir Section 7 du plan

---

### **Phase 5 : Gestion Financière Avancée** - Priorité 🔴 Haute

10. ✅ **Verrouillage confirmation livraison** (vérification solde)
    - Backend : Vérification solde avant création livraison
    - Frontend/Mobile : Blocage si solde insuffisant
    - ⚠️ **UTILISER** : `RechargeTokensPage` / `RechargeTokensScreen` (composant existant)
    - Voir Section 9 du plan

11. ✅ **Réservation fonds + Débit définitif**
    - Migration : Table `delivery_payment_reservations`
    - Backend : Service `DeliveryPaymentService` pour gestion réservations
    - Voir Section 9 du plan

12. ✅ **Mécanisme rechargement immédiat**
    - Frontend/Mobile : Ouvrir automatiquement `RechargeTokensPage` / `RechargeTokensScreen`
    - ⚠️ **NE PAS créer de nouveau composant**, utiliser l'existant
    - Après rechargement → Retry création livraison
    - Voir Section 9 du plan

13. ✅ **Gestion rejet produit** (coût livraison non remboursable)
    - Si client payait : Coût reste débité chez client
    - Si prestataire avait offert : Coût prélevé chez client (pas de pénalité prestataire)
    - Backend : Logique de remboursement partiel (produit remboursé, livraison non)
    - Voir Section 9 du plan

14. ✅ **Reversement prestataire** (après validation coursier)
    - Commission Yukpo : Variable d'environnement `YUKPO_COMMISSION_RATE` (par défaut : 5%)
    - **⚠️ IMPORTANT** : Ne pas coder en dur, utiliser variable d'environnement
    - Configuration facilement modifiable : `YUKPO_COMMISSION_RATE=0.05` (5%)
    - Montant reversé = Prix produit - Commission
    - Backend : Paiement automatique au prestataire après livraison validée
    - Voir Section 9 du plan

15. ✅ **Livraison offerte** (débit compte prestataire)
    - Backend : Support `billing_mode: merchant_inclusive`
    - Voir Section 9 du plan

---

### **Phase 6 : Automatisation Intelligente** - Priorité 🟡 Moyenne

16. ✅ **Détection automatique proximité GPS** (pickup/dropoff)
    - Backend : Fonction `check_proximity_and_suggest_status_update()` (déjà partiellement implémentée)
    - Améliorer : Envoi événement WebSocket + Notification push
    - Voir Section 11 du plan

17. ✅ **Suggestions automatiques changement de statut**
    - Backend : Événement WebSocket "proximity_suggestion"
    - Mobile : Modal de confirmation automatique
    - Voir Section 11 du plan

18. ✅ **Notifications push automatiques** (changements de statut)
    - Backend : Service `send_delivery_status_notifications()` (déjà partiellement implémenté)
    - Améliorer : Notifications pour tous les statuts importants
    - Voir Section 11 du plan

19. ✅ **Notifications SMS/Email** (clients sans app)
    - Backend : Service `delivery_notification_service` (structure créée)
    - Intégration service SMS/Email (Twilio, SendGrid) - optionnel pour Phase 6
    - Voir Section 11 du plan

20. ✅ **Changements de statut semi-automatiques** (avec confirmation)
    - Mobile : Bouton "Confirmer" après suggestion automatique
    - Voir Section 11 du plan

---

### **Phase 7 : Améliorations UX Studio Vidéo** - Priorité 🟡 Moyenne

21. ✅ **Auto-remplissage Brief IA** (depuis description produit/service)
    - Frontend/Mobile : Modifier `fetchServiceData` dans `VideoCreationWizardScreen` / `ImmersiveVideoWizard`
    - Priorité : `product.description` > `service.description` (si ≤ 2 produits)
    - Voir Section 12 du plan

22. ✅ **Endpoint Suggestions IA** (génération suggestions depuis brief)
    - Backend : Créer `POST /api/studio/sessions/{id}/suggestions`
    - Frontend/Mobile : Remplacer code hardcodé par appel backend
    - Voir Section 12 du plan

23. ✅ **Amélioration affichage coûts** (produit + livraison séparés)
    - Frontend/Mobile : Séparer visuellement : Prix produit | Coût livraison | Total
    - Badge "Gratuite" si livraison offerte
    - Voir Section 13 du plan

---

### **Phase 8 : Points d'Entrée Commande Multiples** - Priorité 🔴 Haute

24. ✅ **Commande depuis ProductCard** (bouton "Se faire livrer")
    - Frontend/Mobile : Ajouter bouton sur `ProductCard`
    - Modal `OrderDeliveryModal` avec sélection produit + multi-produits
    - Voir Section 13 du plan

25. ✅ **Commande depuis ChatModal** (intégration dans conversation)
    - Frontend/Mobile : Intégrer `OrderDeliveryModal` dans `ChatModal` / `ChatModalMobile`
    - Actions rapides : "Commander ce produit"
    - Voir Section 13 du plan

26. ✅ **Sélection multi-produits** (ajouter plusieurs produits lors commande)
    - Frontend/Mobile : Interface pour sélectionner plusieurs produits du prestataire
    - Backend : Utiliser endpoint existant `create_shopping_order` (déjà supporté)
    - Voir Section 13 du plan

---

### **Phase 9 : Fonctionnalités Avancées** - Priorité 🟡 Moyenne

27. ✅ **Page publique dropoff** (client sans compte via lien)
    - Backend : `GET /api/delivery/public/:token`, `POST /api/delivery/public/:token/dropoff`
    - Frontend/Mobile : Page `PublicDropoffPage` / `PublicDropoffScreen`
    - Voir Section 14 du plan

28. ✅ **Sélection livreur personnel** (choix coursier par prestataire)
    - Backend : Support `courier_id` optionnel dans `CreateDeliveryParams`
    - Frontend/Mobile : Interface pour choisir coursier (liste disponibles)
    - Voir Section 15 du plan

29. ✅ **Notification client fournit adresse** (alerte prestataire)
    - Backend : Notification automatique dans `assign_delivery_recipient` si dropoff était pending
    - Voir Section 16 du plan

30. ✅ **Amélioration UX dropoff pending** (gestion dropoff temporaire)
    - Frontend/Mobile : Badge "En attente adresse client" + Bouton "Partager lien"
    - Backend : Support dropoff optionnel (null) lors création livraison
    - Voir Section 17 du plan

31. ✅ **Chaînage vidéos lors création** (définir dépendances pendant création)
    - Frontend/Mobile : Panneau "Vidéos liées" dans `VideoCreationWizard`
    - Création automatique liens lors sauvegarde/génération vidéo
    - Voir Section 18 du plan

32. ✅ **Plusieurs lieux de stock** (points de départ multiples, matching choisit plus proche)
    - Migration : Table `prestataire_stock_locations`
    - Backend : Fonction `find_optimal_stock_location()` avec calcul distances Haversine
    - Frontend/Mobile : Écran `StockLocationsScreen` pour gérer lieux de stock
    - Voir Section 19 du plan

33. ✅ **Renommage pickup/dropoff** (termes plus naturels : "départ" / "destination")
    - Frontend/Mobile : Labels traduits dans `i18n/locales/fr.ts`
    - Backend : Garder noms techniques internes, renommer dans réponses API (optionnel)
    - Voir Section 21 du plan

---

## 🔧 RÈGLES DE DÉVELOPPEMENT

### **Backend Rust**
1. ✅ **Vérifier l'existant** : Rechercher fonctions/services similaires avant de créer
2. ✅ Utiliser `Result<T, E>` pour la gestion d'erreurs
3. ✅ Implémenter des traits pour la réutilisabilité
4. ✅ Utiliser `async/await` pour les opérations asynchrones
5. ✅ Valider toutes les entrées utilisateur
6. ✅ Utiliser des enums pour les états
7. ✅ Optimiser les requêtes SQL avec des index appropriés
8. ✅ Réutiliser les services existants (ex: `delivery_service`, `notification_service`)

### **Frontend React**
1. ✅ **Vérifier l'existant** : Rechercher composants/hooks similaires avant de créer
2. ✅ Utiliser des hooks personnalisés pour la logique métier
3. ✅ Séparer la logique métier des composants UI
4. ✅ Utiliser des contextes React pour l'état global
5. ✅ Implémenter la gestion d'erreur robuste
6. ✅ Utiliser TypeScript strictement
7. ✅ Optimiser les re-renders avec useMemo/useCallback
8. ✅ Réutiliser les composants système existants (ex: `RechargeTokensPage`)

### **Mobile React Native**
1. ✅ **Vérifier l'existant** : Rechercher screens/composants/hooks similaires avant de créer
2. ✅ Respecter la structure stable (Expo SDK 52, React Native 0.76.9)
3. ✅ Utiliser les composants système de design : `SafeIcon`, `NativeCard`, `NativeButton`, etc.
4. ✅ Gérer les différences iOS/Android avec `Platform.OS`
5. ✅ Utiliser `ErrorBoundary` pour gestion d'erreur robuste
6. ✅ Réutiliser les screens existants (ex: `RechargeTokensScreen`)

### **Base de données**
1. ✅ **TOUTES les migrations DOIVENT être dans `auto_migrate` ET `000..all..`**
2. ✅ Utiliser des migrations pour les changements de schéma
3. ✅ Créer des index pour les requêtes fréquentes
4. ✅ Utiliser des contraintes de clé étrangère
5. ✅ Optimiser les requêtes avec EXPLAIN
6. ✅ Utiliser des transactions pour les opérations complexes
7. ✅ **Régénérer `sqlx-data.json` après chaque migration** : `cargo sqlx prepare -- --lib`

---

## 🚨 POINTS CRITIQUES À RETENIR

1. ⚠️ **VÉRIFICATION EXISTANT** : **TOUJOURS** vérifier le code existant avant toute modification/création pour éviter doublons
2. ⚠️ **MIGRATIONS** : Toujours vérifier `auto_migrate` et `000..all..` après création
3. ⚠️ **RECHARGEMENT** : Utiliser `RechargeTokensPage` / `RechargeTokensScreen` (composant existant), ne pas créer de nouveau
4. ⚠️ **SQLX OFFLINE** : Toujours régénérer `sqlx-data.json` après migrations
5. ⚠️ **GPS MATCHING** : Utiliser fonction `haversine_distance()` existante pour calcul distances
6. ⚠️ **TERMES NATURELS** : Utiliser "Départ" / "Destination" dans l'UI (garder pickup/dropoff en backend)
7. ⚠️ **COMMISSION YUKPO** : Utiliser variable d'environnement `YUKPO_COMMISSION_RATE`, **NE PAS coder en dur** (par défaut 5%)
8. ⚠️ **REJET PRODUIT + LIVRAISON OFFERTE** : Si prestataire avait offert la livraison et client refuse, prélever les frais chez le client (pas le prestataire)

---

## 📝 VALIDATION AVANT COMMIT

Avant chaque commit, vérifier :

1. ✅ **Vérification doublons** : Recherche complète dans le codebase pour s'assurer qu'aucun code similaire n'existe déjà
2. ✅ `cargo fmt` - Formatage Rust
3. ✅ `cargo check` - Compilation Rust
4. ✅ `cargo test` - Tests Rust
5. ✅ `cargo sqlx prepare -- --lib` - Régénération sqlx-data.json
6. ✅ `read_lints` - Linter errors (TypeScript, Rust)
7. ✅ Migrations vérifiées dans `auto_migrate` et `000..all..`
8. ✅ Composants/services réutilisés (RechargeTokens, haversine_distance, etc.) au lieu de créer de nouveaux
9. ✅ Aucun endpoint API dupliqué
10. ✅ Aucune table de base de données dupliquée

---

## 📚 DOCUMENTATION DE RÉFÉRENCE

### **Document principal** (À LIRE EN PRIORITÉ) :
- `PLAN_COMPLET_AMELIORATIONS_LIVRAISON.md` - Plan complet avec toutes les 33 améliorations détaillées

### **Documents d'architecture technique** :
- `ARCHITECTURE_GESTION_FINANCIERE_LIVRAISON.md` - Détails techniques gestion financière (réservations, commissions, remboursements)
- `ARCHITECTURE_VIDEO_PREUVE_LIVRAISON.md` - Détails techniques vidéo preuve de livraison
- `ANALYSE_FLUX_COMMANDE_ET_VIDEOS_LIEES.md` - Détails commande client et chaînage vidéos
- `ANALYSE_FLUX_LIVRAISON_REVISEE.md` - Analyse du flux de livraison révisé
- `ANALYSE_FLUX_LIVRAISON_ET_AMELIORATIONS.md` - Analyse initiale du flux de livraison
- `DIAGNOSTIC_COMPOSANT_VIDEO.md` - Diagnostic du composant vidéo (erreurs, corrections)

### **Documents d'analyse externe** :
- `ANALYSE_EXTERNALISATION_LIVRAISON_PLATEFORMES.md` - Externalisation du système de livraison (WhatsApp, Facebook)
- `BENCHMARK_SYSTEMES_LIVRAISON_AUTOMATISES.md` - Benchmark des systèmes de livraison existants
- `FONCTIONNEMENT_REEL_SUIVI_LIVRAISON.md` - Fonctionnement réel du suivi de livraison

### **Références codebase** (à vérifier avant implémentation) :
- `backend/src/services/delivery_service.rs` - Service principal de livraison
- `backend/src/services/delivery_repository.rs` - Repository de livraison
- `backend/src/models/delivery_models.rs` - Modèles de données livraison
- `backend/src/routes/delivery_routes.rs` - Routes API livraison
- `mobile/src/screens/delivery/` - Écrans de livraison mobile
- `frontend/src/pages/delivery/` - Pages de livraison web
- `mobile/src/screens/RechargeTokensScreen.tsx` - Composant de recharge (à réutiliser)
- `frontend/src/pages/RechargeTokensPage.tsx` - Composant de recharge web (à réutiliser)

---

## 🎯 ORDRE D'IMPLÉMENTATION RECOMMANDÉ

**Sprint 1 (Critique)** : Phases 1, 2, 5 (Fondations + Financière)
**Sprint 2 (Important)** : Phases 3, 8 (Intelligence + Points d'entrée)
**Sprint 3 (Améliorations)** : Phases 6, 7 (Automatisation + UX Studio)
**Sprint 4 (Avancé)** : Phase 9 (Fonctionnalités avancées)

---

## ✅ CHECKLIST DE DÉMARRAGE

Avant de commencer l'implémentation :

### **Phase 0 : Exploration et Vérification de l'Existant (OBLIGATOIRE)**

- [ ] Lire complètement `PLAN_COMPLET_AMELIORATIONS_LIVRAISON.md`
- [ ] **Rechercher dans le codebase** : Fonctionnalités similaires déjà implémentées
- [ ] **Vérifier les tables existantes** : `backend/migrations/` pour voir quelles tables existent déjà
- [ ] **Vérifier les endpoints API** : `backend/src/routes/` et `backend/src/controllers/` pour endpoints similaires
- [ ] **Vérifier les composants Frontend** : `frontend/src/components/`, `frontend/src/pages/`
- [ ] **Vérifier les composants Mobile** : `mobile/src/components/`, `mobile/src/screens/`
- [ ] **Vérifier les services** : `backend/src/services/`, `mobile/src/services/`, `frontend/src/services/`
- [ ] **Vérifier les hooks** : `mobile/src/hooks/`, `frontend/src/hooks/`
- [ ] **Documenter ce qui existe déjà** : Créer une liste des fonctionnalités existantes à réutiliser

### **Phase 1 : Configuration Environnement**

- [ ] Vérifier la structure des migrations existantes (`backend/migrations/`)
- [ ] Localiser `auto_migrate()` dans le code backend (`backend/src/migrations/auto_migrate.rs`)
- [ ] Localiser le fichier `0000_create_all_tables.sql` (ou équivalent)
- [ ] Configurer `SQLX_OFFLINE=true` dans l'environnement
- [ ] Vérifier la structure de la base de données actuelle
- [ ] Configurer `YUKPO_COMMISSION_RATE=0.05` dans les variables d'environnement (ou laisser par défaut 5%)

### **Phase 2 : Vérification Composants/Services Existants**

- [ ] Tester le composant `RechargeTokensPage` / `RechargeTokensScreen` (composant de recharge)
- [ ] Vérifier la fonction `haversine_distance()` dans `delivery_service.rs` (calcul distances GPS)
- [ ] Vérifier les services de livraison existants : `delivery_service.rs`, `delivery_repository.rs`
- [ ] Vérifier les services de notifications existants : `notification_service.rs`, `delivery_notification_service.rs`
- [ ] Vérifier les modèles de livraison : `delivery_models.rs`

---

## 💬 SUPPORT

En cas de doute sur une implémentation, se référer dans cet ordre :

1. **Documentation du plan** : `PLAN_COMPLET_AMELIORATIONS_LIVRAISON.md` (section correspondante)
2. **Documents d'architecture** : `ARCHITECTURE_GESTION_FINANCIERE_LIVRAISON.md`, `ARCHITECTURE_VIDEO_PREUVE_LIVRAISON.md`
3. **Recherche dans le codebase** : Utiliser `codebase_search` et `grep` pour trouver code similaire existant
4. **Exemples de code** : Voir les exemples dans les documents d'architecture
5. **Patterns existants** : Inspirer du code existant dans le repo (services, composants, routes similaires)

**Workflow recommandé pour chaque amélioration** :
```
1. Lire la section correspondante dans PLAN_COMPLET_AMELIORATIONS_LIVRAISON.md
2. Rechercher dans le codebase si quelque chose existe déjà (codebase_search + grep)
3. Vérifier les documents d'architecture pour détails techniques
4. Étudier le code existant similaire pour patterns
5. Implémenter en réutilisant l'existant au maximum
6. Vérifier avant commit : pas de doublons, migrations OK, tests OK
```

---

## 🎯 RÉCAPITULATIF : Tous les Éléments Nécessaires pour la Mise en Œuvre

Le prompt contient toutes les informations nécessaires :

✅ **33 améliorations détaillées** avec références aux sections du plan
✅ **Contraintes critiques** : Migrations SQLx, composant recharge, vérification existant
✅ **Règles de développement** : Backend Rust, Frontend React, Mobile React Native, Base de données
✅ **Points critiques** : 8 points essentiels à retenir
✅ **Validation avant commit** : Checklist complète
✅ **Documentation de référence** : Tous les documents nécessaires listés
✅ **Checklist de démarrage** : Phase 0 (vérification existant), Phase 1 (config), Phase 2 (composants)
✅ **Support et workflow** : Guide étape par étape

**Tous les éléments sont présents pour une implémentation réussie ! 🚀**

