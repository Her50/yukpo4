#!/usr/bin/env python3
"""
Script pour détecter les routes dupliquées dans le backend Rust/Axum
"""
import re
import os
from collections import defaultdict
from pathlib import Path

def extract_routes_from_file(file_path):
    """Extrait toutes les routes d'un fichier Rust"""
    routes = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Pattern pour trouver .route("...", method(...))
        # On cherche les patterns comme .route("/api/...", get(...)) ou .route("/api/...", post(...))
        pattern = r'\.route\s*\(\s*"([^"]+)"\s*,\s*(get|post|put|delete|patch|head|options)'
        matches = re.finditer(pattern, content, re.MULTILINE)
        
        for match in matches:
            route_path = match.group(1)
            method = match.group(2).upper()
            routes.append((method, route_path, str(file_path)))
            
        # Aussi chercher les routes avec plusieurs méthodes sur la même ligne
        # Pattern: .route("/path", get(...).post(...))
        pattern2 = r'\.route\s*\(\s*"([^"]+)"\s*,\s*([^)]+)\)'
        matches2 = re.finditer(pattern2, content, re.MULTILINE)
        
        for match in matches2:
            route_path = match.group(1)
            methods_str = match.group(2)
            # Extraire toutes les méthodes
            methods = re.findall(r'\b(get|post|put|delete|patch|head|options)\s*\(', methods_str, re.IGNORECASE)
            for method in methods:
                routes.append((method.upper(), route_path, str(file_path)))
                
    except Exception as e:
        print(f"Erreur lors de la lecture de {file_path}: {e}")
    
    return routes

def normalize_route(route):
    """Normalise une route pour la comparaison (remplace {param} par un placeholder)"""
    # Remplacer {param} par :param pour la comparaison
    normalized = re.sub(r'\{[^}]+\}', '{param}', route)
    return normalized

def find_duplicate_routes():
    """Trouve toutes les routes dupliquées"""
    routes_dir = Path("backend/src/routes")
    websocket_dir = Path("backend/src/websocket")
    routers_dir = Path("backend/src/routers")
    
    all_routes = []
    
    # Parcourir tous les fichiers .rs dans routes/
    if routes_dir.exists():
        for file_path in routes_dir.rglob("*.rs"):
            routes = extract_routes_from_file(file_path)
            all_routes.extend(routes)
    
    # Parcourir tous les fichiers .rs dans websocket/
    if websocket_dir.exists():
        for file_path in websocket_dir.rglob("*.rs"):
            routes = extract_routes_from_file(file_path)
            all_routes.extend(routes)
    
    # Parcourir tous les fichiers .rs dans routers/
    if routers_dir.exists():
        for file_path in routers_dir.rglob("*.rs"):
            routes = extract_routes_from_file(file_path)
            all_routes.extend(routes)
    
    # Grouper par méthode + route (normalisée)
    route_map = defaultdict(list)
    for method, route, file_path in all_routes:
        # Normaliser la route pour la comparaison
        normalized_route = normalize_route(route)
        key = f"{method} {normalized_route}"
        route_map[key].append((file_path, route))  # Garder la route originale aussi
    
    # Trouver les doublons (même méthode + même chemin dans des fichiers différents)
    duplicates = {}
    for key, entries in route_map.items():
        # Extraire les fichiers uniques
        unique_files = list(set([entry[0] for entry in entries]))
        if len(unique_files) > 1:
            # C'est un vrai conflit - même route dans plusieurs fichiers
            duplicates[key] = {
                'files': unique_files,
                'routes': [entry[1] for entry in entries]
            }
    
    return duplicates

def main():
    print("🔍 Recherche de routes dupliquées...\n")
    
    duplicates = find_duplicate_routes()
    
    if duplicates:
        print(f"❌ {len(duplicates)} route(s) dupliquée(s) trouvée(s):\n")
        for route_key, info in sorted(duplicates.items()):
            print(f"  {route_key}")
            print(f"    Routes trouvées: {', '.join(set(info['routes']))}")
            for file in info['files']:
                print(f"    - {file}")
            print()
    else:
        print("✅ Aucune route dupliquée trouvée!")
    
    return len(duplicates)

if __name__ == "__main__":
    exit(main())

