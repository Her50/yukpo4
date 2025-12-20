# 📚 PROMPT DE CONTINUATION - BOURSE DU LIVRE SCOLAIRE & TROC INTELLIGENT

**Date de création**: 2025-01-28  
**Contexte**: Implémentation complète d'un système de troc intelligent de livres scolaires avec matching multi-personnes, proximité géographique, et intégration des composants live/vidéo Yukpo

---

## 📚 DOCUMENTS DE RÉFÉRENCE OBLIGATOIRES

### Documents d'analyse existants (À LIRE EN PREMIER)
1. ✅ **`PROMPT_CONTINUATION_TAXI_COVOITURAGE_100_FINAL.md`**
   - Patterns de scalabilité horizontale utilisés
   - Structure migrations (0000, auto_migrate)
   - Patterns Redis, pagination, index

2. ✅ **`ANALYSE_HOPITAUX_LABORATOIRES_AMELIORATIONS.md`**
   - Analyse services spécialisés
   - Patterns backend/frontend/mobile

3. ✅ **`PROMPT_CONTINUATION_SERVICES_SPECIALISES.md`**
   - Architecture services spécialisés
   - Patterns existants

### Code existant à analyser (CRITIQUE)
4. ✅ **`backend/src/services/traiter_echange.rs`**
   - Système Tokio d'échange existant
   - Matching algorithmes
   - Cache Redis
   - Scoring avec pondération

5. ✅ **`backend/src/models/echange.rs`**
   - Modèle de données échange
   - Structure JSON offre/besoin

6. ✅ **`backend/src/controllers/echange_controller.rs`**
   - Endpoints existants
   - Routes API

7. ✅ **`backend/src/services/valider_echange.rs`**
   - Validation JSON échange
   - Contraintes métier

8. ✅ **`backend/src/tasks/matching_echange.rs`**
   - Tâches de matching asynchrone
   - Workers Tokio

9. ✅ **`backend/src/schemas/echange_schema.json`**
   - Schéma JSON validation

---

## 🎯 OBJECTIF

**Implémenter une bourse du livre scolaire avec troc intelligent** permettant :
- ✅ Troc de livres scolaires entre parents/élèves (classe A ↔ classe B)
- ✅ Matching intelligent basé sur disponibilités et besoins
- ✅ **Matching multi-personnes** (chaînes de troc) avec proximité géographique
- ✅ Intégration images/vidéos pour apprécier l'état des livres
- ✅ Composants live/vidéo Yukpo pour échanges en direct
- ✅ **Scalabilité horizontale** (Redis, pagination, index)
- ✅ **Migrations vérifiées et appliquées** (0000, auto_migrate, Render)
- ✅ **Expérience utilisateur unique** : Navigation cohérente, accès évidents, feedback immédiat (CRITIQUE)

---

## 📊 ÉTAT ACTUEL DU SYSTÈME D'ÉCHANGE

### ✅ Ce qui existe (Système Tokio d'échange)

#### Backend
- ✅ `traiter_echange.rs` - Service principal de traitement
  - Matching avec scoring pondéré (géolocalisation, offre, besoin, quantité, réputation, disponibilité, contraintes)
  - Cache Redis pour doublons (TTL 5 min)
  - Validation JSON stricte
  - Embeddings Pinecone pour similarité sémantique
  - Batch processing (50 échanges par batch)

- ✅ `echange_model.rs` - Modèle de données
  - Structure `offre` / `besoin` (JSON)
  - Champs: `quantite_offerte`, `quantite_requise`, `gps_fixe_lat/lon`, `don`, `disponibilite`, `contraintes`

- ✅ `valider_echange.rs` - Validation
  - Validation structure JSON
  - Contraintes métier

- ✅ `matching_echange.rs` - Tâche asynchrone
  - Matching en arrière-plan
  - Workers Tokio

- ✅ `echange_controller.rs` - Contrôleur
  - Endpoints API existants

#### Limitations actuelles
- ❌ Pas de spécialisation "livres scolaires"
- ❌ Pas de matching multi-personnes (chaînes)
- ❌ Pas d'intégration images/vidéos pour état des livres
- ❌ Pas de composants live/vidéo pour échanges
- ❌ Pas de table dédiée `livres_scolaires`
- ❌ Pas de gestion classes scolaires (A, B, C, etc.)
- ❌ Proximité géographique basique (pas optimisée pour troc)

---

## 🎯 FONCTIONNALITÉS À IMPLÉMENTER

### Phase 1: Backend - Modèle de données et migrations

#### 1.1 Table `livres_scolaires`
```sql
CREATE TABLE livres_scolaires (
    id SERIAL PRIMARY KEY,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations livre
    titre TEXT NOT NULL,
    auteur TEXT,
    editeur TEXT,
    isbn TEXT,
    classe_actuelle TEXT NOT NULL, -- Classe actuelle de l'élève (ex: "6ème", "5ème")
    classe_souhaitee TEXT NOT NULL, -- Classe souhaitée (ex: "5ème", "4ème")
    matiere TEXT NOT NULL, -- "Mathématiques", "Français", etc.
    niveau TEXT, -- "Primaire", "Collège", "Lycée"
    
    -- État et médias
    etat_livre TEXT NOT NULL, -- "Neuf", "Très bon", "Bon", "Acceptable"
    description_etat TEXT,
    images_urls TEXT[], -- URLs des images du livre
    video_url TEXT, -- URL vidéo d'appréciation de l'état
    
    -- Géolocalisation
    gps TEXT, -- Format: "lat,lng"
    ville TEXT,
    quartier TEXT,
    
    -- Disponibilité
    is_available BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    
    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 1.2 Table `troc_livres_scolaires`
```sql
CREATE TABLE troc_livres_scolaires (
    id SERIAL PRIMARY KEY,
    
    -- Participants
    initiateur_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    participant_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Livres échangés
    livre_offert_id INTEGER REFERENCES livres_scolaires(id) ON DELETE CASCADE,
    livre_souhaite_id INTEGER REFERENCES livres_scolaires(id) ON DELETE CASCADE,
    
    -- Type de troc
    type_troc TEXT NOT NULL, -- "direct" (2 personnes) ou "chaine" (3+ personnes)
    chaine_troc_id INTEGER, -- ID de la chaîne si type_troc = "chaine"
    
    -- Statut
    statut TEXT NOT NULL DEFAULT 'en_attente', -- "en_attente", "accepte", "refuse", "annule", "complete"
    
    -- Validation
    validation_initiateur BOOLEAN DEFAULT false,
    validation_participant BOOLEAN DEFAULT false,
    validation_video BOOLEAN DEFAULT false, -- Validation via vidéo live
    
    -- Proximité
    distance_km FLOAT,
    
    -- Dates
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    date_echange TIMESTAMPTZ, -- Date prévue pour l'échange physique
    date_complete TIMESTAMPTZ -- Date de finalisation
);
```

#### 1.3 Table `chaines_troc_livres`
```sql
CREATE TABLE chaines_troc_livres (
    id SERIAL PRIMARY KEY,
    
    -- Participants (ordre de la chaîne)
    participants JSONB NOT NULL, -- [{user_id, livre_offert_id, livre_souhaite_id, ordre}]
    
    -- Statut
    statut TEXT NOT NULL DEFAULT 'en_formation', -- "en_formation", "validee", "en_cours", "complete"
    
    -- Score de proximité global
    score_proximite FLOAT,
    distance_totale_km FLOAT,
    
    -- Dates
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    date_validation TIMESTAMPTZ,
    date_complete TIMESTAMPTZ
);
```

#### 1.4 Index de scalabilité
```sql
-- Index pour recherche par classe
CREATE INDEX idx_livres_classe_actuelle ON livres_scolaires(classe_actuelle, matiere)
    WHERE is_active = true AND is_available = true;

CREATE INDEX idx_livres_classe_souhaitee ON livres_scolaires(classe_souhaitee, matiere)
    WHERE is_active = true AND is_available = true;

-- Index pour matching bidirectionnel
CREATE INDEX idx_livres_matching ON livres_scolaires(classe_actuelle, classe_souhaitee, matiere)
    WHERE is_active = true AND is_available = true;

-- Index GPS pour proximité
CREATE INDEX idx_livres_gps ON livres_scolaires USING GIST(
    ST_MakePoint(
        CAST(SPLIT_PART(gps, ',', 1) AS FLOAT),
        CAST(SPLIT_PART(gps, ',', 2) AS FLOAT)
    )
) WHERE gps IS NOT NULL AND is_active = true;

-- Index pour recherche par ville/quartier
CREATE INDEX idx_livres_ville_quartier ON livres_scolaires(ville, quartier)
    WHERE is_active = true;

-- Index pour trocs
CREATE INDEX idx_troc_statut ON troc_livres_scolaires(statut, created_at DESC);
CREATE INDEX idx_troc_initiateur ON troc_livres_scolaires(initiateur_id, statut);
CREATE INDEX idx_troc_participant ON troc_livres_scolaires(participant_id, statut);
CREATE INDEX idx_troc_chaine ON troc_livres_scolaires(chaine_troc_id)
    WHERE chaine_troc_id IS NOT NULL;
```

### Phase 2: Backend - Services et contrôleurs

#### 2.1 Service `livres_scolaires_service.rs`
Fonctions à implémenter :
- `create_livre_scolaire()` - Création avec upload images/vidéo
- `search_livres_scolaires()` - Recherche avec filtres (classe, matière, proximité)
- `get_livre_details()` - Détails avec médias
- `update_livre_disponibilite()` - Mise à jour disponibilité
- `delete_livre_scolaire()` - Suppression

#### 2.2 Service `troc_intelligent_service.rs`
Fonctions à implémenter :
- `find_matching_direct()` - Matching 2 personnes (basé sur `traiter_echange.rs`)
- `find_matching_chaine()` - Matching multi-personnes (chaînes)
- `calculate_proximity_score()` - Score de proximité géographique
- `validate_chaine_troc()` - Validation chaîne complète
- `create_troc_direct()` - Création troc direct
- `create_troc_chaine()` - Création troc chaîne
- `accept_troc()` - Acceptation troc
- `refuse_troc()` - Refus troc
- `complete_troc()` - Finalisation échange

#### 2.3 Algorithme de matching chaîne
```
1. Trouver tous les livres disponibles pour classe_souhaitee = X
2. Pour chaque livre trouvé, chercher si son propriétaire a besoin de classe_souhaitee = Y
3. Construire graphe de dépendances
4. Trouver cycles (chaînes fermées) avec score de proximité optimal
5. Proposer chaîne avec distance totale minimale
```

#### 2.4 Contrôleur `livres_scolaires_controller.rs`
Endpoints :
- `POST /api/livres-scolaires` - Créer livre (protégé JWT)
- `GET /api/livres-scolaires/search` - Recherche publique (cache Redis)
- `GET /api/livres-scolaires/:id` - Détails (cache Redis)
- `PUT /api/livres-scolaires/:id` - Modifier (protégé JWT)
- `DELETE /api/livres-scolaires/:id` - Supprimer (protégé JWT)
- `POST /api/livres-scolaires/:id/upload-images` - Upload images (protégé JWT)
- `POST /api/livres-scolaires/:id/upload-video` - Upload vidéo (protégé JWT)

#### 2.5 Contrôleur `troc_livres_controller.rs`
Endpoints :
- `POST /api/troc-livres/match` - Trouver matchings (direct + chaînes)
- `POST /api/troc-livres/direct` - Créer troc direct (protégé JWT)
- `POST /api/troc-livres/chaine` - Créer troc chaîne (protégé JWT)
- `GET /api/troc-livres/my-trocs` - Mes trocs (protégé JWT)
- `POST /api/troc-livres/:id/accept` - Accepter troc (protégé JWT)
- `POST /api/troc-livres/:id/refuse` - Refuser troc (protégé JWT)
- `POST /api/troc-livres/:id/complete` - Finaliser échange (protégé JWT)
- `GET /api/troc-livres/:id` - Détails troc (protégé JWT)

### Phase 3: Backend - Intégration Live/Video Yukpo

#### 3.1 Service `troc_live_service.rs`
Fonctions :
- `initiate_live_validation()` - Démarrer session live pour validation
- `join_live_validation()` - Rejoindre session live
- `end_live_validation()` - Terminer session et valider/refuser

#### 3.2 Intégration WebRTC/LiveKit
- Utiliser `backend/src/utils/livekit.rs` existant
- Utiliser `backend/src/websocket/webrtc_signaling.rs` existant
- Créer endpoints WebSocket pour échanges live

### Phase 4: Mobile - Écrans et UX

#### 4.1 Écrans de base
- `LivreScolaireFormScreen.tsx` - Création/édition livre
- `LivreScolaireSearchScreen.tsx` - Recherche avec filtres
- `LivreScolaireListScreen.tsx` - Liste résultats
- `LivreScolaireDetailsScreen.tsx` - Détails avec images/vidéo
- `MesLivresScreen.tsx` - Mes livres publiés

#### 4.2 Écrans de troc
- `TrocMatchingScreen.tsx` - Résultats matching (direct + chaînes)
- `TrocDetailsScreen.tsx` - Détails troc proposé
- `MesTrocsScreen.tsx` - Mes trocs (en attente, acceptés, complétés)
- `TrocLiveValidationScreen.tsx` - Validation live via vidéo
- `ChaineTrocDetailsScreen.tsx` - Détails chaîne multi-personnes

#### 4.3 UX Mobile - Expérience utilisateur unique
**Principes à respecter** :
- ✅ **Accès évident** : Bouton "Bourse du livre" visible dans `SpecializedServicesHubScreen` avec icône distinctive (📚)
- ✅ **Navigation intuitive** : Flow clair Recherche → Liste → Détails → Troc
- ✅ **Feedback visuel** : Badges de statut (Disponible, En attente, Accepté, Complété)
- ✅ **Actions rapides** : Boutons d'action visibles (Accepter, Refuser, Voir détails)
- ✅ **Cohérence** : Suivre les patterns existants (Taxi, Hôpitaux) pour familiarité
- ✅ **Accessibilité** : Textes lisibles, contrastes suffisants, tailles de touch appropriées
- ✅ **États de chargement** : Spinners, skeletons, messages informatifs
- ✅ **Gestion d'erreurs** : Messages clairs, actions de récupération

**Navigation mobile** :
```
SpecializedServicesHubScreen
  └─> LivreScolaireSearchScreen (bouton "Rechercher un livre")
       └─> LivreScolaireListScreen
            └─> LivreScolaireDetailsScreen
                 ├─> TrocMatchingScreen (bouton "Trouver un troc")
                 │    └─> TrocDetailsScreen (direct ou chaîne)
                 │         ├─> TrocLiveValidationScreen (si validation live)
                 │         └─> ChaineTrocDetailsScreen (si chaîne)
                 └─> MesLivresScreen (bouton "Mes livres")
                      └─> LivreScolaireFormScreen (création/édition)
```

**Points d'entrée mobile** :
1. Hub Services Spécialisés → Carte "Bourse du livre" → Recherche
2. Hub Services Spécialisés → Carte "Bourse du livre" → "Mes livres"
3. Hub Services Spécialisés → Carte "Bourse du livre" → "Mes trocs"
4. Notification push → Troc proposé → TrocDetailsScreen
5. Notification push → Match trouvé → TrocMatchingScreen

### Phase 5: Frontend - Pages et UX

#### 5.1 Pages de base
- `LivreScolaireSearchPage.tsx`
- `LivreScolaireListPage.tsx`
- `LivreScolaireDetailsPage.tsx`
- `LivreScolaireFormPage.tsx`

#### 5.2 Pages de troc
- `TrocMatchingPage.tsx`
- `TrocDetailsPage.tsx`
- `MesTrocsPage.tsx`
- `TrocLiveValidationPage.tsx`
- `ChaineTrocDetailsPage.tsx`

#### 5.3 UX Frontend - Expérience utilisateur unique
**Principes à respecter** :
- ✅ **Accès évident** : Carte "Bourse du livre" dans `SpecializedServicesHubPage` avec design distinctif
- ✅ **Navigation cohérente** : Breadcrumbs, boutons retour, menu de navigation
- ✅ **Layout responsive** : Desktop (grid 3 colonnes), tablette (2 colonnes), mobile (1 colonne)
- ✅ **Feedback visuel** : Toasts pour actions (succès, erreur), badges de statut, animations subtiles
- ✅ **Actions claires** : Boutons primaires/secondaires bien différenciés, CTAs visibles
- ✅ **Cohérence** : Utiliser Shadcn UI components (Card, Button, Badge, Input) comme autres pages
- ✅ **Accessibilité** : ARIA labels, navigation clavier, focus visible
- ✅ **Performance** : Lazy loading images, pagination, virtual scrolling pour grandes listes

**Navigation frontend** :
```
SpecializedServicesHubPage (/specialized)
  └─> LivreScolaireSearchPage (/livres-scolaires/search)
       └─> LivreScolaireListPage (/livres-scolaires/list)
            └─> LivreScolaireDetailsPage (/livres-scolaires/:id)
                 ├─> TrocMatchingPage (/livres-scolaires/:id/match)
                 │    └─> TrocDetailsPage (/trocs/:id)
                 │         ├─> TrocLiveValidationPage (/trocs/:id/live)
                 │         └─> ChaineTrocDetailsPage (/chaines-troc/:id)
                 ├─> LivreScolaireFormPage (/livres-scolaires/new)
                 └─> MesLivresPage (/livres-scolaires/mes-livres)
                      └─> MesTrocsPage (/trocs/mes-trocs)
```

**Points d'entrée frontend** :
1. Hub Services Spécialisés → Carte "Bourse du livre" → Recherche
2. Hub Services Spécialisés → Carte "Bourse du livre" → "Publier un livre"
3. Hub Services Spécialisés → Carte "Bourse du livre" → "Mes livres"
4. Hub Services Spécialisés → Carte "Bourse du livre" → "Mes trocs"
5. Menu utilisateur → "Mes trocs" (si connecté)
6. Email/Notification → Lien direct vers TrocDetailsPage

### Phase 6: Scalabilité et migrations

#### 6.1 Migration SQL
Créer `backend/migrations/20250128_create_livres_scolaires_troc.sql` avec :
- Tables `livres_scolaires`, `troc_livres_scolaires`, `chaines_troc_livres`
- Tous les index de scalabilité
- Contraintes et foreign keys

#### 6.2 Fonction auto-migration
Ajouter dans `backend/src/migrations/auto_migrate.rs` :
```rust
pub async fn ensure_livres_scolaires_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables livres scolaires et troc...");
    let migration_sql = include_str!("../../migrations/20250128_create_livres_scolaires_troc.sql");
    execute_multiple_sql_commands(pool, migration_sql).await?;
    info!("✅ Tables livres scolaires et troc créées");
    Ok(())
}
```

Appel dans `run_auto_migrations()` :
```rust
match ensure_livres_scolaires_tables(pool).await {
    Ok(_) => info!("✅ Migration auto: livres scolaires tables OK"),
    Err(e) => error!("❌ Erreur migration auto livres scolaires: {}", e),
}
```

#### 6.3 Application migrations Render
**Coordonnées Render** (à utiliser pour application migrations) :
```
Hostname: your-render-db-host.render.com
Database: yukpo_db
Username: yukpo_db_user
URL: postgresql://user:password@host:port/database
```

**Commandes pour appliquer migrations** :
```bash
# Option 1: Via psql
psql "postgresql://user:password@host:port/database" -f backend/migrations/20250128_create_livres_scolaires_troc.sql

# Option 2: Via sqlx (si disponible)
sqlx migrate run --database-url "postgresql://user:password@host:port/database"
```

### Phase 7: Cache Redis et performance

#### 7.1 Cache Redis
- Cache recherche livres (TTL 10 min)
- Cache détails livre (TTL 15 min)
- Cache matchings (TTL 5 min)
- Invalidation cache lors création/modification/suppression

#### 7.2 Optimisations
- Pagination offset/limit et cursor-based
- Index GIN pour recherche texte (titre, auteur)
- Index composite pour matching classes
- Index spatial pour proximité GPS

---

## 🤔 RÉFLEXION CRITIQUE : TROC DIRECT VS CHAÎNE

### Troc direct (2 personnes)
**Avantages** :
- Simple et rapide
- Moins de coordination
- Moins de risques (moins de participants)

**Limitations** :
- Matching limité (besoin correspondance exacte)
- Peut manquer des opportunités de troc

### Troc chaîne (3+ personnes)
**Avantages** :
- Matching plus large (A→B→C→A)
- Plus d'opportunités de troc
- Optimisation globale

**Défis** :
- Coordination complexe
- Gestion proximité (distance totale)
- Validation de tous les participants
- Risque d'abandon en cours de chaîne

### Solution hybride proposée
1. **Priorité au troc direct** si matching parfait (même matière, classes compatibles, proximité < 5km)
2. **Proposer chaînes** si :
   - Pas de matching direct trouvé
   - Score de proximité chaîne < 1.5x distance directe moyenne
   - Tous participants dans rayon < 20km
3. **Validation progressive** : Chaque participant valide individuellement
4. **Fallback** : Si un participant refuse chaîne, proposer sous-chaînes

---

## 🎨 EXPÉRIENCE UTILISATEUR UNIQUE - EXIGENCES CRITIQUES

### Principes fondamentaux
1. **Accès évident** : La bourse du livre doit être immédiatement accessible depuis le Hub Services Spécialisés
2. **Navigation cohérente** : Flow identique entre mobile et frontend (même logique, même ordre)
3. **Feedback immédiat** : Chaque action doit avoir un retour visuel clair
4. **Simplicité** : Processus de troc compréhensible en 3 clics maximum
5. **Transparence** : Statut du troc toujours visible (en attente, accepté, complété)

### Cohérence Mobile ↔ Frontend
**Même structure de navigation** :
- Recherche → Liste → Détails → Troc
- Mêmes noms de routes (normalisés)
- Mêmes actions disponibles
- Mêmes statuts et badges

**Différences acceptables** :
- Mobile : Navigation stack (retour natif)
- Frontend : Breadcrumbs + menu latéral
- Mobile : Actions en bas d'écran
- Frontend : Actions en sidebar ou header

### Points d'entrée unifiés
**Mobile et Frontend doivent avoir** :
1. ✅ Carte "Bourse du livre" dans Hub Services Spécialisés
2. ✅ Bouton "Rechercher un livre" (recherche publique)
3. ✅ Bouton "Publier un livre" (création, protégé JWT)
4. ✅ Bouton "Mes livres" (liste personnelle, protégé JWT)
5. ✅ Bouton "Mes trocs" (gestion trocs, protégé JWT)
6. ✅ Notifications push/email → Lien direct vers troc

### Design System
**Couleurs** :
- Primaire : `#6366F1` (indigo) - Actions principales
- Succès : `#10B981` (vert) - Troc accepté/complété
- Avertissement : `#F59E0B` (orange) - Troc en attente
- Erreur : `#EF4444` (rouge) - Troc refusé/annulé
- Info : `#3B82F6` (bleu) - Informations

**Icônes** :
- 📚 Livre scolaire
- 🔄 Troc/Échange
- ✅ Accepté
- ❌ Refusé
- ⏳ En attente
- 📹 Live/Video
- 🔗 Chaîne

**Composants réutilisables** :
- Mobile : `NativeCard`, `NativeButton`, `SafeIcon` (comme Taxi/Hôpitaux)
- Frontend : Shadcn UI (`Card`, `Button`, `Badge`, `Input`, `Label`)

---

## 📋 CHECKLIST D'IMPLÉMENTATION

### Backend
- [ ] Migration SQL créée (`20250128_create_livres_scolaires_troc.sql`)
- [ ] Fonction auto-migration ajoutée dans `auto_migrate.rs`
- [ ] Service `livres_scolaires_service.rs` créé
- [ ] Service `troc_intelligent_service.rs` créé
- [ ] Service `troc_live_service.rs` créé
- [ ] Contrôleur `livres_scolaires_controller.rs` créé
- [ ] Contrôleur `troc_livres_controller.rs` créé
- [ ] Routes ajoutées dans `specialized_services_routes.rs`
- [ ] Cache Redis implémenté
- [ ] Tests unitaires

### Mobile - Écrans
- [ ] `LivreScolaireFormScreen.tsx`
- [ ] `LivreScolaireSearchScreen.tsx`
- [ ] `LivreScolaireListScreen.tsx`
- [ ] `LivreScolaireDetailsScreen.tsx`
- [ ] `MesLivresScreen.tsx`
- [ ] `TrocMatchingScreen.tsx`
- [ ] `TrocDetailsScreen.tsx`
- [ ] `MesTrocsScreen.tsx`
- [ ] `TrocLiveValidationScreen.tsx`
- [ ] `ChaineTrocDetailsScreen.tsx`

### Mobile - Navigation et UX
- [ ] Routes ajoutées dans `AppNavigator.tsx`
- [ ] Hub modifié (`SpecializedServicesHubScreen.tsx`) - Carte "Bourse du livre" avec boutons d'action
- [ ] Navigation cohérente (même flow que Taxi/Hôpitaux)
- [ ] Badges de statut visibles et clairs
- [ ] Actions rapides (Accepter, Refuser, Voir détails)
- [ ] Feedback visuel (spinners, messages, toasts)
- [ ] Gestion d'erreurs avec messages clairs

### Frontend - Pages
- [ ] `LivreScolaireSearchPage.tsx`
- [ ] `LivreScolaireListPage.tsx`
- [ ] `LivreScolaireDetailsPage.tsx`
- [ ] `LivreScolaireFormPage.tsx`
- [ ] `TrocMatchingPage.tsx`
- [ ] `TrocDetailsPage.tsx`
- [ ] `MesTrocsPage.tsx`
- [ ] `TrocLiveValidationPage.tsx`
- [ ] `ChaineTrocDetailsPage.tsx`

### Frontend - Navigation et UX
- [ ] Routes ajoutées dans `App.tsx`
- [ ] Hub modifié (`SpecializedServicesHubPage.tsx`) - Carte "Bourse du livre" avec boutons d'action
- [ ] Navigation cohérente (breadcrumbs, menu)
- [ ] Layout responsive (desktop/tablette/mobile)
- [ ] Badges de statut et feedback visuel
- [ ] Actions claires (boutons primaires/secondaires)
- [ ] Toasts pour notifications (react-hot-toast)
- [ ] Accessibilité (ARIA, navigation clavier)

### Migrations et déploiement
- [ ] Migration SQL testée localement
- [ ] Migration appliquée sur Render
- [ ] Vérification index créés
- [ ] Vérification contraintes
- [ ] Tests de performance

---

## 🎯 PRIORITÉS D'IMPLÉMENTATION

1. **Phase 1** : Backend - Modèle de données et migrations (CRITIQUE)
2. **Phase 2** : Backend - Services et contrôleurs (CRITIQUE)
3. **Phase 3** : Backend - Intégration Live/Video (IMPORTANT)
4. **Phase 4** : Mobile - Écrans de base + Navigation Hub (IMPORTANT)
5. **Phase 5** : Frontend - Pages de base + Navigation Hub (IMPORTANT)
6. **Phase 6** : Mobile/Frontend - Écrans de troc + UX cohérente (IMPORTANT)
7. **Phase 7** : Optimisations UX, tests, accessibilité (MOYEN)

**Note UX** : Les phases 4, 5 et 6 doivent être développées en parallèle pour garantir la cohérence navigation/UX entre mobile et frontend.

---

## 📝 NOTES IMPORTANTES

1. **Réutiliser le système Tokio existant** (`traiter_echange.rs`) comme base
2. **Proximité géographique** : Critère majeur pour matching
3. **Matching chaîne** : Algorithme complexe, bien tester
4. **Composants live/vidéo** : Réutiliser infrastructure Yukpo existante
5. **Scalabilité** : Prévoir charge importante (rentrée scolaire)
6. **Migrations Render** : Toujours tester localement avant application
7. **UX UNIQUE** : Expérience utilisateur cohérente entre mobile et frontend (CRITIQUE)
8. **Accès évidents** : Boutons d'action visibles dans Hub, navigation intuitive (CRITIQUE)
9. **Navigation cohérente** : Même flow, mêmes noms de routes, mêmes actions (CRITIQUE)

---

## 🚀 COMMANDES UTILES

```bash
# Backend
cargo check
cargo build
cargo test
cargo clippy
cargo fmt

# Migrations
sqlx migrate add create_livres_scolaires_troc
sqlx migrate run
sqlx migrate run --database-url "postgresql://user:password@host:port/database"

# Mobile
npm run dev
npm run build

# Frontend
npm run dev
npm run build
```

---

**Bonne implémentation ! 🎓📚**

