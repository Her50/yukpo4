# Plan d'Action : Finalisation Intégration IA Delivery

## 🎯 Objectif
Finaliser l'intégration des prompts ETA et Forecasting dans les services de livraison pour passer de 6/10 à 9-10/10.

## ✅ Système IA Existant à Exploiter

**Yukpo dispose déjà d'un système IA complet :**
- ✅ `AppIA` : Service principal avec méthode `predict(prompt: &str) -> (model_name, response, tokens)`
- ✅ Support multi-modèles : GPT-4, Claude 3.5, Gemini Pro
- ✅ Gestion automatique des timeouts, retries, fallbacks
- ✅ Accessible via `state.ia` ou `state.app_ia` dans les contrôleurs
- ✅ Pattern déjà utilisé : `DeliveryAIRecommendationsService` avec `with_ia()`

**Il suffit d'utiliser ce système existant, pas besoin de créer un nouveau !**

---

## 📋 Tâches Immédiates

### Tâche 1 : Vérifier l'état actuel des fichiers

#### 1.1 Vérifier les fichiers existants
```bash
# Vérifier les prompts
cat backend/src/services/delivery_ai_prompts.rs

# Vérifier les services
ls -la backend/src/services/delivery_*service.rs
ls -la backend/src/services/delivery_*recommendations.rs

# Vérifier les contrôleurs
ls -la backend/src/controllers/*delivery*.rs
```

#### 1.2 Identifier les services à créer/modifier
- [ ] `delivery_eta_service.rs` existe-t-il ?
- [ ] `delivery_forecasting_service.rs` existe-t-il ?
- [ ] Où sont actuellement calculés les ETA et prévisions ?

---

### Tâche 2 : Intégrer ETA Prediction avec IA

#### 2.1 Créer/Modifier `delivery_eta_service.rs`

**Structure du service (en suivant le pattern existant de `DeliveryAIRecommendationsService`) :**
```rust
use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use crate::services::delivery_ai_prompts::ETA_PREDICTION_PROMPT;
use sqlx::PgPool;
use serde_json::Value;
use std::sync::Arc;

pub struct DeliveryETAService {
    app_ia: Option<Arc<AppIA>>, // Option comme dans DeliveryAIRecommendationsService
    db: Arc<PgPool>,
}

impl DeliveryETAService {
    pub fn new(db: Arc<PgPool>) -> Self {
        Self {
            app_ia: None,
            db,
        }
    }

    // Pattern avec_ia() comme dans DeliveryAIRecommendationsService
    pub fn with_ia(mut self, app_ia: Arc<AppIA>) -> Self {
        self.app_ia = Some(app_ia);
        self
    }

    /// Prédit l'ETA en utilisant l'IA avec historique
    pub async fn predict_eta_with_ai(
        &self,
        delivery_request_id: i32,
        origin: &Location,
        destination: &Location,
    ) -> AppResult<EstimatedTime> {
        // 1. Récupérer l'historique depuis la DB
        let historical_data = self.get_historical_deliveries(
            origin,
            destination,
            30, // 30 derniers jours
        ).await?;

        // 2. Calculer la distance
        let distance = self.calculate_distance(origin, destination);

        // 3. Préparer le prompt avec contexte
        let prompt = self.build_eta_prompt(
            &historical_data,
            distance,
            origin,
            destination,
        );

        // 4. Appeler l'IA (utiliser le système existant)
        let app_ia = self.app_ia.as_ref()
            .ok_or("Service IA non initialisé. Utiliser with_ia()")?;
        
        let (model_name, response, tokens) = app_ia.predict(&prompt).await?;
        log::info!("[DeliveryETAService] Prédiction ETA avec {} ({} tokens)", model_name, tokens);

        // 5. Parser la réponse
        let eta = self.parse_eta_response(response)?;

        // 6. Retourner avec fallback si nécessaire
        Ok(eta)
    }

    /// Fallback : formule basique si l'IA échoue
    fn calculate_basic_eta(&self, distance: f64) -> EstimatedTime {
        let avg_speed_kmh = 30.0; // Vitesse moyenne en ville
        let time_hours = distance / avg_speed_kmh;
        EstimatedTime::from_hours(time_hours)
    }

    /// Construit le prompt pour l'IA
    fn build_eta_prompt(
        &self,
        historical: &[DeliveryHistory],
        distance: f64,
        origin: &Location,
        destination: &Location,
    ) -> String {
        format!(
            "{}\n\nCONTEXTE DE LA LIVRAISON:\n\
            - Distance: {:.2} km\n\
            - Origine: {}, {}\n\
            - Destination: {}, {}\n\
            - Nombre de livraisons similaires: {}\n\n\
            HISTORIQUE DES LIVRAISONS SIMILAIRES:\n\
            {}\n\n\
            Prédit l'ETA en minutes avec une justification.",
            ETA_PREDICTION_PROMPT,
            distance,
            origin.lat, origin.lng,
            destination.lat, destination.lng,
            historical.len(),
            self.format_historical_data(historical)
        )
    }

    /// Récupère l'historique depuis la DB
    async fn get_historical_deliveries(
        &self,
        origin: &Location,
        destination: &Location,
        days: i32,
    ) -> AppResult<Vec<DeliveryHistory>> {
        // Requête SQL pour récupérer les livraisons similaires
        // (à implémenter selon le schéma DB)
        todo!()
    }
}
```

#### 2.2 Intégrer dans le contrôleur

**Modifier `delivery_controller.rs` (en suivant le pattern de `delivery_optimization_routes.rs`) :**
```rust
// Remplacer les appels à calculate_basic_eta() par :
let mut eta_service = DeliveryETAService::new(state.pg.clone())
    .with_ia(state.ia.clone()); // Utiliser state.ia comme dans delivery_optimization_routes.rs

match eta_service.predict_eta_with_ai(
    delivery_request_id,
    &origin,
    &destination,
).await {
    Ok(eta) => eta,
    Err(e) => {
        log::warn!("Erreur prédiction ETA IA, fallback: {}", e);
        eta_service.calculate_basic_eta(distance)
    }
}
```

---

### Tâche 3 : Intégrer Demand Forecasting avec IA

#### 3.1 Créer/Modifier `delivery_forecasting_service.rs`

**Structure du service (même pattern que ETA) :**
```rust
use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use crate::services::delivery_ai_prompts::DEMAND_FORECASTING_PROMPT;
use sqlx::PgPool;
use std::sync::Arc;

pub struct DeliveryForecastingService {
    app_ia: Option<Arc<AppIA>>, // Option comme dans DeliveryAIRecommendationsService
    db: Arc<PgPool>,
}

impl DeliveryForecastingService {
    pub fn new(db: Arc<PgPool>) -> Self {
        Self {
            app_ia: None,
            db,
        }
    }

    // Pattern with_ia() comme dans DeliveryAIRecommendationsService
    pub fn with_ia(mut self, app_ia: Arc<AppIA>) -> Self {
        self.app_ia = Some(app_ia);
        self
    }

    /// Prédit la demande en utilisant l'IA avec historique
    pub async fn forecast_demand_with_ai(
        &self,
        product_id: i32,
        location: &Location,
        time_period: TimePeriod,
    ) -> AppResult<DemandForecast> {
        // 1. Récupérer l'historique des ventes
        let sales_history = self.get_sales_history(
            product_id,
            location,
            time_period.get_historical_days(),
        ).await?;

        // 2. Préparer le prompt avec contexte
        let prompt = self.build_forecasting_prompt(
            &sales_history,
            product_id,
            location,
            time_period,
        );

        // 3. Appeler l'IA (utiliser le système existant)
        let app_ia = self.app_ia.as_ref()
            .ok_or("Service IA non initialisé. Utiliser with_ia()")?;
        
        let (model_name, response, tokens) = app_ia.predict(&prompt).await?;
        log::info!("[DeliveryForecastingService] Prévision avec {} ({} tokens)", model_name, tokens);

        // 4. Parser la réponse
        let forecast = self.parse_forecast_response(response)?;

        // 5. Retourner avec fallback si nécessaire
        Ok(forecast)
    }

    /// Fallback : moyenne basique si l'IA échoue
    fn calculate_basic_forecast(&self, sales: &[SalesData]) -> DemandForecast {
        let avg = sales.iter()
            .map(|s| s.quantity)
            .sum::<f64>() / sales.len() as f64;
        DemandForecast {
            predicted_quantity: avg,
            confidence: 0.5,
        }
    }

    /// Construit le prompt pour l'IA
    fn build_forecasting_prompt(
        &self,
        sales_history: &[SalesData],
        product_id: i32,
        location: &Location,
        time_period: TimePeriod,
    ) -> String {
        format!(
            "{}\n\nCONTEXTE DE LA PRÉVISION:\n\
            - Produit ID: {}\n\
            - Localisation: {}, {}\n\
            - Période: {:?}\n\
            - Nombre de points de données: {}\n\n\
            HISTORIQUE DES VENTES:\n\
            {}\n\n\
            Prédit la demande avec une justification et un niveau de confiance.",
            DEMAND_FORECASTING_PROMPT,
            product_id,
            location.lat, location.lng,
            time_period,
            sales_history.len(),
            self.format_sales_data(sales_history)
        )
    }

    /// Récupère l'historique des ventes depuis la DB
    async fn get_sales_history(
        &self,
        product_id: i32,
        location: &Location,
        days: i32,
    ) -> AppResult<Vec<SalesData>> {
        // Requête SQL pour récupérer les ventes historiques
        // (à implémenter selon le schéma DB)
        todo!()
    }
}
```

#### 3.2 Intégrer dans le contrôleur

**Modifier `delivery_controller.rs` (même pattern que ETA) :**
```rust
// Remplacer les appels à calculate_basic_forecast() par :
let mut forecasting_service = DeliveryForecastingService::new(state.pg.clone())
    .with_ia(state.ia.clone()); // Utiliser state.ia comme dans delivery_optimization_routes.rs

match forecasting_service.forecast_demand_with_ai(
    product_id,
    &location,
    time_period,
).await {
    Ok(forecast) => forecast,
    Err(e) => {
        log::warn!("Erreur prévision IA, fallback: {}", e);
        forecasting_service.calculate_basic_forecast(&sales_history)
    }
}
```

---

## 🔧 Implémentation Technique

### Étape 1 : Préparer les structures de données

**Créer/modifier `backend/src/models/delivery_models.rs` :**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub lat: f64,
    pub lng: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EstimatedTime {
    pub minutes: i32,
    pub confidence: f64,
    pub method: String, // "ai" ou "basic"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryHistory {
    pub delivery_id: i32,
    pub origin: Location,
    pub destination: Location,
    pub distance_km: f64,
    pub actual_duration_minutes: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DemandForecast {
    pub predicted_quantity: f64,
    pub confidence: f64,
    pub method: String, // "ai" ou "basic"
    pub time_period: TimePeriod,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TimePeriod {
    NextDay,
    NextWeek,
    NextMonth,
}

impl TimePeriod {
    pub fn get_historical_days(&self) -> i32 {
        match self {
            TimePeriod::NextDay => 30,
            TimePeriod::NextWeek => 60,
            TimePeriod::NextMonth => 90,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SalesData {
    pub date: chrono::DateTime<chrono::Utc>,
    pub quantity: f64,
    pub location: Location,
}
```

### Étape 2 : Implémenter les requêtes SQL

**Pour ETA :**
```sql
SELECT 
    id,
    origin_lat, origin_lng,
    destination_lat, destination_lng,
    distance_km,
    EXTRACT(EPOCH FROM (completed_at - created_at)) / 60 as duration_minutes,
    created_at
FROM delivery_requests
WHERE 
    status = 'completed'
    AND created_at >= NOW() - INTERVAL '30 days'
    AND (
        (origin_lat BETWEEN $1 - 0.01 AND $1 + 0.01)
        AND (origin_lng BETWEEN $2 - 0.01 AND $2 + 0.01)
    )
    AND (
        (destination_lat BETWEEN $3 - 0.01 AND $3 + 0.01)
        AND (destination_lng BETWEEN $4 - 0.01 AND $4 + 0.01)
    )
ORDER BY created_at DESC
LIMIT 50;
```

**Pour Forecasting :**
```sql
SELECT 
    date_trunc('day', created_at) as date,
    SUM(quantity) as quantity,
    AVG(location_lat) as lat,
    AVG(location_lng) as lng
FROM delivery_requests
WHERE 
    product_id = $1
    AND status = 'completed'
    AND created_at >= NOW() - INTERVAL '90 days'
    AND (
        (location_lat BETWEEN $2 - 0.05 AND $2 + 0.05)
        AND (location_lng BETWEEN $3 - 0.05 AND $3 + 0.05)
    )
GROUP BY date_trunc('day', created_at)
ORDER BY date DESC;
```

### Étape 3 : Parser les réponses IA

**Pour ETA :**
```rust
fn parse_eta_response(&self, response: String) -> AppResult<EstimatedTime> {
    let cleaned = response
        .replace("```json", "")
        .replace("```", "")
        .trim()
        .to_string();
    
    let json: Value = serde_json::from_str(&cleaned)?;
    
    Ok(EstimatedTime {
        minutes: json["eta_minutes"]
            .as_i64()
            .ok_or("Invalid ETA response")? as i32,
        confidence: json["confidence"]
            .as_f64()
            .unwrap_or(0.7),
        method: "ai".to_string(),
    })
}
```

**Pour Forecasting :**
```rust
fn parse_forecast_response(&self, response: String) -> AppResult<DemandForecast> {
    let cleaned = response
        .replace("```json", "")
        .replace("```", "")
        .trim()
        .to_string();
    
    let json: Value = serde_json::from_str(&cleaned)?;
    
    Ok(DemandForecast {
        predicted_quantity: json["predicted_quantity"]
            .as_f64()
            .ok_or("Invalid forecast response")?,
        confidence: json["confidence"]
            .as_f64()
            .unwrap_or(0.7),
        method: "ai".to_string(),
        time_period: TimePeriod::NextWeek, // À adapter
    })
}
```

---

## ✅ Checklist d'Implémentation

### Phase 1 : Préparation
- [ ] Vérifier l'existence des fichiers `delivery_ai_prompts.rs`
- [ ] Vérifier l'existence de `delivery_ai_recommendations.rs`
- [ ] Identifier où sont calculés actuellement ETA et Forecasting
- [ ] Vérifier le schéma de la base de données

### Phase 2 : ETA Prediction
- [ ] Créer/modifier `delivery_eta_service.rs`
- [ ] Implémenter `predict_eta_with_ai()`
- [ ] Implémenter `get_historical_deliveries()`
- [ ] Implémenter `build_eta_prompt()`
- [ ] Implémenter `parse_eta_response()`
- [ ] Ajouter fallback `calculate_basic_eta()`
- [ ] Intégrer dans le contrôleur
- [ ] Tests unitaires
- [ ] Tests d'intégration

### Phase 3 : Demand Forecasting
- [ ] Créer/modifier `delivery_forecasting_service.rs`
- [ ] Implémenter `forecast_demand_with_ai()`
- [ ] Implémenter `get_sales_history()`
- [ ] Implémenter `build_forecasting_prompt()`
- [ ] Implémenter `parse_forecast_response()`
- [ ] Ajouter fallback `calculate_basic_forecast()`
- [ ] Intégrer dans le contrôleur
- [ ] Tests unitaires
- [ ] Tests d'intégration

### Phase 4 : Validation
- [ ] `cargo build` sans erreurs
- [ ] `cargo test` tous les tests passent
- [ ] `cargo clippy` sans warnings critiques
- [ ] Tests avec données réelles
- [ ] Vérifier les coûts IA
- [ ] Documentation mise à jour

---

## 🚀 Commandes de Test

```bash
# Compilation
cargo build

# Tests
cargo test delivery_eta_service
cargo test delivery_forecasting_service

# Linting
cargo clippy -- -D warnings

# Formatage
cargo fmt
```

---

## 📊 Métriques de Succès

### Avant (État Actuel)
- ML ETA : 5/10 (formules simples)
- Demand Forecasting : 4/10 (moyennes basiques)
- Score Global : 6/10

### Après (Objectif)
- ML ETA : 8-9/10 (IA + historique)
- Demand Forecasting : 8-9/10 (IA + historique)
- Score Global : 9-10/10

### Indicateurs
- ✅ Taux de succès des prédictions IA > 80%
- ✅ Réduction des erreurs ETA de 30%+
- ✅ Amélioration précision prévisions de 40%+
- ✅ Coûts IA maîtrisés (< 5% du budget)

---

## 🎯 Prochaines Étapes

1. **Immédiat** : Vérifier l'état actuel des fichiers
2. **Court terme** : Implémenter l'intégration ETA (1-2 jours)
3. **Court terme** : Implémenter l'intégration Forecasting (1-2 jours)
4. **Moyen terme** : Améliorer les algorithmes ML (1 semaine)
5. **Long terme** : Optimiser performances et coûts (2 semaines)

