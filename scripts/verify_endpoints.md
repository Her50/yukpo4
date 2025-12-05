# ✅ Guide de vérification des endpoints IA

## Endpoints Bourse du Livre

### 1. Suggestions Prix IA (Publique)
```bash
GET /api/bourse-livre/ai/price-suggestions?titre=Mathématiques%206ème&etat_livre=Bon&classe_actuelle=6ème&matiere=Mathématiques
```

**Réponse attendue**:
```json
{
  "success": true,
  "suggestion": {
    "livre_id": 0,
    "prix_suggere_min": 5000.0,
    "prix_suggere_max": 8000.0,
    "prix_suggere_median": 6500.0,
    "devise": "XAF",
    "facteurs_influence": [...],
    "comparaison_marche": "...",
    "confidence": 0.85
  }
}
```

### 2. Recommandations IA (Protégé JWT)
```bash
POST /api/bourse-livre/ai/recommendations
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "classe_actuelle": "6ème",
  "classe_souhaitee": "5ème",
  "matiere": "Mathématiques",
  "niveau": "Collège",
  "ville": "Douala"
}
```

**Réponse attendue**:
```json
{
  "success": true,
  "recommendation": {
    "livre_ids": [1, 2, 3],
    "score_recommendation": 85.5,
    "reasoning": "...",
    "alternative_books": [4, 5],
    "matieres_suggestees": ["Mathématiques", "Physique"]
  }
}
```

### 3. Matching IA (Protégé JWT)
```bash
POST /api/bourse-livre/ai/matching
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "livre_offert_id": 1,
  "livre_souhaite_id": 2,
  "participant_id": 3,
  "distance_km": 5.0,
  "etat_livre_offert": "Bon",
  "etat_livre_souhaite": "Très bon"
}
```

## Endpoints Orientation Scolaire

### 1. Analyse Profil IA (Protégé JWT)
```bash
POST /api/orientation/ai/analyze-profile
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "profile_data": {
    "age": 18,
    "niveau_etude_actuel": "Lycée",
    "interets": ["Informatique"],
    "matieres_preferees": ["Mathématiques"],
    "notes_recentes": {"Math": 15.5},
    "objectif_carriere": "Développeur",
    "contraintes_geographiques": "Douala",
    "budget_etudes": 500000
  }
}
```

**Note**: Le backend attend `profile_id` mais l'écran mobile envoie `profile_data`. Vérifier la compatibilité.

### 2. Recommandations Programmes IA (Protégé JWT)
```bash
POST /api/orientation/ai/recommendations
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "criteria": {
    "age": 18,
    "niveau_etude_actuel": "Lycée",
    "interets": ["Informatique"],
    "matieres_preferees": ["Mathématiques"],
    "type_etablissement_souhaite": "Supérieur",
    "localisation_preferee": "Douala",
    "budget_max": 500000
  }
}
```

**Note**: Le backend attend `student_profile_id` mais l'écran mobile envoie `criteria`. Vérifier la compatibilité.

### 3. Comparaison Programmes IA (Protégé JWT)
```bash
POST /api/orientation/ai/compare-programs
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "program_ids": [1, 2]
}
```

**Note**: Le backend attend `student_profile_id`, `etablissement_1_id`, `etablissement_2_id`, etc. mais l'écran mobile envoie `program_ids`. Vérifier la compatibilité.

## Endpoints Offres d'Emploi

### 1. Prédiction Salaire IA (Publique)
```bash
GET /api/offres-emploi/ai/salary-prediction?titre_poste=Développeur%20Full%20Stack&secteur=Informatique&ville=Douala&experience_annees=3&niveau_etude=Bac+5&competences=React,Node.js
```

### 2. Analyse CV IA (Protégé JWT)
```bash
POST /api/offres-emploi/ai/analyze-cv
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "candidat_id": 1,
  "cv_text": "Développeur Full Stack avec 5 ans d'expérience...",
  "cv_url": "https://..."
}
```

### 3. Suggestions Formations IA (Protégé JWT)
```bash
POST /api/offres-emploi/ai/suggest-formations
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "candidat_id": 1
}
```

## Tests avec curl

```bash
# Test suggestions prix (publique)
curl "http://localhost:3000/api/bourse-livre/ai/price-suggestions?titre=Mathématiques%206ème&etat_livre=Bon&classe_actuelle=6ème&matiere=Mathématiques"

# Test prédiction salaire (publique)
curl "http://localhost:3000/api/offres-emploi/ai/salary-prediction?titre_poste=Développeur&secteur=Informatique&ville=Douala&experience_annees=3&niveau_etude=Bac+5"

# Test recommandations (avec JWT)
curl -X POST "http://localhost:3000/api/bourse-livre/ai/recommendations" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"classe_actuelle":"6ème","classe_souhaitee":"5ème","matiere":"Mathématiques"}'
```

## Problèmes connus à corriger

1. **Orientation Scolaire**: Les endpoints backend attendent `profile_id` mais les écrans mobiles envoient `profile_data`. Il faut soit:
   - Modifier les endpoints backend pour accepter `profile_data`
   - Modifier les écrans mobiles pour envoyer `profile_id`

2. **Comparaison Programmes**: Le backend attend des IDs d'établissements séparés, mais l'écran mobile envoie `program_ids`. À aligner.

