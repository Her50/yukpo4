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

**Champs conditionnels :**
- Si `is_tarissable=true` : `vitesse_tarissement` obligatoire
- Si produits détectés : `produits` avec structure listeproduit

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