# 🔧 ALGORITHMES IMPLÉMENTATION - Yukpo

**Complément de** : `TODO_COMPLET_REFONTE_YUKPO.md`

---

## 🌍 ALGORITHME 1 : GeoNames Service

### Fonction : enrich_location_bidirectional()

```rust
// backend/src/services/geonames_service.rs

use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use crate::core::types::AppResult;

const GEONAMES_BASE: &str = "http://api.geonames.org";
const MAX_DEPTH: u8 = 7;  // Quartier max

#[derive(Debug, Serialize, Deserialize)]
pub struct GeoNamePlace {
    pub geoname_id: i64,
    pub name: String,
    pub fcode: String,
    pub lat: f64,
    pub lng: f64,
    pub population: Option<i32>,
}

pub async fn enrich_location_bidirectional(
    pool: &PgPool,
    place_name: &str,
    country_context: Option<&str>
) -> AppResult<Vec<String>> {
    let username = std::env::var("GEONAMES_USERNAME")
        .unwrap_or("demo".to_string());
    let client = Client::new();
    
    // 1. Search pour obtenir geoname_id
    let search_query = if let Some(country) = country_context {
        format!("{}, {}", place_name, country)
    } else {
        place_name.to_string()
    };
    
    let search_url = format!(
        "{}/searchJSON?name={}&maxRows=1&username={}",
        GEONAMES_BASE,
        urlencoding::encode(&search_query),
        username
    );
    
    let search_resp = client.get(&search_url).send().await?;
    let search_data: serde_json::Value = search_resp.json().await?;
    
    let geoname_id = search_data["geonames"][0]["geonameId"]
        .as_i64()
        .ok_or_else(|| AppError::Internal("GeoName ID non trouvé".into()))?;
    
    // 2. Récupérer hiérarchie (parents)
    let hierarchy_url = format!(
        "{}/hierarchyJSON?geonameId={}&username={}",
        GEONAMES_BASE, geoname_id, username
    );
    
    let hierarchy_resp = client.get(&hierarchy_url).send().await?;
    let hierarchy_data: serde_json::Value = hierarchy_resp.json().await?;
    
    let hierarchy: Vec<GeoNamePlace> = serde_json::from_value(
        hierarchy_data["geonames"].clone()
    )?;
    
    // 3. Récupérer enfants
    let children_url = format!(
        "{}/childrenJSON?geonameId={}&username={}",
        GEONAMES_BASE, geoname_id, username
    );
    
    let children_resp = client.get(&children_url).send().await?;
    let children_data: serde_json::Value = children_resp.json().await?;
    
    let children: Vec<GeoNamePlace> = serde_json::from_value(
        children_data["geonames"].clone()
    )?;
    
    // 4. Filtrer enfants selon profondeur max
    let valid_children: Vec<_> = children.into_iter()
        .filter(|c| {
            let level = admin_level_from_fcode(&c.fcode);
            level <= MAX_DEPTH && !is_excluded_fcode(&c.fcode)
        })
        .collect();
    
    let is_leaf = valid_children.is_empty();
    
    // 5. Construire vecteur : [Choix, Enfants..., Parents...]
    let mut vector = vec![place_name.to_string()];
    
    // Ajouter enfants
    for child in &valid_children {
        vector.push(child.name.clone());
    }
    
    // Ajouter parents (filtrés, min niveau 2 = pays)
    for parent in hierarchy.iter().rev() {
        let level = admin_level_from_fcode(&parent.fcode);
        if level >= 2 && level < 10 && !vector.contains(&parent.name) {
            vector.push(parent.name.clone());
        }
    }
    
    // 6. Sauvegarder dans geo_hierarchy
    let country_name = hierarchy.iter()
        .find(|p| p.fcode == "PCLI")
        .map(|p| p.name.as_str())
        .unwrap_or("");
    
    sqlx::query!(
        "INSERT INTO geo_hierarchy 
         (geoname_id, place_name, display_name, feature_code, admin_level, 
          is_leaf, parent_country, location_vector, lat, lng, population)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (geoname_id) DO UPDATE SET
            location_vector = $8,
            last_enriched_at = NOW(),
            times_used = geo_hierarchy.times_used + 1",
        geoname_id,
        place_name,
        format!("{}, {}", place_name, country_name),
        search_data["geonames"][0]["fcode"].as_str().unwrap(),
        admin_level_from_fcode(&search_data["geonames"][0]["fcode"].as_str().unwrap()),
        is_leaf,
        country_name,
        &vector,
        search_data["geonames"][0]["lat"].as_f64(),
        search_data["geonames"][0]["lng"].as_f64(),
        search_data["geonames"][0]["population"].as_i64().map(|p| p as i32)
    ).execute(pool).await?;
    
    Ok(vector)
}

fn admin_level_from_fcode(fcode: &str) -> i32 {
    match fcode {
        "CONT" => 1,
        "PCLI" => 2,
        "ADM1" => 3,
        "ADM2" => 4,
        "ADM3" => 5,
        "PPL" | "PPLA" | "PPLC" => 6,
        "PPLX" => 7,
        _ => 8
    }
}

fn is_excluded_fcode(fcode: &str) -> bool {
    matches!(fcode, "ROAD" | "STR" | "BLDG" | "ADDR")
}
```

---

## 🔍 ALGORITHME 2 : Recherche Vectorielle Multi-Filtres

### Endpoint : POST /api/autocomplete/search-combinations

```rust
// backend/src/controllers/autocomplete_controller.rs

use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Debug, Deserialize)]
pub struct SearchCombinationsRequest {
    pub filters: Vec<String>,  // ["Plastique", "Jaune", "Douala"]
    pub limit: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct CombinationResult {
    pub service_id: i32,
    pub product_vector: Vec<String>,
    pub location_vector: Vec<String>,
    pub full_vector: Vec<String>,
    pub chosen_location: String,
    pub usage_count: i32,
    pub has_variant: bool,
    pub variants: Option<Vec<PriceVariant>>,
    pub location_score: f32,
    pub popularity_score: f32,
    pub final_score: f32,
}

pub async fn search_combinations(
    State(pool): State<PgPool>,
    Json(request): Json<SearchCombinationsRequest>
) -> AppResult<Json<Vec<CombinationResult>>> {
    let filters = request.filters;
    let limit = request.limit.unwrap_or(20);
    
    // Construire WHERE clauses pour chaque filtre
    let mut where_parts = vec![];
    let mut params: Vec<String> = vec![];
    
    for (i, filter) in filters.iter().enumerate() {
        // Vérifier si c'est un lieu géographique
        let is_location = is_geographic_term(filter);
        
        if is_location {
            // Recherche géographique bidirectionnelle
            let location_variants = expand_location_search(&pool, filter).await?;
            
            // Clause : filtre OU ses parents OU ses enfants
            let placeholders: Vec<String> = location_variants.iter()
                .enumerate()
                .map(|(j, _)| format!("${}", params.len() + j + 1))
                .collect();
            
            where_parts.push(format!(
                "({} && location_vector)",  // Overlap operator
                format!("ARRAY[{}]::TEXT[]", placeholders.join(","))
            ));
            
            params.extend(location_variants);
        } else {
            // Recherche caractéristique normale
            params.push(filter.clone());
            where_parts.push(format!("${}::TEXT = ANY(full_vector)", params.len()));
        }
    }
    
    // Construire requête SQL
    let where_clause = if where_parts.is_empty() {
        "TRUE".to_string()
    } else {
        where_parts.join(" AND ")
    };
    
    let sql = format!(
        "SELECT 
            ac.service_id,
            ac.product_vector,
            ac.location_vector,
            ac.full_vector,
            ac.chosen_location,
            ac.usage_count,
            ac.has_variant,
            ac.variant_dimension,
            ac.variant_value,
            ac.prix,
            ac.devise,
            ac.stock,
            calculate_location_score($1, ac.location_vector, ac.chosen_location) as location_score,
            ac.usage_count::float as popularity_score
         FROM autocomplete_combinations ac
         WHERE {}
         ORDER BY 
            (calculate_location_score($1, ac.location_vector, ac.chosen_location) * 0.7 
             + (ac.usage_count::float / 100.0) * 0.3) DESC
         LIMIT ${}",
        where_clause,
        params.len() + 2
    );
    
    // Ajouter paramètres search_location (pour scoring) et limit
    let mut query = sqlx::query(&sql);
    query = query.bind(&filters[0]);  // 1er filtre pour scoring localisation
    for param in &params {
        query = query.bind(param);
    }
    query = query.bind(limit);
    
    let rows = query.fetch_all(&pool).await?;
    
    // Parser résultats...
    Ok(Json(results))
}

async fn expand_location_search(
    pool: &PgPool,
    location: &str
) -> AppResult<Vec<String>> {
    let geo = sqlx::query!(
        "SELECT location_vector FROM geo_hierarchy 
         WHERE place_name = $1",
        location
    ).fetch_optional(pool).await?;
    
    if let Some(geo) = geo {
        Ok(geo.location_vector)  // Retourne tout le vecteur (parents + enfants)
    } else {
        Ok(vec![location.to_string()])  // Pas enrichi encore
    }
}

// Fonction SQL helper
CREATE OR REPLACE FUNCTION calculate_location_score(
    search_location TEXT,
    location_vector TEXT[],
    chosen_location TEXT
) RETURNS FLOAT AS $$
DECLARE
    position INTEGER;
    score FLOAT;
BEGIN
    -- Match exact sur choix
    IF search_location = chosen_location THEN
        RETURN 100.0;
    END IF;
    
    -- Trouver position dans vecteur
    SELECT idx INTO position
    FROM unnest(location_vector) WITH ORDINALITY AS arr(val, idx)
    WHERE val = search_location
    LIMIT 1;
    
    IF position IS NULL THEN
        RETURN 0.0;
    END IF;
    
    -- Score selon position : plus proche = meilleur
    score := 100.0 / position;
    
    RETURN score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

---

## 💾 ALGORITHME 3 : Sauvegarde Produit avec Lieu

```rust
// backend/src/services/creer_service.rs

async fn save_product_complete(
    pool: &PgPool,
    service_id: i32,
    service_data: &Value
) -> AppResult<()> {
    // 1. Extraire vecteur produit
    let produits_field = service_data.get("produits")
        .ok_or_else(|| AppError::BadRequest("Champ produits manquant".into()))?;
    
    let product_combination = produits_field["valeur"][0]
        .as_str()
        .ok_or_else(|| AppError::BadRequest("Valeur produits invalide".into()))?;
    
    let product_vector: Vec<String> = product_combination
        .split(',')
        .map(|s| s.trim().to_string())
        .collect();
    
    // 2. Extraire lieu
    let lieu_field = service_data.get("lieu_produit")
        .or_else(|| service_data.get("localisation"))
        .or_else(|| service_data.get("ville"));
    
    let location_vector = if let Some(lieu) = lieu_field {
        let lieu_str = lieu["valeur"].as_str().unwrap_or("");
        let country = extract_country_from_lieu(lieu_str);  // "Douala, Cameroun" → "Cameroun"
        
        // Construire vecteur lieu avec GeoNames
        build_location_vector(pool, lieu_str, country.as_deref()).await?
    } else {
        vec![]  // Pas de lieu spécifié
    };
    
    // 3. Vecteur complet
    let mut full_vector = product_vector.clone();
    full_vector.extend(location_vector.clone());
    
    // 4. Gérer variations prix
    if let Some(variation) = produits_field.get("variation_prix") {
        let variant_dim = variation["variable"].as_str().unwrap();
        let modalites = variation["modalites"].as_array().unwrap();
        
        for modalite in modalites {
            let variant_value = modalite["valeur"].as_str().unwrap();
            let prix = modalite["prix"].as_f64().unwrap();
            let stock = modalite.get("stock").and_then(|s| s.as_i64()).unwrap_or(0);
            
            // Vecteur avec variation
            let mut variant_vector = full_vector.clone();
            
            // Insérer variation AVANT le lieu
            let insert_pos = product_vector.len();
            variant_vector.insert(insert_pos, variant_value.to_string());
            
            // Sauvegarder
            sqlx::query!(
                "INSERT INTO autocomplete_combinations 
                 (service_id, product_vector, location_vector, full_vector,
                  chosen_location, chosen_location_geoname_id,
                  has_variant, variant_dimension, variant_value, prix, stock, usage_count)
                 VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10, 1)
                 ON CONFLICT (service_id, full_vector)
                 DO UPDATE SET usage_count = usage_count + 1",
                service_id,
                &product_vector,
                &location_vector,
                &variant_vector,
                location_vector.first(),  // Lieu choisi = position 0
                get_geoname_id(pool, location_vector.first().unwrap()).await?,
                variant_dim,
                variant_value,
                prix as f64,
                stock as i32
            ).execute(pool).await?;
        }
    } else {
        // Pas de variation
        sqlx::query!(...).execute(pool).await?;
    }
    
    Ok(())
}

async fn build_location_vector(
    pool: &PgPool,
    chosen_place: &str,
    country_context: Option<&str>
) -> AppResult<Vec<String>> {
    // Chercher dans cache
    let cached = sqlx::query!(
        "SELECT location_vector FROM geo_hierarchy 
         WHERE place_name = $1 AND parent_country = $2",
        chosen_place,
        country_context.unwrap_or("")
    ).fetch_optional(pool).await?;
    
    if let Some(cached) = cached {
        return Ok(cached.location_vector);
    }
    
    // Pas en cache → Enrichir
    enrich_location_bidirectional(pool, chosen_place, country_context).await
}
```

---

## 🔍 ALGORITHME 4 : Recherche Progressive Frontend

```typescript
// mobile/src/screens/ResultatBesoinScreen.tsx (REFONTE)

const ResultatBesoinScreen = () => {
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<CombinationSuggestion[]>([]);
  const [results, setResults] = useState<Product[]>([]);
  
  // Recherche progressive autocomplete
  useEffect(() => {
    const debounce = setTimeout(async () => {
      if (searchText.trim()) {
        const words = searchText.split(' ').filter(w => w.trim());
        setFilters(words);
        
        // Appeler backend
        const response = await apiPost('/api/autocomplete/search-combinations', {
          filters: words,
          limit: 10
        });
        
        setSuggestions(response.data || []);
      } else {
        setSuggestions([]);
      }
    }, 300);
    
    return () => clearTimeout(debounce);
  }, [searchText]);
  
  const selectSuggestion = (suggestion: CombinationSuggestion) => {
    // Mettre vecteur complet dans barre recherche
    setSearchText(suggestion.full_vector.join(', '));
    setFilters(suggestion.full_vector);
    
    // Lancer recherche finale
    searchFinal(suggestion.full_vector);
  };
  
  const searchFinal = async (finalFilters: string[]) => {
    // Recherche dans services avec ces filtres
    const response = await apiPost('/api/search/by-autocomplete', {
      combination_vector: finalFilters
    });
    
    setResults(response.data || []);
  };
  
  return (
    <View>
      {/* Barre recherche */}
      <TextInput
        value={searchText}
        onChangeText={setSearchText}
        placeholder="Rechercher produit..."
      />
      
      {/* Suggestions vecteurs */}
      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          <Text>💡 Suggestions de produits complets :</Text>
          {suggestions.map((sug, i) => (
            <TouchableOpacity 
              key={i}
              onPress={() => selectSuggestion(sug)}
            >
              <View style={styles.suggestionCard}>
                <View style={styles.vectorChips}>
                  {sug.product_vector.map(v => (
                    <Chip key={v}>{v}</Chip>
                  ))}
                </View>
                <View style={styles.locationChips}>
                  📍 {sug.location_vector[0]}  {/* Lieu choisi */}
                </View>
                <Text style={styles.stats}>
                  📊 {sug.usage_count} fois · 
                  {sug.has_variant && ` ${sug.variants.length} variations`}
                </Text>
                <Button>Sélectionner ce produit</Button>
              </View>
            </TouchableOpacity>
          ))}
          
          <Button onPress={() => searchFinal(filters)}>
            🔍 Rechercher sans suggestion
          </Button>
        </View>
      )}
      
      {/* Résultats */}
      <FlatList
        data={results}
        renderItem={({item}) => <ProductCard product={item} />}
      />
    </View>
  );
};
```

---

## 🎨 ALGORITHME 5 : ProductCard avec Variations

```typescript
// mobile/src/components/ProductCard.tsx (REFONTE)

interface Product {
  service_id: number;
  nom: string;
  product_vector: string[];
  location_vector: string[];
  chosen_location: string;
  distance_km?: number;
  prestataire: {
    nom: string;
    avatar_url?: string;
    user_id: number;
  };
  has_variant: boolean;
  variants?: Array<{
    value: string;
    prix: number;
    devise: string;
    stock: number;
  }>;
  prix?: number;
  devise?: string;
}

const ProductCard: React.FC<{product: Product}> = ({product}) => {
  return (
    <NativeCard>
      {/* Header */}
      <View style={styles.header}>
        <Image source={{uri: product.image}} style={styles.image} />
        <View style={styles.headerInfo}>
          <Text style={styles.productName}>{product.nom}</Text>
          
          {/* Prestataire */}
          <TouchableOpacity onPress={() => navigation.navigate('ProfilePrestataire', {userId: product.prestataire.user_id})}>
            <View style={styles.prestataire}>
              <Avatar source={product.prestataire.avatar_url} size={24} />
              <Text>{product.prestataire.nom}</Text>
            </View>
          </TouchableOpacity>
          
          {/* Localisation */}
          <View style={styles.location}>
            <SafeIcon name="map-pin" size={14} />
            <Text>{product.chosen_location}</Text>
            {product.distance_km && (
              <Text style={styles.distance}>· {product.distance_km}km</Text>
            )}
          </View>
        </View>
      </View>
      
      {/* Caractéristiques (vecteur produit) */}
      <View style={styles.characteristics}>
        <Text style={styles.sectionTitle}>Caractéristiques :</Text>
        <View style={styles.chips}>
          {product.product_vector.map((carac, i) => (
            <View key={i} style={styles.chip}>
              <Text style={styles.chipText}>{carac}</Text>
            </View>
          ))}
        </View>
      </View>
      
      {/* Prix */}
      {product.has_variant ? (
        <View style={styles.priceVariations}>
          <Text style={styles.sectionTitle}>
            Prix selon {product.variants[0]?.dimension || 'variante'} :
          </Text>
          <View style={styles.priceTable}>
            {product.variants.map((v, i) => (
              <View key={i} style={styles.priceRow}>
                <Text style={styles.variantValue}>{v.value}</Text>
                <Text style={styles.variantPrice}>
                  {v.prix.toLocaleString()} {v.devise}
                </Text>
                <View style={[styles.stockBadge, v.stock > 5 ? styles.stockOK : styles.stockLow]}>
                  <Text>{v.stock > 0 ? `${v.stock} dispo` : 'Épuisé'}</Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={styles.priceFrom}>
            À partir de {Math.min(...product.variants.map(v => v.prix)).toLocaleString()} {product.devise}
          </Text>
        </View>
      ) : (
        <View style={styles.priceUnique}>
          <Text style={styles.price}>
            {product.prix?.toLocaleString()} {product.devise}
          </Text>
        </View>
      )}
      
      {/* Actions */}
      <View style={styles.actions}>
        <NativeButton
          variant="primary"
          onPress={() => openChat(product.prestataire.user_id)}
        >
          💬 Contacter
        </NativeButton>
        <NativeButton
          variant="secondary"
          onPress={() => navigation.navigate('ServiceDetail', {serviceId: product.service_id})}
        >
          👁️ Détails
        </NativeButton>
      </View>
    </NativeCard>
  );
};
```

---

SUITE DANS : `PROMPT_IMPLEMENTATION_COMPLET.md`


