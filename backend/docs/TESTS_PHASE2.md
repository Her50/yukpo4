# Tests Phase 2 - Optimisations

## ✅ Rate Limiting

### Test 1: Rate Limiting Global (par IP)
```bash
# Tester avec curl (100 requêtes rapides)
for i in {1..101}; do
  curl -X POST http://localhost:3001/api/delivery \
    -H "Content-Type: application/json" \
    -d '{"test": "data"}' \
    -w "\nStatus: %{http_code}\n"
done
# Attendu: Les 100 premières réussissent, la 101ème retourne 429 Too Many Requests
```

### Test 2: Rate Limiting par Utilisateur
```bash
# Tester avec token JWT valide
TOKEN="your_jwt_token"
for i in {1..61}; do
  curl -X POST http://localhost:3001/api/delivery/123/status \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status": "accepted"}' \
    -w "\nStatus: %{http_code}\n"
done
# Attendu: Les 60 premières réussissent, la 61ème retourne 429
```

## ✅ WebSocket Optimisations

### Test 1: Batching Automatique
```javascript
// Client WebSocket test
const ws = new WebSocket('ws://localhost:3001/api/delivery/123/ws');

let messageCount = 0;
ws.onmessage = (event) => {
  messageCount++;
  console.log(`Message ${messageCount}:`, event.data);
  
  // Envoyer 15 messages rapides (devrait créer 2 batches)
  if (messageCount === 1) {
    for (let i = 0; i < 15; i++) {
      // Simuler envoi depuis serveur
    }
  }
};

// Attendu: Messages groupés par batch de 10 ou flush toutes les 100ms
```

### Test 2: Compression
```bash
# Tester avec message volumineux (>1KB)
# Le serveur devrait compresser automatiquement
curl -X POST http://localhost:3001/api/delivery/123/tracking \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitude": 48.8566, "longitude": 2.3522, "data": "'$(python3 -c "print('x' * 2000)")'"}'
```

## ✅ Archivage Automatique

### Test 1: Vérification Fonction SQL
```sql
-- Vérifier que la fonction existe
SELECT proname FROM pg_proc WHERE proname = 'archive_old_deliveries';

-- Tester manuellement (si des livraisons > 90 jours existent)
SELECT archived_count, deleted_count FROM archive_old_delivery();

-- Vérifier les partitions
SELECT tablename FROM pg_tables WHERE tablename LIKE 'deliveries_%';
```

### Test 2: Worker d'Archivage
```bash
# Vérifier les logs au démarrage
grep "DeliveryArchive" logs/app.log

# Forcer l'exécution (modifier temporairement le code pour exécuter immédiatement)
# Attendu: Logs montrant l'archivage et la création de partitions
```

### Test 3: Création Partitions Futures
```sql
-- Appeler manuellement
SELECT create_future_delivery_partitions();

-- Vérifier les nouvelles partitions créées
SELECT tablename FROM pg_tables 
WHERE tablename LIKE 'deliveries_%' 
ORDER BY tablename;
```

## 📊 Métriques à Surveiller

### Rate Limiting
- Nombre de requêtes bloquées (429)
- Temps de réponse moyen
- Distribution des requêtes par IP/user

### WebSocket
- Taille moyenne des messages
- Ratio compression (avant/après)
- Nombre de batches créés
- Latence des messages critiques

### Archivage
- Nombre de livraisons archivées par exécution
- Taille de la table deliveries (avant/après)
- Performance des requêtes sur table principale

## 🔧 Commandes Utiles

```bash
# Vérifier les connexions WebSocket actives
psql -c "SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active';"

# Vérifier la taille des tables
psql -c "SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE tablename LIKE 'deliveries%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"

# Vérifier les index
psql -c "SELECT indexname, tablename FROM pg_indexes WHERE tablename LIKE 'deliveries%';"
```

