# Prompt Spécifique - Assistance Générale

Génère un JSON strictement conforme pour une question d'assistance :

**Structure obligatoire :**
```json
{
  "intention": "assistance_generale",
  "texte": {
    "type_donnee": "string",
    "valeur": "<question ou demande utilisateur>",
    "origine_champs": "<source>"
  },
  "reponse_ia": {
    "type_donnee": "string",
    "valeur": "<réponse claire et utile à la question>",
    "origine_champs": "ia"
  }
}
```

**Règles strictes :**
- `texte` : question exacte de l'utilisateur
- `reponse_ia` : réponse claire, synthétique et utile
- Réponse basée sur la connaissance de Yukpo

**Input utilisateur :** {user_input}

**JSON :** 