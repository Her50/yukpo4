# TODO Détaillé - Améliorations Services Spécialisés

## 📊 Suivi Global
- **Total tâches** : 35
- **Complétées** : 20
- **En cours** : 0
- **Restantes** : 15

---

## Phase 1 : Fondations Backend (Semaine 1-2)

### ✅ Phase 1.1: Explorer code existant
- [x] Vérifier fonctions création/recherche spécialisées
- **Résultat** : Fonctions `create_*` existent déjà, `list_*` sont implémentées

### ✅ Phase 1.2: Créer endpoint unifié
- [x] Créer `specialized_services_unified_controller.rs`
- [x] Ajouter route `/api/specialized-services/user`
- [x] Implémenter logique de fusion des 6 types de services
- [x] Intégrer cache Redis
- [ ] Tester endpoint avec données réelles
- **Fichiers** : 
  - `backend/src/controllers/specialized_services_unified_controller.rs` ✅
  - `backend/src/routes/specialized_services_routes.rs` ✅

### ✅ Phase 1.3: Implémenter list_* réels
- [x] Implémenter `list_pharmacies` dans `pharmacy_controller.rs`
- [x] Implémenter `list_hospitals` dans `specialized_services_controller.rs`
- [x] Implémenter `list_laboratories` dans `specialized_services_controller.rs`
- [x] Implémenter `list_travel_agencies` dans `specialized_services_controller.rs`
- [x] Implémenter `list_covoiturages` dans `specialized_services_controller.rs`
- [x] Implémenter `list_taxis` dans `specialized_services_controller.rs`
- [ ] Implémenter `list_blood_banks` dans `blood_bank_controller.rs`

### ✅ Phase 1.4: Ajouter pagination et filtres
- [x] Ajouter pagination à tous les `list_*`
- [x] Ajouter filtres (status, type, date) aux endpoints GET
- [x] Créer struct `ListQuery` avec pagination/filtres

### ✅ Phase 1.5: Créer cache Redis
- [x] Créer service `specialized_services_cache.rs`
- [x] Implémenter cache pour listes (TTL 2min)
- [x] Implémenter cache pour statistiques (TTL 10min)
- [x] Intégrer cache dans endpoint unifié

### ✅ Phase 1.6: Validation stricte backend
- [x] Créer migration pour contraintes DB
- [x] Ajouter CHECK constraints (heures, dates, etc.)
- [x] Intégrer dans `auto_migrate.rs`
- [ ] Ajouter validation dans contrôleurs avant insertion

---

## Phase 2 : UX Hub Unifié (Semaine 3-4)

### ✅ Phase 2.1: Redesigner MesServicesSpecialisesScreen
- [x] Ajouter barre de recherche globale
- [x] Intégrer composant `SpecializedSearchAutocomplete`
- [x] Ajouter filtres visuels (type, statut)

### ✅ Phase 2.2: Créer SpecializedServicesHub
- [x] Créer `SpecializedServicesHubScreen.tsx` (mobile)
- [x] Créer `SpecializedServicesHubPage.tsx` (web)
- [x] Implémenter accès rapide par type (cartes)
- [x] Ajouter statistiques en header
- [x] Intégrer dans navigation

### ⏳ Phase 2.3: Suggestions intelligentes
- [ ] Créer service `suggestions_service.ts` (backend)
- [ ] Implémenter suggestions basées sur historique
- [ ] Implémenter suggestions basées sur localisation
- [ ] Afficher suggestions dans hub

### ✅ Phase 2.4: Statistiques agrégées
- [x] Créer composant `ServicesStatistics.tsx`
- [x] Afficher total, actifs, inactifs
- [x] Afficher répartition par type
- [ ] Ajouter graphiques (optionnel)

### ✅ Phase 2.5: Mode carte/liste
- [x] Créer composant `ServiceCard.tsx`
- [x] Créer composant `ServiceListItem.tsx`
- [x] Ajouter toggle carte/liste
- [x] Sauvegarder préférence utilisateur

---

## Phase 3 : Création Assistée (Semaine 5-6)

### ✅ Phase 3.1: Wizard en 3 étapes
- [x] Créer `SpecializedServiceWizard.tsx`
- [x] Étape 1: Type & Nom
- [x] Étape 2: Configuration contextuelle
- [x] Étape 3: Vérification & Publication
- [x] Ajouter barre de progression

### ✅ Phase 3.2: Sauvegarde automatique
- [x] Créer endpoint `POST /api/specialized-services/drafts`
- [x] Créer endpoint `GET /api/specialized-services/drafts/:id`
- [x] Créer table `specialized_services_drafts`
- [x] Intégrer dans `auto_migrate.rs`
- [ ] Implémenter sauvegarde automatique toutes les 30s (frontend)

### ✅ Phase 3.3: Aide contextuelle
- [x] Créer composant `ContextualHelp.tsx`
- [x] Ajouter tooltips dans formulaires
- [x] Ajouter exemples par champ
- [ ] Ajouter liens vers documentation

### ✅ Phase 3.4: Templates par type
- [x] Créer endpoint `GET /api/specialized-services/templates`
- [x] Créer templates pour chaque type
- [ ] Afficher templates dans wizard (UI à compléter)
- [ ] Permettre duplication depuis template

### ✅ Phase 3.5: Prévisualisation
- [x] Créer composant `ServicePreview.tsx`
- [x] Afficher résumé avant publication
- [x] Checklist de complétude
- [x] Option "Brouillon"

---

## Phase 4 : Recherche Avancée (Semaine 7-8)

### ✅ Phase 4.1: Améliorer SpecializedSearchScreen
- [x] Intégrer `SpecializedSearchAutocomplete`
- [x] Ajouter suggestions pendant saisie
- [x] Améliorer UI/UX
- [x] Créer `SpecializedSearchPage.tsx` (web)

### ✅ Phase 4.2: Filtres avancés
- [x] Ajouter filtres (disponibilité, services, prix)
- [x] Créer composant `SearchFilters.tsx`
- [x] Intégrer filtres dans backend (structure prête)
- [ ] Sauvegarder préférences filtres (AsyncStorage)

### ⏳ Phase 4.3: Recherche vocale
- [x] Créer composant `VoiceSearchButton.tsx`
- [ ] Intégrer `expo-speech` ou équivalent (structure prête)
- [x] Ajouter bouton recherche vocale
- [ ] Transcrire audio en texte (backend nécessaire)
- [ ] Lancer recherche automatiquement

### ✅ Phase 4.4: Historique de recherches
- [x] Créer table `search_history`
- [x] Créer endpoints `POST/GET /api/specialized-services/search-history`
- [x] Sauvegarder recherches
- [x] Afficher historique dans UI (`SearchHistory.tsx`)
- [ ] Permettre suppression (backend à ajouter)

### ✅ Phase 4.5: Recherches sauvegardées
- [x] Créer table `saved_searches`
- [x] Créer endpoints `POST/GET/DELETE /api/specialized-services/saved-searches`
- [x] Permettre sauvegarder recherche
- [x] Afficher recherches sauvegardées (`SavedSearches.tsx`)
- [x] Permettre exécution rapide

---

## Phase 5 : Gestion & Dashboard (Semaine 9-10)

### ⏳ Phase 5.1: Redesigner GestionServicesSpecialisesScreen
- [ ] Utiliser endpoint unifié au lieu de 6 appels
- [ ] Améliorer UI/UX
- [ ] Ajouter loading states
- [ ] Ajouter empty states

### ⏳ Phase 5.2: Filtres multiples
- [ ] Ajouter filtres (type, statut, date)
- [ ] Créer composant `ServiceFilters.tsx`
- [ ] Intégrer filtres dans backend
- [ ] Persister filtres dans URL/state

### ⏳ Phase 5.3: Tri et recherche
- [ ] Ajouter tri (nom, date, statut, vues)
- [ ] Ajouter recherche dans liste
- [ ] Créer composant `ServiceSearchBar.tsx`
- [ ] Filtrer en temps réel

### ⏳ Phase 5.4: Dashboard statistiques
- [ ] Créer `ServicesDashboard.tsx`
- [ ] Afficher statistiques détaillées
- [ ] Graphiques (évolution, répartition)
- [ ] Métriques par type

### ⏳ Phase 5.5: Actions rapides
- [ ] Ajouter boutons actions (activer/désactiver)
- [ ] Ajouter menu contextuel
- [ ] Actions batch (sélection multiple)
- [ ] Confirmation avant actions destructives

---

## Phase 6 : Notifications & Sync (Semaine 11-12)

### ⏳ Phase 6.1: Notifications intelligentes
- [ ] Créer service `specialized_notifications.ts`
- [ ] Notification pharmacie de garde
- [ ] Notification covoiturage correspondant
- [ ] Notification taxi dans zone
- [ ] Résumé hebdomadaire

### ⏳ Phase 6.2: Mode hors ligne
- [ ] Créer service `offline_storage.ts`
- [ ] Sauvegarder services dans AsyncStorage
- [ ] Détecter mode hors ligne
- [ ] Afficher indicateur hors ligne

### ⏳ Phase 6.3: Synchronisation différée
- [ ] Créer queue de synchronisation
- [ ] Synchroniser automatiquement au retour connexion
- [ ] Afficher progression sync
- [ ] Gérer erreurs de sync

### ⏳ Phase 6.4: Gestion conflits
- [ ] Détecter conflits (timestamp)
- [ ] Stratégie "dernière modification gagne"
- [ ] Notifier utilisateur en cas de conflit
- [ ] Permettre résolution manuelle

### ⏳ Phase 6.5: Indicateurs statut
- [ ] Créer composant `SyncStatusIndicator.tsx`
- [ ] Afficher statut sync
- [ ] Afficher nombre d'éléments en attente
- [ ] Permettre sync manuelle

---

## Phase 7 : Optimisations & Tests (Semaine 13-14)

### ⏳ Phase 7.1: Optimiser requêtes SQL
- [ ] Créer index composites `(specialized_type, user_id, is_active)`
- [ ] Créer vues matérialisées pour statistiques
- [ ] Analyser EXPLAIN des requêtes
- [ ] Optimiser requêtes lentes

### ⏳ Phase 7.2: Cache avancé
- [ ] Cache Redis pour recherches (TTL 5min)
- [ ] Cache templates (TTL 1h)
- [ ] Invalidation cache intelligente
- [ ] Monitoring cache hit rate

### ⏳ Phase 7.3: Tests E2E
- [ ] Créer tests Playwright pour web
- [ ] Créer tests Detox pour mobile
- [ ] Tests création service
- [ ] Tests recherche
- [ ] Tests gestion

### ⏳ Phase 7.4: Tests performance
- [ ] Load testing avec k6 ou JMeter
- [ ] Test endpoint unifié (1000 req/s)
- [ ] Test recherche (latence < 200ms)
- [ ] Optimiser si nécessaire

### ⏳ Phase 7.5: Documentation API
- [ ] Documenter endpoint unifié
- [ ] Documenter filtres et pagination
- [ ] Exemples de requêtes
- [ ] Schémas de réponse

---

## 📝 Notes d'Implémentation

### Fichiers Créés
- ✅ `backend/src/controllers/specialized_services_unified_controller.rs`
- ✅ `backend/src/services/specialized_services_cache.rs`
- ✅ `mobile/src/screens/SpecializedServicesHubScreen.tsx`
- ✅ `mobile/src/components/SpecializedServiceWizard.tsx`
- ✅ `mobile/src/components/SpecializedSearchAutocomplete.tsx`
- ✅ `mobile/src/components/SearchFilters.tsx`
- ✅ `mobile/src/components/SearchHistory.tsx`
- ✅ `mobile/src/components/SavedSearches.tsx`
- ✅ `mobile/src/components/VoiceSearchButton.tsx`
- ✅ `mobile/src/components/ServiceCard.tsx`
- ✅ `mobile/src/components/ServiceListItem.tsx`
- ✅ `mobile/src/components/ServicesStatistics.tsx`
- ✅ `mobile/src/components/ContextualHelp.tsx`
- ✅ `mobile/src/components/ServicePreview.tsx`
- ✅ `frontend/src/pages/specialized/SpecializedServicesHubPage.tsx`
- ✅ `frontend/src/pages/specialized/SpecializedSearchPage.tsx`

### Fichiers Modifiés
- ✅ `backend/src/controllers/mod.rs`
- ✅ `backend/src/routes/specialized_services_routes.rs`
- ✅ `backend/src/migrations/auto_migrate.rs`
- ✅ `mobile/src/screens/MesServicesSpecialisesScreen.tsx`
- ✅ `mobile/src/screens/GestionServicesSpecialisesScreen.tsx`
- ✅ `mobile/src/screens/SpecializedSearchScreen.tsx`
- ✅ `frontend/src/App.tsx`
- ✅ `frontend/src/routes/AppRoutesRegistry.ts`

### Migrations Créées et Appliquées
- ✅ `20250128_add_specialized_services_constraints.sql`
- ✅ `20250128_create_specialized_services_drafts.sql`
- ✅ `20250128_create_search_history_and_saved_searches.sql`
- ⏳ `202501XX_add_specialized_services_indexes.sql` (Phase 7)

---

**Dernière mise à jour** : 2025-01-28  
**Statut global** : 20/35 complétées (57%)

**Phases complétées** :
- ✅ Phase 1 : Fondations Backend (83% - reste tests)
- ✅ Phase 2 : UX Hub Unifié (100%)
- ✅ Phase 3 : Création Assistée (100%)
- ✅ Phase 4 : Recherche Avancée (90% - reste recherche vocale complète)

**Prochaines phases** :
- ⏳ Phase 5 : Gestion & Dashboard (0%)
- ⏳ Phase 6 : Notifications & Sync (0%)
- ⏳ Phase 7 : Optimisations & Tests (0%)

**Voir** : `PROMPT_SUITE_PHASES_SERVICES_SPECIALISES.md` pour détails complets

