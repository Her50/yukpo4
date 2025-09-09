# Prompt Spécifique - Échange/Troc

Génère un JSON strictement conforme pour un échange/troc :

**Structure obligatoire :**
```json
{
  "intention": "echange",
  "mode": "echange",
  "mode_troc": "echange",
  "offre": {
    "nom": "<nom de l'objet offert>",
    "categorie": "<catégorie>",
    "etat": "<neuf|occasion|bon>",
    "description": "<description détaillée>"
  },
  "besoin": {
    "nom": "<nom de l'objet recherché>",
    "categorie": "<catégorie>",
    "etat": "<neuf|occasion|bon>",
    "description": "<description détaillée>"
  }
}
```

**Règles strictes :**
- `mode` et `mode_troc` : toujours "echange"
- `offre` et `besoin` : objets détaillés avec toutes les infos détectées
- Enrichir avec marque, couleur, spécifications si détectées

**Input utilisateur :** {user_input}

**JSON :** 