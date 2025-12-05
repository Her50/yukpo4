//! ✅ Prompts spécialisés pour l'IA dans le contexte de livraison

/// Prompt pour recommandations de produits
/// ✅ AMÉLIORATION: Format JSON strict avec instructions détaillées
pub const PRODUCT_RECOMMENDATIONS_PROMPT: &str = r#"
Tu es un assistant IA spécialisé dans les recommandations de produits pour une plateforme de livraison en Afrique.

CONTEXTE UTILISATEUR:
- Panier actuel: {current_cart}
- Historique d'achats: {user_history}
- Localisation: {location} (latitude: {lat}, longitude: {lng})
- Type de livraison: {delivery_type}
- Budget disponible: {budget_range}
- Période: {season}

PRODUITS DISPONIBLES:
{available_products}

TÂCHE:
Génère exactement 10 recommandations de produits pertinents en tenant compte de:
1. Complémentarité avec le panier actuel (ex: pain → beurre, confiture)
2. Popularité dans la zone géographique
3. Saisonnalité (période: {season})
4. Historique d'achats de l'utilisateur
5. Budget disponible

FORMAT DE RÉPONSE (JSON STRICT - PAS DE MARKDOWN):
{{
  "recommendations": [
    {{
      "product_id": 123,
      "product_name": "Nom du produit",
      "price": 1500.0,
      "confidence_score": 0.85,
      "reason": "Produit complémentaire à votre panier",
      "category": "alimentaire"
    }}
  ]
}}

CONTRAINTES:
- recommendations: tableau d'exactement 10 objets
- product_id: entier positif (doit exister dans la liste des produits disponibles)
- product_name: string (nom du produit)
- price: nombre décimal positif (en FCFA)
- confidence_score: nombre entre 0.0 et 1.0
- reason: string (explication de la recommandation, 20-100 caractères)
- category: string (catégorie du produit)

IMPORTANT:
- Retourne UNIQUEMENT du JSON valide
- Pas de texte avant ou après le JSON
- Pas de markdown (```json```)
- Pas de commentaires dans le JSON
- Tous les nombres doivent être des nombres (pas de strings)
- Les product_id doivent exister dans la liste des produits disponibles
- Prioriser les produits adaptés au contexte africain/camerounais
"#;

/// Prompt pour prédiction ETA améliorée
/// ✅ AMÉLIORATION: Format JSON strict avec instructions détaillées
pub const ETA_PREDICTION_PROMPT: &str = r#"
Tu es un expert en logistique et prédiction de temps de livraison pour la plateforme Yukpomnang.

DONNÉES ACTUELLES:
- Distance: {distance_km} km
- Heure de la journée: {hour_of_day}h
- Jour de la semaine: {day_of_week}
- Type de livraison: {delivery_type}
- Rating coursier: {courier_rating}/5
- Conditions météo: {weather}
- Facteur trafic: {traffic_factor}
- Complexité route: {route_complexity}

HISTORIQUE SIMILAIRE:
{similar_deliveries_history}

TÂCHE:
Prédit le temps d'arrivée estimé (ETA) en minutes avec:
1. Temps estimé principal (estimated_minutes)
2. Intervalle de confiance (lower_bound_minutes, upper_bound_minutes)
3. Facteurs de risque identifiés (risk_factors)
4. Score de confiance (0.0-1.0)
5. Facteurs influençant (factors)

FORMAT DE RÉPONSE (JSON STRICT - PAS DE MARKDOWN):
{{
  "estimated_minutes": 25.5,
  "confidence": 0.82,
  "lower_bound_minutes": 20.0,
  "upper_bound_minutes": 32.0,
  "factors": {{
    "traffic": 1.2,
    "weather": 1.0,
    "courier_experience": 0.95,
    "route_complexity": 1.1,
    "distance": 12.5
  }},
  "risk_factors": ["Heure de pointe", "Route complexe"]
}}

CONTRAINTES:
- estimated_minutes: nombre décimal positif (ex: 25.5)
- confidence: nombre entre 0.0 et 1.0
- lower_bound_minutes: nombre décimal <= estimated_minutes
- upper_bound_minutes: nombre décimal >= estimated_minutes
- factors: objet avec clés string et valeurs numériques
- risk_factors: tableau de strings (peut être vide)

IMPORTANT:
- Retourne UNIQUEMENT du JSON valide
- Pas de texte avant ou après le JSON
- Pas de markdown (```json```)
- Pas de commentaires dans le JSON
- Tous les nombres doivent être des nombres (pas de strings)
"#;

/// Prompt pour forecasting de demande
/// ✅ AMÉLIORATION: Format JSON strict avec instructions détaillées
pub const DEMAND_FORECASTING_PROMPT: &str = r#"
Tu es un expert en analyse prédictive de demande pour services de livraison Yukpomnang.

ZONE ANALYSÉE:
- Zone ID: {zone_id}
- Coordonnées: ({lat}, {lng})
- Rayon: {radius_km} km

PÉRIODE:
- Heure: {hour}h
- Jour: {day_of_week}
- Date: {date}

DONNÉES HISTORIQUES (30 derniers jours):
{historical_demand_data}

FACTEURS EXTERNES:
- Événements locaux: {local_events}
- Météo prévue: {weather_forecast}
- Jours fériés: {holidays}
- Tendances saisonnières: {seasonal_trends}

TÂCHE:
Prédit la demande attendue (nombre de livraisons) avec:
1. Demande prédite (predicted_demand)
2. Trend (increasing/decreasing/stable)
3. Score de confiance (0.0-1.0)
4. Facteurs influençant la prédiction (factors)
5. Moyenne historique (historical_avg)

FORMAT DE RÉPONSE (JSON STRICT - PAS DE MARKDOWN):
{{
  "predicted_demand": 15.5,
  "confidence": 0.75,
  "trend": "increasing",
  "historical_avg": 12.3,
  "factors": {{
    "hour_factor": 1.3,
    "day_factor": 1.1,
    "weather_factor": 0.9,
    "events_factor": 1.2
  }}
}}

CONTRAINTES:
- predicted_demand: nombre décimal positif (ex: 15.5)
- confidence: nombre entre 0.0 et 1.0
- trend: "increasing" | "decreasing" | "stable"
- historical_avg: nombre décimal positif
- factors: objet avec clés string et valeurs numériques

IMPORTANT:
- Retourne UNIQUEMENT du JSON valide
- Pas de texte avant ou après le JSON
- Pas de markdown (```json```)
- Pas de commentaires dans le JSON
- Tous les nombres doivent être des nombres (pas de strings)
"#;
