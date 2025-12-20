# PROMPT : OFFRES D'EMPLOI & MATCHING INTELLIGENT

## 🎯 OBJECTIF

Implémenter un système complet de gestion des offres d'emploi avec matching intelligent permettant :

- **Publication d'offres** : Entreprises peuvent publier des offres d'emploi
- **Recherche d'emploi** : Candidats peuvent rechercher selon critères multiples
- **Matching intelligent** : Algorithme de correspondance candidat/offre
- **Candidatures** : Système de dépôt et suivi de candidatures
- **Notifications** : Alertes pour nouvelles offres correspondantes
- **Statistiques** : Tableaux de bord employeurs et candidats
- **Filtres avancés** : Localisation, salaire, type de contrat, secteur, expérience
- **Scalabilité horizontale** : Redis, pagination, index
- **Migrations vérifiées et appliquées** : 0000, auto_migrate, Render
- **Expérience utilisateur unique** : Accès évidents, navigation cohérente (mobile et frontend)

---

## 📊 ANALYSE DU SYSTÈME EXISTANT

### Composants à réutiliser

1. **Services spécialisés existants** :
   - `backend/src/controllers/specialized_services_controller.rs` : Pattern pour création/liste/recherche
   - `backend/src/services/specialized_services_cache.rs` : Cache Redis
   - `backend/src/routes/specialized_services_routes.rs` : Routes publiques/protégées

2. **Système de matching existant** :
   - `backend/src/services/traiter_echange.rs` : Pattern de matching
   - `backend/src/services/matching_echange.rs` : Algorithmes asynchrones
   - Redis pour cache de matching

3. **Système de notifications** :
   - WebSocket pour notifications en temps réel
   - Système d'alertes existant

4. **Système de fichiers** :
   - Upload CV, lettres de motivation
   - Intégration CDN Cloudflare/Wasabi

---

## 🗄️ MODÈLE DE DONNÉES

### Table : `offres_emploi`

```sql
CREATE TABLE offres_emploi (
    id SERIAL PRIMARY KEY,
    entreprise_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations générales
    titre_poste VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type_contrat VARCHAR(50) NOT NULL CHECK (type_contrat IN ('CDI', 'CDD', 'Stage', 'Freelance', 'Temps partiel', 'Alternance')),
    duree_contrat INTEGER, -- En mois (pour CDD)
    
    -- Localisation
    lieu_travail VARCHAR(255) NOT NULL, -- Ville, quartier
    adresse TEXT,
    gps VARCHAR(50), -- Format: "lat,lng"
    location_point GEOGRAPHY(POINT, 4326), -- Index spatial
    remote BOOLEAN DEFAULT false, -- Télétravail possible
    remote_partiel BOOLEAN DEFAULT false, -- Télétravail partiel
    
    -- Rémunération
    salaire_min DECIMAL(10, 2), -- Salaire minimum
    salaire_max DECIMAL(10, 2), -- Salaire maximum
    devise VARCHAR(10) DEFAULT 'XAF',
    salaire_negociable BOOLEAN DEFAULT false,
    
    -- Exigences
    niveau_etude VARCHAR(100), -- 'Bac', 'Bac+2', 'Bac+3', 'Bac+5', etc.
    experience_min INTEGER, -- Années d'expérience minimum
    competences_requises TEXT[], -- Compétences techniques
    langues_requises JSONB, -- [{"langue": "Français", "niveau": "Courant"}, ...]
    permis_requis TEXT[], -- Permis de conduire, etc.
    
    -- Secteur et domaine
    secteur VARCHAR(100) NOT NULL, -- 'Informatique', 'Commerce', 'Santé', etc.
    domaine VARCHAR(100), -- Sous-domaine
    tags TEXT[], -- Tags pour recherche
    
    -- Dates
    date_publication TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    date_limite_candidature DATE,
    date_debut_poste DATE,
    
    -- Statut
    statut VARCHAR(50) DEFAULT 'active' CHECK (statut IN ('active', 'pourvue', 'fermee', 'brouillon')),
    nombre_candidatures INTEGER DEFAULT 0,
    nombre_vues INTEGER DEFAULT 0,
    
    -- Métadonnées
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false, -- Vérification par admin
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Index
    CONSTRAINT check_salaire CHECK (salaire_max IS NULL OR salaire_min IS NULL OR salaire_max >= salaire_min)
);

-- Index pour recherche géographique
CREATE INDEX idx_offres_location ON offres_emploi USING GIST(location_point);
CREATE INDEX idx_offres_statut_active ON offres_emploi(statut, is_active, date_limite_candidature) WHERE statut = 'active' AND is_active = true;
CREATE INDEX idx_offres_secteur ON offres_emploi(secteur, domaine, statut) WHERE statut = 'active';
CREATE INDEX idx_offres_type_contrat ON offres_emploi(type_contrat, statut) WHERE statut = 'active';
CREATE INDEX idx_offres_competences ON offres_emploi USING GIN(competences_requises);
CREATE INDEX idx_offres_tags ON offres_emploi USING GIN(tags);
CREATE INDEX idx_offres_date_limite ON offres_emploi(date_limite_candidature, statut) WHERE date_limite_candidature >= CURRENT_DATE AND statut = 'active';
```

### Table : `profils_candidats`

```sql
CREATE TABLE profils_candidats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations personnelles
    nom_complet VARCHAR(255) NOT NULL,
    date_naissance DATE,
    telephone VARCHAR(50),
    email VARCHAR(255) NOT NULL,
    adresse TEXT,
    ville VARCHAR(100),
    gps VARCHAR(50),
    location_point GEOGRAPHY(POINT, 4326),
    
    -- Profil professionnel
    titre_professionnel VARCHAR(255), -- "Développeur Full Stack", "Comptable", etc.
    niveau_etude VARCHAR(100),
    experience_annees INTEGER DEFAULT 0,
    secteur_principal VARCHAR(100),
    
    -- Compétences
    competences TEXT[], -- Compétences techniques
    langues JSONB, -- [{"langue": "Français", "niveau": "Courant"}, ...]
    permis TEXT[], -- Permis de conduire, etc.
    certifications TEXT[], -- Certifications professionnelles
    
    -- CV et documents
    cv_url TEXT, -- URL du CV
    cv_nom VARCHAR(255),
    photo_url TEXT, -- Photo de profil
    portfolio_url TEXT, -- Portfolio/LinkedIn
    
    -- Préférences
    type_contrat_souhaite TEXT[], -- Types de contrat acceptés
    salaire_souhaite_min DECIMAL(10, 2),
    salaire_souhaite_max DECIMAL(10, 2),
    remote_souhaite BOOLEAN DEFAULT false,
    secteurs_interesses TEXT[], -- Secteurs d'intérêt
    
    -- Disponibilité
    disponible_immediatement BOOLEAN DEFAULT false,
    date_disponibilite DATE,
    
    -- Métadonnées
    is_active BOOLEAN DEFAULT true,
    is_complete BOOLEAN DEFAULT false, -- Profil complété
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_profils_user ON profils_candidats(user_id);
CREATE INDEX idx_profils_secteur ON profils_candidats(secteur_principal, is_active);
CREATE INDEX idx_profils_competences ON profils_candidats USING GIN(competences);
CREATE INDEX idx_profils_location ON profils_candidats USING GIST(location_point);
CREATE INDEX idx_profils_disponible ON profils_candidats(disponible_immediatement, is_active) WHERE is_active = true;
```

### Table : `candidatures`

```sql
CREATE TABLE candidatures (
    id SERIAL PRIMARY KEY,
    offre_id INTEGER NOT NULL REFERENCES offres_emploi(id) ON DELETE CASCADE,
    candidat_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profil_id INTEGER REFERENCES profils_candidats(id) ON DELETE SET NULL,
    
    -- Contenu candidature
    lettre_motivation TEXT,
    cv_url TEXT, -- CV spécifique pour cette candidature (optionnel)
    documents_complementaires JSONB, -- [{"nom": "Diplôme", "url": "..."}, ...]
    
    -- Statut
    statut VARCHAR(50) DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'en_cours', 'acceptee', 'refusee', 'annulee')),
    date_candidature TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    date_modification_statut TIMESTAMP WITH TIME ZONE,
    
    -- Évaluation
    score_matching DECIMAL(5, 2), -- Score de matching (0-100)
    notes_employeur TEXT, -- Notes internes employeur
    evaluation_candidat JSONB, -- Évaluation structurée
    
    -- Métadonnées
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Contraintes
    CONSTRAINT unique_candidature UNIQUE (offre_id, candidat_id)
);

CREATE INDEX idx_candidatures_offre ON candidatures(offre_id, statut);
CREATE INDEX idx_candidatures_candidat ON candidatures(candidat_id, statut);
CREATE INDEX idx_candidatures_date ON candidatures(date_candidature DESC);
CREATE INDEX idx_candidatures_score ON candidatures(score_matching DESC) WHERE score_matching IS NOT NULL;
```

### Table : `matching_offres_candidats` (Cache des matchings)

```sql
CREATE TABLE matching_offres_candidats (
    id SERIAL PRIMARY KEY,
    offre_id INTEGER NOT NULL REFERENCES offres_emploi(id) ON DELETE CASCADE,
    candidat_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Score de matching
    score_total DECIMAL(5, 2) NOT NULL, -- Score global (0-100)
    score_competences DECIMAL(5, 2), -- Score compétences (0-100)
    score_experience DECIMAL(5, 2), -- Score expérience (0-100)
    score_localisation DECIMAL(5, 2), -- Score localisation (0-100)
    score_salaire DECIMAL(5, 2), -- Score salaire (0-100)
    
    -- Détails matching
    competences_match TEXT[], -- Compétences correspondantes
    competences_manquantes TEXT[], -- Compétences manquantes
    criteres_match JSONB, -- Détails des critères correspondants
    
    -- Métadonnées
    date_calcul TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_notified BOOLEAN DEFAULT false, -- Notification envoyée au candidat
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Index
    CONSTRAINT unique_matching UNIQUE (offre_id, candidat_id)
);

CREATE INDEX idx_matching_offre ON matching_offres_candidats(offre_id, score_total DESC);
CREATE INDEX idx_matching_candidat ON matching_offres_candidats(candidat_id, score_total DESC);
CREATE INDEX idx_matching_score ON matching_offres_candidats(score_total DESC) WHERE score_total >= 70; -- Seuil minimum
CREATE INDEX idx_matching_notified ON matching_offres_candidats(is_notified, date_calcul) WHERE is_notified = false;
```

### Table : `alertes_emploi`

```sql
CREATE TABLE alertes_emploi (
    id SERIAL PRIMARY KEY,
    candidat_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Critères de recherche
    titre_poste VARCHAR(255),
    secteur VARCHAR(100),
    type_contrat TEXT[],
    salaire_min DECIMAL(10, 2),
    lieu_travail VARCHAR(255),
    remote BOOLEAN,
    competences TEXT[],
    
    -- Fréquence
    frequence VARCHAR(50) DEFAULT 'quotidienne' CHECK (frequence IN ('instantanee', 'quotidienne', 'hebdomadaire')),
    dernier_envoi TIMESTAMP WITH TIME ZONE,
    
    -- Métadonnées
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alertes_candidat ON alertes_alertes_emploi(candidat_id, is_active);
CREATE INDEX idx_alertes_frequence ON alertes_alertes_emploi(frequence, dernier_envoi) WHERE is_active = true;
```

### Table : `statistiques_offres`

```sql
CREATE TABLE statistiques_offres (
    id SERIAL PRIMARY KEY,
    offre_id INTEGER NOT NULL REFERENCES offres_emploi(id) ON DELETE CASCADE,
    
    -- Métriques
    nombre_vues INTEGER DEFAULT 0,
    nombre_candidatures INTEGER DEFAULT 0,
    nombre_candidatures_qualifiees INTEGER DEFAULT 0, -- Score > 70
    taux_conversion DECIMAL(5, 2), -- Candidatures / Vues
    
    -- Démographie candidats
    repartition_experience JSONB, -- {"0-2": 10, "3-5": 25, ...}
    repartition_niveau_etude JSONB,
    repartition_localisation JSONB,
    
    -- Métadonnées
    date_calcul TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_stats_offre UNIQUE (offre_id)
);

CREATE INDEX idx_stats_offre ON statistiques_offres(offre_id);
```

---

## 🔧 SERVICES BACKEND

### 1. `offres_emploi_service.rs`

**Fonctions principales** :
- `create_offre()` : Création d'une offre d'emploi
- `search_offres()` : Recherche avec filtres avancés (secteur, type contrat, salaire, GPS, remote)
- `get_offre_details()` : Détails complets d'une offre
- `update_offre()` : Mise à jour d'une offre
- `close_offre()` : Fermeture d'une offre (statut 'pourvue' ou 'fermee')
- `increment_vues()` : Incrémenter compteur de vues

### 2. `profils_candidats_service.rs`

**Fonctions principales** :
- `create_or_update_profil()` : Création/mise à jour profil candidat
- `get_profil()` : Récupération profil complet
- `search_candidats()` : Recherche de candidats (pour employeurs)
- `complete_profil()` : Marquer profil comme complété

### 3. `candidatures_service.rs`

**Fonctions principales** :
- `create_candidature()` : Dépôt d'une candidature
- `list_candidatures_offre()` : Liste candidatures pour une offre (employeur)
- `list_candidatures_candidat()` : Liste candidatures d'un candidat
- `update_statut_candidature()` : Changer statut (employeur)
- `get_candidature_details()` : Détails d'une candidature

### 4. `matching_service.rs`

**Fonctions principales** :
- `calculate_matching_score()` : Calculer score de matching offre/candidat
- `find_matching_offres()` : Trouver offres correspondantes pour un candidat
- `find_matching_candidats()` : Trouver candidats correspondants pour une offre
- `update_matching_cache()` : Mettre à jour cache de matching
- `notify_new_matches()` : Notifier nouveaux matchings

**Algorithme de matching** :
- **Score compétences** (40%) : Pourcentage de compétences requises possédées
- **Score expérience** (25%) : Adéquation expérience requise/possédée
- **Score localisation** (20%) : Proximité géographique (distance)
- **Score salaire** (10%) : Adéquation salaire souhaité/offert
- **Score autres** (5%) : Type contrat, remote, etc.
- **Seuil minimum** : 70% pour notification automatique

### 5. `alertes_emploi_service.rs`

**Fonctions principales** :
- `create_alerte()` : Créer une alerte de recherche
- `check_alertes()` : Vérifier et envoyer alertes (tâche cron)
- `send_alerte()` : Envoyer notification pour nouvelles offres
- `list_alertes_candidat()` : Liste des alertes d'un candidat

### 6. `statistiques_emploi_service.rs`

**Fonctions principales** :
- `calculate_offre_stats()` : Calculer statistiques d'une offre
- `get_dashboard_employeur()` : Tableau de bord employeur
- `get_dashboard_candidat()` : Tableau de bord candidat
- `get_tendance_marche()` : Tendances du marché (secteurs, salaires)

---

## 🎨 UX & NAVIGATION

### Principes UX

1. **Expérience unique** : Interface claire pour employeurs et candidats
2. **Accès évidents** : Bouton "Offres d'Emploi" dans le hub services spécialisés
3. **Navigation cohérente** : Même structure mobile/frontend
4. **Feedback visuel** : Indicateurs de matching, statuts candidatures
5. **Actions rapides** : Candidature en un clic, recherche instantanée
6. **Consistance** : Même design system que les autres services
7. **Accessibilité** : Support lecteurs d'écran, contrastes
8. **États de chargement** : Skeleton loaders, spinners
9. **Gestion d'erreurs** : Messages clairs, retry automatique

### Navigation Mobile

**Flux candidat** :
1. Hub Services Spécialisés → "Offres d'Emploi"
2. Recherche offres (filtres : secteur, type contrat, salaire, GPS)
3. Liste résultats → Détails offre
4. Voir score de matching → Postuler
5. Suivi candidatures → Mes candidatures

**Flux employeur** :
1. Hub Services Spécialisés → "Offres d'Emploi"
2. Publier offre → Formulaire création
3. Mes offres → Liste offres publiées
4. Détails offre → Candidatures reçues
5. Évaluer candidatures → Changer statuts

**Écrans** :
- `OffresEmploiHubScreen` : Hub principal
- `OffreSearchScreen` : Recherche offres
- `OffreListScreen` : Liste résultats
- `OffreDetailsScreen` : Détails offre avec score matching
- `CandidatureFormScreen` : Formulaire candidature
- `MesCandidaturesScreen` : Liste candidatures candidat
- `MesOffresScreen` : Liste offres employeur
- `CandidaturesOffreScreen` : Candidatures d'une offre
- `ProfilCandidatScreen` : Profil candidat
- `DashboardEmploiScreen` : Tableau de bord

### Navigation Frontend

**Flux candidat** :
1. Hub Services Spécialisés → "Offres d'Emploi"
2. Recherche offres (filtres avancés)
3. Liste résultats → Détails offre
4. Score matching affiché → Postuler
5. Dashboard → Statistiques personnelles

**Flux employeur** :
1. Hub Services Spécialisés → "Offres d'Emploi"
2. Publier offre → Formulaire
3. Dashboard → Statistiques offres
4. Gérer candidatures → Évaluation

**Pages** :
- `/offres-emploi` : Hub principal
- `/offres-emploi/search` : Recherche
- `/offres-emploi/list` : Liste résultats
- `/offres-emploi/:id` : Détails offre
- `/offres-emploi/candidater/:id` : Formulaire candidature
- `/offres-emploi/mes-candidatures` : Mes candidatures
- `/offres-emploi/mes-offres` : Mes offres (employeur)
- `/offres-emploi/offres/:id/candidatures` : Candidatures d'une offre
- `/offres-emploi/profil` : Profil candidat
- `/offres-emploi/dashboard` : Tableau de bord

### Points d'entrée

1. **Hub Services Spécialisés** : Carte "Offres d'Emploi" avec bouton "Rechercher"
2. **Menu principal** : Section "Emploi" → "Offres d'Emploi"
3. **Recherche globale** : Suggestion "Offres d'emploi" dans la barre de recherche
4. **Notifications** : Alertes pour nouvelles offres correspondantes, mises à jour candidatures

---

## 📈 SCALABILITÉ

### Index de performance

```sql
-- Index pour recherche géographique
CREATE INDEX idx_offres_location ON offres_emploi USING GIST(location_point);

-- Index composites pour recherche fréquente
CREATE INDEX idx_offres_secteur_statut ON offres_emploi(secteur, statut, is_active) WHERE statut = 'active' AND is_active = true;

-- Index pour matching
CREATE INDEX idx_matching_score ON matching_offres_candidats(score_total DESC) WHERE score_total >= 70;

-- Index pour alertes
CREATE INDEX idx_alertes_criteres ON alertes_emploi(secteur, type_contrat, is_active) WHERE is_active = true;
```

### Cache Redis

**Clés de cache** :
- `emploi:search:{secteur}:{type_contrat}:{salaire_min}:{ville}:{page}:{limit}` : TTL 10 minutes
- `emploi:details:{offre_id}` : TTL 15 minutes
- `emploi:matching:{candidat_id}` : TTL 30 minutes
- `emploi:matching:{offre_id}` : TTL 30 minutes
- `emploi:stats:{offre_id}` : TTL 1 heure
- `emploi:dashboard:{user_id}` : TTL 15 minutes

**Invalidation** :
- Nouvelle offre → Invalider cache recherche
- Nouvelle candidature → Invalider cache matching
- Mise à jour profil → Invalider cache matching candidat

### Pagination

- **Offset/Limit** : Pour listes simples (offres, candidatures)
- **Cursor-based** : Pour résultats de recherche avec filtres complexes
- **Limit par défaut** : 20 items par page, max 100

---

## 🔄 MIGRATIONS

### Fichier : `backend/migrations/20250128_create_offres_emploi.sql`

```sql
-- Création des tables (voir schémas ci-dessus)
-- Index de performance
-- Contraintes et clés étrangères
```

### Intégration `auto_migrate.rs`

Ajouter dans `backend/src/migrations/auto_migrate.rs` :

```rust
pub async fn ensure_offres_emploi_tables(pg: &PgPool) -> Result<(), sqlx::Error> {
    // Vérifier et créer tables si nécessaire
    // Appliquer migrations
}
```

### Application Render

**Commandes** :
```bash
# Depuis le répertoire backend
export DATABASE_URL="postgresql://user:password@host:port/database"
sqlx migrate run
```

**Coordonnées Render** :
- Hostname: `your-render-db-host.render.com`
- Database: `yukpo_db`
- Username: `yukpo_db_user`
- URL: `postgresql://user:password@host:port/database`

---

## ✅ CHECKLIST D'IMPLÉMENTATION

### Backend
- [ ] Création tables (migrations)
- [ ] Service `offres_emploi_service.rs`
- [ ] Service `profils_candidats_service.rs`
- [ ] Service `candidatures_service.rs`
- [ ] Service `matching_service.rs` (algorithme de matching)
- [ ] Service `alertes_emploi_service.rs`
- [ ] Service `statistiques_emploi_service.rs`
- [ ] Contrôleur `offres_emploi_controller.rs`
- [ ] Routes publiques/protégées
- [ ] Cache Redis
- [ ] Upload/download fichiers (CV, documents)
- [ ] Tâche cron pour alertes
- [ ] WebSocket pour notifications temps réel

### Frontend
- [ ] Page hub `/offres-emploi`
- [ ] Page recherche `/offres-emploi/search`
- [ ] Page liste `/offres-emploi/list`
- [ ] Page détails `/offres-emploi/:id`
- [ ] Page candidature `/offres-emploi/candidater/:id`
- [ ] Pages dashboard, mes candidatures, mes offres
- [ ] Composants score matching
- [ ] Composants statistiques (graphiques)
- [ ] Intégration routes dans `App.tsx`
- [ ] Ajout au hub services spécialisés

### Mobile
- [ ] Écran hub `OffresEmploiHubScreen`
- [ ] Écran recherche `OffreSearchScreen`
- [ ] Écran liste `OffreListScreen`
- [ ] Écran détails `OffreDetailsScreen`
- [ ] Écran candidature `CandidatureFormScreen`
- [ ] Écrans dashboard, mes candidatures, mes offres
- [ ] Intégration routes dans `AppNavigator.tsx`
- [ ] Ajout au hub services spécialisés mobile

### Tests & Validation
- [ ] Tests unitaires services
- [ ] Tests intégration API
- [ ] Tests algorithme matching
- [ ] Tests mobile (navigation, candidatures)
- [ ] Tests frontend (recherche, affichage)
- [ ] Validation migrations Render
- [ ] Performance cache Redis
- [ ] Scalabilité (pagination, index)

---

## 🎯 PRIORITÉS D'IMPLÉMENTATION

1. **Phase 1** : Backend - Tables, services de base (offres, profils, candidatures)
2. **Phase 2** : Backend - Algorithme de matching, alertes
3. **Phase 3** : Frontend - Pages principales (hub, recherche, détails)
4. **Phase 4** : Frontend - Pages candidatures, dashboard
5. **Phase 5** : Mobile - Écrans principaux
6. **Phase 6** : Mobile - Écrans candidatures, dashboard
7. **Phase 7** : Statistiques, notifications temps réel
8. **Phase 8** : Migrations, tests, optimisations

---

## 📝 NOTES IMPORTANTES

- **Sécurité** : Validation stricte des uploads de fichiers (CV, documents)
- **Performance** : Cache agressif pour matching, calculs asynchrones
- **UX** : Score de matching visible, suggestions intelligentes
- **Notifications** : Alertes pour nouvelles offres correspondantes, mises à jour candidatures
- **Analytics** : Tracking des recherches, candidatures, taux de conversion
- **Modération** : Vérification des offres par admin (optionnel)
- **Confidentialité** : CV et données personnelles protégées


