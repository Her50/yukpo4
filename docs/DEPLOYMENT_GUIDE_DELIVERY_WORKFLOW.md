# 🚀 Guide de Déploiement : Améliorations Workflow de Livraison

## Vue d'ensemble

Ce guide décrit les étapes nécessaires pour déployer les améliorations du workflow de livraison en production.

---

## 📋 Prérequis

### Backend
- ✅ Rust 1.70+ installé
- ✅ PostgreSQL 14+ avec extensions :
  - `pgvector` (pour recherche vectorielle)
  - `imgsmlr` (pour recherche d'images)
- ✅ SQLx CLI installé (`cargo install sqlx-cli`)
- ✅ Variables d'environnement configurées
- ✅ Accès à la base de données de production

### Frontend
- ✅ Node.js 18+ installé
- ✅ npm ou yarn installé
- ✅ Variables d'environnement configurées
- ✅ Accès au service de build (Netlify, Vercel, etc.)

### Mobile
- ✅ Expo CLI installé (`npm install -g expo-cli`)
- ✅ EAS CLI installé (`npm install -g eas-cli`)
- ✅ Compte Expo configuré
- ✅ Variables d'environnement configurées

---

## 🔧 Configuration Backend

### 1. Variables d'Environnement

Ajouter/modifier dans `.env` ou variables d'environnement du serveur :

```bash
# Base de données
DATABASE_URL=postgresql://user:password@host:port/database

# SQLx Offline Mode (pour compilation sans DB)
SQLX_OFFLINE=true

# Redis (optionnel, pour WebSocket)
REDIS_URL=redis://host:port/0

# MongoDB (optionnel)
MONGODB_URL=mongodb://host:port/database

# Autres variables existantes...
```

### 2. Migrations Base de Données

#### Étape 1 : Préparer les migrations

```bash
cd backend

# Vérifier que les migrations existent
ls migrations/20250120_*.sql

# Vérifier que auto_migrate.rs contient les fonctions
grep -r "ensure_order_preparation_system" src/migrations/
grep -r "ensure_product_stock_management" src/migrations/
grep -r "ensure_courier_verification_system" src/migrations/
```

#### Étape 2 : Appliquer les migrations

**Option A : Via SQLx CLI (Recommandé)**

```bash
# Se connecter à la base de production
export DATABASE_URL="postgresql://user:password@host:port/database"

# Vérifier l'état des migrations
sqlx migrate info

# Appliquer les migrations
sqlx migrate run

# Vérifier que les tables sont créées
psql $DATABASE_URL -c "\dt" | grep -E "(product_delivery_config|product_orders|order_cancellations|product_cancellation_stats|category_preparation_stats|product_stock_locations|stock_reservations|courier_verification_codes)"
```

**Option B : Via auto_migrate.rs (Automatique au démarrage)**

Les migrations s'appliquent automatiquement au démarrage du serveur via `auto_migrate.rs`. Vérifier les logs au démarrage.

#### Étape 3 : Vérifier les index

```sql
-- Vérifier que les index sont créés
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename IN (
  'product_delivery_config',
  'product_orders',
  'order_cancellations',
  'product_cancellation_stats',
  'category_preparation_stats',
  'product_stock_locations',
  'stock_reservations',
  'courier_verification_codes'
);
```

### 3. Régénérer sqlx-data.json

```bash
cd backend

# Se connecter à la base de données
export DATABASE_URL="postgresql://user:password@host:port/database"

# Régénérer les métadonnées SQLx
cargo sqlx prepare -- --lib

# Vérifier que sqlx-data.json est mis à jour
git status sqlx-data.json
```

### 4. Compilation et Tests

```bash
# Compiler le backend
cargo build --release

# Vérifier qu'il n'y a pas d'erreurs
cargo check --lib

# Tests (si disponibles)
cargo test --lib
```

### 5. Déploiement Backend

**Sur Render/Heroku/etc :**

1. **Pousser le code** sur la branche de production
2. **Vérifier les variables d'environnement** dans le dashboard
3. **Déclencher le build** (automatique ou manuel)
4. **Vérifier les logs** au démarrage :
   - Migrations appliquées
   - Tâches périodiques démarrées
   - Serveur démarré sur le port correct

**Sur serveur VPS :**

```bash
# Cloner/pull le code
git pull origin main

# Arrêter le service actuel
sudo systemctl stop yukpomnang-backend

# Compiler
cargo build --release

# Appliquer migrations (si pas fait automatiquement)
export DATABASE_URL="..."
sqlx migrate run

# Redémarrer le service
sudo systemctl start yukpomnang-backend

# Vérifier les logs
sudo journalctl -u yukpomnang-backend -f
```

---

## 🌐 Configuration Frontend

### 1. Variables d'Environnement

Créer/modifier `.env` ou variables dans Netlify/Vercel :

```bash
# API Backend
VITE_API_BASE_URL=https://api.yukpomnang.com

# WebSocket
VITE_WS_BASE_URL=wss://api.yukpomnang.com

# Environnement
VITE_ENVIRONMENT=production
```

### 2. Build Frontend

```bash
cd frontend

# Installer les dépendances
npm install

# Vérifier qu'il n'y a pas d'erreurs TypeScript
npm run type-check  # Si disponible

# Build de production
npm run build

# Vérifier que le build est réussi
ls -la dist/
```

### 3. Déploiement Frontend

**Sur Netlify :**

1. **Connecter le repository** GitHub/GitLab
2. **Configurer les variables d'environnement** dans Netlify Dashboard
3. **Build command** : `npm run build`
4. **Publish directory** : `dist`
5. **Déployer** (automatique ou manuel)

**Sur Vercel :**

1. **Importer le projet**
2. **Configurer les variables d'environnement**
3. **Build command** : `npm run build`
4. **Output directory** : `dist`
5. **Déployer**

**Sur serveur VPS :**

```bash
cd frontend

# Build
npm run build

# Copier vers le serveur web (nginx, etc.)
sudo cp -r dist/* /var/www/yukpomnang/

# Redémarrer nginx
sudo systemctl restart nginx
```

---

## 📱 Configuration Mobile

### 1. Variables d'Environnement

Créer/modifier `mobile/.env` :

```bash
# API Backend
EXPO_PUBLIC_API_BASE_URL=https://api.yukpomnang.com

# WebSocket
EXPO_PUBLIC_WS_BASE_URL=wss://api.yukpomnang.com

# Autres variables...
```

### 2. Vérifier les Services

```bash
cd mobile

# Vérifier que les nouveaux services existent
ls src/services/orderService.ts
ls src/services/productDeliveryService.ts
ls src/services/stockService.ts
ls src/services/notificationSoundService.ts

# Vérifier que les screens existent
ls src/screens/OrderStatusScreen.tsx
ls src/screens/ProviderOrderManagementScreen.tsx

# Vérifier la navigation
grep -r "OrderStatusScreen\|ProviderOrderManagementScreen" src/navigation/
```

### 3. Ajouter les Sons de Notification (Optionnel)

```bash
# Créer le dossier si nécessaire
mkdir -p mobile/src/assets/sounds

# Ajouter les fichiers audio (voir NOTIFICATION_SOUNDS.md)
# - order_notification.mp3
# - courier_assigned.mp3
# - order_ready.mp3
```

### 4. Build Mobile

**Pour Android :**

```bash
cd mobile

# Build avec EAS
eas build --platform android --profile production

# Ou build local
npx expo run:android --variant release
```

**Pour iOS :**

```bash
cd mobile

# Build avec EAS
eas build --platform ios --profile production

# Ou build local (nécessite Mac)
npx expo run:ios --configuration Release
```

### 5. Déploiement Mobile

**Via EAS (Expo Application Services) :**

1. **Configurer eas.json** si nécessaire
2. **Lancer le build** : `eas build --platform all`
3. **Soumission automatique** (si configuré) ou manuelle
4. **Tester** sur TestFlight (iOS) / Internal Testing (Android)

**Via build local :**

1. **Générer l'APK/IPA**
2. **Tester** sur appareils
3. **Soumettre** manuellement aux stores

---

## ✅ Vérifications Post-Déploiement

### 1. Backend

#### Vérifier les Tables

```sql
-- Se connecter à la base de données
psql $DATABASE_URL

-- Vérifier les tables
\dt product_delivery_config
\dt product_orders
\dt order_cancellations
\dt product_cancellation_stats
\dt category_preparation_stats
\dt product_stock_locations
\dt stock_reservations
\dt courier_verification_codes

-- Vérifier les colonnes
\d product_delivery_config
\d product_orders
```

#### Vérifier les Routes API

```bash
# Tester les routes principales
curl -X GET https://api.yukpomnang.com/api/health
curl -X GET https://api.yukpomnang.com/api/provider/1/analytics/orders \
  -H "Authorization: Bearer <token>"
```

#### Vérifier les Tâches Périodiques

```bash
# Vérifier les logs pour voir les tâches démarrées
# Chercher dans les logs :
# - "📊 [StatsRecalculation] Démarrage de la tâche de recalcul des stats de catégories"
# - "📊 [StatsRecalculation] Démarrage de la tâche de recalcul des stats d'annulation"
# - "[OrderTimeoutMonitor] Démarrage du monitor des timeouts"
```

### 2. Frontend

#### Vérifier les Routes

```bash
# Tester les nouvelles pages
curl -I https://yukpomnang.com/similar-products
curl -I https://yukpomnang.com/orders/management
curl -I https://yukpomnang.com/provider/analytics
```

#### Vérifier les Services API

Ouvrir la console du navigateur et vérifier :
- Pas d'erreurs 404 pour les nouveaux endpoints
- Les services API se chargent correctement
- Les composants s'affichent sans erreurs

### 3. Mobile

#### Vérifier les Screens

1. **Tester la navigation** vers les nouveaux screens
2. **Vérifier les appels API** dans les logs
3. **Tester les notifications sonores** (si fichiers audio ajoutés)
4. **Vérifier le polling** temps réel

#### Tests Fonctionnels

- [ ] Créer une commande
- [ ] Voir les badges sur ProductCard
- [ ] Valider/Rejeter une commande (prestataire)
- [ ] Voir les produits similaires
- [ ] Accéder au dashboard analytics

---

## 🔄 Rollback (En cas de problème)

### Backend

#### Option 1 : Rollback Code

```bash
# Revenir à la version précédente
git checkout <commit-precedent>

# Recompiler et redéployer
cargo build --release
# Redémarrer le service
```

#### Option 2 : Désactiver les Nouvelles Routes

Modifier `backend/src/lib.rs` pour commenter les nouvelles routes temporairement.

### Frontend

```bash
# Revenir à la version précédente
git checkout <commit-precedent>

# Rebuild et redéployer
npm run build
# Redéployer sur Netlify/Vercel
```

### Mobile

```bash
# Revenir à la version précédente
git checkout <commit-precedent>

# Rebuild
eas build --platform all
# Redéployer
```

### Base de Données

**⚠️ ATTENTION : Ne pas supprimer les tables en production sans sauvegarde !**

Si nécessaire, créer une migration de rollback :

```sql
-- Migration de rollback (à utiliser avec précaution)
-- Ne pas exécuter en production sans sauvegarde complète !

-- DROP TABLE IF EXISTS courier_verification_codes;
-- DROP TABLE IF EXISTS stock_reservations;
-- DROP TABLE IF EXISTS product_stock_locations;
-- DROP TABLE IF EXISTS product_cancellation_stats;
-- DROP TABLE IF EXISTS order_cancellations;
-- DROP TABLE IF EXISTS product_orders;
-- DROP TABLE IF EXISTS category_preparation_stats;
-- ALTER TABLE product_delivery_config DROP COLUMN IF EXISTS preparation_time_minutes;
-- ALTER TABLE product_delivery_config DROP COLUMN IF EXISTS max_preparation_time_minutes;
-- ALTER TABLE product_delivery_config DROP COLUMN IF EXISTS availability_days;
-- ALTER TABLE product_delivery_config DROP COLUMN IF EXISTS is_immediately_available;
```

---

## 📊 Monitoring Post-Déploiement

### Métriques à Surveiller

1. **Erreurs API** : Taux d'erreur 4xx/5xx
2. **Temps de réponse** : Latence des endpoints
3. **Base de données** : Taille des tables, requêtes lentes
4. **Tâches périodiques** : Vérifier qu'elles s'exécutent
5. **Logs** : Erreurs, warnings

### Alertes à Configurer

- ⚠️ Taux d'erreur > 5%
- ⚠️ Temps de réponse > 1s
- ⚠️ Tâches périodiques non exécutées
- ⚠️ Base de données saturée

---

## 🔍 Checklist de Déploiement

### Avant Déploiement

- [ ] Tous les tests passent
- [ ] Code review effectué
- [ ] Documentation à jour
- [ ] Migrations testées en staging
- [ ] Variables d'environnement configurées
- [ ] Sauvegarde base de données effectuée

### Déploiement Backend

- [ ] Migrations appliquées
- [ ] sqlx-data.json régénéré
- [ ] Code compilé sans erreurs
- [ ] Service redémarré
- [ ] Logs vérifiés
- [ ] Routes API testées

### Déploiement Frontend

- [ ] Build réussi
- [ ] Variables d'environnement configurées
- [ ] Déployé sur Netlify/Vercel
- [ ] Routes testées
- [ ] Console navigateur vérifiée

### Déploiement Mobile

- [ ] Services API vérifiés
- [ ] Screens testés
- [ ] Navigation fonctionnelle
- [ ] Build réussi
- [ ] Testé sur appareils réels

### Post-Déploiement

- [ ] Tables créées vérifiées
- [ ] Routes API fonctionnelles
- [ ] Tâches périodiques démarrées
- [ ] Frontend accessible
- [ ] Mobile fonctionnel
- [ ] Monitoring activé
- [ ] Alertes configurées

---

## 🆘 Dépannage

### Problème : Migrations échouent

**Solution :**
```bash
# Vérifier la connexion à la base
psql $DATABASE_URL -c "SELECT 1"

# Vérifier les permissions
psql $DATABASE_URL -c "SELECT current_user"

# Appliquer manuellement si nécessaire
psql $DATABASE_URL < backend/migrations/20250120_001_add_order_preparation_system.sql
```

### Problème : Compilation SQLx échoue

**Solution :**
```bash
# Vérifier SQLX_OFFLINE=true
echo $SQLX_OFFLINE

# Régénérer sqlx-data.json
cargo sqlx prepare -- --lib

# Vérifier que sqlx-data.json existe
ls -la sqlx-data.json
```

### Problème : Routes API 404

**Solution :**
- Vérifier que les routes sont bien ajoutées dans `lib.rs`
- Vérifier que le serveur a redémarré
- Vérifier les logs pour les erreurs de compilation

### Problème : Tâches périodiques ne démarrent pas

**Solution :**
- Vérifier les logs au démarrage
- Vérifier que `tokio::spawn` est appelé dans `main.rs`
- Vérifier qu'il n'y a pas d'erreurs dans les tâches

---

## 📚 Références

- Documentation API : `docs/API_DELIVERY_WORKFLOW_IMPROVEMENTS.md`
- Guide Utilisateur : `docs/USER_GUIDE_DELIVERY_WORKFLOW.md`
- Guide de Tests : `docs/TESTING_GUIDE_DELIVERY_WORKFLOW.md`
- Résumé Implémentation : `docs/IMPLEMENTATION_SUMMARY_DELIVERY_WORKFLOW.md`
- Guide Migrations SQLx : `backend/README_SQLX.md`

---

## 📞 Support

En cas de problème lors du déploiement :
1. Vérifier les logs
2. Consulter la documentation
3. Vérifier les issues GitHub
4. Contacter l'équipe technique

---

**Dernière mise à jour** : 2025-01-20  
**Version** : 1.0.0

