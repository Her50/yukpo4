# Prompt Spécifique - Recherche Besoin

Génère un JSON strictement conforme pour la recherche d'un besoin :

**Structure obligatoire :**
```json
{
  "intention": "recherche_besoin",
  "titre": {
    "type_donnee": "string",
    "valeur": "<titre synthèse du besoin>",
    "origine_champs": "<source>"
  },
  "description": {
    "type_donnee": "string",
    "valeur": "<description détaillée du besoin>",
    "origine_champs": "<source>"
  },
  "category": {
    "type_donnee": "string",
    "valeur": "<catégorie métier>",
    "origine_champs": "<source>"
  },
  "reponse_intelligente": {
    "type_donnee": "string",
    "valeur": "<suggestion IA personnalisée>",
    "origine_champs": "ia"
  }
}
```

**Règles strictes :**
- `titre` : TOUJOURS obligatoire, synthèse courte du besoin
- TOUS les champs structurés DOIVENT avoir `origine_champs`
- `reponse_intelligente` : suggestion IA basée sur le besoin

**Champs conditionnels :**
- Si suggestions : `suggestions_complementaires` avec structure array

**Input utilisateur :** {user_input}

**JSON :** 