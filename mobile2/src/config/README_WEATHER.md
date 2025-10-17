# Configuration de l'API Météo

## Vue d'ensemble

Le système météo de Yukpomnang utilise l'API OpenWeatherMap pour fournir des prévisions météo détaillées. Il supporte deux types d'APIs :

1. **API Forecast (Gratuite)** : Prévisions jusqu'à 5 jours
2. **API One Call 3.0 (Payante)** : Prévisions jusqu'à 16 jours

## Configuration

### 1. Obtenir une clé API OpenWeatherMap

1. Rendez-vous sur [OpenWeatherMap](https://openweathermap.org/api)
2. Créez un compte gratuit
3. Générez une clé API dans votre tableau de bord
4. Pour les prévisions 16 jours, vous devrez passer à un plan payant

### 2. Configurer la clé API

Puisque vous avez déjà `OPENWEATHER_API_KEY` dans votre backend, l'app mobile récupère automatiquement cette clé via un endpoint.

#### Option A : Créer un endpoint backend (Recommandé)
Ajoutez cette route dans votre backend Rust :

```rust
// Route pour exposer la configuration météo
pub async fn get_weather_config() -> Result<Json<Value>, StatusCode> {
    let api_key = std::env::var("OPENWEATHER_API_KEY")
        .unwrap_or_else(|_| "YOUR_OPENWEATHER_API_KEY".to_string());
    
    Ok(Json(json!({
        "apiKey": api_key,
        "status": "success"
    })))
}

// Ajoutez à votre router : router.route("/api/weather/config", get(get_weather_config))
```

#### Option B : Utiliser la même clé directement
Créez un fichier `.env` dans le dossier `mobile/` :

```bash
# mobile/.env
EXPO_PUBLIC_OPENWEATHER_API_KEY=votre_cle_api_ici
```

#### Option C : Modifier directement le code
Modifiez le fichier `mobile/src/config/weatherConfig.ts` :

```typescript
export const WEATHER_CONFIG = {
    // Remplacez par votre clé API (même que OPENWEATHER_API_KEY du backend)
    API_KEY: 'votre_cle_api_ici',
    // ... reste de la configuration
};
```

### 3. Types d'abonnements OpenWeatherMap

| Plan | Prévisions | Prix | Limite d'appels |
|------|------------|------|-----------------|
| Free | 5 jours | Gratuit | 1000/jour |
| Startup | 16 jours | $40/mois | 100,000/mois |
| Developer | 16 jours | $150/mois | 1,000,000/mois |
| Professional | 16 jours | $400/mois | 5,000,000/mois |

## Fonctionnalités

### Prévisions disponibles

- **5 jours** : API gratuite, données toutes les 3 heures
- **7 jours** : API payante, données quotidiennes
- **10 jours** : API payante, données quotidiennes
- **16 jours** : API payante, données quotidiennes

### Données météo

Pour chaque jour, vous obtenez :
- Température min/max
- Description météo
- Icône météo
- Humidité
- Vitesse du vent
- Précipitations

### Interface utilisateur

- **Widget compact** : Affichage de la météo actuelle
- **Modal détaillé** : Prévisions sur plusieurs jours
- **Sélecteur de période** : Choix entre 5, 7, 10 ou 16 jours
- **Données mockées** : Fallback en cas d'erreur API

## Utilisation

### Dans le code

```typescript
import { WeatherForecastModal } from '../components/WeatherForecastModal';

// Ouvrir le modal avec 7 jours de prévisions
<WeatherForecastModal
    visible={showModal}
    onClose={() => setShowModal(false)}
    location={{ lat: 3.848, lng: 11.502 }} // Yaoundé
    days={7}
/>
```

### Configuration avancée

Vous pouvez personnaliser les données mockées dans `weatherConfig.ts` :

```typescript
MOCK_DATA: {
    descriptions: ['Ensoleillé', 'Nuageux', 'Pluvieux'],
    icons: ['☀️', '☁️', '🌧️'],
    temperatureRange: { min: 20, max: 30 },
    // ...
}
```

## Gestion des erreurs

Le système gère automatiquement :
- **API non configurée** : Utilise les données mockées
- **Erreur réseau** : Fallback vers les données mockées
- **Limite d'appels dépassée** : Message d'erreur explicite
- **Position GPS manquante** : Demande d'activation du GPS

## Sécurité

⚠️ **Important** : Ne commitez jamais votre clé API dans le code source. Utilisez des variables d'environnement :

```typescript
// Dans weatherConfig.ts (déjà configuré)
API_KEY: process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY || 'YOUR_OPENWEATHER_API_KEY',
```

Puis dans votre fichier `mobile/.env` :
```
EXPO_PUBLIC_OPENWEATHER_API_KEY=votre_cle_api_ici
```

### Configuration rapide

Si vous avez déjà `OPENWEATHER_API_KEY` dans votre backend, copiez simplement la même valeur :

1. Créez `mobile/.env`
2. Ajoutez : `EXPO_PUBLIC_OPENWEATHER_API_KEY=votre_cle_existante`
3. Redémarrez l'app

## Support

Pour toute question sur l'API OpenWeatherMap :
- [Documentation officielle](https://openweathermap.org/api)
- [Support OpenWeatherMap](https://openweathermap.org/support)
- [Forum communautaire](https://openweathermap.org/forum)
