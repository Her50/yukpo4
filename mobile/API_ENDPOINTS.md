# API Endpoints pour Yukpomnang Mobile

## Endpoints à créer dans votre backend Rust

### 1. API Météo
```rust
// GET /weather
// Paramètres: lat, lon, units, lang
// Retourne: données météo OpenWeatherMap
```

**Exemple de réponse :**
```json
{
  "main": {
    "temp": 22.5,
    "humidity": 65
  },
  "weather": [{
    "description": "partiellement nuageux",
    "icon": "02d"
  }],
  "wind": {
    "speed": 3.2
  },
  "name": "Paris",
  "sys": {
    "country": "FR"
  }
}
```

### 2. API Services à proximité
```rust
// GET /services/nearby
// Paramètres: latitude, longitude, radius, limit
// Retourne: liste des services à proximité
```

**Exemple de réponse :**
```json
{
  "services": [
    {
      "id": "1",
      "name": "Restaurant Le Bistrot",
      "description": "Cuisine française traditionnelle",
      "category": "Restaurant",
      "distance": 250,
      "rating": 4.5,
      "price": "€€",
      "latitude": 48.8566,
      "longitude": 2.3522,
      "address": "123 Rue de la Paix, Paris",
      "phone": "+33 1 23 45 67 89",
      "website": "https://lebistrot.fr"
    }
  ]
}
```

### 3. API IA - Chat
```rust
// POST /ai/chat
// Body: { message, context, type }
// Retourne: réponse IA
```

**Exemple de requête :**
```json
{
  "message": "Où puis-je trouver un bon restaurant ?",
  "context": {
    "location": "Paris",
    "preferences": ["cuisine française"]
  },
  "type": "question"
}
```

**Exemple de réponse :**
```json
{
  "message": "Je vous recommande Le Bistrot, un excellent restaurant français à 250m de votre position.",
  "suggestions": [
    "Voir le menu",
    "Réserver une table",
    "Obtenir l'itinéraire"
  ],
  "confidence": 0.9
}
```

### 4. API IA - Recommandations
```rust
// POST /ai/recommendations
// Body: { preferences, type }
// Retourne: recommandations personnalisées
```

### 5. API IA - Analyse de texte
```rust
// POST /ai/analyze
// Body: { text, type }
// Retourne: analyse sentiment et mots-clés
```

## Configuration des APIs externes

### OpenWeatherMap
1. Créer un compte sur https://openweathermap.org/api
2. Obtenir une clé API gratuite
3. Ajouter la clé dans vos variables d'environnement

### Services IA
1. **OpenAI API** : https://platform.openai.com/api-keys
2. **Google AI** : https://ai.google.dev/
3. **Azure OpenAI** : https://azure.microsoft.com/en-us/products/ai-services/openai-service

## Variables d'environnement nécessaires

```env
# Backend (.env)
OPENWEATHER_API_KEY=your_openweather_api_key
OPENAI_API_KEY=your_openai_api_key
DATABASE_URL=postgresql://user:password@localhost/yukpomnang

# Mobile (app.json)
EXPO_PUBLIC_API_URL=https://yukpomnang.onrender.com
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

## Implémentation dans le backend Rust

### 1. Ajouter les dépendances dans Cargo.toml
```toml
[dependencies]
reqwest = { version = "0.11", features = ["json"] }
tokio = { version = "1.0", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

### 2. Créer les handlers
```rust
// src/handlers/weather.rs
pub async fn get_weather(
    Query(params): Query<WeatherParams>,
    State(app_state): State<AppState>,
) -> Result<Json<WeatherResponse>, AppError> {
    // Implémentation de l'API météo
}

// src/handlers/services.rs  
pub async fn get_nearby_services(
    Query(params): Query<ServicesParams>,
    State(app_state): State<AppState>,
) -> Result<Json<ServicesResponse>, AppError> {
    // Implémentation des services à proximité
}

// src/handlers/ai.rs
pub async fn chat_ai(
    Json(payload): Json<ChatRequest>,
    State(app_state): State<AppState>,
) -> Result<Json<ChatResponse>, AppError> {
    // Implémentation de l'IA
}
```

### 3. Ajouter les routes
```rust
// src/main.rs
app.route("/weather", get(weather::get_weather))
   .route("/services/nearby", get(services::get_nearby_services))
   .route("/ai/chat", post(ai::chat_ai))
   .route("/ai/recommendations", post(ai::get_recommendations))
   .route("/ai/analyze", post(ai::analyze_text));
```

