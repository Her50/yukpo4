# Prompt Spécifique - Creation Service

Génère un JSON strictement conforme pour la création d'un service :

**Structure obligatoire :**
```json
{
  "intention": "creation_service",
  "titre_service": {
    "type_donnee": "string",
    "valeur": "<titre du service>",
    "origine_champs": "<source>"
  },
  "nom_prestataire": {
    "type_donnee": "string",
    "valeur": "<nom du commerce/établissement/prestataire si mentionné dans l'input, sinon omettre>",
    "origine_champs": "ia"
  },
  // Note: nom_prestataire est OPTIONNEL mais recommandé pour améliorer le matching Google Places.
  // Si un nom de boutique/commerce/établissement est mentionné dans l'input, l'extraire ici.
  // Si non mentionné, omettre ce champ (le système utilisera users.nom_complet comme fallback).
  "category": {
    "type_donnee": "string", 
    "valeur": "<catégorie métier>",
    "origine_champs": "<source>"
  },
  "description": {
    "type_donnee": "string",
    "valeur": "<description du service>",
    "origine_champs": "<source>"
  },
  "is_tarissable": <boolean>,
  "vitesse_tarissement": "<lente|moyenne|rapide>",
  "whatsapp": {
    "type_donnee": "string",
    "valeur": "<numéro WhatsApp du prestataire>",
    "origine_champs": "ia"
  },
  "telephone": {
    "type_donnee": "string",
    "valeur": "<numéro de téléphone du prestataire>",
    "origine_champs": "ia"
  },
  "email": {
    "type_donnee": "string",
    "valeur": "<email du prestataire>",
    "origine_champs": "ia"
  },
  "siteweb": {
    "type_donnee": "string",
    "valeur": "<site web du prestataire>",
    "origine_champs": "ia"
  }
}
```

**Règles strictes :**
- `vitesse_tarissement` : string simple, JAMAIS un objet
- `is_tarissable` : boolean simple, JAMAIS un objet
- TOUS les champs structurés DOIVENT avoir `origine_champs`
- Si produits détectés, ajouter `produits` avec `type_donnee: "listeproduit"`

**EXTRACTION STRICTE DES PRODUITS :**
- **IMPORTANT** : N'INVENTE RIEN ! Extrais UNIQUEMENT les produits que tu vois réellement dans l'image
- **RÈGLE ABSOLUE** : Chaque produit doit être **spécifique et réellement visible** dans l'image
- **INTERDICTION** : Ne jamais inventer de produits qui ne sont pas visibles
- **Si tu ne vois qu'un seul produit** : Ne crée qu'un seul objet dans le tableau
- **Si tu ne vois aucun produit spécifique** : N'ajoute pas le champ produits
- **Extrais EXACTEMENT** ce que tu vois, rien de plus, rien de moins
- **FIDÉLITÉ TOTALE** : Reproduis fidèlement ce que tu observes, sans extrapolation

**STRUCTURE OBLIGATOIRE POUR LES PRESTATIONS DE SERVICE (produits avec type_donnee: "autocomplete") :**
Si le service contient des prestations (produits avec `type_donnee: "autocomplete"`), le champ `produits` DOIT avoir cette structure :
```json
{
  "produits": {
    "type_donnee": "autocomplete",
    "valeur": ["<modalité1>", "<modalité2>", ...],
    "sous_caracteristiques": {
      "<label1>": ["<valeur1>", "<valeur2>", ...],
      "<label2>": ["<valeur1>", "<valeur2>", ...],
      ...
    },
    "product_labels": ["<label1>", "<label2>", ...],
    "separateur": ",",
    "origine_champs": "ia"
  }
}
```

**RÈGLE CRITIQUE POUR product_labels :**
- `product_labels` : **OBLIGATOIRE** pour les prestations de service avec autocomplete
- C'est un tableau de strings qui définit l'ordre exact des labels des sous-caractéristiques
- L'ordre dans `product_labels` DOIT correspondre à l'ordre des clés dans `sous_caracteristiques`
- Chaque label dans `product_labels` DOIT être une clé présente dans `sous_caracteristiques`
- Exemple : Si `sous_caracteristiques = {"type": ["Consultation"], "duree": ["30 min"]}`, alors `product_labels = ["type", "duree"]` (dans cet ordre exact)

**Champs conditionnels :**
- Si `is_tarissable=true` : `vitesse_tarissement` obligatoire
- Si produits détectés : `produits` avec structure listeproduit OU autocomplete
- Si `produits.type_donnee = "autocomplete"` : `product_labels` OBLIGATOIRE pour garantir l'alignement correct des labels et valeurs

**CHAMPS DE CONTACT OBLIGATOIRES :**
- `whatsapp` : **OBLIGATOIRE** - Numéro WhatsApp du prestataire (format international)
- `telephone` : **OBLIGATOIRE** - Numéro de téléphone du prestataire (format international)
- `email` : **OBLIGATOIRE** - Adresse email du prestataire
- `siteweb` : **OPTIONNEL** - Site web du prestataire (si disponible)

**RÈGLES POUR LES CONTACTS :**
- WhatsApp et téléphone doivent être au format international (ex: +237 6 90 00 00 00)
- Email doit être valide (ex: contact@example.com)
- Site web doit inclure le protocole (ex: https://www.example.com)
- Si une information n'est pas disponible, utilise "Non spécifié" comme valeur

**Input utilisateur :** {user_input}

**JSON :** 