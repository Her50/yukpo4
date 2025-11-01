# 📚 Guide : Intégration Bases de Données Externes pour Produits Alimentaires

## 🎯 Objectif

Enrichir la base de données ALIMENTS.json avec des sources externes pour capturer **TOUTES** les caractéristiques possibles d'un produit selon sa catégorie.

## 🌐 Bases de Données Disponibles

### 1. **Open Food Facts** ⭐⭐⭐ (RECOMMANDÉ)

**API REST gratuite** : https://world.openfoodfacts.org/api/v2/

**Avantages** :
- ✅ **1.9+ millions de produits** référencés
- ✅ **API gratuite** sans authentification
- ✅ Données complètes : ingrédients, nutriments, allergènes, labels
- ✅ Couverture mondiale incluant produits africains
- ✅ Mise à jour collaborative

**Exemple d'utilisation** :
```python
import requests

# Rechercher un produit
response = requests.get(
    "https://world.openfoodfacts.org/api/v2/search",
    params={
        "search_terms": "riz",
        "page_size": 20,
        "json": 1
    }
)

products = response.json()["products"]

for product in products:
    print(f"Nom: {product.get('product_name')}")
    print(f"Marque: {product.get('brands')}")
    print(f"Catégorie: {product.get('categories')}")
    print(f"Origine: {product.get('origins')}")
    print(f"Labels: {product.get('labels')}")
    print(f"Nutriments: {product.get('nutriments')}")
```

**Intégration dans notre script** :
```python
def enrich_from_openfoodfacts(product_name: str, brand: str = None):
    """Enrichit un produit avec données Open Food Facts"""
    params = {"search_terms": product_name, "page_size": 1, "json": 1}
    if brand:
        params["brand"] = brand
    
    response = requests.get("https://world.openfoodfacts.org/api/v2/search", params=params)
    
    if response.json().get("products"):
        product_data = response.json()["products"][0]
        return {
            "ingredients": product_data.get("ingredients_text", ""),
            "nutriments": product_data.get("nutriments", {}),
            "allergens": product_data.get("allergens", ""),
            "labels": product_data.get("labels", "").split(","),
            "origins": product_data.get("origins", ""),
            "packaging": product_data.get("packaging", ""),
            "nutriscore": product_data.get("nutriscore_grade", ""),
            "ecoscore": product_data.get("ecoscore_grade", "")
        }
    return None
```

### 2. **FAO/INFOODS** ⭐⭐

**URL** : https://www.fao.org/infoods/infoods/tables-et-bases-de-donnees

**Avantages** :
- ✅ Données nutritionnelles **scientifiques précises**
- ✅ Base mondiale de composition des aliments
- ✅ Couvre produits bruts et transformés

**Limitations** :
- ❌ Pas d'API directe (données téléchargeables)
- ❌ Format Excel/CSV à parser
- ❌ Focus nutritionnel, moins sur marques

**Utilisation** :
- Télécharger tables Excel
- Parser avec `pandas` ou `openpyxl`
- Mapper vers notre structure

### 3. **CIQUAL (ANSES)** ⭐⭐

**URL** : https://ciqual.anses.fr/

**Avantages** :
- ✅ Base de référence française **officielle**
- ✅ Données nutritionnelles validées
- ✅ Couvre produits français et importés

**Limitations** :
- ❌ Focus France (moins de produits africains)
- ❌ Pas d'API publique
- ❌ Accès web scraping nécessaire

### 4. **Data.gouv.fr - Agriculture & Alimentation** ⭐

**URL** : https://www.data.gouv.fr/fr/pages/donnees_agriculture-alimentation/

**Avantages** :
- ✅ Données ouvertes françaises
- ✅ Statistiques marché
- ✅ Prix moyens par produit

**Utilisation** :
- Télécharger datasets CSV/JSON
- Intégrer prix moyens réels
- Enrichir variantes de prix

## 🔧 Script d'Enrichissement Automatique

### Script Python complet

```python
#!/usr/bin/env python3
"""
Script d'enrichissement ALIMENTS.json avec Open Food Facts
"""

import json
import requests
import time
from typing import Dict, List, Any

def enrich_product_from_openfoodfacts(product: Dict[str, Any]) -> Dict[str, Any]:
    """Enrichit un produit avec données Open Food Facts"""
    
    # Construire requête
    search_term = product["product_name"]
    if product.get("fixed_characteristics", {}).get("marqueAliment"):
        search_term += f" {product['fixed_characteristics']['marqueAliment']}"
    
    try:
        response = requests.get(
            "https://world.openfoodfacts.org/api/v2/search",
            params={
                "search_terms": search_term,
                "page_size": 1,
                "json": 1
            },
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("products"):
                off_product = data["products"][0]
                
                # Enrichir les métadonnées
                if not product.get("metadata", {}).get("ingredients"):
                    product["metadata"]["ingredients"] = off_product.get("ingredients_text", "")
                
                if not product.get("metadata", {}).get("allergens"):
                    product["metadata"]["allergens"] = off_product.get("allergens", "").split(",")
                
                if not product.get("metadata", {}).get("labels"):
                    labels = off_product.get("labels", "").split(",")
                    product["metadata"]["labels"] = [l.strip() for l in labels if l.strip()]
                
                # Enrichir nutriments si disponible
                if off_product.get("nutriments"):
                    product["metadata"]["nutriments"] = {
                        "energy_kcal": off_product["nutriments"].get("energy-kcal_100g"),
                        "proteins": off_product["nutriments"].get("proteins_100g"),
                        "carbs": off_product["nutriments"].get("carbohydrates_100g"),
                        "fat": off_product["nutriments"].get("fat_100g"),
                        "fiber": off_product["nutriments"].get("fiber_100g")
                    }
                
                # Nutri-Score et Eco-Score
                if off_product.get("nutriscore_grade"):
                    product["metadata"]["nutriscore"] = off_product["nutriscore_grade"]
                
                if off_product.get("ecoscore_grade"):
                    product["metadata"]["ecoscore"] = off_product["ecoscore_grade"]
                
                # Packaging
                if off_product.get("packaging"):
                    product["metadata"]["packaging"] = off_product["packaging"]
                
                print(f"✅ Enrichi: {product['product_name']}")
        
        # Rate limiting
        time.sleep(0.5)
        
    except Exception as e:
        print(f"❌ Erreur pour {product['product_name']}: {e}")
    
    return product

def enrich_all_products(input_file: str, output_file: str):
    """Enrichit tous les produits du fichier JSON"""
    
    print(f"📖 Lecture de {input_file}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        products = json.load(f)
    
    print(f"🔄 Enrichissement de {len(products)} produits avec Open Food Facts...")
    
    enriched_products = []
    for i, product in enumerate(products, 1):
        print(f"[{i}/{len(products)}] Traitement: {product['product_name']}")
        enriched = enrich_product_from_openfoodfacts(product)
        enriched_products.append(enriched)
    
    print(f"💾 Sauvegarde dans {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(enriched_products, f, indent=2, ensure_ascii=False)
    
    print(f"✅ {len(enriched_products)} produits enrichis !")

if __name__ == "__main__":
    enrich_all_products("ALIMENTS.json", "ALIMENTS_ENRICHIS.json")
```

## 📊 Structure de Données Enrichie

### Exemple de produit enrichi

```json
{
  "product_id": "ALIMENTS-RIZ-VIETNAM-PREMIUM",
  "product_name": "Riz Vietnam",
  "metadata": {
    "category": "aliments",
    "subcategory": "cereales",
    "ingredients": "Riz long grain parfumé",
    "allergens": [],
    "labels": ["Bio", "Commerce équitable"],
    "nutriments": {
      "energy_kcal": 365,
      "proteins": 7.5,
      "carbs": 80,
      "fat": 0.5,
      "fiber": 1.5
    },
    "nutriscore": "A",
    "ecoscore": "B",
    "packaging": "Sac papier recyclable"
  }
}
```

## 🚀 Extension du Script de Génération

### Ajouter plus de produits systématiquement

```python
# Dans generate_aliments_complete.py, ajouter :

# ═══════════════════════════════════════════════════════
# GÉNÉRATION SYSTÉMATIQUE PAR COMBINAISONS
# ═══════════════════════════════════════════════════════

def generate_combinations_systematic():
    """Génère produits par combinaisons systématiques"""
    
    # Tous les fruits × toutes les origines
    fruits = ["Mangue", "Ananas", "Papaye", "Orange", "Citron", ...]
    origines = ["Cameroun", "Côte d'Ivoire", "Sénégal", "Ghana", ...]
    
    for fruit, origine in itertools_product(fruits, origines):
        # Générer produit pour chaque combinaison
        ...
    
    # Toutes les marques × tous les formats
    marques_huile = ["Dinor", "Olive", "La Rose", "Lawan", ...]
    formats_huile = ["1L", "2L", "5L", "10L", "20L"]
    
    for marque, format in itertools_product(marques_huile, formats_huile):
        # Générer produit pour chaque combinaison
        ...
```

## 📈 Stratégie pour Atteindre 1000+ Produits

### 1. **Combinaisons systématiques** (actuel : 458 produits)
- ✅ Fruits × Origines
- ✅ Légumes × Origines  
- ✅ Marques × Formats
- ✅ Types × Variantes

### 2. **Enrichissement Open Food Facts** (+200-300 produits)
- Rechercher produits africains spécifiques
- Ajouter produits populaires manquants
- Enrichir caractéristiques nutritionnelles

### 3. **Produits locaux africains** (+100-200 produits)
- Attiéké (Côte d'Ivoire)
- Garri (Nigeria)
- Ndolé (Cameroun)
- Fufu (Ghana)
- Plantain (toutes variétés)
- Igname (toutes variétés)
- Manioc (toutes variétés)

### 4. **Variantes de conditionnement** (+100 produits)
- Tous les formats de chaque produit
- Tous les poids/volumes disponibles
- Tous les conditionnements

## 🎯 Résultat Attendu

**500-1000+ produits** avec :
- ✅ Caractéristiques complètes
- ✅ Variantes de recherche intelligentes
- ✅ Prix réalistes marché africain
- ✅ Métadonnées enrichies (nutriments, labels, etc.)
- ✅ Compatibilité totale avec système existant

## 🔄 Workflow Recommandé

1. **Générer base** : `python generate_aliments_complete.py` → 458 produits
2. **Enrichir Open Food Facts** : `python enrich_from_openfoodfacts.py` → +200 produits
3. **Ajouter produits locaux** : Extension manuelle produits africains → +100 produits
4. **Valider et tester** : Vérifier intégration formulaire universel
5. **Itérer** : Ajouter produits selon besoins utilisateurs réels

## 📝 Notes Importantes

- ⚠️ **Rate limiting** : Open Food Facts limite à ~1 requête/seconde
- ⚠️ **Données partielles** : Tous les produits n'existent pas dans Open Food Facts
- ✅ **Fallback** : Si pas trouvé dans Open Food Facts, utiliser données générées
- ✅ **Crowdsourcing** : Système collaboratif permettra enrichissement progressif

