# 📋 Plan de Division du Fichier Consolidé

**Fichier source** : `backend/migrations/0000_create_all_tables.sql` (5638 lignes)

## 🎯 Objectif

Diviser le fichier consolidé en fichiers de migration plus petits et logiques pour :
- ✅ Éviter les problèmes de parsing
- ✅ Utiliser SQLx standard (`sqlx::migrate!()`)
- ✅ Améliorer la traçabilité
- ✅ Faciliter la maintenance

## 📁 Structure Proposée

### 1. Extensions PostgreSQL
**Fichier** : `00000001_create_extensions.sql` ✅ CRÉÉ
- Extensions de base (uuid-ossp, pg_trgm, unaccent, pgcrypto, postgis)
- Extension pgvector (avec gestion d'erreur)

### 2. Tables de Base
**Fichier** : `00000002_create_base_tables.sql` (à créer)
- `users` (lignes 37-60)
- `user_documents` (lignes 63-109)
- `services` (lignes 112-128)
- `media` (lignes 131-195)
- `google_places_data` (lignes 199-252)
- Index et triggers associés

### 3. Tables Utilitaires
**Fichier** : `00000003_create_utility_tables.sql` (à créer)
- `consultation_historique` (lignes 255-260)
- `token_packs` (lignes 263-269)
- `service_logs` (lignes 272-280)

### 4. Tables de Paiement
**Fichier** : `00000004_create_payment_tables.sql` (à créer)
- `payment_transactions` (lignes 283-295)
- `token_transactions` (lignes 298-308)
- Index associés (lignes 311-315)

### 5. Tables Autocomplete
**Fichier** : `00000005_create_autocomplete_tables.sql` (à créer)
- `autocomplete_characteristics` (lignes 320-400)
- `autocomplete_combinations` (lignes 404-472)
- Index associés

### 6. Tables Produits
**Fichier** : `00000006_create_product_tables.sql` (à créer)
- `service_products` (lignes 477-548)
- `products_lifecycle` (lignes 551-586)
- Index et triggers associés

### 7. Tables Reviews et Réactions
**Fichier** : `00000007_create_review_tables.sql` (à créer)
- `service_reviews` (lignes 591+)
- `product_reactions` (lignes 622+)
- `product_comments` (lignes 665+)
- Index associés

### 8. Tables de Livraison
**Fichier** : `00000008_create_delivery_tables.sql` (à créer)
- Tables de livraison (lignes ~2000-3000)
- Index associés

### 9. Tables Spécialisées
**Fichier** : `00000009_create_specialized_services_tables.sql` (à créer)
- `pharmacies` (ligne 3024+)
- `hopitaux_cliniques` (ligne 3058+)
- `laboratoires_imagerie` (ligne 3093+)
- Autres services spécialisés
- Index associés

### 10. Fonctions SQL
**Fichier** : `00000010_create_functions.sql` (à créer)
- Fonctions de désactivation produits (ligne 1142+)
- Fonctions de publicités (ligne 1189+)
- Autres fonctions SQL
- Triggers associés

### 11. Index et Optimisations
**Fichier** : `00000011_create_indexes_and_optimizations.sql` (à créer)
- Index supplémentaires
- Optimisations (ligne 5557+)
- ANALYZE statements

## ⚠️ Notes Importantes

1. **Ordre d'exécution** : Les fichiers sont numérotés pour respecter les dépendances
2. **Dépendances** :
   - `users` doit être créé avant `services`
   - `services` doit être créé avant `media`
   - `services` doit être créé avant toutes les tables spécialisées
3. **Fonctions** : Les fonctions peuvent référencer des tables, donc elles doivent être créées après les tables
4. **Index** : Les index peuvent être créés après les tables, mais certains sont créés avec les tables

## 🚀 Prochaines Étapes

1. ✅ Créer `00000001_create_extensions.sql`
2. ⏳ Créer les autres fichiers de migration
3. ⏳ Tester l'exécution avec SQLx
4. ⏳ Mettre à jour `auto_migrate.rs` pour utiliser les nouveaux fichiers
5. ⏳ Supprimer ou archiver `0000_create_all_tables.sql`



