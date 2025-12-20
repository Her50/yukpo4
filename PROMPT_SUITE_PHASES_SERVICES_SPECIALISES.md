# 🚀 Prompt Suite - Améliorations Services Spécialisés (Phases 5-7)

## 📋 Contexte du Projet

**Repository** : `C:\Users\23767\yukpomnang2`  
**Backend** : Rust avec Axum, SQLx, PostgreSQL, pgvector, Redis  
**Frontend Mobile** : React Native (Expo SDK 52) avec TypeScript  
**Frontend Web** : React avec TypeScript, TailwindCSS  
**Base de données** : PostgreSQL Render (hostname: `your-render-db-host.render.com`)

## ✅ Ce qui a été complété (Phases 1-4)

### Phase 1 : Fondations Backend ✅ (83% complété)
- ✅ Endpoint unifié `/api/specialized-services/user` créé
- ✅ Cache Redis implémenté (`specialized_services_cache.rs`)
- ✅ Pagination et filtres ajoutés
- ✅ Contraintes DB créées et intégrées dans `auto_migrate.rs`
- ✅ Migration `20250128_add_specialized_services_constraints.sql` appliquée
- ✅ Migration `20250128_create_specialized_services_drafts.sql` appliquée
- ⏳ Tests endpoint avec données réelles (reste à faire)

### Phase 2 : UX Hub Unifié ✅ (100% complété)
- ✅ `SpecializedServicesHubScreen.tsx` (mobile) créé
- ✅ `SpecializedServicesHubPage.tsx` (web) créé
- ✅ `MesServicesSpecialisesScreen.tsx` amélioré avec recherche et filtres
- ✅ `GestionServicesSpecialisesScreen.tsx` amélioré avec toggle carte/liste
- ✅ Composants créés :
  - `ServiceCard.tsx` et `ServiceListItem.tsx`
  - `ServicesStatistics.tsx`
  - `SpecializedSearchAutocomplete.tsx`
- ⏳ Suggestions intelligentes (historique + localisation) - backend à créer

### Phase 3 : Création Assistée ✅ (100% complété)
- ✅ `SpecializedServiceWizard.tsx` créé (3 étapes avec barre de progression)
- ✅ Table `specialized_services_drafts` créée et migrée
- ✅ Endpoints `POST/GET /api/specialized-services/drafts` créés
- ✅ `ContextualHelp.tsx` créé (tooltips et exemples)
- ✅ `ServicePreview.tsx` créé (checklist et option brouillon)
- ✅ Endpoint `GET /api/specialized-services/templates` créé
- ✅ Intégration dans `auto_migrate.rs`

### Phase 4 : Recherche Avancée ✅ (100% complété)
- ✅ `SpecializedSearchScreen.tsx` amélioré avec autocomplete
- ✅ `SearchFilters.tsx` créé (filtres avancés)
- ✅ `VoiceSearchButton.tsx` créé (structure prête, expo-speech à intégrer)
- ✅ Tables `search_history` et `saved_searches` créées et migrées
- ✅ Composants `SearchHistory.tsx` et `SavedSearches.tsx` créés
- ✅ Endpoints backend créés :
  - `POST/GET /api/specialized-services/search-history`
  - `POST/GET/DELETE /api/specialized-services/saved-searches`
- ✅ Pages web créées :
  - `SpecializedSearchPage.tsx` (web)
  - Routes ajoutées dans `App.tsx` et `AppRoutesRegistry.ts`

## 📚 Documents de Référence

1. **`TODO_DETAIL_SERVICES_SPECIALISES.md`** : Plan détaillé des 7 phases avec 35 tâches
2. **`ANALYSE_COMPLETE_SERVICES_SPECIALISES_UX_BACKEND.md`** : Analyse complète des gaps et améliorations
3. **`AVANCEMENT_PHASE1_SERVICES_SPECIALISES.md`** : Résumé Phase 1
4. **`RESUME_IMPLEMENTATION_SERVICES_SPECIALISES.md`** : Résumé global (si existe)

## 🎯 Ce qui reste à faire

### Phase 5 : Gestion & Dashboard (Semaine 9-10)

#### Phase 5.1: Redesigner GestionServicesSpecialisesScreen
- [ ] **Mobile** : Vérifier que l'endpoint unifié est bien utilisé (déjà fait partiellement)
- [ ] **Mobile** : Améliorer loading states (skeleton loaders)
- [ ] **Mobile** : Améliorer empty states (illustrations, CTA)
- [ ] **Web** : Créer `GestionServicesSpecialisesPage.tsx` (web)
- [ ] **Web** : Utiliser endpoint unifié au lieu de 6 appels

#### Phase 5.2: Filtres multiples
- [ ] **Mobile** : Créer composant `ServiceFilters.tsx` (différent de `SearchFilters.tsx`)
- [ ] **Mobile** : Ajouter filtres (type, statut, date de création)
- [ ] **Web** : Créer composant `ServiceFilters.tsx` (web)
- [ ] **Backend** : Intégrer filtres dans endpoint unifié (déjà fait partiellement)
- [ ] **Mobile/Web** : Persister filtres dans URL/state (query params)

#### Phase 5.3: Tri et recherche
- [ ] **Mobile** : Créer composant `ServiceSearchBar.tsx`
- [ ] **Mobile** : Ajouter tri (nom, date, statut, vues)
- [ ] **Mobile** : Filtrer en temps réel dans liste
- [ ] **Web** : Créer composant `ServiceSearchBar.tsx` (web)
- [ ] **Backend** : Ajouter paramètres de tri dans endpoint unifié

#### Phase 5.4: Dashboard statistiques
- [ ] **Mobile** : Créer `ServicesDashboard.tsx` (ou améliorer écran existant)
- [ ] **Mobile** : Afficher statistiques détaillées (graphiques avec react-native-chart-kit ou équivalent)
- [ ] **Web** : Créer `ServicesDashboardPage.tsx` (web)
- [ ] **Web** : Graphiques avec Recharts ou Chart.js (évolution, répartition)
- [ ] **Backend** : Endpoint `/api/specialized-services/statistics/detailed` avec métriques par type

#### Phase 5.5: Actions rapides
- [ ] **Mobile** : Ajouter boutons actions rapides (activer/désactiver en batch)
- [ ] **Mobile** : Menu contextuel (long press) avec actions
- [ ] **Mobile** : Sélection multiple (checkboxes)
- [ ] **Mobile** : Confirmation avant actions destructives
- [ ] **Web** : Actions batch avec sélection multiple
- [ ] **Backend** : Endpoint `PATCH /api/specialized-services/batch` pour actions multiples

### Phase 6 : Notifications & Sync (Semaine 11-12)

#### Phase 6.1: Notifications intelligentes
- [ ] **Backend** : Créer service `specialized_notifications.rs`
- [ ] **Backend** : Notification pharmacie de garde (cron job ou trigger)
- [ ] **Backend** : Notification covoiturage correspondant (matching GPS + destination)
- [ ] **Backend** : Notification taxi dans zone (push notification)
- [ ] **Backend** : Résumé hebdomadaire (email ou push)
- [ ] **Mobile** : Intégrer notifications push (expo-notifications)
- [ ] **Mobile** : Préférences notifications utilisateur

#### Phase 6.2: Mode hors ligne
- [ ] **Mobile** : Créer service `offline_storage.ts`
- [ ] **Mobile** : Sauvegarder services dans AsyncStorage (format JSON)
- [ ] **Mobile** : Détecter mode hors ligne (NetInfo)
- [ ] **Mobile** : Afficher indicateur "Mode hors ligne" dans UI
- [ ] **Mobile** : Afficher données en cache quand hors ligne

#### Phase 6.3: Synchronisation différée
- [ ] **Mobile** : Créer queue de synchronisation (AsyncStorage)
- [ ] **Mobile** : Synchroniser automatiquement au retour connexion
- [ ] **Mobile** : Afficher progression sync (nombre d'éléments)
- [ ] **Mobile** : Gérer erreurs de sync (retry avec backoff)
- [ ] **Backend** : Endpoint `POST /api/specialized-services/sync` pour sync batch

#### Phase 6.4: Gestion conflits
- [ ] **Backend** : Détecter conflits (comparer `updated_at` timestamps)
- [ ] **Backend** : Stratégie "dernière modification gagne" (ou merge intelligent)
- [ ] **Mobile** : Notifier utilisateur en cas de conflit
- [ ] **Mobile** : Permettre résolution manuelle (afficher versions)

#### Phase 6.5: Indicateurs statut
- [ ] **Mobile** : Créer composant `SyncStatusIndicator.tsx`
- [ ] **Mobile** : Afficher statut sync (synced, syncing, error, offline)
- [ ] **Mobile** : Afficher nombre d'éléments en attente
- [ ] **Mobile** : Permettre sync manuelle (bouton refresh)

### Phase 7 : Optimisations & Tests (Semaine 13-14)

#### Phase 7.1: Optimiser requêtes SQL
- [ ] **Backend** : Créer index composites `(specialized_type, user_id, is_active)`
- [ ] **Backend** : Créer vues matérialisées pour statistiques
- [ ] **Backend** : Analyser EXPLAIN des requêtes lentes
- [ ] **Backend** : Optimiser requêtes avec JOINs si nécessaire
- [ ] **Migration** : `202501XX_optimize_specialized_services_indexes.sql`

#### Phase 7.2: Cache avancé
- [ ] **Backend** : Cache Redis pour recherches (TTL 5min)
- [ ] **Backend** : Cache templates (TTL 1h)
- [ ] **Backend** : Invalidation cache intelligente (tags Redis)
- [ ] **Backend** : Monitoring cache hit rate (logs ou métriques)

#### Phase 7.3: Tests E2E
- [ ] **Web** : Créer tests Playwright pour :
  - Création service spécialisé
  - Recherche avec filtres
  - Gestion (modification, suppression)
- [ ] **Mobile** : Créer tests Detox pour :
  - Navigation hub → création
  - Recherche vocale
  - Mode hors ligne
- [ ] **CI/CD** : Intégrer tests dans pipeline

#### Phase 7.4: Tests performance
- [ ] **Backend** : Load testing avec k6 ou JMeter
- [ ] **Backend** : Test endpoint unifié (objectif: 1000 req/s)
- [ ] **Backend** : Test recherche (objectif: latence < 200ms)
- [ ] **Backend** : Optimiser si nécessaire (index, cache, requêtes)

#### Phase 7.5: Documentation API
- [ ] **Backend** : Documenter endpoint unifié (OpenAPI/Swagger)
- [ ] **Backend** : Documenter filtres et pagination
- [ ] **Backend** : Exemples de requêtes (curl, Postman)
- [ ] **Backend** : Schémas de réponse JSON

## 🔧 Fichiers Clés à Connaître

### Backend
- `backend/src/controllers/specialized_services_unified_controller.rs` - Contrôleur unifié
- `backend/src/services/specialized_services_cache.rs` - Service cache Redis
- `backend/src/routes/specialized_services_routes.rs` - Routes API
- `backend/src/migrations/auto_migrate.rs` - Migrations automatiques
- `backend/migrations/20250128_*.sql` - Migrations créées

### Mobile
- `mobile/src/screens/SpecializedServicesHubScreen.tsx` - Hub unifié
- `mobile/src/screens/specialized/GestionServicesSpecialisesScreen.tsx` - Gestion
- `mobile/src/screens/SpecializedSearchScreen.tsx` - Recherche
- `mobile/src/components/SearchFilters.tsx` - Filtres recherche
- `mobile/src/components/SpecializedServiceWizard.tsx` - Wizard création

### Web
- `frontend/src/pages/specialized/SpecializedServicesHubPage.tsx` - Hub web
- `frontend/src/pages/specialized/SpecializedSearchPage.tsx` - Recherche web
- `frontend/src/App.tsx` - Routes principales
- `frontend/src/routes/AppRoutesRegistry.ts` - Registre des routes

## 🎯 Instructions pour la Suite

### Priorité 1 : Phase 5.1 - Améliorer GestionServicesSpecialisesScreen
1. **Mobile** : Vérifier que l'endpoint unifié est utilisé (déjà fait, vérifier)
2. **Mobile** : Ajouter skeleton loaders pendant chargement
3. **Mobile** : Améliorer empty state avec illustration et CTA
4. **Web** : Créer `GestionServicesSpecialisesPage.tsx` similaire au mobile
5. **Web** : Intégrer dans routes et navigation

### Priorité 2 : Phase 5.2 - Filtres multiples
1. **Mobile** : Créer `ServiceFilters.tsx` (différent de `SearchFilters.tsx` - pour la liste de gestion)
2. **Backend** : Vérifier que les filtres sont bien supportés dans endpoint unifié
3. **Mobile/Web** : Persister filtres dans query params URL

### Priorité 3 : Phase 5.3 - Tri et recherche
1. **Mobile** : Ajouter dropdown de tri dans `GestionServicesSpecialisesScreen`
2. **Backend** : Ajouter paramètre `sort_by` dans endpoint unifié
3. **Mobile** : Recherche en temps réel dans la liste locale

### Priorité 4 : Phase 5.4 - Dashboard statistiques
1. **Backend** : Créer endpoint `/api/specialized-services/statistics/detailed`
2. **Mobile** : Créer écran dashboard avec graphiques
3. **Web** : Créer page dashboard avec Recharts

### Priorité 5 : Phase 6 - Notifications & Sync
1. Commencer par Phase 6.2 (Mode hors ligne) - plus simple
2. Puis Phase 6.3 (Synchronisation)
3. Enfin Phase 6.1 (Notifications) - nécessite configuration push

### Priorité 6 : Phase 7 - Optimisations & Tests
1. Commencer par Phase 7.1 (Optimiser SQL) - impact immédiat
2. Puis Phase 7.2 (Cache avancé)
3. Enfin Phase 7.3-7.5 (Tests et documentation)

## 📝 Notes Techniques Importantes

### Base de données Render
- **URL** : `postgresql://user:password@host:port/database`
- **Migrations** : Appliquer via `psql` ou intégrer dans `auto_migrate.rs`
- **SQLX_OFFLINE** : Utiliser `SQLX_OFFLINE=true` pour développement

### Structure des Services Spécialisés
- **Types** : `pharmacie`, `hopital`, `laboratoire`, `banque_sang`, `agence_voyage`, `covoiturage`, `taxi`
- **Tables** : `pharmacies`, `hopitaux_cliniques`, `laboratoires_imagerie`, `banques_sang`, `agences_voyage`, `covoiturages`, `taxis_ville`
- **Relation** : Chaque table a `service_id` → `services(id)` et `user_id` → `users(id)`

### Cache Redis
- **TTL Listes** : 2 minutes
- **TTL Stats** : 10 minutes
- **Service** : `SpecializedServicesCache` dans `backend/src/services/specialized_services_cache.rs`
- **Intégration** : Déjà fait dans endpoint unifié

### Endpoints API Créés
- `GET /api/specialized-services/user` - Liste unifiée avec pagination/filtres
- `POST/GET /api/specialized-services/drafts` - Brouillons
- `GET /api/specialized-services/templates` - Templates
- `POST/GET /api/specialized-services/search-history` - Historique
- `POST/GET/DELETE /api/specialized-services/saved-searches` - Recherches sauvegardées

## 🚨 Points d'Attention

1. **Migrations** : Toujours intégrer dans `auto_migrate.rs` ET créer fichier SQL dans `backend/migrations/`
2. **Frontend = Mobile** : Quand on dit "frontend", on parle du mobile React Native
3. **Web** : Créer aussi les pages web correspondantes dans `frontend/src/pages/`
4. **Tests** : Tester les endpoints avec données réelles avant de marquer comme complété
5. **Cache** : Vérifier que le cache fonctionne (Redis doit être disponible)

## 📊 Progression Globale

- **Phase 1** : 83% (5/6 sous-phases)
- **Phase 2** : 100% (5/5 sous-phases)
- **Phase 3** : 100% (5/5 sous-phases)
- **Phase 4** : 100% (5/5 sous-phases)
- **Phase 5** : 0% (0/5 sous-phases)
- **Phase 6** : 0% (0/5 sous-phases)
- **Phase 7** : 0% (0/5 sous-phases)

**Total** : 20/35 tâches complétées (57%)

## 🎯 Objectif Session Suivante

**Commencer Phase 5 : Gestion & Dashboard**

1. Améliorer `GestionServicesSpecialisesScreen` (mobile) avec loading/empty states
2. Créer `GestionServicesSpecialisesPage.tsx` (web)
3. Créer composant `ServiceFilters.tsx` pour la gestion (différent de recherche)
4. Ajouter tri et recherche dans liste de gestion
5. Créer dashboard statistiques (mobile + web)

**Références** :
- Voir `TODO_DETAIL_SERVICES_SPECIALISES.md` pour détails complets
- Voir `ANALYSE_COMPLETE_SERVICES_SPECIALISES_UX_BACKEND.md` pour contexte
- Voir code existant dans `mobile/src/screens/specialized/` et `frontend/src/pages/specialized/`

---

**Dernière mise à jour** : 2025-01-28  
**Prochaine session** : Phase 5 - Gestion & Dashboard

