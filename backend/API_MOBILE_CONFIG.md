# Configuration des APIs Mobile

## Variables d'environnement à ajouter dans votre .env

```env
# OpenWeatherMap API pour la météo
OPENWEATHER_API_KEY=your-openweather-api-key-here
```

## Comment obtenir la clé OpenWeatherMap

1. Allez sur https://openweathermap.org/api
2. Créez un compte gratuit
3. Obtenez votre clé API
4. Ajoutez-la dans votre fichier .env

## Endpoints créés

### 1. API Météo
- **GET** `/weather?lat={latitude}&lon={longitude}&units=metric&lang=fr`
- Utilise OpenWeatherMap API
- Retourne les données météo en temps réel

### 2. API Services à proximité
- **GET** `/services/nearby?latitude={lat}&longitude={lon}&radius={radius}&limit={limit}`
- Utilise votre base de données PostgreSQL existante
- Recherche GPS avec ST_DWithin
- Retourne les services à proximité triés par distance

### 3. API IA Chat
- **POST** `/ai/chat` - Chat avec OpenAI
- **POST** `/ai/recommendations` - Recommandations personnalisées
- **POST** `/ai/analyze` - Analyse de sentiment et mots-clés

## Test des endpoints

```bash
# Test météo
curl "http://localhost:3000/weather?lat=48.8566&lon=2.3522"

# Test services à proximité
curl "http://localhost:3000/services/nearby?latitude=48.8566&longitude=2.3522&radius=5000&limit=10"

# Test chat IA
curl -X POST "http://localhost:3000/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "Bonjour", "type": "question"}'
```

## Compilation du backend

```bash
cd backend
cargo build
cargo run
```

Les nouvelles routes sont maintenant intégrées dans votre backend !

