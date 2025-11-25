# 🏗️ Architecture Complète : Services Spécialisés avec Moment Systématique

## 🎯 Objectif

Créer un système complet de services spécialisés avec :
1. **Recherche avec "moment" systématique** (temps réel)
2. **Accès regroupé** depuis Mon Compte / Avatar
3. **Deux groupes** : Santé et Transport
4. **Tables dédiées** pour chaque service

---

## 📊 Groupes de Services Spécialisés

### Groupe 1 : Santé 🏥
- 💊 **Pharmacies** (avec garde)
- 🏥 **Hôpitaux/Cliniques** (avec disponibilité)
- 🔬 **Laboratoires/Imagerie** (avec planning)

### Groupe 2 : Transport 🚗
- 🚌 **Agences de Voyage** (tickets bus)
- 🚗 **Covoiturage** (trajets partagés)
- 🚕 **Taxi de Ville** (comme Yango/Uber)

---

## 🔍 Recherche avec "Moment" Systématique

### Principe

Pour les services spécialisés, **le moment de la recherche (NOW()) est TOUJOURS pris en compte** :

- **Pharmacies** : `is_on_duty_now` calculé avec `NOW()`
- **Hôpitaux** : `is_available_now` calculé avec `NOW()`
- **Laboratoires** : `is_available_now` calculé avec `NOW()`
- **Covoiturage** : Trajets disponibles **maintenant** ou dans les prochaines heures
- **Taxi** : Chauffeurs disponibles **maintenant**

### Implémentation

```rust
// backend/src/services/specialized_search_service.rs

pub struct SpecializedSearchService {
    pool: PgPool,
}

impl SpecializedSearchService {
    /// Recherche pharmacies avec moment systématique
    pub async fn search_pharmacies_with_moment(
        &self,
        query: &str,
        gps_zone: Option<&str>,
        search_radius_km: Option<i32>,
        search_time: Option<DateTime<Utc>>, // Par défaut NOW()
    ) -> AppResult<Vec<PharmacyResult>> {
        let search_time = search_time.unwrap_or_else(Utc::now);
        
        let sql = r#"
            SELECT 
                p.*,
                s.data,
                s.gps as service_gps,
                -- ✅ MOMENT SYSTÉMATIQUE : Calculer is_on_duty_now avec search_time
                is_pharmacy_on_duty(
                    jsonb_build_object(
                        'joursGarde', p.jours_garde,
                        'heuresOuverture', p.heures_ouverture::TEXT,
                        'heuresFermeture', p.heures_fermeture::TEXT
                    ),
                    $1::TIMESTAMPTZ  -- ✅ Moment de recherche
                ) as is_on_duty_now,
                -- Distance si GPS fourni
                CASE 
                    WHEN $2 IS NOT NULL AND p.gps IS NOT NULL 
                    THEN calculate_distance_km($2, p.gps)
                    ELSE NULL
                END as distance_km
            FROM pharmacies p
            INNER JOIN services s ON s.id = p.service_id
            WHERE p.is_active = TRUE
            AND (
                p.nom ILIKE '%' || $3 || '%'
                OR p.quartier ILIKE '%' || $3 || '%'
                OR p.ville ILIKE '%' || $3 || '%'
                OR EXISTS (
                    SELECT 1 FROM unnest(p.services) AS service
                    WHERE service ILIKE '%' || $3 || '%'
                )
            )
            -- ✅ FILTRE PAR MOMENT : Seulement si recherche "de garde" ou "disponible"
            AND (
                $4::BOOLEAN = FALSE  -- Si pas de filtre moment
                OR is_pharmacy_on_duty(
                    jsonb_build_object(
                        'joursGarde', p.jours_garde,
                        'heuresOuverture', p.heures_ouverture::TEXT,
                        'heuresFermeture', p.heures_fermeture::TEXT
                    ),
                    $1::TIMESTAMPTZ
                ) = TRUE
            )
            -- Filtre distance si GPS fourni
            AND (
                $2 IS NULL 
                OR p.gps IS NULL
                OR calculate_distance_km($2, p.gps) <= $5::DOUBLE PRECISION
            )
            ORDER BY 
                -- ✅ PRIORITÉ : Pharmacies de garde maintenant en premier
                is_pharmacy_on_duty(
                    jsonb_build_object(
                        'joursGarde', p.jours_garde,
                        'heuresOuverture', p.heures_ouverture::TEXT,
                        'heuresFermeture', p.heures_fermeture::TEXT
                    ),
                    $1::TIMESTAMPTZ
                ) DESC,
                distance_km ASC NULLS LAST,
                p.nom ASC
            LIMIT 50
        "#;
        
        // Exécuter avec search_time (NOW() par défaut)
        // ...
    }
    
    // Même logique pour hôpitaux, laboratoires, covoiturage, taxi
}
```

---

## 📱 Accès Regroupé : "Mes Services Spécialisés"

### Structure de Navigation

```
HomeScreen / HomePage
    ↓
Avatar / Mon Compte
    ↓
"Mes Services Spécialisés" (1 seul lien)
    ↓
Page "Mes Services Spécialisés"
    ├─ Groupe Santé 🏥
    │   ├─ 💊 Pharmacies
    │   ├─ 🏥 Hôpitaux/Cliniques
    │   └─ 🔬 Laboratoires
    └─ Groupe Transport 🚗
        ├─ 🚌 Agences de Voyage
        ├─ 🚗 Covoiturage
        └─ 🚕 Taxi de Ville
```

### Page "Mes Services Spécialisés"

**Fichier** : `mobile/src/screens/MesServicesSpecialisesScreen.tsx`

```typescript
const MesServicesSpecialisesScreen: React.FC = () => {
  const navigation = useNavigation();
  
  const servicesSante = [
    {
      id: 'pharmacie',
      title: 'Pharmacie',
      icon: '💊',
      description: 'Enregistrer une pharmacie avec garde',
      route: 'PharmacieForm',
      color: '#10B981', // Vert
    },
    {
      id: 'hopital',
      title: 'Hôpital/Clinique',
      icon: '🏥',
      description: 'Enregistrer un établissement de santé',
      route: 'HopitalForm',
      color: '#EF4444', // Rouge
    },
    {
      id: 'laboratoire',
      title: 'Laboratoire/Imagerie',
      icon: '🔬',
      description: 'Enregistrer un laboratoire',
      route: 'LaboratoireForm',
      color: '#3B82F6', // Bleu
    },
  ];
  
  const servicesTransport = [
    {
      id: 'agence_voyage',
      title: 'Agence de Voyage',
      icon: '🚌',
      description: 'Enregistrer une agence de voyage',
      route: 'AgenceVoyageForm',
      color: '#F59E0B', // Orange
    },
    {
      id: 'covoiturage',
      title: 'Covoiturage',
      icon: '🚗',
      description: 'Proposer un trajet partagé',
      route: 'CovoiturageForm',
      color: '#8B5CF6', // Violet
    },
    {
      id: 'taxi',
      title: 'Taxi de Ville',
      icon: '🚕',
      description: 'Enregistrer un service de taxi',
      route: 'TaxiForm',
      color: '#F97316', // Orange foncé
    },
  ];
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes Services Spécialisés</Text>
        <Text style={styles.subtitle}>
          Gérez vos services de santé et de transport
        </Text>
      </View>
      
      {/* Groupe Santé */}
      <View style={styles.group}>
        <View style={styles.groupHeader}>
          <Text style={styles.groupIcon}>🏥</Text>
          <Text style={styles.groupTitle}>Santé</Text>
        </View>
        <View style={styles.servicesGrid}>
          {servicesSante.map(service => (
            <TouchableOpacity
              key={service.id}
              style={[styles.serviceCard, { borderLeftColor: service.color }]}
              onPress={() => navigation.navigate(service.route)}
            >
              <Text style={styles.serviceIcon}>{service.icon}</Text>
              <Text style={styles.serviceTitle}>{service.title}</Text>
              <Text style={styles.serviceDescription}>{service.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      {/* Groupe Transport */}
      <View style={styles.group}>
        <View style={styles.groupHeader}>
          <Text style={styles.groupIcon}>🚗</Text>
          <Text style={styles.groupTitle}>Transport</Text>
        </View>
        <View style={styles.servicesGrid}>
          {servicesTransport.map(service => (
            <TouchableOpacity
              key={service.id}
              style={[styles.serviceCard, { borderLeftColor: service.color }]}
              onPress={() => navigation.navigate(service.route)}
            >
              <Text style={styles.serviceIcon}>{service.icon}</Text>
              <Text style={styles.serviceTitle}>{service.title}</Text>
              <Text style={styles.serviceDescription}>{service.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};
```

---

## 🗄️ Tables à Créer

### 1. Table `covoiturages`

```sql
CREATE TABLE IF NOT EXISTS covoiturages (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations trajet
    depart VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    gps_depart VARCHAR(255),
    gps_destination VARCHAR(255),
    
    -- Date et heure
    date_depart TIMESTAMPTZ NOT NULL,
    heure_depart TIME NOT NULL,
    date_arrivee_estimee TIMESTAMPTZ,
    
    -- Véhicule
    type_vehicule VARCHAR(50), -- "Voiture", "Moto", "Camionnette"
    marque_modele VARCHAR(255),
    nombre_places INTEGER NOT NULL,
    places_disponibles INTEGER NOT NULL,
    
    -- Prix
    prix_par_place INTEGER NOT NULL, -- FCFA
    devise VARCHAR(3) DEFAULT 'XAF',
    
    -- Options
    bagages_autorises BOOLEAN DEFAULT TRUE,
    animaux_autorises BOOLEAN DEFAULT FALSE,
    fumeur_autorise BOOLEAN DEFAULT FALSE,
    climatisation BOOLEAN DEFAULT FALSE,
    
    -- Statut
    statut VARCHAR(20) NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert', 'complet', 'annule', 'termine')),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(service_id)
);

-- Index pour recherche avec moment
CREATE INDEX IF NOT EXISTS idx_covoiturages_date_depart ON covoiturages(date_depart) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_covoiturages_statut ON covoiturages(statut) WHERE statut = 'ouvert';
CREATE INDEX IF NOT EXISTS idx_covoiturages_depart_destination ON covoiturages(depart, destination);
```

### 2. Table `taxis_ville`

```sql
CREATE TABLE IF NOT EXISTS taxis_ville (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations chauffeur
    nom_chauffeur VARCHAR(255),
    telephone VARCHAR(50) NOT NULL,
    whatsapp VARCHAR(50),
    
    -- Véhicule
    type_vehicule VARCHAR(50), -- "Berline", "SUV", "Van", "Moto"
    marque_modele VARCHAR(255),
    immatriculation VARCHAR(50),
    couleur VARCHAR(50),
    annee INTEGER,
    
    -- Disponibilité
    is_available_now BOOLEAN DEFAULT FALSE, -- Calculé automatiquement
    zone_intervention TEXT[], -- ["Douala Centre", "Bonanjo", "Akwa"]
    gps_actuel VARCHAR(255), -- Position actuelle du taxi
    
    -- Tarification
    tarif_base INTEGER DEFAULT 500, -- FCFA (prix minimum)
    tarif_par_km INTEGER DEFAULT 200, -- FCFA par km
    devise VARCHAR(3) DEFAULT 'XAF',
    
    -- Options
    paiement_cash BOOLEAN DEFAULT TRUE,
    paiement_mobile_money BOOLEAN DEFAULT FALSE,
    paiement_carte BOOLEAN DEFAULT FALSE,
    climatisation BOOLEAN DEFAULT FALSE,
    wifi BOOLEAN DEFAULT FALSE,
    
    -- Statut
    is_active BOOLEAN DEFAULT TRUE,
    is_on_duty BOOLEAN DEFAULT FALSE, -- En service maintenant
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(service_id)
);

-- Index pour recherche avec moment
CREATE INDEX IF NOT EXISTS idx_taxis_is_available ON taxis_ville(is_available_now) WHERE is_available_now = TRUE;
CREATE INDEX IF NOT EXISTS idx_taxis_is_on_duty ON taxis_ville(is_on_duty) WHERE is_on_duty = TRUE;
CREATE INDEX IF NOT EXISTS idx_taxis_zone_gin ON taxis_ville USING GIN(zone_intervention);
```

---

## 🔍 Recherche avec Moment pour Covoiturage et Taxi

### Covoiturage : Trajets Disponibles Maintenant ou Prochaines Heures

```rust
pub async fn search_covoiturages_with_moment(
    &self,
    depart: Option<&str>,
    destination: Option<&str>,
    gps_zone: Option<&str>,
    search_time: Option<DateTime<Utc>>,
    max_hours_ahead: Option<i32>, // Par défaut 24h
) -> AppResult<Vec<CovoiturageResult>> {
    let search_time = search_time.unwrap_or_else(Utc::now);
    let max_hours = max_hours_ahead.unwrap_or(24);
    let max_time = search_time + chrono::Duration::hours(max_hours as i64);
    
    let sql = r#"
        SELECT 
            c.*,
            s.data,
            -- ✅ MOMENT SYSTÉMATIQUE : Trajets disponibles maintenant ou prochaines heures
            CASE 
                WHEN c.date_depart <= $1::TIMESTAMPTZ THEN 'disponible_maintenant'
                WHEN c.date_depart <= $2::TIMESTAMPTZ THEN 'disponible_bientot'
                ELSE 'disponible_plus_tard'
            END as disponibilite_moment,
            -- Distance si GPS fourni
            CASE 
                WHEN $3 IS NOT NULL AND c.gps_depart IS NOT NULL 
                THEN calculate_distance_km($3, c.gps_depart)
                ELSE NULL
            END as distance_km
        FROM covoiturages c
        INNER JOIN services s ON s.id = c.service_id
        WHERE c.is_active = TRUE
        AND c.statut = 'ouvert'
        AND c.places_disponibles > 0
        -- ✅ FILTRE PAR MOMENT : Trajets dans les prochaines X heures
        AND c.date_depart >= $1::TIMESTAMPTZ  -- Pas de trajets passés
        AND c.date_depart <= $2::TIMESTAMPTZ   -- Dans les prochaines X heures
        -- Filtres optionnels
        AND ($4::TEXT IS NULL OR c.depart ILIKE '%' || $4 || '%')
        AND ($5::TEXT IS NULL OR c.destination ILIKE '%' || $5 || '%')
        ORDER BY 
            -- ✅ PRIORITÉ : Trajets disponibles maintenant en premier
            CASE 
                WHEN c.date_depart <= $1::TIMESTAMPTZ THEN 1
                WHEN c.date_depart <= $1::TIMESTAMPTZ + INTERVAL '2 hours' THEN 2
                ELSE 3
            END,
            distance_km ASC NULLS LAST,
            c.prix_par_place ASC
        LIMIT 50
    "#;
    
    // Exécuter avec search_time (NOW())
    // ...
}
```

### Taxi : Chauffeurs Disponibles Maintenant

```rust
pub async fn search_taxis_with_moment(
    &self,
    gps_zone: Option<&str>,
    search_time: Option<DateTime<Utc>>,
) -> AppResult<Vec<TaxiResult>> {
    let search_time = search_time.unwrap_or_else(Utc::now);
    
    let sql = r#"
        SELECT 
            t.*,
            s.data,
            -- ✅ MOMENT SYSTÉMATIQUE : Chauffeurs disponibles maintenant
            t.is_available_now,
            t.is_on_duty,
            -- Distance si GPS fourni
            CASE 
                WHEN $1 IS NOT NULL AND t.gps_actuel IS NOT NULL 
                THEN calculate_distance_km($1, t.gps_actuel)
                ELSE NULL
            END as distance_km
        FROM taxis_ville t
        INNER JOIN services s ON s.id = t.service_id
        WHERE t.is_active = TRUE
        -- ✅ FILTRE PAR MOMENT : Seulement taxis disponibles maintenant
        AND t.is_available_now = TRUE
        AND t.is_on_duty = TRUE
        -- Filtre distance si GPS fourni
        AND (
            $1 IS NULL 
            OR t.gps_actuel IS NULL
            OR calculate_distance_km($1, t.gps_actuel) <= 10.0  -- 10km max pour taxi
        )
        ORDER BY 
            -- ✅ PRIORITÉ : Plus proche en premier
            distance_km ASC NULLS LAST,
            t.tarif_base ASC
        LIMIT 20
    "#;
    
    // Exécuter avec search_time (NOW())
    // ...
}
```

---

## 🔗 Intégration dans HomeScreen / HomePage

### Mobile : HomeScreen.tsx

**Option 1 : Depuis Avatar (Header)**

```typescript
// Dans le header de HomeScreen
<TouchableOpacity
  style={styles.avatarContainer}
  onPress={() => navigation.navigate('Profile')}
>
  <Image source={{ uri: user?.avatar_url }} style={styles.avatar} />
</TouchableOpacity>

// Dans ProfileScreen, ajouter :
<TouchableOpacity
  style={styles.menuItem}
  onPress={() => navigation.navigate('MesServicesSpecialises')}
>
  <Text style={styles.menuIcon}>🏥</Text>
  <Text style={styles.menuText}>Mes Services Spécialisés</Text>
  <SafeIcon name="chevron-right" size={20} />
</TouchableOpacity>
```

**Option 2 : Depuis "Mon Compte" (Footer)**

```typescript
// Dans le footer de HomeScreen
<View style={styles.footer}>
  <TouchableOpacity
    style={styles.footerItem}
    onPress={() => navigation.navigate('MesServicesSpecialises')}
  >
    <Text style={styles.footerIcon}>🏥</Text>
    <Text style={styles.footerText}>Mes Services Spécialisés</Text>
  </TouchableOpacity>
</View>
```

### Frontend : HomePage.tsx

```typescript
// Dans le header de HomePage
<DropdownMenu>
  <MenuItem onClick={() => navigate('/mes-services-specialises')}>
    <Icon>🏥</Icon>
    <span>Mes Services Spécialisés</span>
  </MenuItem>
</DropdownMenu>
```

---

## 📋 Checklist d'Implémentation

### Phase 1 : Tables et Backend
- [ ] Créer migration pour `covoiturages`
- [ ] Créer migration pour `taxis_ville`
- [ ] Créer fonctions de recherche avec moment
- [ ] Créer contrôleurs pour covoiturage et taxi
- [ ] Créer routes API

### Phase 2 : Page "Mes Services Spécialisés"
- [ ] Créer `MesServicesSpecialisesScreen.tsx` (Mobile)
- [ ] Créer `MesServicesSpecialisesPage.tsx` (Frontend)
- [ ] Ajouter route dans navigation
- [ ] Créer styles pour groupes Santé/Transport

### Phase 3 : Formulaires
- [ ] Créer `CovoiturageFormScreen.tsx`
- [ ] Créer `TaxiFormScreen.tsx`
- [ ] Intégrer dans page "Mes Services Spécialisés"

### Phase 4 : Intégration Navigation
- [ ] Ajouter lien dans ProfileScreen (Mobile)
- [ ] Ajouter lien dans footer HomeScreen (Mobile)
- [ ] Ajouter lien dans header HomePage (Frontend)

### Phase 5 : Recherche avec Moment
- [ ] Modifier recherche pharmacies avec moment systématique
- [ ] Modifier recherche hôpitaux avec moment systématique
- [ ] Modifier recherche laboratoires avec moment systématique
- [ ] Implémenter recherche covoiturage avec moment
- [ ] Implémenter recherche taxi avec moment

---

## 🎯 Résultat Final

### Expérience Utilisateur

1. **Prestataire** :
   - Clique sur Avatar → "Mes Services Spécialisés"
   - Voit 2 groupes : Santé 🏥 et Transport 🚗
   - Clique sur "Taxi de Ville" → Ouvre formulaire
   - Remplit formulaire → Sauvegarde dans `taxis_ville`

2. **Client recherche "taxi disponible"** :
   - Détection : `SpecializedSearchType::Taxi`
   - Recherche BASE : Services avec produits taxi
   - Recherche ENRICHISSEMENT : `SELECT * FROM taxis_ville WHERE is_available_now = TRUE`
   - **Moment systématique** : Seulement taxis disponibles **maintenant**
   - Fusion des résultats
   - Affichage spécialisé avec distance et tarif

**Le moment est TOUJOURS pris en compte pour les services spécialisés !** ✅

