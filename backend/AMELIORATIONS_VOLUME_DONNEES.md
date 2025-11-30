# 🚀 Améliorations des limites de volume de données

## 📋 Résumé

Modifications apportées pour permettre à l'application de gérer des données plus volumineuses (images, vidéos, documents base64).

## ✅ Modifications effectuées

### 1. Limite globale augmentée
- **Fichier** : `backend/src/middlewares/request_size_limit.rs`
- **Changement** : Limite globale portée de **100 MB** à **200 MB**
- **Raison** : Cohérence avec le frontend (200 MB) et nginx (500 MB)

### 2. Routes critiques avec DefaultBodyLimit

#### `/api/services/{service_id}/products` (AjouterProduitSimple)
- **Fichier** : `backend/src/routers/router_yukpo.rs`
- **Limite** : **200 MB** (augmentée de 100 MB)
- **Usage** : Ajout de produits avec images/vidéos base64

#### `/api/ia/creation-service` (Création de service intelligente)
- **Fichier** : `backend/src/routers/router_yukpo.rs`
- **Limite** : **200 MB** (nouveau)
- **Usage** : Création de service avec images/vidéos/documents base64

#### `/api/search/direct` (Recherche directe avec images)
- **Fichier** : `backend/src/routers/router_yukpo.rs`
- **Limite** : **200 MB** (nouveau)
- **Usage** : Recherche de produits avec images base64

#### `/api/ia/auto` (Yukpo IA automatique)
- **Fichier** : `backend/src/routers/router_yukpo.rs`
- **Limite** : **200 MB** (nouveau)
- **Usage** : Requêtes IA avec médias base64

#### `/api/media/upload-proof` (Preuve de livraison)
- **Fichier** : `backend/src/routers/router_yukpo.rs`
- **Limite** : **100 MB**
- **Usage** : Upload de médias de preuve (images/vidéos)

#### `/api/upload` (Upload préalable)
- **Fichier** : `backend/src/routes/upload_routes.rs`
- **Limite** : **200 MB** (augmentée de 50 MB)
- **Usage** : Upload préalable de plusieurs fichiers

## 📊 Tableau récapitulatif

| Route | Ancienne limite | Nouvelle limite | Statut |
|-------|----------------|-----------------|--------|
| Middleware global | 100 MB | **200 MB** | ✅ Modifié |
| `/api/services/{id}/products` | 100 MB | **200 MB** | ✅ Modifié |
| `/api/ia/creation-service` | Aucune | **200 MB** | ✅ Ajouté |
| `/api/search/direct` | Aucune | **200 MB** | ✅ Ajouté |
| `/api/ia/auto` | Aucune | **200 MB** | ✅ Ajouté |
| `/api/media/upload-proof` | Aucune | **100 MB** | ✅ Ajouté |
| `/api/upload` | 50 MB | **200 MB** | ✅ Modifié |

## 🎯 Problèmes résolus

1. **Erreur 413 (Payload Too Large)** : Les routes peuvent maintenant accepter des payloads jusqu'à 200 MB
2. **Timeouts sur AjouterProduitSimple** : La limite de taille était trop basse, causant des rejets avant traitement
3. **Cohérence** : Toutes les limites sont maintenant alignées avec le frontend (200 MB) et nginx (500 MB)

## 📝 Notes importantes

### Limitations Axum
- `DefaultBodyLimit` doit être configuré **sur chaque route** individuellement
- Le middleware global `request_size_limit` vérifie avant le traitement Axum
- Si les deux sont configurés, Axum vérifie en premier

### Compatibilité
- ✅ Frontend Express : 200 MB (`express.json({ limit: '200mb' })`)
- ✅ Nginx : 500 MB (`client_max_body_size 500M`)
- ✅ Backend Rust : 200 MB (middleware + routes)

### Prochaines optimisations recommandées

1. **Traitement parallèle des images** : Optimiser `save_product_media` pour traiter les images en parallèle avec `FuturesUnordered`
2. **Timeouts adaptatifs** : Augmenter les timeouts pour les routes qui gèrent des données volumineuses
3. **Compression** : Implémenter la compression automatique des images base64 côté client avant upload

## 🔍 Vérifications

Pour tester les limites, vérifier les logs :
- `[request_size_limit] ✅ Taille requête acceptée` : Requête acceptée
- `[request_size_limit] ❌ Taille de requête dépassée` : Requête rejetée

## 📚 Fichiers modifiés

1. `backend/src/middlewares/request_size_limit.rs`
2. `backend/src/routers/router_yukpo.rs`
3. `backend/src/routes/upload_routes.rs`

