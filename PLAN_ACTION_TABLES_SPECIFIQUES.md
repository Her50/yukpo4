# 📋 Plan d'Action : Tables Spécifiques pour Services Spécialisés

## 🎯 Objectif

Créer un système complet avec tables dédiées, pages de saisie, et redirection automatique pour :
- 💊 **Pharmacies**
- 🏥 **Hôpitaux/Cliniques**
- 🔬 **Laboratoires/Imagerie**
- 🚌 **Agences de Voyage**

---

## 📊 État Actuel

### ✅ Ce qui existe déjà

1. **Table `bus_reservations`** : ✅ Existe (20250125_create_bus_reservations.sql)
2. **Table `health_structures`** : ✅ Existe (20251025002_create_health_structures.sql) - mais seulement pour autocomplete
3. **Fonctions de planification** : ✅ `is_pharmacy_on_duty()`, `is_medical_service_available()`
4. **Composants bus** : ✅ `BusSeatSelector.tsx` existe

### ❌ Ce qui manque

1. **Tables dédiées** : ❌ Pas de tables `pharmacies`, `hopitaux_cliniques`, `laboratoires_imagerie`, `agences_voyage`
2. **Pages de saisie** : ❌ Pas de formulaires dédiés
3. **Boutons HomeScreen** : ❌ Pas d'accès rapide
4. **Redirection recherche** : ❌ Pas de détection automatique
5. **Affichage spécialisé** : ❌ Pas de cards spécialisées

---

## 🚀 Plan d'Implémentation

### Phase 1 : Backend - Tables et Migrations

#### 1.1 Créer Migration `20251126_create_specialized_services_tables.sql`

```sql
-- Tables pour services spécialisés
-- Date: 2025-11-26

-- 1. Table pharmacies
CREATE TABLE IF NOT EXISTS pharmacies (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255),
    jours_garde TEXT,
    heures_ouverture TIME,
    heures_fermeture TIME,
    permanent_24h BOOLEAN DEFAULT FALSE,
    telephone VARCHAR(50),
    telephone_urgence VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    services TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    is_on_duty_now BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(service_id)
);

-- 2. Table hopitaux_cliniques
CREATE TABLE IF NOT EXISTS hopitaux_cliniques (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    type_etablissement VARCHAR(50) NOT NULL,
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255),
    prestations_medicales TEXT[],
    banque_sang BOOLEAN DEFAULT FALSE,
    urgences_disponible BOOLEAN DEFAULT FALSE,
    rdv_en_ligne BOOLEAN DEFAULT FALSE,
    planning_hebdomadaire JSONB,
    telephone VARCHAR(50),
    telephone_urgence VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    site_web VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_available_now BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(service_id)
);

-- 3. Table laboratoires_imagerie
CREATE TABLE IF NOT EXISTS laboratoires_imagerie (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    type_laboratoire VARCHAR(50) NOT NULL,
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255),
    analyses_disponibles TEXT[],
    imagerie_disponible TEXT[],
    planning_hebdomadaire JSONB,
    rdv_requis BOOLEAN DEFAULT TRUE,
    resultats_en_ligne BOOLEAN DEFAULT FALSE,
    telephone VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_available_now BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(service_id)
);

-- 4. Table agences_voyage
CREATE TABLE IF NOT EXISTS agences_voyage (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom_agence VARCHAR(255) NOT NULL,
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255),
    services_voyage TEXT[],
    compagnies_bus TEXT[],
    destinations TEXT[],
    heures_ouverture TIME,
    heures_fermeture TIME,
    jours_ouverture TEXT,
    telephone VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    site_web VARCHAR(255),
    peut_emettre_tickets_bus BOOLEAN DEFAULT FALSE,
    compagnies_affiliees TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(service_id)
);

-- Index pour toutes les tables
-- (voir ARCHITECTURE_TABLES_SPECIFIQUES_SERVICES.md pour détails)
```

#### 1.2 Créer Contrôleurs Rust

**Fichiers à créer** :
- `backend/src/controllers/pharmacy_controller.rs`
- `backend/src/controllers/hospital_controller.rs`
- `backend/src/controllers/laboratory_controller.rs`
- `backend/src/controllers/travel_agency_controller.rs`

**Fonctions à implémenter** :
- `create_pharmacy()` - Crée service + entrée pharmacies
- `search_pharmacies()` - Recherche dans table pharmacies
- `get_pharmacies_on_duty()` - Pharmacies de garde maintenant
- (Même structure pour les 3 autres types)

#### 1.3 Créer Routes API

**Fichiers à créer** :
- `backend/src/routes/pharmacy_routes.rs`
- `backend/src/routes/hospital_routes.rs`
- `backend/src/routes/laboratory_routes.rs`
- `backend/src/routes/travel_agency_routes.rs`

**Intégrer dans `main.rs`** :
```rust
let app = router()
    .merge(pharmacy_routes())
    .merge(hospital_routes())
    .merge(laboratory_routes())
    .merge(travel_agency_routes())
    // ... autres routes
```

---

### Phase 2 : Détection et Enrichissement (Sans Remplacer la Base)

#### 2.1 Modifier `native_search_service.rs`

**⚠️ IMPORTANT : La recherche BASE reste toujours active. L'enrichissement est un complément.**

**Ajouter fonction de détection** :
```rust
#[derive(Debug, Clone)]
enum SpecializedSearchType {
    Pharmacie,
    Hopital,
    Laboratoire,
    AgenceVoyage,
    General,
}

fn detect_specialized_search_type(query: &str) -> SpecializedSearchType {
    let query_lower = query.to_lowercase();
    
    // Détection pharmacie
    if query_lower.contains("pharmacie") || 
       query_lower.contains("médicament") ||
       (query_lower.contains("garde") && query_lower.contains("pharmacie")) {
        return SpecializedSearchType::Pharmacie;
    }
    
    // Détection hôpital
    if query_lower.contains("hôpital") ||
       query_lower.contains("clinique") ||
       query_lower.contains("médecin") ||
       query_lower.contains("docteur") ||
       query_lower.contains("urgences") {
        return SpecializedSearchType::Hopital;
    }
    
    // Détection laboratoire
    if query_lower.contains("laboratoire") ||
       query_lower.contains("analyse") ||
       query_lower.contains("imagerie") ||
       query_lower.contains("radiologie") ||
       query_lower.contains("scanner") ||
       query_lower.contains("irm") {
        return SpecializedSearchType::Laboratoire;
    }
    
    // Détection agence voyage
    if (query_lower.contains("agence") && query_lower.contains("voyage")) ||
       (query_lower.contains("billet") && query_lower.contains("bus")) ||
       (query_lower.contains("réservation") && query_lower.contains("bus")) ||
       (query_lower.contains("ticket") && query_lower.contains("voyage")) ||
       query_lower.contains("compagnie") && query_lower.contains("bus") {
        return SpecializedSearchType::AgenceVoyage;
    }
    
    SpecializedSearchType::General
}
```

**Modifier `fulltext_search_with_gps()` pour ENRICHISSEMENT (pas remplacement)** :
```rust
pub async fn fulltext_search_with_gps(...) -> AppResult<Vec<SearchResult>> {
    // ✅ ÉTAPE 1 : RECHERCHE BASE (TOUJOURS EXÉCUTÉE)
    let base_results = if let Some(gps_zone_val) = gps_zone {
        // Recherche GPS optimisée (BASE - code existant)
        self.search_with_gps_optimized(query, gps_zone_val, search_radius_km).await?
    } else {
        // Recherche fulltext normale (BASE - code existant)
        self.search_fulltext_normal(query, category_filter, location_filter).await?
    };
    
    // ✅ ÉTAPE 2 : DÉTECTION TYPE (Enrichissement optionnel)
    let search_type = detect_specialized_search_type(query);
    
    // ✅ ÉTAPE 3 : ENRICHISSEMENT (Si type détecté)
    let enriched_results = match search_type {
        SpecializedSearchType::Pharmacie => {
            // Recherche dans table pharmacies (ENRICHISSEMENT)
            let pharmacy_results = self.search_pharmacies_enriched(query, gps_zone, search_radius_km).await?;
            // Fusionner avec résultats BASE
            merge_results(base_results, pharmacy_results)
        }
        SpecializedSearchType::Hopital => {
            let hospital_results = self.search_hospitals_enriched(query, gps_zone, search_radius_km).await?;
            merge_results(base_results, hospital_results)
        }
        SpecializedSearchType::Laboratoire => {
            let lab_results = self.search_laboratories_enriched(query, gps_zone, search_radius_km).await?;
            merge_results(base_results, lab_results)
        }
        SpecializedSearchType::AgenceVoyage => {
            let agency_results = self.search_agencies_enriched(query, gps_zone, search_radius_km).await?;
            merge_results(base_results, agency_results)
        }
        SpecializedSearchType::General => {
            // Pas d'enrichissement, retourner résultats BASE uniquement
            base_results
        }
    };
    
    // ✅ ÉTAPE 4 : DÉDUPLIQUER (même service_id peut être dans base + spécialisé)
    let final_results = deduplicate_results(enriched_results);
    
    // ✅ ÉTAPE 5 : TRIER (résultats enrichis en premier)
    final_results.sort_by(|a, b| {
        let a_enriched = a.search_method.contains("specialized") || a.search_method.contains("enriched");
        let b_enriched = b.search_method.contains("specialized") || b.search_method.contains("enriched");
        
        match (a_enriched, b_enriched) {
            (true, false) => std::cmp::Ordering::Less,  // a avant b
            (false, true) => std::cmp::Ordering::Greater, // b avant a
            _ => b.total_score.partial_cmp(&a.total_score).unwrap_or(std::cmp::Ordering::Equal),
        }
    });
    
    Ok(final_results)
}

// Fonction de fusion
fn merge_results(
    base_results: Vec<SearchResult>,
    specialized_results: Vec<SearchResult>,
) -> Vec<SearchResult> {
    let mut merged = base_results;
    
    for specialized in specialized_results {
        // Vérifier si le service existe déjà dans base
        if let Some(existing) = merged.iter_mut().find(|r| r.service_id == specialized.service_id) {
            // Enrichir le résultat existant
            existing.search_method = format!("{}_enriched", existing.search_method);
            existing.total_score = (existing.total_score + specialized.total_score) / 2.0;
            existing.matched_fields.extend(specialized.matched_fields);
        } else {
            // Ajouter comme nouveau résultat
            merged.push(specialized);
        }
    }
    
    merged
}

fn deduplicate_results(results: Vec<SearchResult>) -> Vec<SearchResult> {
    let mut seen = std::collections::HashSet::new();
    let mut deduplicated = Vec::new();
    
    for result in results {
        if seen.insert(result.service_id) {
            deduplicated.push(result);
        }
    }
    
    deduplicated
}
```

---

### Phase 3 : Frontend Mobile - Pages de Saisie

#### 3.1 Créer `PharmacieFormScreen.tsx`

**Route** : Ajouter dans `App.tsx` ou navigation
```typescript
<Stack.Screen 
  name="PharmacieForm" 
  component={PharmacieFormScreen}
  options={{ title: 'Enregistrer une Pharmacie' }}
/>
```

**Structure** :
```typescript
const PharmacieFormScreen: React.FC = () => {
  const [formData, setFormData] = useState({
    nom: '',
    adresse: '',
    quartier: '',
    ville: '',
    jours_garde: [],
    heures_ouverture: '08:00',
    heures_fermeture: '20:00',
    telephone: '',
    telephone_urgence: '',
    services: [],
  });
  
  const handleSubmit = async () => {
    // Appel API POST /api/pharmacies
    // Crée service + entrée pharmacies
  };
  
  return (
    <ScrollView>
      {/* Formulaire avec tous les champs */}
    </ScrollView>
  );
};
```

#### 3.2 Créer les 3 autres formulaires (même structure)

---

### Phase 4 : Intégration HomeScreen

#### 4.1 Ajouter Section dans `HomeScreen.tsx`

```typescript
// Dans le render de HomeScreen
<View style={styles.specializedSection}>
  <Text style={styles.sectionTitle}>Services Spécialisés</Text>
  
  <View style={styles.serviceGrid}>
    <TouchableOpacity
      style={styles.serviceCard}
      onPress={() => navigation.navigate('PharmacieForm')}
    >
      <Text style={styles.serviceIcon}>💊</Text>
      <Text style={styles.serviceTitle}>Pharmacie</Text>
    </TouchableOpacity>
    
    {/* 3 autres cards */}
  </View>
</View>
```

---

### Phase 5 : Affichage Spécialisé

#### 5.1 Créer Composants de Cards

**`PharmacieResultCard.tsx`** :
```typescript
interface PharmacieResultCardProps {
  pharmacie: {
    id: number;
    nom: string;
    adresse: string;
    is_on_duty_now: boolean;
    jours_garde: string;
    telephone_urgence: string;
    distance_km?: number;
  };
}

const PharmacieResultCard: React.FC<PharmacieResultCardProps> = ({ pharmacie }) => {
  return (
    <View style={styles.card}>
      {pharmacie.is_on_duty_now && (
        <View style={styles.badgeOnDuty}>
          <Text style={styles.badgeText}>DE GARDE</Text>
        </View>
      )}
      <Text style={styles.nom}>{pharmacie.nom}</Text>
      <Text style={styles.adresse}>{pharmacie.adresse}</Text>
      <Text style={styles.joursGarde}>Garde: {pharmacie.jours_garde}</Text>
      <TouchableOpacity style={styles.urgenceButton}>
        <Text>📞 Urgence: {pharmacie.telephone_urgence}</Text>
      </TouchableOpacity>
      {pharmacie.distance_km && (
        <Text style={styles.distance}>{pharmacie.distance_km.toFixed(1)} km</Text>
      )}
    </View>
  );
};
```

#### 5.2 Modifier `ResultatBesoinScreen.tsx`

```typescript
const ResultatBesoinScreen: React.FC = () => {
  const route = useRoute();
  const { results, searchType } = route.params;
  
  // Détecter le type depuis les résultats
  const resultType = detectResultType(results);
  
  const renderResult = (item: any, index: number) => {
    switch (resultType) {
      case 'pharmacie':
        return <PharmacieResultCard key={item.id} pharmacie={item} />;
      case 'hopital':
        return <HopitalResultCard key={item.id} hopital={item} />;
      case 'laboratoire':
        return <LaboratoireResultCard key={item.id} laboratoire={item} />;
      case 'agence_voyage':
        return <AgenceVoyageResultCard key={item.id} agence={item} />;
      default:
        return <ProductCard key={item.service_id} product={item} />;
    }
  };
  
  return (
    <FlatList
      data={results}
      renderItem={({ item, index }) => renderResult(item, index)}
      // ...
    />
  );
};
```

---

## 📝 Ordre d'Exécution Recommandé

### Étape 1 : Backend (Priorité 1)
1. ✅ Créer migration `20251126_create_specialized_services_tables.sql`
2. ✅ Créer fonctions de calcul automatique (is_on_duty_now, etc.)
3. ✅ Créer contrôleurs Rust
4. ✅ Créer routes API
5. ✅ Tester les endpoints

### Étape 2 : Détection Recherche (Priorité 2)
1. ✅ Modifier `native_search_service.rs` pour détection
2. ✅ Implémenter redirection automatique
3. ✅ Tester détection avec différentes requêtes

### Étape 3 : Frontend Mobile (Priorité 3)
1. ✅ Créer `PharmacieFormScreen.tsx`
2. ✅ Créer `HopitalFormScreen.tsx`
3. ✅ Créer `LaboratoireFormScreen.tsx`
4. ✅ Créer `AgenceVoyageFormScreen.tsx`
5. ✅ Ajouter routes dans navigation

### Étape 4 : Intégration HomeScreen (Priorité 4)
1. ✅ Ajouter section "Services Spécialisés"
2. ✅ Ajouter boutons d'accès rapide
3. ✅ Tester navigation

### Étape 5 : Affichage Spécialisé (Priorité 5)
1. ✅ Créer composants de cards spécialisées
2. ✅ Modifier `ResultatBesoinScreen.tsx`
3. ✅ Tester affichage conditionnel

---

## 🎯 Résultat Final

### Expérience Utilisateur

1. **Utilisateur ouvre HomeScreen** → Voit 4 boutons "Services Spécialisés"
2. **Clique sur "Pharmacie"** → Ouvre `PharmacieFormScreen`
3. **Remplit le formulaire** → Sauvegarde dans table `pharmacies`
4. **Autre utilisateur recherche "pharmacie de garde"** → Redirection automatique vers table `pharmacies`
5. **Résultats affichés** → Cards spécialisées avec badge "DE GARDE", téléphone urgence, etc.

---

## ✅ Checklist Complète

### Backend
- [ ] Migration SQL créée
- [ ] Contrôleurs créés
- [ ] Routes API créées
- [ ] Services de recherche créés
- [ ] Détection de type implémentée
- [ ] Redirection automatique fonctionnelle

### Frontend Mobile
- [ ] 4 formulaires créés
- [ ] Routes navigation ajoutées
- [ ] Section HomeScreen ajoutée
- [ ] 4 composants de cards créés
- [ ] ResultatBesoinScreen modifié
- [ ] Tests effectués

### Frontend Web
- [ ] Pages équivalentes créées
- [ ] Intégration HomePage
- [ ] Composants de résultats

---

**Souhaitez-vous que je commence par créer la migration SQL et les contrôleurs Rust ?** 🚀

