# 📝 PROMPT IMPLÉMENTATION COMPLET - Yukpo

**Instructions pour Chat d'implémentation**

---

## 🎯 CONTEXTE

Tu dois implémenter une refonte majeure du système Yukpo avec 3 axes :

1. **Architecture Vectorielle Autocomplete** : Sauvegarde linéaire des combinaisons de caractéristiques
2. **Hiérarchie Géographique Intelligente** : Système bidirectionnel avec GeoNames
3. **Corrections Bugs** : 25 problèmes identifiés à corriger

**Technologies** :
- Backend : Rust, Axum, SQLx (offline mode), PostgreSQL
- Frontend : React Native, TypeScript, Expo
- APIs : GeoNames API (gratuit, 30k req/jour), Google Places API (fallback)

---

## ⚙️ CONTRAINTES TECHNIQUES IMPORTANTES

### SQLx Offline Mode

Le backend Yukpo utilise **SQLx en mode offline** pour compatibilité production.

**RÈGLE CRITIQUE** : Les migrations SQL dans `backend/migrations/*.sql` ne s'exécutent PAS automatiquement.

**Méthode correcte** :
1. Créer fonction `ensure_nom_table()` dans `backend/src/migrations/auto_migrate.rs`
2. Vérifier si table existe : `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'nom_table')`
3. Si n'existe pas : Créer avec `sqlx::query(CREATE TABLE...)`
4. Appeler dans `run_auto_migrations()` (ligne ~350)

**Exemple à suivre** : `ensure_publicites_table()` ligne 102-280

**Au démarrage** : `main.rs` appelle `run_auto_migrations(&pg_pool)` → Tables créées automatiquement

---

### GeoNames API (Hiérarchie Géographique)

**Inscription** : http://www.geonames.org/login (gratuit)  
**Limite** : 30 000 requêtes/jour  
**Variable env** : `GEONAMES_USERNAME=votre_username`

**3 Endpoints essentiels** :

1. **searchJSON** : Trouver lieu → obtenir geoname_id
   - `name` : Nom lieu
   - `country` : Code pays (CM, FR, US) pour éviter homonymes
   - Retourne : `geonameId`, `lat`, `lng`, `population`, `fcode`

2. **hierarchyJSON** : Parents (ascendant)
   - `geonameId` : ID du lieu
   - Retourne : Array [Continent, Pays, Région, ..., Lieu] (du plus large au plus précis)

3. **childrenJSON** : Enfants (descendant)
   - `geonameId` : ID du lieu
   - Retourne : Array des lieux contenus (villes dans région, quartiers dans ville)

**Profondeur** : Descend jusqu'à **niveau 7 (quartier)**  
**Extrêmes** : Quartier retourne généralement `children = []` (is_leaf)

---

## 📋 PROBLÈMES À RÉSOUDRE

### Création Service
1. Transformation autocomplete → listeproduit manquante
2. Débit tokens AVANT validation (perte argent)
3. Tables manquantes (migrations SQL non auto)
4. tokens_ia_externe dans mauvais endroit

### Recherche
5. Fonction hybrid_image_search() manquante
6. Table image_analyses manquante  
7. Recherche ne retourne pas résultats pertinents

### Formulaire
8. nom_produit, categorie_produit, description_produit pas chargés
9. Autocomplete cherche au lieu d'afficher vecteur IA

### Architecture
10. Sauvegarde longitudinale au lieu de linéaire (perd contexte)
11. Pas de vecteurs combinatoires
12. Silos par sous_caracteristique
13. Variation prix séparée de autocomplete

### Géolocalisation
14. Pas de hiérarchie bidirectionnelle
15. Recherche "Douala" ne trouve pas "Littoral"
16. Recherche "Littoral" ne trouve pas "Douala"
17. Homonymes pas gérés

### UI/UX
18. Scroll horizontal auto HomeScreen ne fonctionne pas
19. Historique notifications non fonctionnel
20. ResultatBesoinScreen : Suggestions vecteurs manquantes
21. ProductCard : Pas d'affichage variations prix

### Prompt IA
22. variation_prix séparé de autocomplete
23. Position "last" dimension variable pas spécifiée
24. Multi-combinaisons pas générées
25. Dimension lieu pas ajoutée automatiquement

---

## 🏗️ ARCHITECTURE CIBLE

### Principe Vectoriel

**Produit** = Vecteur de caractéristiques + Vecteur de localisation

```
Exemple :
Product: [Canapé, Tissu, Marron, 2 places, 38, Douala, Akwa, Bonamoussadi, Littoral, Cameroun]
          ↑──────────────────────────────↑  ↑   ↑────────────────────────────────────────────↑
          Caractéristiques produit         Var  Localisation (choix + enfants + parents)
```

**Recherche** : Filtrage progressif dans vecteurs

```
User tape "Tissu" → Filtre vecteurs contenant "Tissu"
User tape "Marron" → Filtre ENCORE (Tissu ET Marron)
User tape "Douala" → Filtre ENCORE (Tissu ET Marron ET Douala)

Résultat : Vecteurs matchant LES 3 critères
```

---

## 🗄️ TABLES À CRÉER

### 1. autocomplete_combinations

**Rôle** : Stocker vecteurs produit complets pour recherche

```sql
CREATE TABLE autocomplete_combinations (
    id SERIAL PRIMARY KEY,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    
    product_vector TEXT[] NOT NULL,
    location_vector TEXT[] NOT NULL,
    full_vector TEXT[] NOT NULL,
    
    chosen_location VARCHAR(255),
    chosen_location_geoname_id BIGINT,
    
    has_variant BOOLEAN DEFAULT FALSE,
    variant_dimension VARCHAR(255),
    variant_value TEXT,
    prix NUMERIC,
    devise VARCHAR(10) DEFAULT 'XAF',
    stock INTEGER,
    
    usage_count INTEGER DEFAULT 1,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(service_id, full_vector)
);

CREATE INDEX idx_full_vector_gin ON autocomplete_combinations USING GIN(full_vector);
CREATE INDEX idx_product_vector_gin ON autocomplete_combinations USING GIN(product_vector);
CREATE INDEX idx_location_vector_gin ON autocomplete_combinations USING GIN(location_vector);
CREATE INDEX idx_chosen_location ON autocomplete_combinations(chosen_location);
CREATE INDEX idx_service_id ON autocomplete_combinations(service_id);
```

### 2. geo_hierarchy

**Rôle** : Cache hiérarchie géographique bidirectionnelle

```sql
CREATE TABLE geo_hierarchy (
    geoname_id BIGINT PRIMARY KEY,
    place_name VARCHAR(255) NOT NULL,
    display_name TEXT NOT NULL,
    feature_code VARCHAR(10) NOT NULL,
    admin_level INTEGER NOT NULL,
    is_leaf BOOLEAN DEFAULT FALSE,
    
    parent_country VARCHAR(255) NOT NULL,
    parent_country_code CHAR(2),
    
    location_vector TEXT[] NOT NULL,
    
    lat NUMERIC(10, 7) NOT NULL,
    lng NUMERIC(10, 7) NOT NULL,
    bounds JSONB,
    
    population INTEGER,
    timezone VARCHAR(50),
    
    times_used INTEGER DEFAULT 0,
    last_enriched_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE (place_name, parent_country, lat, lng)
);

CREATE INDEX idx_geo_name_country ON geo_hierarchy(place_name, parent_country);
CREATE INDEX idx_geo_vector_gin ON geo_hierarchy USING GIN(location_vector);
CREATE INDEX idx_geo_country ON geo_hierarchy(parent_country);
CREATE INDEX idx_geo_geoname ON geo_hierarchy(geoname_id);
```

---

## 🔧 IMPLÉMENTATION PRIORITAIRE

### ÉTAPE 1 : Migrations Auto (URGENT)

**Fichier** : `backend/src/migrations/auto_migrate.rs`

Ajouter toutes les fonctions `ensure_*` pour créer tables automatiquement au démarrage.

Voir : `ALGORITHMES_IMPLEMENTATION.md` pour code complet.

---

### ÉTAPE 2 : GeoNames Service

**Fichier** : `backend/src/services/geonames_service.rs` (CRÉER)

Fonctions :
- `enrich_location_bidirectional()` : Récupère hierarchy + children en une passe
- `build_location_vector()` : Construit `[Choix, Enfants, Parents]`
- `expand_location_search()` : Pour recherche (retourne vecteur complet)

Variables d'environnement :
```env
GEONAMES_USERNAME=votre_username
```

---

### ÉTAPE 3 : Sauvegarde Vectorielle

**Fichier** : `backend/src/services/creer_service.rs`

Modifier flux :
1. Valider schéma JSON (ligne ~280)
2. Débiter tokens (ligne ~410) - **APRÈS validation**
3. Sauvegarder service (ligne ~450)
4. **NOUVEAU** : Sauvegarder autocomplete_combinations

---

### ÉTAPE 4 : Frontend Formulaire

**Fichier** : `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx`

Modifications :
1. Ligne ~150 : useEffect charger valeurs IA
2. Ligne ~300 : Ajouter dimension lieu auto
3. Ligne ~1900 : Transformer avant sauvegarde

---

### ÉTAPE 5 : Prompt IA Amélioration

**Fichier** : `backend/ia_prompts/creation_service_prompt.md`

**Modifications CRITIQUES** :

1. **Ligne ~115** : Fusionner `price_variant` DANS `autocomplete`
```markdown
### 💰 INTÉGRATION variation_prix DANS autocomplete

**RÈGLE** : Si produit a variations prix, `variation_prix` est une PROPRIÉTÉ de `produits`, pas un champ séparé.

**Structure** :
```json
"produits": {
  "type_donnee": "autocomplete",
  "valeur": [
    "Nike,Air Max,Noir,Neuf,38",
    "Nike,Air Max,Noir,Neuf,39",
    "Nike,Air Max,Noir,Neuf,40"
  ],
  "sous_caracteristiques": {
    "marque": ["Nike"],
    "modele": ["Air Max"],
    "couleur": ["Noir"],
    "etat": ["Neuf"],
    "pointure": ["38", "39", "40", "41", "42"]  // Dernier AVANT lieu
  },
  "variation_prix": {  // ⚡ INTÉGRÉ ICI
    "variable": "pointure",
    "position": "last_before_location",
    "modalites": [
      {"valeur": "38", "prix": 45000, "devise": "XAF", "stock": 5},
      {"valeur": "39", "prix": 45000, "devise": "XAF", "stock": 3},
      {"valeur": "40", "prix": 48000, "devise": "XAF", "stock": 2}
    ]
  }
}
```
\`\`\`

2. **Ligne ~145** : Règle position last
```markdown
**RÈGLE POSITION** : 
- Dimension variable (pointure, taille, stockage) = AVANT-DERNIÈRE position
- Dimension lieu = DERNIÈRE position (toujours)

Ordre : [caractéristiques fixes, dimension_variable, lieu]
```

3. **Ligne ~280** : Dimension lieu automatique
```markdown
### 🌍 DIMENSION LIEU (AUTOMATIQUE)

**TOUJOURS ajouter** dimension lieu en FIN du vecteur autocomplete.

Le lieu sera enrichi côté backend avec hiérarchie complète (GeoNames).

**Exemple** :
\`\`\`json
"sous_caracteristiques": {
  "marque": [...],
  "couleur": [...],
  "pointure": [...],  // Avant-dernier si variation
  "lieu": [""]  // ⚡ TOUJOURS en dernier (vide, rempli par user)
}
\`\`\`
```

---

### ÉTAPE 6 : Composants UI

**Fichiers** :
- `LinearAutocompleteEditor.tsx` : RÉÉCRIRE (affichage vecteur avec variations)
- `ResultatBesoinScreen.tsx` : RÉÉCRIRE COMPLET (suggestions vecteurs)
- `ProductCard.tsx` : REFONTE (tableau variations + lieu)
- `MixedContentCarousel.tsx` : CORRIGER scroll auto
- `NotificationHistoryModal.tsx` : REVOIR profondeur

---

## 📐 RÈGLES IMPORTANTES

### Vecteurs

1. **Ordre produit** : `[caractéristiques fixes..., dimension_variable, lieu...]`
2. **Ordre lieu** : `[Choix, Enfants immédiats, Parents ascendants]`
3. **Position 0 produit** : 1ère caractéristique
4. **Position 0 lieu** : Lieu choisi par prestataire

### Profondeur Géographique

- **Minimum** : Pays (niveau 2)
- **Maximum** : Quartier (niveau 7)
- **Exclusions** : Rues, bâtiments (privacy)

### Homonymes

- **Clé primaire** : `geoname_id` (unique mondial)
- **Clé secondaire** : `(place_name, parent_country)` 
- **Affichage** : Toujours avec contexte ("Douala, Cameroun")

### Scoring Recherche

```
Score final = (Score location × 0.7) + (Popularité × 0.3)

Score location :
- Choix exact = 100
- Position 1-15 (enfant) = 100 / position
- Au-delà (parent) = 50 / position
```

---

## 🎯 PRIORITÉS IMPLÉMENTATION

**P0 - BLOQUANT** (faire d'abord) :
- Migrations auto
- GeoNames service
- Débit après validation
- Transformation autocomplete

**P1 - IMPORTANT** (ensuite) :
- Formulaire charger valeurs
- Sauvegarde vectorielle
- LocationSelector enrichi
- Recherche vectorielle

**P2 - UX** (après P0+P1) :
- ResultatBesoinScreen refonte
- ProductCard refonte
- LinearAutocompleteEditor

---

## 📝 NOTES POUR IMPLÉMENTATION

### Variables d'Environnement

Ajouter dans `.env` :
```env
GEONAMES_USERNAME=votre_username_geonames
MAX_GEO_DEPTH=7
```

### Tests à Faire

1. Créer service chaussure avec pointures (variations)
2. Sauvegarder avec lieu "Douala"
3. Vérifier autocomplete_combinations contient vecteur complet
4. Vérifier geo_hierarchy enrichi
5. Rechercher "Tissu" → Voir suggestions
6. Rechercher "Littoral" → Trouve produit "Douala"
7. Vérifier scoring (exact avant parent)

### Fonctionnalités Existantes à Préserver

- ChatModalMobile (intégration ProductCard)
- LocationProximityFilter (utiliser dans recherche)
- PlacesService (fallback local Afrique)
- NativeDesign components (utiliser partout)
- SafeIcon (icônes)
- MixedContentCarousel (corriger scroll auto)
- NotificationHistoryModal (revoir)

---

## 🎨 AFFICHAGE VARIATIONS PRIX

### Dans Formulaire Création

```typescript
// FormulaireYukpoIntelligentScreen.tsx

{field.typeDonnee === 'autocomplete' && field.variation_prix && (
  <View style={styles.variationsContainer}>
    <Text style={styles.variationTitle}>
      Prix selon {field.variation_prix.variable} :
    </Text>
    <View style={styles.variationsGrid}>
      {field.variation_prix.modalites.map((modalite, index) => (
        <View key={index} style={styles.variationRow}>
          <TextInput
            value={modalite.valeur}
            editable={false}
            style={styles.variantValue}
          />
          <TextInput
            value={String(modalite.prix)}
            onChangeText={(text) => updateVariantPrice(index, text)}
            keyboardType="numeric"
            style={styles.variantPrice}
            placeholder="Prix"
          />
          <TextInput
            value={String(modalite.stock || 0)}
            onChangeText={(text) => updateVariantStock(index, text)}
            keyboardType="numeric"
            style={styles.variantStock}
            placeholder="Stock"
          />
        </View>
      ))}
    </View>
  </View>
)}
```

### Dans ProductCard

```typescript
{product.has_variant ? (
  <View style={styles.priceTable}>
    <Text style={styles.tableTitle}>
      Prix selon {product.variant_dimension} :
    </Text>
    {product.variants.map((v, i) => (
      <View key={i} style={styles.tableRow}>
        <Text style={styles.cellVariant}>{v.value}</Text>
        <Text style={styles.cellPrice}>
          {v.prix.toLocaleString()} {v.devise}
        </Text>
        <View style={[styles.cellStock, v.stock > 5 ? styles.stockOK : styles.stockLow]}>
          <Text>{v.stock > 0 ? `${v.stock} dispo` : 'Épuisé'}</Text>
        </View>
      </View>
    ))}
    <Text style={styles.priceFrom}>
      À partir de {Math.min(...product.variants.map(v => v.prix)).toLocaleString()} {product.devise}
    </Text>
  </View>
) : (
  <Text style={styles.priceUnique}>
    {product.prix?.toLocaleString()} {product.devise}
  </Text>
)}
```

---

## 🔍 RECHERCHE PROGRESSIVE (ResultatBesoinScreen)

### Interface Recherche avec Suggestions Vecteurs

```typescript
const [searchText, setSearchText] = useState('');
const [vectorSuggestions, setVectorSuggestions] = useState([]);

// Recherche progressive
useEffect(() => {
  const words = searchText.split(' ').filter(w => w.trim());
  
  if (words.length > 0) {
    apiPost('/api/autocomplete/search-combinations', {
      filters: words,
      limit: 10
    }).then(response => {
      setVectorSuggestions(response.data || []);
    });
  }
}, [searchText]);

// Affichage
{vectorSuggestions.length > 0 && (
  <View style={styles.suggestions}>
    <Text>💡 Produits complets correspondants :</Text>
    {vectorSuggestions.map((suggestion, i) => (
      <TouchableOpacity 
        key={i}
        onPress={() => {
          // Remplir barre avec vecteur complet
          setSearchText(suggestion.full_vector.join(', '));
          // Lancer recherche
          searchFinal(suggestion.full_vector);
        }}
      >
        <View style={styles.suggestionCard}>
          {/* Vecteur produit */}
          <View style={styles.productChips}>
            {suggestion.product_vector.map(v => (
              <Chip key={v}>{v}</Chip>
            ))}
          </View>
          
          {/* Lieu */}
          <Text style={styles.location}>
            📍 {suggestion.chosen_location}
          </Text>
          
          {/* Stats */}
          <Text style={styles.stats}>
            📊 {suggestion.usage_count} utilisations
            {suggestion.has_variant && ` · ${suggestion.variants?.length} variations`}
          </Text>
          
          <Button>Sélectionner ce produit</Button>
        </View>
      </TouchableOpacity>
    ))}
    
    <Button onPress={() => searchFinal(words)}>
      🔍 Rechercher sans suggestion
    </Button>
  </View>
)}
```

---

FIN. Document complet avec algorithmes dans `ALGORITHMES_IMPLEMENTATION.md`

