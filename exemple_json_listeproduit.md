# Exemples JSON pour le champ `listeproduit`

## Format attendu par le backend

Le champ `listeproduit` doit être un tableau d'objets avec la structure suivante :

```json
{
  "listeproduit": [
    {
      "nom": "Cahier 200 pages",
      "categorie": "Fournitures scolaires",
      "nature_produit": "Papeterie",
      "quantite": 50,
      "unite": "unités",
      "prix": {
        "montant": 500,
        "devise": "XAF"
      },
      "marque": "Oxford",
      "origine": "Cameroun",
      "occasion": false,
      "est_tarissable": true,
      "vitesse_tarissement": "Immédiat"
    },
    {
      "nom": "Stylos Bic",
      "categorie": "Fournitures scolaires", 
      "nature_produit": "Écriture",
      "quantite": 100,
      "unite": "unités",
      "prix": {
        "montant": 200,
        "devise": "XAF"
      },
      "marque": "Bic",
      "origine": "France",
      "occasion": false,
      "est_tarissable": true,
      "vitesse_tarissement": "Immédiat"
    }
  ]
}
```

## Exemples par type de service

### 1. Service de vente de fournitures scolaires
```json
{
  "intention": "creation_service",
  "data": {
    "titre_service": {
      "type_donnee": "string",
      "valeur": "Vente de fournitures scolaires"
    },
    "is_tarissable": {
      "type_donnee": "boolean", 
      "valeur": true
    },
    "listeproduit": {
      "type_donnee": "listeproduit",
      "valeur": [
        {
          "nom": "Cahier 200 pages",
          "categorie": "Fournitures scolaires",
          "nature_produit": "Papeterie",
          "quantite": 50,
          "unite": "unités",
          "prix": {"montant": 500, "devise": "XAF"},
          "marque": "Oxford",
          "est_tarissable": true
        },
        {
          "nom": "Cartable scolaire",
          "categorie": "Fournitures scolaires",
          "nature_produit": "Bagagerie",
          "quantite": 20,
          "unite": "unités", 
          "prix": {"montant": 5000, "devise": "XAF"},
          "marque": "Kipling",
          "est_tarissable": true
        }
      ]
    }
  }
}
```

### 2. Service de cours particuliers
```json
{
  "intention": "creation_service",
  "data": {
    "titre_service": {
      "type_donnee": "string",
      "valeur": "Cours de mathématiques"
    },
    "listeproduit": {
      "type_donnee": "listeproduit",
      "valeur": [
        {
          "nom": "Cours niveau collège",
          "categorie": "Éducation",
          "nature_produit": "Cours particulier",
          "quantite": 1,
          "unite": "heure",
          "prix": {"montant": 2000, "devise": "XAF"},
          "est_tarissable": true,
          "vitesse_tarissement": "24h"
        },
        {
          "nom": "Cours niveau lycée",
          "categorie": "Éducation", 
          "nature_produit": "Cours particulier",
          "quantite": 1,
          "unite": "heure",
          "prix": {"montant": 2500, "devise": "XAF"},
          "est_tarissable": true,
          "vitesse_tarissement": "24h"
        }
      ]
    }
  }
}
```

### 3. Service de vente de meubles d'occasion
```json
{
  "intention": "creation_service",
  "data": {
    "titre_service": {
      "type_donnee": "string",
      "valeur": "Vente de meubles d'occasion"
    },
    "listeproduit": {
      "type_donnee": "listeproduit",
      "valeur": [
        {
          "nom": "Canapé 3 places",
          "categorie": "Meubles",
          "nature_produit": "Mobilier de salon",
          "quantite": 1,
          "unite": "unité",
          "prix": {"montant": 150000, "devise": "XAF"},
          "occasion": true,
          "est_tarissable": true,
          "vitesse_tarissement": "Immédiat"
        },
        {
          "nom": "Table basse",
          "categorie": "Meubles",
          "nature_produit": "Mobilier de salon", 
          "quantite": 1,
          "unite": "unité",
          "prix": {"montant": 45000, "devise": "XAF"},
          "occasion": true,
          "est_tarissable": true,
          "vitesse_tarissement": "Immédiat"
        }
      ]
    }
  }
}
```

## Champs obligatoires vs optionnels

### Champs obligatoires :
- `nom` : Nom du produit
- `categorie` : Catégorie du produit
- `nature_produit` : Nature du produit
- `quantite` : Quantité disponible
- `unite` : Unité de mesure
- `prix` : Objet avec montant et devise

### Champs optionnels :
- `marque` : Marque du produit
- `origine` : Pays d'origine
- `occasion` : Boolean (true si produit d'occasion)
- `est_tarissable` : Boolean (true si le produit peut être épuisé)
- `vitesse_tarissement` : String (ex: "Immédiat", "24h", "48h")

## Intégration dans le formulaire

Le composant `ProductListManager` doit :
1. Afficher la liste des produits existants
2. Permettre d'ajouter/supprimer des produits
3. Valider que les champs obligatoires sont remplis
4. Formater les données selon ce schéma JSON 