#!/usr/bin/env python3
"""
Script d'enrichissement ALIMENTS.json avec Open Food Facts API
Enrichit les produits existants avec données nutritionnelles et caractéristiques supplémentaires
"""

import json
import requests
import time
from typing import Dict, Any, Optional

def enrich_product_from_openfoodfacts(product: Dict[str, Any], max_retries: int = 3) -> Dict[str, Any]:
    """Enrichit un produit avec données Open Food Facts"""
    
    # Construire terme de recherche
    search_term = product["product_name"]
    marque = product.get("fixed_characteristics", {}).get("marqueAliment")
    if marque:
        search_term = f"{marque} {search_term}"
    
    for attempt in range(max_retries):
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
                if data.get("products") and len(data["products"]) > 0:
                    off_product = data["products"][0]
                    
                    # Enrichir seulement si données valides
                    if off_product.get("product_name"):
                        # Ajouter dans additional_info
                        if "additional_info" not in product:
                            product["additional_info"] = {}
                        
                        # Ingredients
                        if off_product.get("ingredients_text"):
                            product["additional_info"]["ingredients"] = off_product["ingredients_text"]
                        
                        # Allergènes
                        allergens = off_product.get("allergens", "")
                        if allergens:
                            product["additional_info"]["allergens"] = [
                                a.strip() for a in allergens.split(",") if a.strip()
                            ]
                        
                        # Labels et certifications
                        labels_str = off_product.get("labels", "")
                        if labels_str:
                            labels = [l.strip() for l in labels_str.split(",") if l.strip()]
                            if labels:
                                product["metadata"]["certifications"] = labels
                        
                        # Nutriments (optionnel, pour référence)
                        if off_product.get("nutriments"):
                            nutriments = off_product["nutriments"]
                            product["additional_info"]["nutrition_per_100g"] = {
                                "energy_kcal": nutriments.get("energy-kcal_100g"),
                                "proteins_g": nutriments.get("proteins_100g"),
                                "carbs_g": nutriments.get("carbohydrates_100g"),
                                "fat_g": nutriments.get("fat_100g"),
                                "fiber_g": nutriments.get("fiber_100g"),
                                "sugar_g": nutriments.get("sugars_100g"),
                                "salt_g": nutriments.get("salt_100g")
                            }
                        
                        # Nutri-Score et Eco-Score
                        if off_product.get("nutriscore_grade"):
                            product["metadata"]["nutriscore"] = off_product["nutriscore_grade"]
                        
                        if off_product.get("ecoscore_grade"):
                            product["metadata"]["ecoscore"] = off_product["ecoscore_grade"]
                        
                        # Packaging
                        if off_product.get("packaging"):
                            product["additional_info"]["packaging_info"] = off_product["packaging"]
                        
                        print(f"✅ Enrichi: {product['product_name']}")
                        break  # Succès, sortir de la boucle retry
            
            # Rate limiting : 1 requête par seconde max
            time.sleep(1)
            
        except requests.exceptions.Timeout:
            print(f"⏱️ Timeout pour {product['product_name']}, tentative {attempt + 1}/{max_retries}")
            if attempt < max_retries - 1:
                time.sleep(2)  # Attendre plus longtemps avant retry
        except Exception as e:
            print(f"❌ Erreur pour {product['product_name']}: {e}")
            break  # Erreur autre que timeout, arrêter
    
    return product

def enrich_all_products(input_file: str = "ALIMENTS.json", output_file: str = "ALIMENTS.json"):
    """Enrichit tous les produits du fichier JSON"""
    
    print(f"📖 Lecture de {input_file}...")
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            products = json.load(f)
    except FileNotFoundError:
        print(f"❌ Fichier {input_file} non trouvé!")
        return
    
    print(f"🔄 Enrichissement de {len(products)} produits avec Open Food Facts...")
    print(f"⏱️ Temps estimé: ~{len(products)} secondes (1 produit/seconde)")
    
    enriched_products = []
    for i, product in enumerate(products, 1):
        print(f"[{i}/{len(products)}] {product['product_name']}...", end=" ")
        enriched = enrich_product_from_openfoodfacts(product)
        enriched_products.append(enriched)
    
    print(f"\n💾 Sauvegarde dans {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(enriched_products, f, indent=2, ensure_ascii=False)
    
    print(f"✅ {len(enriched_products)} produits traités !")
    print(f"📊 Fichier sauvegardé: {output_file}")

if __name__ == "__main__":
    import sys
    
    input_file = sys.argv[1] if len(sys.argv) > 1 else "ALIMENTS.json"
    output_file = sys.argv[2] if len(sys.argv) > 2 else "ALIMENTS.json"
    
    enrich_all_products(input_file, output_file)

