import requests
import time
import json

def test_geocoding_performance():
    """Test des performances du géocodage optimisé"""
    
    # Coordonnées de test (différentes villes du Cameroun)
    test_coordinates = [
        {"latitude": 3.848033, "longitude": 11.502075},  # Yaoundé
        {"latitude": 4.051056, "longitude": 9.767869},   # Douala
        {"latitude": 5.479413, "longitude": 10.394933},  # Bafoussam
        {"latitude": 3.885113, "longitude": 11.517043},  # Yaoundé (Bastos)
        {"latitude": 4.040000, "longitude": 9.710000},   # Douala (Akwa)
        {"latitude": 9.818119, "longitude": 4.033687},   # Nigeria (test)
        {"latitude": 3.848033, "longitude": 11.502075},  # Yaoundé (dupliqué pour test cache)
        {"latitude": 4.051056, "longitude": 9.767869},   # Douala (dupliqué pour test cache)
    ]
    
    print("🚀 Test des performances du géocodage optimisé")
    print("=" * 60)
    
    # Test 1: Géocodage séquentiel (ancienne méthode)
    print("\n📊 Test 1: Géocodage séquentiel (ancienne méthode)")
    start_time = time.time()
    
    for i, coords in enumerate(test_coordinates):
        try:
            response = requests.post(
                "http://localhost:3001/api/geocoding/reverse",
                json=coords,
                timeout=3  # Timeout ultra-court pour une recherche INSTANTANÉE
            )
            if response.status_code == 200:
                data = response.json()
                print(f"  {i+1:2d}. {coords['latitude']:.6f}, {coords['longitude']:.6f} → {data.get('formatted_address', 'Erreur')}")
            else:
                print(f"  {i+1:2d}. Erreur HTTP {response.status_code}")
        except Exception as e:
            print(f"  {i+1:2d}. Erreur: {e}")
    
    sequential_time = time.time() - start_time
    print(f"  ⏱️  Temps total: {sequential_time:.3f}s")
    print(f"  📈 Temps moyen par coordonnée: {sequential_time/len(test_coordinates):.3f}s")
    
    # Test 2: Géocodage en lot (nouvelle méthode)
    print("\n📊 Test 2: Géocodage en lot (nouvelle méthode)")
    start_time = time.time()
    
    try:
        # Simuler un appel en lot (le backend ne supporte pas encore le vrai batch)
        # Mais on peut mesurer le temps total
        batch_start = time.time()
        
        # Traitement parallèle simulé
        import concurrent.futures
        
        def geocode_single(coords):
            try:
                response = requests.post(
                    "http://localhost:3001/api/geocoding/reverse",
                    json=coords,
                    timeout=3  # Timeout ultra-court pour une recherche INSTANTANÉE
                )
                if response.status_code == 200:
                    data = response.json()
                    return f"{coords['latitude']:.6f}, {coords['longitude']:.6f} → {data.get('formatted_address', 'Erreur')}"
                else:
                    return f"Erreur HTTP {response.status_code}"
            except Exception as e:
                return f"Erreur: {e}"
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            results = list(executor.map(geocode_single, test_coordinates))
        
        for i, result in enumerate(results):
            print(f"  {i+1:2d}. {result}")
        
        batch_time = time.time() - batch_start
        print(f"  ⏱️  Temps total: {batch_time:.3f}s")
        print(f"  📈 Temps moyen par coordonnée: {batch_time/len(test_coordinates):.3f}s")
        
    except Exception as e:
        print(f"  ❌ Erreur lors du test en lot: {e}")
    
    # Test 3: Test de cache
    print("\n📊 Test 3: Test de cache (coordonnées dupliquées)")
    start_time = time.time()
    
    # Géocoder à nouveau les coordonnées dupliquées
    duplicate_coords = [
        {"latitude": 3.848033, "longitude": 11.502075},  # Yaoundé
        {"latitude": 4.051056, "longitude": 9.767869},   # Douala
    ]
    
    for i, coords in enumerate(duplicate_coords):
        try:
            response = requests.post(
                "http://localhost:3001/api/geocoding/reverse",
                json=coords,
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                print(f"  {i+1:2d}. {coords['latitude']:.6f}, {coords['longitude']:.6f} → {data.get('formatted_address', 'Erreur')} (cache)")
            else:
                print(f"  {i+1:2d}. Erreur HTTP {response.status_code}")
        except Exception as e:
            print(f"  {i+1:2d}. Erreur: {e}")
    
    cache_time = time.time() - start_time
    print(f"  ⏱️  Temps total: {cache_time:.3f}s")
    print(f"  📈 Temps moyen par coordonnée: {cache_time/len(duplicate_coords):.3f}s")
    
    # Résumé des performances
    print("\n" + "=" * 60)
    print("📊 RÉSUMÉ DES PERFORMANCES")
    print("=" * 60)
    print(f"🔴 Géocodage séquentiel: {sequential_time:.3f}s")
    print(f"🟡 Géocodage en lot: {batch_time:.3f}s")
    print(f"🟢 Test de cache: {cache_time:.3f}s")
    
    if batch_time < sequential_time:
        improvement = ((sequential_time - batch_time) / sequential_time) * 100
        print(f"✅ Amélioration: {improvement:.1f}% plus rapide avec le lot")
    else:
        print("⚠️  Le géocodage en lot n'a pas amélioré les performances")
    
    print(f"📈 Gain de temps: {sequential_time - batch_time:.3f}s")
    print(f"🚀 Vitesse d'amélioration: {sequential_time/batch_time:.1f}x plus rapide")

if __name__ == "__main__":
    test_geocoding_performance() 