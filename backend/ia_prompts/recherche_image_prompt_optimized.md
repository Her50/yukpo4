# Prompt Recherche Image - Yukpo (OPTIMISÉ)

## MODE : RECHERCHE PAR IMAGE
L'utilisateur cherche un produit/service visible dans l'image. Génère un JSON au format création pour matching optimal.

## 5 CHAMPS OBLIGATOIRES (TOUJOURS)
1. `titre_service` (string)
2. `category` (string) 
3. `description` (string)
4. `is_tarissable` (boolean)
5. `type_offre` ("produit" ou "prestation") ⚠️ CRITIQUE pour labels frontend

**type_offre: "produit"** = biens matériels | **"prestation"** = services

## TYPES DE DONNÉES
- **Lieux** → `type_donnee="location"` (adresse, ville, destination, départ, arrivée)
- **Dates** → `type_donnee="date"` format YYYY-MM-DD
- **Prix variables** → `type_donnee="price_variant"` (pointure, taille, quantité)
- **Caractéristiques** → `type_donnee="autocomplete"` (marque, modèle, etc.)

## PRODUITS/PRESTATIONS (6 CHAMPS OBLIGATOIRES si détecté)
Si UN SEUL produit/prestation détecté → générer TOUJOURS :
1. `produits` (autocomplete avec 8-12 sous_caracteristiques minimum)
2. `nom_produit` (string)
3. `categorie_produit` (string)
4. `description_produit` (string)
5. `prix_produit` (number, null si non visible)
6. `devise_produit` (string: XAF/EUR/USD)

**ENRICHISSEMENT AUTOCOMPLETE OBLIGATOIRE** :
- Ne JAMAIS se limiter aux infos explicites
- Ajouter caractéristiques standards (ex: véhicule → carburant, transmission, puissance, kilométrage, état, couleur, etc.)
- Minimum 8-12 caractéristiques pour produits complexes, 6-8 pour simples
- Chaque caractéristique = liste de valeurs possibles (pas juste la valeur mentionnée)

**EXTRACTION STRICTE** :
- Extrais EXACTEMENT ce qui est visible (prix, marque, nom, quantité)
- Ne JAMAIS inventer de produits non visibles
- Liste TOUS les produits visibles, un par un

## FORMAT JSON
```json
{
  "intention": "recherche_produit",
  "data": {
    "titre_service": {"type_donnee": "string", "valeur": "...", "origine_champs": "ia"},
    "category": {"type_donnee": "string", "valeur": "...", "origine_champs": "ia"},
    "description": {"type_donnee": "string", "valeur": "...", "origine_champs": "ia"},
    "is_tarissable": {"type_donnee": "boolean", "valeur": true, "origine_champs": "ia"},
    "type_offre": {"type_donnee": "string", "valeur": "produit", "origine_champs": "ia"},
    "produits": {
      "type_donnee": "autocomplete",
      "valeur": ["Marque,Modèle,Année,Caractéristique1,Caractéristique2,..."],
      "separateur": ",",
      "sous_caracteristiques": {
        "marque": ["Marque1", "Marque2", ...],
        "modele": ["Modèle1", "Modèle2", ...],
        // ... 8-12 caractéristiques minimum avec listes complètes
      },
      "filtrable": true,
      "identifiant_base": "produits",
      "origine_champs": "ia"
    },
    "nom_produit": {"type_donnee": "string", "valeur": "...", "origine_champs": "ia"},
    "categorie_produit": {"type_donnee": "string", "valeur": "...", "origine_champs": "ia"},
    "description_produit": {"type_donnee": "string", "valeur": "...", "origine_champs": "ia"},
    "prix_produit": {"type_donnee": "number", "valeur": 15000, "origine_champs": "ia"},
    "devise_produit": {"type_donnee": "string", "valeur": "XAF", "origine_champs": "ia"}
  }
}
```

## EXEMPLES RAPIDES

**Véhicule** : autocomplete avec marque, modèle, année, version, carburant, transmission, puissance, kilométrage, état, couleur, nombre_de_portes, nombre_de_places (12 caractéristiques)

**Smartphone** : marque, modèle, capacité_stockage, couleur, RAM, écran, état, réseau, système, batterie (10 caractéristiques)

**Chaussure** : marque, modèle, pointure, couleur, matière, type, semelle, genre, état (9 caractéristiques)

**Prestation** : compétences, niveau, expérience, durée, fréquence, modalité, outils, tarif (8 caractéristiques)

## RÈGLES CRITIQUES
- ✅ Tous les champs ont `origine_champs: "ia"`
- ✅ Prix = number (jamais string)
- ✅ Dates = YYYY-MM-DD
- ✅ Lieux = type_donnee="location"
- ✅ Autocomplete = 8-12 caractéristiques minimum avec listes complètes
- ❌ Ne JAMAIS inventer de produits non visibles
- ❌ Ne JAMAIS oublier `type_offre`

## CHECKLIST
- [ ] 5 champs obligatoires (titre_service, category, description, is_tarissable, type_offre)
- [ ] Si produit détecté → 6 champs produits (produits autocomplete, nom_produit, categorie_produit, description_produit, prix_produit, devise_produit)
- [ ] Autocomplete avec 8-12 caractéristiques enrichies
- [ ] Types de données corrects (location, date, price_variant)
- [ ] Extraction exacte de l'image (pas d'invention)

