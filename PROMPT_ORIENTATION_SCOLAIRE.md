# PROMPT : ORIENTATION SCOLAIRE & INFORMATION ÉTABLISSEMENTS

## 🎯 OBJECTIF

Implémenter un système complet d'orientation scolaire et d'information sur les établissements scolaires (primaire, secondaire, supérieur) permettant :

- **Présentation des établissements** : Primaire, Secondaire, Supérieur (écoles de formation, universités)
- **Programmes scolaires** : Par classe, niveau, filière avec téléchargement
- **Fournitures scolaires** : Listes téléchargeables pour primaire et secondaire
- **Statistiques d'examens** : Agrégation et affichage par établissement
- **Système d'agrégation intelligent** : Suggestions d'établissements par domaine, région, ville
- **Concours d'entrée** : Programmation avec documentation
- **Expériences d'anciens étudiants** : Partage pour le supérieur
- **Lives et conférences** : Programmation d'événements en direct
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

2. **Système de live existant** :
   - `backend/src/services/livekit.rs` : Intégration LiveKit
   - `backend/src/services/webrtc_signaling.rs` : WebRTC
   - Composants frontend/mobile pour lives

3. **Système de fichiers** :
   - Upload/download de documents (programmes, fournitures, documentation concours)
   - Intégration CDN Cloudflare/Wasabi

4. **Système de matching intelligent** :
   - Pattern du système de troc pour suggestions d'établissements
   - Algorithmes de recommandation basés sur critères multiples

---

## 🗄️ MODÈLE DE DONNÉES

### Table : `etablissements_scolaires`

```sql
CREATE TABLE etablissements_scolaires (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations générales
    nom_etablissement VARCHAR(255) NOT NULL,
    type_etablissement VARCHAR(50) NOT NULL CHECK (type_etablissement IN ('primaire', 'secondaire', 'superieur')),
    sous_type VARCHAR(50), -- 'ecole_formation', 'universite', 'institut', etc. pour supérieur
    niveau_min INTEGER, -- Classe/niveau minimum
    niveau_max INTEGER, -- Classe/niveau maximum
    
    -- Localisation
    adresse TEXT,
    quartier VARCHAR(100),
    ville VARCHAR(100) NOT NULL,
    region VARCHAR(100),
    gps VARCHAR(50), -- Format: "lat,lng"
    location_point GEOGRAPHY(POINT, 4326), -- Index spatial
    
    -- Contact
    telephone VARCHAR(50),
    email VARCHAR(255),
    site_web VARCHAR(255),
    
    -- Informations académiques
    filieres TEXT[], -- Filières disponibles (pour secondaire/supérieur)
    specialites TEXT[], -- Spécialités (pour supérieur)
    langues_enseignement TEXT[], -- Langues d'enseignement
    
    -- Statistiques examens (JSON)
    statistiques_examens JSONB DEFAULT '{}'::jsonb, -- Agrégation: {"annee": {"taux_reussite": 85.5, "nb_candidats": 120, ...}}
    
    -- Métadonnées
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false, -- Vérification par admin
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Index
    CONSTRAINT unique_service_etablissement UNIQUE (service_id)
);

-- Index pour recherche géographique
CREATE INDEX idx_etablissements_location ON etablissements_scolaires USING GIST(location_point);
CREATE INDEX idx_etablissements_type_ville ON etablissements_scolaires(type_etablissement, ville);
CREATE INDEX idx_etablissements_filieres ON etablissements_scolaires USING GIN(filieres);
CREATE INDEX idx_etablissements_specialites ON etablissements_scolaires USING GIN(specialites);
CREATE INDEX idx_etablissements_active ON etablissements_scolaires(is_active, is_verified) WHERE is_active = true;
```

### Table : `programmes_scolaires`

```sql
CREATE TABLE programmes_scolaires (
    id SERIAL PRIMARY KEY,
    etablissement_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
    
    -- Identification du programme
    type_etablissement VARCHAR(50) NOT NULL, -- 'primaire', 'secondaire', 'superieur'
    niveau VARCHAR(50) NOT NULL, -- 'CP1', '6ème', 'L1', etc.
    classe VARCHAR(50), -- Pour primaire/secondaire
    filiere VARCHAR(100), -- Pour secondaire/supérieur
    specialite VARCHAR(100), -- Pour supérieur
    
    -- Contenu
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    annee_scolaire VARCHAR(20) NOT NULL, -- '2024-2025'
    
    -- Fichier
    fichier_url TEXT, -- URL du fichier PDF/document
    fichier_nom VARCHAR(255),
    fichier_taille INTEGER, -- Taille en bytes
    
    -- Métadonnées
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Index
    CONSTRAINT unique_etablissement_niveau_annee UNIQUE (etablissement_id, niveau, annee_scolaire, filiere)
);

CREATE INDEX idx_programmes_etablissement ON programmes_scolaires(etablissement_id, is_active);
CREATE INDEX idx_programmes_type_niveau ON programmes_scolaires(type_etablissement, niveau);
CREATE INDEX idx_programmes_annee ON programmes_scolaires(annee_scolaire);
```

### Table : `fournitures_scolaires`

```sql
CREATE TABLE fournitures_scolaires (
    id SERIAL PRIMARY KEY,
    etablissement_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
    
    -- Identification
    type_etablissement VARCHAR(50) NOT NULL CHECK (type_etablissement IN ('primaire', 'secondaire')),
    niveau VARCHAR(50) NOT NULL, -- 'CP1', '6ème', etc.
    classe VARCHAR(50),
    
    -- Contenu
    annee_scolaire VARCHAR(20) NOT NULL,
    liste_fournitures JSONB NOT NULL, -- [{"nom": "Cahier", "quantite": 5, "remarque": "21x29.7"}, ...]
    
    -- Fichier
    fichier_url TEXT, -- URL du fichier PDF
    fichier_nom VARCHAR(255),
    
    -- Métadonnées
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Index
    CONSTRAINT unique_etablissement_classe_annee UNIQUE (etablissement_id, niveau, annee_scolaire)
);

CREATE INDEX idx_fournitures_etablissement ON fournitures_scolaires(etablissement_id, is_active);
CREATE INDEX idx_fournitures_type_niveau ON fournitures_scolaires(type_etablissement, niveau);
```

### Table : `concours_entree`

```sql
CREATE TABLE concours_entree (
    id SERIAL PRIMARY KEY,
    etablissement_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
    
    -- Informations concours
    nom_concours VARCHAR(255) NOT NULL,
    description TEXT,
    filiere VARCHAR(100), -- Filière concernée
    specialite VARCHAR(100), -- Spécialité concernée
    
    -- Dates
    date_ouverture_inscription DATE NOT NULL,
    date_fermeture_inscription DATE NOT NULL,
    date_concours DATE NOT NULL,
    date_resultats DATE, -- Date prévisionnelle
    
    -- Documentation
    documentation_url TEXT, -- URL du fichier PDF
    documentation_nom VARCHAR(255),
    programme_concours TEXT, -- Contenu du programme
    
    -- Conditions
    conditions_admission TEXT,
    frais_inscription DECIMAL(10, 2),
    nombre_places INTEGER,
    
    -- Métadonnées
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_concours_etablissement ON concours_entree(etablissement_id, is_active);
CREATE INDEX idx_concours_dates ON concours_entree(date_concours, is_active) WHERE date_concours >= CURRENT_DATE;
CREATE INDEX idx_concours_filiere ON concours_entree(filiere, is_active);
```

### Table : `experiences_anciens_etudiants`

```sql
CREATE TABLE experiences_anciens_etudiants (
    id SERIAL PRIMARY KEY,
    etablissement_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations expérience
    filiere VARCHAR(100) NOT NULL,
    specialite VARCHAR(100),
    annee_entree INTEGER NOT NULL,
    annee_sortie INTEGER,
    niveau_obtenu VARCHAR(50), -- 'Licence', 'Master', etc.
    
    -- Contenu
    titre VARCHAR(255) NOT NULL,
    contenu TEXT NOT NULL,
    points_positifs TEXT[],
    points_negatifs TEXT[],
    note_generale INTEGER CHECK (note_generale >= 1 AND note_generale <= 5),
    
    -- Métadonnées
    is_verified BOOLEAN DEFAULT false, -- Vérification par admin
    is_approved BOOLEAN DEFAULT true, -- Approuvé pour publication
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_experiences_etablissement ON experiences_anciens_etudiants(etablissement_id, is_approved);
CREATE INDEX idx_experiences_filiere ON experiences_anciens_etudiants(filiere, is_approved);
CREATE INDEX idx_experiences_user ON experiences_anciens_etudiants(user_id);
```

### Table : `conferences_lives_scolaires`

```sql
CREATE TABLE conferences_lives_scolaires (
    id SERIAL PRIMARY KEY,
    etablissement_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations conférence
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    type_conference VARCHAR(50) NOT NULL CHECK (type_conference IN ('orientation', 'information', 'concours', 'temoignage')),
    
    -- Programmation
    date_programmee TIMESTAMP WITH TIME ZONE NOT NULL,
    duree_estimee INTEGER, -- En minutes
    is_live BOOLEAN DEFAULT true,
    
    -- LiveKit
    room_name VARCHAR(255),
    room_token TEXT,
    livekit_url TEXT,
    
    -- Participants
    nombre_participants INTEGER DEFAULT 0,
    nombre_max_participants INTEGER,
    
    -- Métadonnées
    is_active BOOLEAN DEFAULT true,
    is_annule BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conferences_etablissement ON conferences_lives_scolaires(etablissement_id, is_active);
CREATE INDEX idx_conferences_date ON conferences_lives_scolaires(date_programmee, is_active) WHERE date_programmee >= CURRENT_TIMESTAMP;
CREATE INDEX idx_conferences_type ON conferences_lives_scolaires(type_conference, is_active);
```

### Table : `suggestions_orientation` (Cache des suggestions)

```sql
CREATE TABLE suggestions_orientation (
    id SERIAL PRIMARY KEY,
    
    -- Critères de recherche
    type_etablissement VARCHAR(50) NOT NULL,
    domaine VARCHAR(100), -- Domaine d'étude
    filiere VARCHAR(100),
    ville VARCHAR(100),
    region VARCHAR(100),
    
    -- Résultats agrégés
    etablissements_suggerees INTEGER[], -- IDs des établissements
    scores JSONB, -- {"etablissement_id": score, ...}
    criteres_utilises JSONB, -- Critères utilisés pour le calcul
    
    -- Métadonnées
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL -- Expiration du cache
);

CREATE INDEX idx_suggestions_criteres ON suggestions_orientation(type_etablissement, domaine, filiere, ville, region);
CREATE INDEX idx_suggestions_expires ON suggestions_orientation(expires_at) WHERE expires_at >= CURRENT_TIMESTAMP;
```

---

## 🔧 SERVICES BACKEND

### 1. `orientation_scolaire_service.rs`

**Fonctions principales** :
- `create_etablissement()` : Création d'un établissement
- `search_etablissements()` : Recherche avec filtres (type, ville, région, filière, GPS)
- `get_etablissement_details()` : Détails complets d'un établissement
- `update_statistiques_examens()` : Mise à jour des statistiques d'examens
- `get_statistiques_agregees()` : Agrégation des statistiques (national, régional, ville)
- `suggest_etablissements()` : Suggestions intelligentes basées sur critères multiples

**Algorithme de suggestion** :
- Score basé sur : taux de réussite, proximité géographique, filières disponibles, statistiques historiques
- Pondération : 40% statistiques, 30% proximité, 20% filières, 10% autres critères
- Cache Redis pour résultats fréquents

### 2. `programmes_scolaires_service.rs`

**Fonctions principales** :
- `upload_programme()` : Upload de programme scolaire
- `get_programmes_by_etablissement()` : Liste des programmes d'un établissement
- `download_programme()` : Téléchargement avec tracking
- `search_programmes()` : Recherche de programmes (niveau, filière, année)

### 3. `fournitures_scolaires_service.rs`

**Fonctions principales** :
- `upload_fournitures()` : Upload de liste de fournitures
- `get_fournitures_by_etablissement()` : Liste des fournitures
- `download_fournitures()` : Téléchargement avec tracking
- `search_fournitures()` : Recherche par établissement/niveau

### 4. `concours_entree_service.rs`

**Fonctions principales** :
- `create_concours()` : Création d'un concours
- `list_concours_actifs()` : Liste des concours à venir
- `get_concours_details()` : Détails avec documentation
- `search_concours()` : Recherche par filière, date, établissement

### 5. `experiences_etudiants_service.rs`

**Fonctions principales** :
- `create_experience()` : Partage d'expérience
- `list_experiences_by_etablissement()` : Expériences d'un établissement
- `list_experiences_by_filiere()` : Expériences par filière
- `moderate_experience()` : Modération (admin)

### 6. `conferences_lives_service.rs`

**Fonctions principales** :
- `create_conference()` : Création avec LiveKit
- `list_conferences_programmees()` : Liste des conférences à venir
- `join_conference()` : Rejoindre une conférence live
- `get_conference_details()` : Détails avec room token

---

## 🎨 UX & NAVIGATION

### Principes UX

1. **Expérience unique** : Interface claire et intuitive pour parents, élèves, étudiants
2. **Accès évidents** : Bouton "Orientation Scolaire" dans le hub services spécialisés
3. **Navigation cohérente** : Même structure mobile/frontend
4. **Feedback visuel** : Indicateurs de chargement, confirmations
5. **Actions rapides** : Téléchargement en un clic, recherche instantanée
6. **Consistance** : Même design system que les autres services
7. **Accessibilité** : Support lecteurs d'écran, contrastes
8. **États de chargement** : Skeleton loaders, spinners
9. **Gestion d'erreurs** : Messages clairs, retry automatique

### Navigation Mobile

**Flux principal** :
1. Hub Services Spécialisés → "Orientation Scolaire"
2. Choix type : Primaire / Secondaire / Supérieur
3. Recherche établissements (filtres : ville, filière, GPS)
4. Liste résultats → Détails établissement
5. Actions : Voir programmes, Télécharger fournitures, Voir concours, Lire expériences

**Écrans** :
- `OrientationScolaireHubScreen` : Hub principal
- `EtablissementSearchScreen` : Recherche
- `EtablissementListScreen` : Liste résultats
- `EtablissementDetailsScreen` : Détails complets
- `ProgrammesScreen` : Liste programmes
- `FournituresScreen` : Liste fournitures
- `ConcoursListScreen` : Liste concours
- `ConcoursDetailsScreen` : Détails concours
- `ExperiencesScreen` : Expériences d'anciens
- `ConferencesListScreen` : Conférences programmées
- `ConferenceLiveScreen` : Participation live

### Navigation Frontend

**Flux principal** :
1. Hub Services Spécialisés → "Orientation Scolaire"
2. Choix type : Primaire / Secondaire / Supérieur
3. Recherche établissements (filtres avancés)
4. Liste résultats → Détails établissement
5. Actions : Télécharger programmes/fournitures, Voir statistiques, S'inscrire concours

**Pages** :
- `/orientation-scolaire` : Hub principal
- `/orientation-scolaire/search` : Recherche
- `/orientation-scolaire/list` : Liste résultats
- `/orientation-scolaire/:id` : Détails établissement
- `/orientation-scolaire/:id/programmes` : Programmes
- `/orientation-scolaire/:id/fournitures` : Fournitures
- `/orientation-scolaire/:id/concours` : Concours
- `/orientation-scolaire/:id/experiences` : Expériences
- `/orientation-scolaire/:id/conferences` : Conférences
- `/orientation-scolaire/concours/:id` : Détails concours
- `/orientation-scolaire/conferences/:id` : Détails conférence

### Points d'entrée

1. **Hub Services Spécialisés** : Carte "Orientation Scolaire" avec bouton "Rechercher"
2. **Menu principal** : Section "Éducation" → "Orientation Scolaire"
3. **Recherche globale** : Suggestion "Orientation scolaire" dans la barre de recherche
4. **Notifications** : Alertes pour nouveaux concours, conférences programmées

---

## 📈 SCALABILITÉ

### Index de performance

```sql
-- Index pour recherche géographique
CREATE INDEX idx_etablissements_location ON etablissements_scolaires USING GIST(location_point);

-- Index composites pour recherche fréquente
CREATE INDEX idx_etablissements_type_ville_active ON etablissements_scolaires(type_etablissement, ville, is_active) WHERE is_active = true AND is_verified = true;

-- Index pour agrégation statistiques
CREATE INDEX idx_etablissements_stats ON etablissements_scolaires USING GIN(statistiques_examens);

-- Index pour suggestions
CREATE INDEX idx_suggestions_domain_filiere ON suggestions_orientation(domaine, filiere, ville) WHERE expires_at >= CURRENT_TIMESTAMP;
```

### Cache Redis

**Clés de cache** :
- `orientation:search:{type}:{ville}:{filiere}:{page}:{limit}` : TTL 10 minutes
- `orientation:details:{etablissement_id}` : TTL 15 minutes
- `orientation:stats:{etablissement_id}` : TTL 30 minutes
- `orientation:suggestions:{type}:{domaine}:{filiere}:{ville}` : TTL 1 heure
- `orientation:concours:actifs` : TTL 5 minutes
- `orientation:conferences:programmees` : TTL 5 minutes

**Invalidation** :
- Création/modification établissement → Invalider cache recherche
- Mise à jour statistiques → Invalider cache stats
- Nouveau concours → Invalider cache concours actifs

### Pagination

- **Offset/Limit** : Pour listes simples (établissements, programmes)
- **Cursor-based** : Pour résultats de recherche avec filtres complexes
- **Limit par défaut** : 20 items par page, max 100

---

## 🔄 MIGRATIONS

### Fichier : `backend/migrations/20250128_create_orientation_scolaire.sql`

```sql
-- Création des tables (voir schémas ci-dessus)
-- Index de performance
-- Contraintes et clés étrangères
```

### Intégration `auto_migrate.rs`

Ajouter dans `backend/src/migrations/auto_migrate.rs` :

```rust
pub async fn ensure_orientation_scolaire_tables(pg: &PgPool) -> Result<(), sqlx::Error> {
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
- [ ] Service `orientation_scolaire_service.rs`
- [ ] Service `programmes_scolaires_service.rs`
- [ ] Service `fournitures_scolaires_service.rs`
- [ ] Service `concours_entree_service.rs`
- [ ] Service `experiences_etudiants_service.rs`
- [ ] Service `conferences_lives_service.rs`
- [ ] Contrôleur `orientation_scolaire_controller.rs`
- [ ] Routes publiques/protégées
- [ ] Cache Redis
- [ ] Intégration LiveKit pour conférences
- [ ] Upload/download fichiers (CDN)
- [ ] Algorithme de suggestions
- [ ] Agrégation statistiques

### Frontend
- [ ] Page hub `/orientation-scolaire`
- [ ] Page recherche `/orientation-scolaire/search`
- [ ] Page liste `/orientation-scolaire/list`
- [ ] Page détails `/orientation-scolaire/:id`
- [ ] Pages programmes, fournitures, concours, expériences, conférences
- [ ] Composants téléchargement
- [ ] Composants statistiques (graphiques)
- [ ] Intégration routes dans `App.tsx`
- [ ] Ajout au hub services spécialisés

### Mobile
- [ ] Écran hub `OrientationScolaireHubScreen`
- [ ] Écran recherche `EtablissementSearchScreen`
- [ ] Écran liste `EtablissementListScreen`
- [ ] Écran détails `EtablissementDetailsScreen`
- [ ] Écrans programmes, fournitures, concours, expériences, conférences
- [ ] Intégration routes dans `AppNavigator.tsx`
- [ ] Ajout au hub services spécialisés mobile

### Tests & Validation
- [ ] Tests unitaires services
- [ ] Tests intégration API
- [ ] Tests mobile (navigation, téléchargements)
- [ ] Tests frontend (recherche, affichage)
- [ ] Validation migrations Render
- [ ] Performance cache Redis
- [ ] Scalabilité (pagination, index)

---

## 🎯 PRIORITÉS D'IMPLÉMENTATION

1. **Phase 1** : Backend - Tables, services de base (établissements, programmes, fournitures)
2. **Phase 2** : Backend - Concours, expériences, conférences
3. **Phase 3** : Frontend - Pages principales (hub, recherche, détails)
4. **Phase 4** : Frontend - Pages secondaires (programmes, fournitures, etc.)
5. **Phase 5** : Mobile - Écrans principaux
6. **Phase 6** : Mobile - Écrans secondaires
7. **Phase 7** : Algorithme de suggestions et agrégation statistiques
8. **Phase 8** : Intégration LiveKit, migrations, tests

---

## 📝 NOTES IMPORTANTES

- **Sécurité** : Validation stricte des uploads de fichiers (types, tailles)
- **Performance** : Cache agressif pour statistiques agrégées
- **UX** : Téléchargements en arrière-plan, notifications de progression
- **Modération** : Système de modération pour expériences d'anciens étudiants
- **Notifications** : Alertes pour nouveaux concours, conférences programmées
- **Analytics** : Tracking des téléchargements, recherches, suggestions suivies

