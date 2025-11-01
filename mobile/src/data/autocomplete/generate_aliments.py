#!/usr/bin/env python3
"""
Script de génération de la base de données ALIMENTS.json
Génère 500-1000 produits alimentaires avec toutes les caractéristiques requises
"""

import json
from typing import List, Dict, Any

def generate_product(
    product_id: str,
    autocomplete_key: str,
    product_name: str,
    primary_keywords: List[str],
    categorie_aliment: str,
    type_aliment: str,
    unite: str,
    marque: str = None,
    origine: str = None,
    variants_config: List[Dict] = None,
    search_variants_extra: List[str] = None
) -> Dict[str, Any]:
    """Génère un produit alimentaire complet"""
    
    # Variantes de recherche de base
    base_variants = [
        autocomplete_key,
        autocomplete_key.lower(),
        autocomplete_key.replace("fraîche", "fraiche"),
        product_name,
        product_name.lower(),
        product_name + " " + categorie_aliment.lower(),
        product_name + " " + type_aliment.lower(),
    ]
    
    # Ajouter variantes personnalisées
    if search_variants_extra:
        base_variants.extend(search_variants_extra)
    
    # Variantes avec fautes courantes
    if product_name:
        base_variants.extend([
            product_name.replace("é", "e"),
            product_name.replace("è", "e"),
            product_name.replace("à", "a"),
        ])
    
    # Caractéristiques fixes
    # Normaliser categorieAliment en minuscules pour alignement avec CategoryConfig
    categorie_aliment_normalized = {
        "Fruits": "fruits",
        "Légumes": "legumes",
        "Viandes": "viandes",
        "Poissons": "poissons",
        "Céréales": "cereales",
        "Produits laitiers": "produits_laitiers",
        "Épicerie": "epicerie"
    }.get(categorie_aliment, categorie_aliment.lower().replace(" ", "_"))
    
    fixed_chars = {
        "categorie": "Aliments",
        "categorieAliment": categorie_aliment_normalized,
        "typeAliment": type_aliment.lower() if type_aliment else None,
        "unite": unite
    }
    
    if marque:
        fixed_chars["marqueAliment"] = marque
    if origine:
        fixed_chars["origine"] = origine
    
    # Caractéristiques variables selon le type
    variable_chars = []
    
    if unite == "kg" or unite == "g":
        variable_chars.append({
            "field": "poids",
            "label": "Poids",
            "type": "number" if unite == "kg" else "select",
            "placeholder": f"Ex: 5" if unite == "kg" else None,
            "options": ["250g", "500g", "1kg", "2kg", "5kg"] if unite == "g" else None,
            "required": True,
            "impact_on_price": True
        })
    elif unite == "L" or unite == "ml":
        variable_chars.append({
            "field": "volume",
            "label": "Volume",
            "type": "select",
            "options": ["1L", "2L", "5L", "10L"] if unite == "L" else ["250ml", "500ml", "1L"],
            "required": True,
            "impact_on_price": True
        })
    elif unite == "pièce":
        variable_chars.append({
            "field": "quantite",
            "label": "Quantité",
            "type": "number",
            "placeholder": "Ex: 10",
            "required": True,
            "impact_on_price": True
        })
    
    # Origine
    if not origine:
        variable_chars.append({
            "field": "origine",
            "label": "Origine",
            "type": "select",
            "options": ["Cameroun", "Locale", "Importée", "Bio"],
            "required": False,
            "impact_on_price": True
        })
    
    # Conditionnement
    conditionnement_options = {
        "kg": ["En vrac", "Cagette", "Sachet", "Filet", "Barquette"],
        "g": ["Sachet", "Paquet", "Boîte"],
        "L": ["Bouteille", "Bidon", "Sachet"],
        "pièce": ["En vrac", "Sachet", "Barquette", "Douzaine"]
    }
    
    if unite in conditionnement_options:
        variable_chars.append({
            "field": "conditionnement",
            "label": "Conditionnement",
            "type": "select",
            "options": conditionnement_options[unite],
            "required": False,
            "impact_on_price": False
        })
    
    # Prix
    variable_chars.append({
        "field": "prix",
        "label": "Prix",
        "type": "number",
        "placeholder": "Ex: 2500",
        "required": True,
        "impact_on_price": True
    })
    
    # Variantes avec prix
    variants = variants_config or []
    
    return {
        "product_id": product_id,
        "category_code": "ALIMENTS",
        "autocomplete_key": autocomplete_key,
        "autocomplete_hint": f"Tapez {' + '.join(primary_keywords[:2])} (ex: {product_name})",
        "primary_keywords": primary_keywords,
        "product_name": product_name,
        "search_variants": list(set(base_variants)),  # Dédupliquer
        "fixed_characteristics": fixed_chars,
        "variable_characteristics": variable_chars,
        "currency": "FCFA",
        "variants": variants,
        "geographic_scope": {
            "countries": ["Cameroun", "Gabon", "Congo", "RDC", "Tchad", "RCA"],
            "regions": ["Afrique Centrale", "Afrique de l'Ouest"],
            "cities_popular": ["Douala", "Yaoundé", "Libreville", "Brazzaville"],
            "requires_location": False
        },
        "metadata": {
            "category": "aliments",
            "subcategory": categorie_aliment.lower().replace(" ", "_"),
            "brand_tier": "premium" if marque else "standard",
            "popularity_score": 85,
            "search_volume": "high",
            "seasonal": categorie_aliment == "Fruits",
            "target_audience": ["menages", "restaurants", "marchands"],
            "tags": [type_aliment.lower(), categorie_aliment.lower(), "cuisine"],
            "related_products": []
        },
        "additional_info": {
            "description_template": f"{product_name} {type_aliment.lower()}" + (" {origine}" if origine else "") + (", {poids} kg" if unite == "kg" else ", {volume}" if unite == "L" else ""),
            "common_accessories": [],
            "common_issues": [],
            "maintenance_cost": "none",
            "fuel_efficiency": None,
            "insurance_group": None
        },
        "collaborative": {
            "source": "ai_generated",
            "created_at": "2024-01-15T10:30:00Z",
            "created_by": "system",
            "verified": True,
            "verification_count": 0,
            "usage_count": 0,
            "last_updated": "2024-01-15T10:30:00Z",
            "missing_fields": [],
            "template_for_new": {
                "category_code": "ALIMENTS",
                "form_component": "FormAutoAliments",
                "required_fields": ["categorieAliment", "typeAliment", "poids" if unite in ["kg", "g"] else "volume" if unite in ["L", "ml"] else "quantite", "prix"],
                "optional_fields": ["marqueAliment", "origine", "conditionnement"],
                "helps": {
                    "categorieAliment": "Choisissez la catégorie : Fruits, Légumes, Viandes, Poissons, etc.",
                    "typeAliment": "Choisissez le type : Frais, Surgelé, Sec, En conserve",
                    "poids": "Poids en kg ou g selon le produit"
                }
            }
        }
    }

def generate_all_products() -> List[Dict[str, Any]]:
    """Génère tous les produits alimentaires"""
    products = []
    
    # ═══════════════════════════════════════════════════════
    # LÉGUMES FRAIS
    # ═══════════════════════════════════════════════════════
    legumes = [
        ("Tomate", "ALIMENTS-TOMATE-FRAIS", ["Tomate"], ["Tomatee", "Tomattes", "Tomate locale", "Tomate camerounaise"]),
        ("Oignon", "ALIMENTS-OIGNON-FRAIS", ["Oignon"], ["Ognion", "Oignion", "Oignon rouge", "Oignon blanc"]),
        ("Pomme de terre", "ALIMENTS-POMME-DE-TERRE-FRAIS", ["Pomme", "de", "terre"], ["Patate", "Patates", "Pom de terre"]),
        ("Carotte", "ALIMENTS-CAROTTE-FRAIS", ["Carotte"], ["Carrote", "Carotte locale"]),
        ("Haricot vert", "ALIMENTS-HARICOT-VERT-FRAIS", ["Haricot", "vert"], ["Haricots verts", "Haricot verts"]),
        ("Poivron", "ALIMENTS-POIVRON-FRAIS", ["Poivron"], ["Poivrons", "Poivron rouge", "Poivron vert"]),
        ("Aubergine", "ALIMENTS-AUBERGINE-FRAIS", ["Aubergine"], ["Aubergines", "Aubergine locale"]),
        ("Courgette", "ALIMENTS-COURGETTE-FRAIS", ["Courgette"], ["Courgettes", "Courgette locale"]),
        ("Concombre", "ALIMENTS-CONCOMBRE-FRAIS", ["Concombre"], ["Concombres", "Concombre locale"]),
        ("Salade", "ALIMENTS-SALADE-FRAIS", ["Salade"], ["Salades", "Salade verte", "Laitue"]),
        ("Chou", "ALIMENTS-CHOU-FRAIS", ["Chou"], ["Choux", "Chou blanc", "Chou vert"]),
        ("Gombo", "ALIMENTS-GOMBO-FRAIS", ["Gombo"], ["Gombos", "Gombo frais"]),
        ("Piment", "ALIMENTS-PIMENT-FRAIS", ["Piment"], ["Piments", "Piment fort", "Piment doux"]),
        ("Ail", "ALIMENTS-AIL-FRAIS", ["Ail"], ["Ails", "Ail frais"]),
        ("Gingembre", "ALIMENTS-GINGEMBRE-FRAIS", ["Gingembre"], ["Gingembres", "Gingembre frais"]),
    ]
    
    for nom, pid, keywords, extra_variants in legumes:
        products.append(generate_product(
            pid,
            f"{nom} fraîche" if nom != "Ail" and nom != "Gingembre" else f"{nom} frais",
            nom,
            keywords,
            "Légumes",
            "Frais",
            "kg",
            variants_config=[
                {"variant_id": f"{nom.lower().replace(' ', '_')}_1kg", "dimensions": {"poids": "1"}, "price_range": {"min": 500, "max": 1000}, "availability": "Disponible", "popular": True},
                {"variant_id": f"{nom.lower().replace(' ', '_')}_5kg", "dimensions": {"poids": "5"}, "price_range": {"min": 2000, "max": 4000}, "availability": "Disponible", "popular": True},
            ],
            search_variants_extra=extra_variants
        ))
    
    # ═══════════════════════════════════════════════════════
    # FRUITS FRAIS
    # ═══════════════════════════════════════════════════════
    fruits = [
        ("Mangue", "ALIMENTS-MANGUE-FRAIS", ["Mangue"], ["Manges", "Mangue Kent", "Mangue Amélie"]),
        ("Banane plantain", "ALIMENTS-BANANE-PLANTAIN-FRAIS", ["Banane", "plantain"], ["Plantain", "Plantains", "Plantin"]),
        ("Banane douce", "ALIMENTS-BANANE-DOUCE-FRAIS", ["Banane", "douce"], ["Bananes douces", "Banane sucrée"]),
        ("Ananas", "ALIMENTS-ANANAS-FRAIS", ["Ananas"], ["Ananass", "Ananas frais"]),
        ("Papaye", "ALIMENTS-PAPAYE-FRAIS", ["Papaye"], ["Papayes", "Papaye locale"]),
        ("Orange", "ALIMENTS-ORANGE-FRAIS", ["Orange"], ["Oranges", "Orange locale"]),
        ("Citron", "ALIMENTS-CITRON-FRAIS", ["Citron"], ["Citrons", "Citron vert", "Citron jaune"]),
        ("Avocat", "ALIMENTS-AVOCAT-FRAIS", ["Avocat"], ["Avocats", "Avocat locale"]),
        ("Pomme", "ALIMENTS-POMME-FRAIS", ["Pomme"], ["Pommes", "Pomme importée"]),
        ("Raisin", "ALIMENTS-RAISIN-FRAIS", ["Raisin"], ["Raisins", "Raisin importé"]),
        ("Fraise", "ALIMENTS-FRAISE-FRAIS", ["Fraise"], ["Fraises", "Fraise fraîche"]),
        ("Goyave", "ALIMENTS-GOYAVE-FRAIS", ["Goyave"], ["Goyaves", "Goyave locale"]),
        ("Pastèque", "ALIMENTS-PASTEQUE-FRAIS", ["Pastèque"], ["Pastèques", "Melon d'eau"]),
        ("Melon", "ALIMENTS-MELON-FRAIS", ["Melon"], ["Melons", "Melon locale"]),
    ]
    
    for nom, pid, keywords, extra_variants in fruits:
        products.append(generate_product(
            pid,
            f"{nom} fraîche" if nom.endswith("e") and nom != "Citron" else f"{nom} frais",
            nom,
            keywords,
            "Fruits",
            "Frais",
            "kg",
            variants_config=[
                {"variant_id": f"{nom.lower().replace(' ', '_')}_3kg", "dimensions": {"poids": "3"}, "price_range": {"min": 1500, "max": 3000}, "availability": "Disponible", "popular": True},
                {"variant_id": f"{nom.lower().replace(' ', '_')}_5kg", "dimensions": {"poids": "5"}, "price_range": {"min": 2500, "max": 5000}, "availability": "Disponible", "popular": True},
            ],
            search_variants_extra=extra_variants
        ))
    
    # ═══════════════════════════════════════════════════════
    # VIANDES FRAÎCHES
    # ═══════════════════════════════════════════════════════
    viandes = [
        ("Poulet entier", "ALIMENTS-POULET-ENTIER-FRAIS", ["Poulet", "entier"], ["Poulet fermier", "Poulet local"]),
        ("Cuisses de poulet", "ALIMENTS-CUISSES-POULET-FRAIS", ["Cuisses", "poulet"], ["Cuisses poulet", "Cuisses de poulet fraîches"]),
        ("Ailes de poulet", "ALIMENTS-AILES-POULET-FRAIS", ["Ailes", "poulet"], ["Ailes poulet", "Ailes de poulet fraîches"]),
        ("Viande de bœuf", "ALIMENTS-VIANDE-BOEUF-FRAIS", ["Viande", "bœuf"], ["Bœuf", "Boeuf", "Viande boeuf"]),
        ("Viande de porc", "ALIMENTS-VIANDE-PORC-FRAIS", ["Viande", "porc"], ["Porc", "Viande porc"]),
        ("Viande de chèvre", "ALIMENTS-VIANDE-CHEVRE-FRAIS", ["Viande", "chèvre"], ["Chèvre", "Chevre", "Viande chevre"]),
        ("Viande de veau", "ALIMENTS-VIANDE-VEAU-FRAIS", ["Viande", "veau"], ["Veau", "Viande veau"]),
    ]
    
    for nom, pid, keywords, extra_variants in viandes:
        products.append(generate_product(
            pid,
            f"{nom} frais",
            nom,
            keywords,
            "Viandes",
            "Frais",
            "kg",
            variants_config=[
                {"variant_id": f"{nom.lower().replace(' ', '_')}_1kg", "dimensions": {"poids": "1"}, "price_range": {"min": 2000, "max": 5000}, "availability": "Disponible", "popular": True},
                {"variant_id": f"{nom.lower().replace(' ', '_')}_2kg", "dimensions": {"poids": "2"}, "price_range": {"min": 4000, "max": 10000}, "availability": "Disponible", "popular": True},
            ],
            search_variants_extra=extra_variants
        ))
    
    # ═══════════════════════════════════════════════════════
    # POISSONS FRAIS
    # ═══════════════════════════════════════════════════════
    poissons = [
        ("Tilapia", "ALIMENTS-TILAPIA-FRAIS", ["Tilapia"], ["Tilipia", "Tilapya", "Poisson Tilapia"]),
        ("Maquereau", "ALIMENTS-MAQUEREAU-FRAIS", ["Maquereau"], ["Maquereaux", "Maquereau frais"]),
        ("Sardine", "ALIMENTS-SARDINE-FRAIS", ["Sardine"], ["Sardines", "Sardine fraîche"]),
        ("Thon", "ALIMENTS-THON-FRAIS", ["Thon"], ["Thons", "Thon frais"]),
        ("Crevette", "ALIMENTS-CREVETTE-FRAIS", ["Crevette"], ["Crevettes", "Crevette fraîche"]),
        ("Poisson frais", "ALIMENTS-POISSON-FRAIS-GENERIQUE", ["Poisson", "frais"], ["Poissons frais", "Poisson local"]),
    ]
    
    for nom, pid, keywords, extra_variants in poissons:
        products.append(generate_product(
            pid,
            f"{nom} frais",
            nom,
            keywords,
            "Poissons",
            "Frais",
            "kg",
            variants_config=[
                {"variant_id": f"{nom.lower().replace(' ', '_')}_1kg", "dimensions": {"poids": "1"}, "price_range": {"min": 2000, "max": 4000}, "availability": "Disponible", "popular": True},
                {"variant_id": f"{nom.lower().replace(' ', '_')}_2kg", "dimensions": {"poids": "2"}, "price_range": {"min": 4000, "max": 8000}, "availability": "Disponible", "popular": True},
            ],
            search_variants_extra=extra_variants
        ))
    
    # ═══════════════════════════════════════════════════════
    # PRODUITS LAITIERS
    # ═══════════════════════════════════════════════════════
    produits_laitiers = [
        ("Lait frais", "ALIMENTS-LAIT-FRAIS", ["Lait", "frais"], ["Lait local", "Lait camerounaise"]),
        ("Yaourt", "ALIMENTS-YAOURT-FRAIS", ["Yaourt"], ["Yaourts", "Yogourt", "Yogurt"]),
        ("Fromage", "ALIMENTS-FROMAGE-FRAIS", ["Fromage"], ["Fromages", "Fromage local"]),
        ("Beurre", "ALIMENTS-BEURRE-FRAIS", ["Beurre"], ["Beurres", "Beurre local"]),
        ("Œufs", "ALIMENTS-OEUFS-FRAIS", ["Œufs"], ["Oeufs", "Oeuf", "Œuf", "Œufs frais"]),
    ]
    
    for nom, pid, keywords, extra_variants in produits_laitiers:
        unite = "kg" if nom != "Œufs" else "pièce"
        products.append(generate_product(
            pid,
            f"{nom} frais",
            nom,
            keywords,
            "Produits laitiers",
            "Frais",
            unite,
            variants_config=[
                {"variant_id": f"{nom.lower().replace(' ', '_')}_1", "dimensions": {"poids": "1" if unite == "kg" else "12"}, "price_range": {"min": 1500, "max": 3000}, "availability": "Disponible", "popular": True},
            ],
            search_variants_extra=extra_variants
        ))
    
    # ═══════════════════════════════════════════════════════
    # CÉRÉALES & FÉCULENTS
    # ═══════════════════════════════════════════════════════
    cereales = [
        ("Riz Vietnam", "ALIMENTS-RIZ-VIETNAM-PREMIUM", ["Riz", "Vietnam"], ["Riz vietnamien", "Riz Premium Vietnam"], "Vietnam"),
        ("Riz Thaïlande", "ALIMENTS-RIZ-THAILANDE-PREMIUM", ["Riz", "Thaïlande"], ["Riz thailandais", "Riz Thaï"], "Thaïlande"),
        ("Riz Inde", "ALIMENTS-RIZ-INDE-PREMIUM", ["Riz", "Inde"], ["Riz indien", "Riz basmati"], "Inde"),
        ("Riz Cameroun", "ALIMENTS-RIZ-CAMEROUN-LOCAL", ["Riz", "Cameroun"], ["Riz locale", "Riz camerounaise"], "Cameroun"),
        ("Maïs", "ALIMENTS-MAIS-SEC", ["Maïs"], ["Mais", "Maïs sec"], "Cameroun"),
        ("Manioc", "ALIMENTS-MANIOC-SEC", ["Manioc"], ["Maniocs", "Manioc sec"], "Cameroun"),
        ("Igname", "ALIMENTS-IGNAME-FRAIS", ["Igname"], ["Ignames", "Igname frais"], "Cameroun"),
    ]
    
    for nom, pid, keywords, extra_variants, origine in cereales:
        products.append(generate_product(
            pid,
            f"{nom} Premium" if "Premium" in pid else f"{nom} frais" if "FRAIS" in pid else f"{nom} sec",
            nom,
            keywords,
            "Céréales",
            "Sec" if "sec" in pid.lower() else "Frais",
            "kg",
            origine=origine,
            variants_config=[
                {"variant_id": f"{nom.lower().replace(' ', '_')}_25kg", "dimensions": {"poids": "25", "conditionnement": "Sac 25kg"}, "price_range": {"min": 12000, "max": 18000}, "availability": "Disponible", "popular": True},
                {"variant_id": f"{nom.lower().replace(' ', '_')}_50kg", "dimensions": {"poids": "50", "conditionnement": "Sac 50kg"}, "price_range": {"min": 24000, "max": 35000}, "availability": "Disponible", "popular": True},
            ],
            search_variants_extra=extra_variants
        ))
    
    # ═══════════════════════════════════════════════════════
    # PRODUITS TRANSFORMÉS (MARQUES)
    # ═══════════════════════════════════════════════════════
    
    # Huiles
    huiles = [
        ("Huile d'arachide Dinor", "ALIMENTS-HUILE-ARACHIDE-DINOR", ["Huile", "Dinor"], ["Huile arachide Dinor", "Dinor 5L"], "Dinor", "Cameroun"),
        ("Huile de palme", "ALIMENTS-HUILE-PALME-LOCAL", ["Huile", "palme"], ["Huile palme locale", "Huile rouge"], None, "Cameroun"),
        ("Huile de tournesol", "ALIMENTS-HUILE-TOURNESOL", ["Huile", "tournesol"], ["Huile tournesol", "Huile de tournesol raffinée"], None, "Importée"),
    ]
    
    for nom, pid, keywords, extra_variants, marque, origine in huiles:
        products.append(generate_product(
            pid,
            f"{nom} 5L",
            nom.split()[0] + " " + (marque if marque else ""),
            keywords,
            "Épicerie",
            "Sec",
            "L",
            marque=marque,
            origine=origine,
            variants_config=[
                {"variant_id": f"{nom.lower().replace(' ', '_')}_1l", "dimensions": {"volume": "1L"}, "price_range": {"min": 1800, "max": 2500}, "availability": "Disponible", "popular": True},
                {"variant_id": f"{nom.lower().replace(' ', '_')}_5l", "dimensions": {"volume": "5L"}, "price_range": {"min": 8000, "max": 12000}, "availability": "Disponible", "popular": True},
            ],
            search_variants_extra=extra_variants
        ))
    
    # Pâtes
    pates = [
        ("Spaghetti Barilla", "ALIMENTS-SPAGHETTI-BARILLA-500G", ["Spaghetti", "Barilla"], ["Spaghettis Barilla", "Spaguetti Barilla"], "Barilla", "Italie"),
        ("Macaroni", "ALIMENTS-MACARONI-GENERIQUE", ["Macaroni"], ["Macaronis", "Macaroni pâtes"], None, "Importée"),
        ("Couscous", "ALIMENTS-COUSCOUS-GENERIQUE", ["Couscous"], ["Couscous semoule", "Couscous moyen"], None, "Importée"),
    ]
    
    for nom, pid, keywords, extra_variants, marque, origine in pates:
        products.append(generate_product(
            pid,
            f"{nom} 500g",
            nom,
            keywords,
            "Épicerie",
            "Sec",
            "g",
            marque=marque,
            origine=origine,
            variants_config=[
                {"variant_id": f"{nom.lower().replace(' ', '_')}_500g", "dimensions": {"poids": "500g"}, "price_range": {"min": 1000, "max": 1500}, "availability": "Disponible", "popular": True},
                {"variant_id": f"{nom.lower().replace(' ', '_')}_1kg", "dimensions": {"poids": "1kg"}, "price_range": {"min": 2000, "max": 3000}, "availability": "Disponible", "popular": True},
            ],
            search_variants_extra=extra_variants
        ))
    
    # Boissons chaudes
    boissons_chaudes = [
        ("Café Nescafé", "ALIMENTS-CAFE-NESCAFE-200G", ["Café", "Nescafé"], ["Café soluble Nescafé", "Nescafe"], "Nescafé", "Brésil"),
        ("Thé Lipton", "ALIMENTS-THE-LIPTON-100G", ["Thé", "Lipton"], ["Thé Lipton", "Lipton thé"], "Lipton", "Importée"),
    ]
    
    for nom, pid, keywords, extra_variants, marque, origine in boissons_chaudes:
        products.append(generate_product(
            pid,
            f"{nom} 200g" if "Café" in nom else f"{nom} 100g",
            nom,
            keywords,
            "Épicerie",
            "Sec",
            "g",
            marque=marque,
            origine=origine,
            variants_config=[
                {"variant_id": f"{nom.lower().replace(' ', '_')}_100g", "dimensions": {"poids": "100g"}, "price_range": {"min": 1800, "max": 2500}, "availability": "Disponible", "popular": True},
                {"variant_id": f"{nom.lower().replace(' ', '_')}_200g", "dimensions": {"poids": "200g"}, "price_range": {"min": 3200, "max": 4500}, "availability": "Disponible", "popular": True},
            ],
            search_variants_extra=extra_variants
        ))
    
    # Lait en poudre
    lait_poudre = [
        ("Lait en poudre Nido", "ALIMENTS-LAIT-POUDRE-NIDO-400G", ["Lait", "Nido"], ["Lait poudre Nido", "Nido lait"], "Nido", "Europe"),
        ("Lait en poudre Peak", "ALIMENTS-LAIT-POUDRE-PEAK-400G", ["Lait", "Peak"], ["Lait poudre Peak", "Peak lait"], "Peak", "Europe"),
    ]
    
    for nom, pid, keywords, extra_variants, marque, origine in lait_poudre:
        products.append(generate_product(
            pid,
            f"{nom} 400g",
            nom.split()[0] + " " + marque,
            keywords,
            "Produits laitiers",
            "Sec",
            "g",
            marque=marque,
            origine=origine,
            variants_config=[
                {"variant_id": f"{nom.lower().replace(' ', '_')}_400g", "dimensions": {"poids": "400g"}, "price_range": {"min": 4000, "max": 5500}, "availability": "Disponible", "popular": True},
                {"variant_id": f"{nom.lower().replace(' ', '_')}_900g", "dimensions": {"poids": "900g"}, "price_range": {"min": 8500, "max": 11000}, "availability": "Disponible", "popular": True},
            ],
            search_variants_extra=extra_variants
        ))
    
    # Condiments
    condiments = [
        ("Bouillon cube Maggi", "ALIMENTS-BOUILLON-MAGGI-100G", ["Bouillon", "Maggi"], ["Cube Maggi", "Maggi cube"], "Maggi", "Afrique de l'Ouest"),
        ("Sucre Sosucam", "ALIMENTS-SUCRE-SOSUCAM-1KG", ["Sucre", "Sosucam"], ["Sucre Sosucam", "Sosucam sucre"], "Sosucam", "Cameroun"),
        ("Sel", "ALIMENTS-SEL-GENERIQUE", ["Sel"], ["Sel fin", "Sel de cuisine"], None, "Cameroun"),
    ]
    
    for nom, pid, keywords, extra_variants, marque, origine in condiments:
        unite = "kg" if "Sucre" in nom or "Sel" in nom else "g"
        products.append(generate_product(
            pid,
            f"{nom} {'1kg' if unite == 'kg' else '100g'}",
            nom,
            keywords,
            "Épicerie",
            "Sec",
            unite,
            marque=marque,
            origine=origine,
            variants_config=[
                {"variant_id": f"{nom.lower().replace(' ', '_')}_1kg" if unite == "kg" else f"{nom.lower().replace(' ', '_')}_100g", "dimensions": {"poids": "1kg" if unite == "kg" else "100g"}, "price_range": {"min": 500, "max": 1500}, "availability": "Disponible", "popular": True},
            ],
            search_variants_extra=extra_variants
        ))
    
    return products

if __name__ == "__main__":
    print("Génération de la base de données ALIMENTS.json...")
    products = generate_all_products()
    print(f"✅ {len(products)} produits générés")
    
    # Sauvegarder en JSON
    output_file = "ALIMENTS.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(products, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Fichier {output_file} créé avec succès !")
    print(f"📊 Statistiques:")
    print(f"   - Total produits: {len(products)}")
    print(f"   - Taille fichier: {len(json.dumps(products, ensure_ascii=False))} caractères")

