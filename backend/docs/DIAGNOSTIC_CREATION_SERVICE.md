# 🔍 Diagnostic Complet - Problèmes de Création de Service

## Problème Observé
- **Symptôme** : Erreur "Network request failed" côté mobile lors de la création de service
- **Logs serveur** : Message d'erreur vide `{}` dans les logs mobiles

## Correction Appliquée (Symptôme)
✅ **Handler `handle_creer_service`** : Retourne maintenant la réponse complète avec JSON d'erreur au lieu d'un simple StatusCode

## Analyse à la Racine - Points d'Échec Possibles

### 1. Validation JSON (`valider_service_json`)
**Fichier**: `backend/src/services/creer_service.rs:1177`

**Erreurs possibles**:
- JSON invalide (pas d'objet JSON)
- Champ `titre_service.valeur` vide
- Structure JSON mal formée

**Impact**: Retourne `AppError::BadRequest` → Devrait être capturé ✅

### 2. Validation Produit (`validate_product_data_strict`)
**Fichier**: `backend/src/services/creer_service.rs:1691`

**Erreurs possibles**:
- Produit invalide (champs manquants, types incorrects)
- Validation stricte échoue pour un produit

**Impact**: Retourne `AppError::BadRequest` → Devrait être capturé ✅

### 3. Solde Insuffisant
**Fichier**: `backend/src/services/creer_service.rs:1756`

**Erreurs possibles**:
- `current_balance < cout_reel_xaf`
- Erreur lors de la récupération du solde (DB)

**Impact**: 
- Solde insuffisant → `AppError::BadRequest` ✅
- Erreur DB → `AppError::Internal` → Risque de timeout/crash ⚠️

### 4. JSON Trop Volumineux
**Fichier**: `backend/src/services/creer_service.rs:2038`

**Erreurs possibles**:
- JSON > 8000 bytes après nettoyage
- Limite PostgreSQL index: 8191 bytes

**Impact**: Retourne `AppError::Internal` → Devrait être capturé ✅

### 5. Transaction Database - INSERT Services
**Fichier**: `backend/src/services/creer_service.rs:2146-2190`

**Erreurs possibles**:
- ❌ **CRITIQUE**: Connexion DB fermée/crash (TLS error, timeout)
- ❌ **CRITIQUE**: Contrainte NOT NULL violée (user_id, data)
- ❌ **CRITIQUE**: Foreign key violation (user_id n'existe pas)
- ❌ **CRITIQUE**: JSON trop volumineux pour l'index (malgré vérification préalable)
- Erreur de transaction (lock timeout, deadlock)

**Gestion actuelle**:
- Retry avec backoff (5 tentatives)
- Rollback automatique en cas d'erreur
- Log détaillé de l'erreur

**⚠️ PROBLÈME IDENTIFIÉ**: Si l'erreur n'est pas dans la liste des erreurs "retryable", le retry échoue immédiatement. Les erreurs de contrainte (NOT NULL, FK) ne sont PAS retryables mais doivent être loggées clairement.

### 6. Traitement des Médias (Base64)
**Fichier**: `backend/src/services/creer_service.rs:2270+`

**Erreurs possibles**:
- ❌ **CRITIQUE**: Timeout lors de la sauvegarde d'image base64 (30s par image)
- ❌ **CRITIQUE**: Erreur S3/Wasabi (MediaStorageService)
- ❌ **CRITIQUE**: Mémoire insuffisante pour décoder base64 volumineux
- Erreur écriture fichier local

**Impact**: 
- Timeout → `AppError::Internal("Timeout sauvegarde image base64")` ✅
- Erreur S3 → Non gérée explicitement → Risque de crash ⚠️
- Mémoire → Panic Rust → Crash serveur ❌

### 7. Timeout Global de la Requête
**Fichier**: `mobile/src/services/api.ts:290`

**Configuration**:
- Timeout client: 180s (3 minutes)
- Timeout par image: 30s
- Si plusieurs images → temps cumulé peut dépasser 180s

**Impact**: Si le traitement prend > 180s, le client reçoit "Network request failed" même si le serveur fonctionne ✅ (mais nécessite optimisation)

### 8. Problèmes de Mémoire
**Scénarios**:
- Décodage base64 de plusieurs images volumineuses en parallèle
- Chargement complet des médias en mémoire avant upload
- JSON très volumineux avant nettoyage

**Impact**: Panic Rust → Crash serveur → "Network request failed" ❌

## Recommandations d'Amélioration

### 1. Améliorer la Gestion des Erreurs SQL
```rust
// Dans execute_critical_transaction, distinguer erreurs retryable vs non-retryable
let is_retryable = error_str.contains("peer closed connection")
    || error_str.contains("TLS close_notify")
    || // ... erreurs réseau
    
let is_constraint_error = error_str.contains("violates not-null constraint")
    || error_str.contains("violates foreign key constraint")
    || error_str.contains("duplicate key value");

if is_constraint_error {
    // Ne pas retry, log clairement l'erreur
    log::error!("[creer_service] ❌ Erreur de contrainte DB: {}", error_str);
    return Err(AppError::BadRequest(format!("Données invalides: {}", error_str)));
}
```

### 2. Limiter la Taille des Médias en Entrée
- Valider la taille des images base64 avant traitement
- Rejeter les images > 10MB avant décodage
- Compresser automatiquement les images avant sauvegarde (déjà fait partiellement)

### 3. Traitement Séquentiel des Médias
- Éviter le traitement parallèle de plusieurs médias volumineux
- Traiter les médias un par un avec timeout individuel
- Utiliser streaming pour les médias > 5MB

### 4. Améliorer les Logs
- Logger l'erreur SQL complète avec contexte (user_id, json_size, etc.)
- Logger les timeouts avec durée réelle
- Logger les problèmes de mémoire (si détectables)

### 5. Validation Préalable Plus Stricte
- Valider la taille totale des médias avant traitement
- Valider le format JSON AVANT validation métier
- Valider l'existence de user_id AVANT transaction

### 6. Monitoring et Alertes
- Ajouter des métriques Prometheus pour :
  - Temps de création de service
  - Taux d'échec par type d'erreur
  - Taille moyenne des JSON
  - Nombre de médias par service

## Points à Vérifier Immédiatement

1. **Logs serveur complets** : Vérifier les logs backend pour voir l'erreur SQL exacte
2. **Taille des requêtes** : Vérifier la taille des payloads envoyés par le mobile
3. **Métriques Prometheus** : Vérifier les métriques de création de service
4. **Base de données** : Vérifier les contraintes et indexes sur la table `services`
5. **Mémoire serveur** : Vérifier l'utilisation mémoire lors des créations

## Action Immédiate

**Vérifier les logs serveur** pour identifier l'erreur SQL exacte lors de l'INSERT dans `services` :
```sql
-- Vérifier les contraintes sur services
SELECT conname, contype, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'services'::regclass;

-- Vérifier les indexes (taille max)
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'services';
```

