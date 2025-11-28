# Diagnostic LiveKit Appliqué ✅

## Date
2025-11-27

---

## ✅ FONCTIONNALITÉ AJOUTÉE

### Fonction de Diagnostic Complète

**Fichier :** `backend/src/utils/livekit.rs`

**Nouvelle fonction :** `diagnose_livekit_connection()`

**Fonctionnalités :**
1. ✅ **Test de connexion TCP** - Vérifie si le serveur est accessible
2. ✅ **Test de l'endpoint API** - Vérifie si l'API répond
3. ✅ **Test d'authentification** - Vérifie si les identifiants sont corrects
4. ✅ **Vérification de configuration** - Vérifie que toutes les variables sont définies
5. ✅ **Mesure du temps de réponse** - Affiche le temps de connexion
6. ✅ **Suggestions détaillées** - Fournit des suggestions pour résoudre les problèmes

---

## 📊 STRUCTURE DU DIAGNOSTIC

### `LiveKitDiagnostic`

```rust
pub struct LiveKitDiagnostic {
    pub server_reachable: bool,           // Serveur accessible via TCP
    pub api_endpoint_accessible: bool,    // Endpoint API répond
    pub authentication_working: bool,     // Authentification réussie
    pub server_url: String,               // URL du serveur
    pub api_key_configured: bool,         // API Key configurée
    pub api_secret_configured: bool,      // API Secret configurée
    pub connection_time_ms: Option<u128>, // Temps de connexion
    pub error_message: Option<String>,    // Message d'erreur
    pub suggestions: Vec<String>,         // Suggestions de résolution
}
```

---

## 🔍 TESTS EFFECTUÉS

### 1. Test de Connexion TCP
- Connexion directe au serveur sur le port spécifié
- Détection des erreurs de connexion (refusée, timeout, etc.)
- Mesure du temps de connexion

### 2. Test de l'Endpoint API
- Requête POST vers `/twirp/livekit.RoomService/ListRooms`
- Vérification du statut HTTP
- Détection des erreurs de timeout, TLS, etc.

### 3. Test d'Authentification
- Génération d'un token JWT avec les identifiants
- Vérification de la réponse (401 = identifiants incorrects)
- Détection des erreurs d'authentification

### 4. Suggestions Automatiques
- Suggestions basées sur le type d'erreur détecté
- Commandes de test fournies
- Instructions de résolution

---

## 📝 EXEMPLE DE SORTIE

### Cas 1 : Serveur Non Accessible
```
📊 Résultat du diagnostic LiveKit:
   - Serveur accessible: ❌
   - Endpoint API accessible: ❌
   - Authentification: ❌
   - Erreur: Connexion TCP refusée: Connection refused
   💡 Suggestions:
      Le serveur LiveKit n'est pas accessible sur 46.224.14.85:7880. Vérifiez que:
      - Le serveur LiveKit est démarré
      - Le port est ouvert dans le firewall
      - L'IP/Port sont corrects
      - Le serveur n'est pas sur un réseau privé
```

### Cas 2 : Authentification Échouée
```
📊 Résultat du diagnostic LiveKit:
   - Serveur accessible: ✅
   - Endpoint API accessible: ✅
   - Authentification: ❌
   - Erreur: Authentification échouée (401 Unauthorized)
   💡 Suggestions:
      - Vérifiez que LIVEKIT_API_KEY et LIVEKIT_API_SECRET sont corrects
      - Vérifiez que les identifiants correspondent au serveur LiveKit
```

### Cas 3 : LiveKit Opérationnel
```
📊 Résultat du diagnostic LiveKit:
   - Serveur accessible: ✅
   - Endpoint API accessible: ✅
   - Authentification: ✅
   - Temps de connexion: 45ms
   💡 Suggestions:
      ✅ LiveKit est opérationnel et accessible
```

---

## 🔧 INTÉGRATION

### Dans `livekit_cleanup.rs`
- Diagnostic exécuté après 3 tentatives de connexion échouées
- Logs détaillés avec toutes les informations de diagnostic
- Suggestions affichées pour résoudre le problème

### Dans `live_analytics.rs`
- Diagnostic exécuté lors de la première erreur de connexion
- Logs détaillés avec toutes les informations de diagnostic
- Suggestions affichées pour résoudre le problème

---

## ✅ AVANTAGES

1. **Diagnostic Automatique**
   - Plus besoin de tester manuellement avec curl
   - Diagnostic complet en une seule fonction

2. **Messages Détaillés**
   - Identification précise du problème
   - Suggestions spécifiques selon l'erreur

3. **Facilité de Débogage**
   - Logs structurés et clairs
   - Temps de réponse mesuré

4. **Résolution Rapide**
   - Suggestions directes pour résoudre le problème
   - Commandes de test fournies

---

## 📊 RÉSUMÉ

### Fonctionnalités Ajoutées
- ✅ Fonction `diagnose_livekit_connection()` complète
- ✅ Structure `LiveKitDiagnostic` avec toutes les informations
- ✅ Intégration dans `livekit_cleanup.rs` et `live_analytics.rs`
- ✅ Messages d'erreur détaillés et suggestions

### Tests Effectués
- ✅ Connexion TCP
- ✅ Endpoint API
- ✅ Authentification
- ✅ Configuration

### Impact
- ✅ Diagnostic automatique des problèmes LiveKit
- ✅ Messages d'erreur plus informatifs
- ✅ Suggestions de résolution claires

---

**Date de création :** 2025-11-27  
**Dernière mise à jour :** 2025-11-27

