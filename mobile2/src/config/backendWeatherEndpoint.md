# Endpoint Backend pour l'API Météo

## Route à ajouter dans votre backend

Ajoutez cette route dans votre backend Rust pour exposer la clé API météo :

```rust
// Dans votre fichier de routes (ex: src/routes/weather.rs ou src/main.rs)

use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
};
use serde_json::{json, Value};

// Structure pour la réponse
#[derive(serde::Serialize)]
struct WeatherConfigResponse {
    api_key: String,
}

// Route pour exposer la configuration météo
pub async fn get_weather_config(
    State(state): State<AppState>, // Votre état d'application
) -> Result<Json<Value>, StatusCode> {
    let api_key = std::env::var("OPENWEATHER_API_KEY")
        .unwrap_or_else(|_| "YOUR_OPENWEATHER_API_KEY".to_string());
    
    Ok(Json(json!({
        "apiKey": api_key,
        "status": "success"
    })))
}

// Ajoutez cette route à votre router
// router.route("/api/weather/config", get(get_weather_config))
```

## Alternative simple (si vous préférez)

Si vous ne voulez pas créer un endpoint, vous pouvez aussi :

1. **Copier la clé directement** dans le fichier `mobile/src/config/weatherConfig.ts`
2. **Utiliser une variable d'environnement** dans le mobile

## Configuration dans votre backend

Assurez-vous que votre variable d'environnement est bien définie :

```bash
# Dans votre .env du backend
OPENWEATHER_API_KEY=votre_cle_api_openweathermap
```

## Test de l'endpoint

Une fois l'endpoint créé, vous pouvez le tester :

```bash
curl http://localhost:3000/api/weather/config
```

Réponse attendue :
```json
{
  "apiKey": "votre_cle_api_ici",
  "status": "success"
}
```

## Sécurité

⚠️ **Note de sécurité** : Cet endpoint expose votre clé API. En production, vous pourriez vouloir :
- Ajouter une authentification
- Limiter l'accès à votre app mobile uniquement
- Utiliser un proxy ou un middleware de sécurité

