# 🏗️ Architecture : Tables Spécifiques pour Services Spécialisés

## 🎯 Objectif

Créer un système complet avec :
1. **Tables spécifiques** pour pharmacies, hôpitaux, laboratoires, agences de voyage
2. **Pages de saisie dédiées** pour chaque type
3. **Boutons d'accès rapide** dans HomeScreen/HomePage
4. **Redirection automatique** lors de la recherche
5. **Affichage spécialisé** dans ResultatBesoinScreen

---

## 📊 Tables Spécifiques à Créer

### 1. Table `pharmacies`

```sql
CREATE TABLE IF NOT EXISTS pharmacies (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations de base
    nom VARCHAR(255) NOT NULL,
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255), -- Format: "lat,lng"
    
    -- Planification
    jours_garde TEXT, -- "Lundi, Mercredi, Vendredi"
    heures_ouverture TIME,
    heures_fermeture TIME,
    permanent_24h BOOLEAN DEFAULT FALSE,
    
    -- Contact
    telephone VARCHAR(50),
    telephone_urgence VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    
    -- Services
    services TEXT[], -- ["Garde", "Délivrance", "Conseil", "Vaccination"]
    
    -- Statut
    is_active BOOLEAN DEFAULT TRUE,
    is_on_duty_now BOOLEAN DEFAULT FALSE, -- Calculé automatiquement
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(service_id)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_pharmacies_user_id ON pharmacies(user_id);
CREATE INDEX IF NOT EXISTS idx_pharmacies_service_id ON pharmacies(service_id);
CREATE INDEX IF NOT EXISTS idx_pharmacies_is_active ON pharmacies(is_active);
CREATE INDEX IF NOT EXISTS idx_pharmacies_is_on_duty ON pharmacies(is_on_duty_now) WHERE is_on_duty_now = TRUE;
CREATE INDEX IF NOT EXISTS idx_pharmacies_ville ON pharmacies(ville);
CREATE INDEX IF NOT EXISTS idx_pharmacies_quartier ON pharmacies(quartier);

-- Index GIN pour recherche textuelle
CREATE INDEX IF NOT EXISTS idx_pharmacies_services_gin ON pharmacies USING GIN(services);
```

---

### 2. Table `hopitaux_cliniques`

```sql
CREATE TABLE IF NOT EXISTS hopitaux_cliniques (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations de base
    nom VARCHAR(255) NOT NULL,
    type_etablissement VARCHAR(50) NOT NULL, -- "Hôpital", "Clinique", "Dispensaire"
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255),
    
    -- Services médicaux
    prestations_medicales TEXT[], -- ["Chirurgie", "Pédiatrie", "Urgences", "Maternité"]
    banque_sang BOOLEAN DEFAULT FALSE,
    urgences_disponible BOOLEAN DEFAULT FALSE,
    rdv_en_ligne BOOLEAN DEFAULT FALSE,
    
    -- Planification hebdomadaire (JSONB pour flexibilité)
    planning_hebdomadaire JSONB, -- {"lundi": {"debut": "08:00", "fin": "18:00", "permanent": false}, ...}
    
    -- Contact
    telephone VARCHAR(50),
    telephone_urgence VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    site_web VARCHAR(255),
    
    -- Statut
    is_active BOOLEAN DEFAULT TRUE,
    is_available_now BOOLEAN DEFAULT FALSE, -- Calculé automatiquement
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(service_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_hopitaux_user_id ON hopitaux_cliniques(user_id);
CREATE INDEX IF NOT EXISTS idx_hopitaux_service_id ON hopitaux_cliniques(service_id);
CREATE INDEX IF NOT EXISTS idx_hopitaux_type ON hopitaux_cliniques(type_etablissement);
CREATE INDEX IF NOT EXISTS idx_hopitaux_is_active ON hopitaux_cliniques(is_active);
CREATE INDEX IF NOT EXISTS idx_hopitaux_is_available ON hopitaux_cliniques(is_available_now) WHERE is_available_now = TRUE;
CREATE INDEX IF NOT EXISTS idx_hopitaux_prestations_gin ON hopitaux_cliniques USING GIN(prestations_medicales);
CREATE INDEX IF NOT EXISTS idx_hopitaux_planning_gin ON hopitaux_cliniques USING GIN(planning_hebdomadaire);
```

---

### 3. Table `laboratoires_imagerie`

```sql
CREATE TABLE IF NOT EXISTS laboratoires_imagerie (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations de base
    nom VARCHAR(255) NOT NULL,
    type_laboratoire VARCHAR(50) NOT NULL, -- "Laboratoire", "Centre d'imagerie", "Les deux"
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255),
    
    -- Services
    analyses_disponibles TEXT[], -- ["Sang", "Urine", "Bactériologie", "Parasitologie"]
    imagerie_disponible TEXT[], -- ["Radiologie", "Échographie", "Scanner", "IRM"]
    
    -- Planification
    planning_hebdomadaire JSONB,
    rdv_requis BOOLEAN DEFAULT TRUE,
    resultats_en_ligne BOOLEAN DEFAULT FALSE,
    
    -- Contact
    telephone VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    
    -- Statut
    is_active BOOLEAN DEFAULT TRUE,
    is_available_now BOOLEAN DEFAULT FALSE,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(service_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_laboratoires_user_id ON laboratoires_imagerie(user_id);
CREATE INDEX IF NOT EXISTS idx_laboratoires_service_id ON laboratoires_imagerie(service_id);
CREATE INDEX IF NOT EXISTS idx_laboratoires_type ON laboratoires_imagerie(type_laboratoire);
CREATE INDEX IF NOT EXISTS idx_laboratoires_analyses_gin ON laboratoires_imagerie USING GIN(analyses_disponibles);
CREATE INDEX IF NOT EXISTS idx_laboratoires_imagerie_gin ON laboratoires_imagerie USING GIN(imagerie_disponible);
```

---

### 4. Table `agences_voyage`

```sql
CREATE TABLE IF NOT EXISTS agences_voyage (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations de base
    nom_agence VARCHAR(255) NOT NULL,
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255),
    
    -- Services
    services_voyage TEXT[], -- ["Réservation bus", "Billets avion", "Voyages organisés"]
    compagnies_bus TEXT[], -- ["Amour Mezam", "Camair-Co", "Voyages Express"]
    destinations TEXT[], -- ["Douala", "Yaoundé", "Bafoussam", "Garoua"]
    
    -- Horaires
    heures_ouverture TIME,
    heures_fermeture TIME,
    jours_ouverture TEXT, -- "Lundi-Samedi"
    
    -- Contact
    telephone VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    site_web VARCHAR(255),
    
    -- Configuration bus (si applicable)
    peut_emettre_tickets_bus BOOLEAN DEFAULT FALSE,
    compagnies_affiliees TEXT[], -- Compagnies avec lesquelles l'agence travaille
    
    -- Statut
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(service_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_agences_user_id ON agences_voyage(user_id);
CREATE INDEX IF NOT EXISTS idx_agences_service_id ON agences_voyage(service_id);
CREATE INDEX IF NOT EXISTS idx_agences_tickets_bus ON agences_voyage(peut_emettre_tickets_bus) WHERE peut_emettre_tickets_bus = TRUE;
CREATE INDEX IF NOT EXISTS idx_agences_services_gin ON agences_voyage USING GIN(services_voyage);
CREATE INDEX IF NOT EXISTS idx_agences_compagnies_gin ON agences_voyage USING GIN(compagnies_bus);
CREATE INDEX IF NOT EXISTS idx_agences_destinations_gin ON agences_voyage USING GIN(destinations);
```

---

## 🔄 Fonctions PostgreSQL pour Calcul Automatique

### Fonction pour mettre à jour `is_on_duty_now` des pharmacies

```sql
CREATE OR REPLACE FUNCTION update_pharmacies_on_duty_status()
RETURNS void AS $$
BEGIN
    UPDATE pharmacies p
    SET 
        is_on_duty_now = is_pharmacy_on_duty(
            jsonb_build_object(
                'joursGarde', p.jours_garde,
                'heuresOuverture', p.heures_ouverture::TEXT,
                'heuresFermeture', p.heures_fermeture::TEXT
            ),
            NOW()
        ),
        updated_at = NOW()
    WHERE p.is_active = TRUE;
END;
$$ LANGUAGE plpgsql;
```

### Fonction pour mettre à jour `is_available_now` des hôpitaux

```sql
CREATE OR REPLACE FUNCTION update_hopitaux_availability_status()
RETURNS void AS $$
BEGIN
    UPDATE hopitaux_cliniques h
    SET 
        is_available_now = is_medical_service_available(
            jsonb_build_object(
                'planningHebdomadaire', h.planning_hebdomadaire,
                'prestationsMedicales', h.prestations_medicales
            ),
            NOW(),
            NULL
        ),
        updated_at = NOW()
    WHERE h.is_active = TRUE;
END;
$$ LANGUAGE plpgsql;
```

---

## 📱 Pages de Saisie à Créer

### 1. `PharmacieFormScreen.tsx` (Mobile)

**Route** : `/pharmacie/create` ou `PharmacieForm`

**Champs** :
- Nom de la pharmacie
- Adresse, Quartier, Ville
- GPS (automatique ou manuel)
- Jours de garde (multi-select)
- Heures d'ouverture/fermeture
- Téléphone, Téléphone urgence, WhatsApp
- Services (checkboxes)

**Action** : Crée un `service` + enregistre dans `pharmacies`

---

### 2. `HopitalCliniqueFormScreen.tsx` (Mobile)

**Route** : `/hopital/create` ou `HopitalForm`

**Champs** :
- Nom de l'établissement
- Type (Hôpital/Clinique/Dispensaire)
- Adresse, Quartier, Ville
- GPS
- Prestations médicales (multi-select)
- Banque de sang (checkbox)
- Planning hebdomadaire (par jour)
- Contact

**Action** : Crée un `service` + enregistre dans `hopitaux_cliniques`

---

### 3. `LaboratoireFormScreen.tsx` (Mobile)

**Route** : `/laboratoire/create` ou `LaboratoireForm`

**Champs** :
- Nom du laboratoire
- Type (Laboratoire/Imagerie/Les deux)
- Analyses disponibles
- Imagerie disponible
- Planning
- Contact

**Action** : Crée un `service` + enregistre dans `laboratoires_imagerie`

---

### 4. `AgenceVoyageFormScreen.tsx` (Mobile)

**Route** : `/agence-voyage/create` ou `AgenceVoyageForm`

**Champs** :
- Nom de l'agence
- Services (Réservation bus, Billets avion, etc.)
- Compagnies bus
- Destinations
- Horaires
- Peut émettre tickets bus (checkbox)
- Contact

**Action** : Crée un `service` + enregistre dans `agences_voyage`

---

## 🏠 Intégration dans HomeScreen/HomePage

### Boutons d'Accès Rapide

**Dans `HomeScreen.tsx` (Mobile)** :

```typescript
// Section "Services Spécialisés"
<View style={styles.specializedServices}>
  <Text style={styles.sectionTitle}>Services Spécialisés</Text>
  
  <View style={styles.serviceGrid}>
    <TouchableOpacity
      style={styles.serviceCard}
      onPress={() => navigation.navigate('PharmacieForm')}
    >
      <Text style={styles.serviceIcon}>💊</Text>
      <Text style={styles.serviceTitle}>Pharmacie</Text>
      <Text style={styles.serviceSubtitle}>Enregistrer une pharmacie</Text>
    </TouchableOpacity>
    
    <TouchableOpacity
      style={styles.serviceCard}
      onPress={() => navigation.navigate('HopitalForm')}
    >
      <Text style={styles.serviceIcon}>🏥</Text>
      <Text style={styles.serviceTitle}>Hôpital/Clinique</Text>
      <Text style={styles.serviceSubtitle}>Enregistrer un établissement</Text>
    </TouchableOpacity>
    
    <TouchableOpacity
      style={styles.serviceCard}
      onPress={() => navigation.navigate('LaboratoireForm')}
    >
      <Text style={styles.serviceIcon}>🔬</Text>
      <Text style={styles.serviceTitle}>Laboratoire</Text>
      <Text style={styles.serviceSubtitle}>Enregistrer un laboratoire</Text>
    </TouchableOpacity>
    
    <TouchableOpacity
      style={styles.serviceCard}
      onPress={() => navigation.navigate('AgenceVoyageForm')}
    >
      <Text style={styles.serviceIcon}>🚌</Text>
      <Text style={styles.serviceTitle}>Agence Voyage</Text>
      <Text style={styles.serviceSubtitle}>Enregistrer une agence</Text>
    </TouchableOpacity>
  </View>
</View>
```

**Dans `HomePage.tsx` (Frontend)** : Même structure avec composants React

---

## 🔍 Redirection Automatique dans la Recherche

### Modification de `native_search_service.rs`

```rust
// Détecter le type de recherche
let search_type = detect_specialized_search_type(&query);

match search_type {
    SearchType::Pharmacie => {
        // Rediriger vers recherche dans table pharmacies
        search_pharmacies(&query, gps_zone).await
    }
    SearchType::Hopital => {
        // Rediriger vers recherche dans table hopitaux_cliniques
        search_hopitaux(&query, gps_zone).await
    }
    SearchType::Laboratoire => {
        // Rediriger vers recherche dans table laboratoires_imagerie
        search_laboratoires(&query, gps_zone).await
    }
    SearchType::AgenceVoyage => {
        // Rediriger vers recherche dans table agences_voyage
        search_agences_voyage(&query, gps_zone).await
    }
    SearchType::General => {
        // Recherche normale dans services
        search_services_normal(&query, gps_zone).await
    }
}
```

### Fonction de Détection

```rust
fn detect_specialized_search_type(query: &str) -> SearchType {
    let query_lower = query.to_lowercase();
    
    // Détection pharmacie
    if query_lower.contains("pharmacie") || 
       query_lower.contains("médicament") ||
       query_lower.contains("garde") {
        return SearchType::Pharmacie;
    }
    
    // Détection hôpital
    if query_lower.contains("hôpital") ||
       query_lower.contains("clinique") ||
       query_lower.contains("médecin") ||
       query_lower.contains("docteur") ||
       query_lower.contains("urgences") {
        return SearchType::Hopital;
    }
    
    // Détection laboratoire
    if query_lower.contains("laboratoire") ||
       query_lower.contains("analyse") ||
       query_lower.contains("imagerie") ||
       query_lower.contains("radiologie") ||
       query_lower.contains("scanner") {
        return SearchType::Laboratoire;
    }
    
    // Détection agence voyage
    if query_lower.contains("agence") && query_lower.contains("voyage") ||
       query_lower.contains("billet") && query_lower.contains("bus") ||
       query_lower.contains("réservation") && query_lower.contains("bus") ||
       query_lower.contains("ticket") && query_lower.contains("voyage") {
        return SearchType::AgenceVoyage;
    }
    
    SearchType::General
}
```

---

## 📊 Affichage Spécialisé dans ResultatBesoinScreen

### Composants Spécialisés

**1. `PharmacieResultCard.tsx`** :

```typescript
interface PharmacieResultCardProps {
  pharmacie: {
    id: number;
    nom: string;
    adresse: string;
    quartier: string;
    ville: string;
    is_on_duty_now: boolean;
    jours_garde: string;
    heures_ouverture: string;
    heures_fermeture: string;
    telephone_urgence: string;
    services: string[];
    distance_km?: number;
  };
}

// Affiche :
// - Badge "DE GARDE" si is_on_duty_now = true
// - Jours de garde
// - Heures d'ouverture
// - Téléphone urgence en évidence
// - Services disponibles
// - Distance si GPS disponible
```

**2. `HopitalResultCard.tsx`** :

```typescript
interface HopitalResultCardProps {
  hopital: {
    id: number;
    nom: string;
    type_etablissement: string;
    prestations_medicales: string[];
    is_available_now: boolean;
    banque_sang: boolean;
    urgences_disponible: boolean;
    planning_hebdomadaire: JSONB;
    distance_km?: number;
  };
}

// Affiche :
// - Type d'établissement
// - Badge "DISPONIBLE" si is_available_now = true
// - Prestations médicales (chips)
// - Badge "Banque de sang" si applicable
// - Planning du jour actuel
```

**3. `LaboratoireResultCard.tsx`** :

```typescript
// Affiche :
// - Type de laboratoire
// - Analyses disponibles
// - Imagerie disponible
// - Si RDV requis
// - Résultats en ligne
```

**4. `AgenceVoyageResultCard.tsx`** :

```typescript
// Affiche :
// - Nom de l'agence
// - Services (Réservation bus, etc.)
// - Compagnies bus
// - Destinations
// - Badge "Émet tickets bus" si applicable
```

### Modification de `ResultatBesoinScreen.tsx`

```typescript
const ResultatBesoinScreen: React.FC = () => {
  const route = useRoute();
  const { results, searchType } = route.params;
  
  // Détecter le type de résultats
  const resultType = detectResultType(results);
  
  return (
    <ScrollView>
      {resultType === 'pharmacie' && (
        <View>
          {results.map(pharmacie => (
            <PharmacieResultCard key={pharmacie.id} pharmacie={pharmacie} />
          ))}
        </View>
      )}
      
      {resultType === 'hopital' && (
        <View>
          {results.map(hopital => (
            <HopitalResultCard key={hopital.id} hopital={hopital} />
          ))}
        </View>
      )}
      
      {resultType === 'laboratoire' && (
        <View>
          {results.map(lab => (
            <LaboratoireResultCard key={lab.id} laboratoire={lab} />
          ))}
        </View>
      )}
      
      {resultType === 'agence_voyage' && (
        <View>
          {results.map(agence => (
            <AgenceVoyageResultCard key={agence.id} agence={agence} />
          ))}
        </View>
      )}
      
      {/* Fallback : affichage générique */}
      {resultType === 'general' && (
        <GenericResultCard results={results} />
      )}
    </ScrollView>
  );
};
```

---

## 🔌 Routes API Backend

### 1. Routes Pharmacies

```rust
// backend/src/routes/pharmacy_routes.rs
pub fn pharmacy_routes() -> Router {
    Router::new()
        .route("/api/pharmacies", post(create_pharmacy))
        .route("/api/pharmacies/:id", get(get_pharmacy))
        .route("/api/pharmacies/:id", put(update_pharmacy))
        .route("/api/pharmacies/search", post(search_pharmacies))
        .route("/api/pharmacies/on-duty", get(get_pharmacies_on_duty))
}
```

### 2. Routes Hôpitaux

```rust
// backend/src/routes/hospital_routes.rs
pub fn hospital_routes() -> Router {
    Router::new()
        .route("/api/hopitaux", post(create_hospital))
        .route("/api/hopitaux/:id", get(get_hospital))
        .route("/api/hopitaux/search", post(search_hospitals))
        .route("/api/hopitaux/available", get(get_available_hospitals))
}
```

### 3. Routes Laboratoires

```rust
// backend/src/routes/laboratory_routes.rs
pub fn laboratory_routes() -> Router {
    Router::new()
        .route("/api/laboratoires", post(create_laboratory))
        .route("/api/laboratoires/search", post(search_laboratories))
}
```

### 4. Routes Agences Voyage

```rust
// backend/src/routes/travel_agency_routes.rs
pub fn travel_agency_routes() -> Router {
    Router::new()
        .route("/api/agences-voyage", post(create_travel_agency))
        .route("/api/agences-voyage/search", post(search_travel_agencies))
        .route("/api/agences-voyage/bus-tickets", get(get_bus_ticket_agencies))
}
```

---

## 🔄 Synchronisation avec `services`

### Trigger pour Synchronisation

Quand un service est créé avec `type = 'pharmacie'`, créer automatiquement une entrée dans `pharmacies` :

```sql
CREATE OR REPLACE FUNCTION sync_pharmacy_from_service()
RETURNS TRIGGER AS $$
BEGIN
    -- Si le service contient un produit de type pharmacie
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(NEW.data->'produits') AS product
        WHERE product->>'type' = 'pharmacie'
           OR product->>'categorie' = 'pharmacie'
    ) THEN
        -- Créer ou mettre à jour l'entrée dans pharmacies
        INSERT INTO pharmacies (
            service_id,
            user_id,
            nom,
            adresse,
            quartier,
            ville,
            gps,
            jours_garde,
            heures_ouverture,
            heures_fermeture,
            telephone,
            telephone_urgence,
            services
        )
        SELECT 
            NEW.id,
            NEW.user_id,
            NEW.data->'titre_service'->>'valeur',
            product->>'adresse',
            product->>'quartier',
            product->>'ville',
            NEW.gps,
            product->>'joursGarde',
            (product->>'heuresOuverture')::TIME,
            (product->>'heuresFermeture')::TIME,
            product->>'telephone',
            product->>'telephoneUrgence',
            string_to_array(product->>'services', '|')
        FROM jsonb_array_elements(NEW.data->'produits') AS product
        WHERE product->>'type' = 'pharmacie' OR product->>'categorie' = 'pharmacie'
        LIMIT 1
        ON CONFLICT (service_id) DO UPDATE SET
            nom = EXCLUDED.nom,
            adresse = EXCLUDED.adresse,
            -- ... autres champs
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_pharmacy_from_service
    AFTER INSERT OR UPDATE ON services
    FOR EACH ROW
    EXECUTE FUNCTION sync_pharmacy_from_service();
```

---

## 📋 Checklist d'Implémentation

### Phase 1 : Backend
- [ ] Créer migration pour tables spécifiques
- [ ] Créer fonctions de calcul automatique (is_on_duty_now, etc.)
- [ ] Créer contrôleurs pour chaque type
- [ ] Créer routes API
- [ ] Implémenter recherche spécialisée
- [ ] Créer triggers de synchronisation

### Phase 2 : Frontend Mobile
- [ ] Créer `PharmacieFormScreen.tsx`
- [ ] Créer `HopitalFormScreen.tsx`
- [ ] Créer `LaboratoireFormScreen.tsx`
- [ ] Créer `AgenceVoyageFormScreen.tsx`
- [ ] Ajouter boutons dans `HomeScreen.tsx`
- [ ] Créer composants de résultats spécialisés
- [ ] Modifier `ResultatBesoinScreen.tsx` pour affichage conditionnel

### Phase 3 : Frontend Web
- [ ] Créer pages de formulaire équivalentes
- [ ] Ajouter boutons dans `HomePage.tsx`
- [ ] Créer composants de résultats
- [ ] Modifier `ResultatBesoin.tsx`

### Phase 4 : Recherche Intelligente
- [ ] Modifier `native_search_service.rs` pour détection de type
- [ ] Implémenter redirection automatique
- [ ] Tester détection flexible multi-champs

---

## 🎯 Avantages de Cette Architecture

1. **Données Structurées** : Tables dédiées = requêtes optimisées
2. **Interface Spécialisée** : Formulaires adaptés à chaque type
3. **Recherche Ciblée** : Redirection automatique vers les bonnes tables
4. **Affichage Optimisé** : Cards spécialisées avec informations pertinentes
5. **Performance** : Index spécifiques pour chaque type de recherche
6. **Maintenabilité** : Code séparé par domaine métier

---

## 📝 Prochaines Étapes

1. **Créer les migrations SQL** pour les 4 tables
2. **Créer les contrôleurs Rust** pour chaque type
3. **Créer les pages de formulaire** mobile et web
4. **Intégrer dans HomeScreen/HomePage**
5. **Modifier la recherche** pour redirection automatique
6. **Créer les composants d'affichage** spécialisés

**Souhaitez-vous que je commence par créer les migrations SQL et les contrôleurs Rust ?** 🚀

