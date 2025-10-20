# Migration : Fonction deactivate_expired_products()

## ⚠️ PROBLÈME DÉTECTÉ

Le serveur fonctionne mais affiche cette erreur au démarrage :
```
❌ Erreur désactivation produits: function deactivate_expired_products() does not exist
```

## 📋 SOLUTION

La fonction existe dans la migration `20250119_002_product_lifecycle_management.sql` mais n'a pas été exécutée sur la base de données Render.

## 🚀 EXÉCUTION DE LA MIGRATION

### Option 1 : Via le Dashboard Render (Recommandé)

1. Allez sur [Render Dashboard](https://dashboard.render.com)
2. Sélectionnez votre **PostgreSQL database**
3. Cliquez sur **Connect** → **External Connection**
4. Copiez la **Connection String**
5. Utilisez un client PostgreSQL (DBeaver, pgAdmin, ou psql) :

```bash
psql "CONNECTION_STRING" < backend/migrations/20251020_add_deactivate_expired_products_function.sql
```

### Option 2 : Via Shell Render

1. Dans votre service Backend sur Render
2. Allez dans **Shell**
3. Exécutez :

```bash
psql $DATABASE_URL < /opt/render/project/src/backend/migrations/20251020_add_deactivate_expired_products_function.sql
```

### Option 3 : Manuellement via SQL

Connectez-vous à votre base de données et exécutez le contenu du fichier `backend/migrations/20251020_add_deactivate_expired_products_function.sql`

## ✅ VÉRIFICATION

Après l'exécution, vérifiez que la fonction existe :

```sql
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'deactivate_expired_products';
```

Devrait retourner une ligne.

## 🎯 IMPACT

Cette fonction est appelée automatiquement par le CRON Job toutes les heures pour :
- Désactiver les produits dont la date `auto_deactivate_at` est dépassée
- Permettre aux prestataires de les réactiver moyennant 1000 FCFA par produit

### Fonctionnalités activées :

1. **Désactivation automatique** : Produits désactivés après 30 jours
2. **Réactivation payante** : 1000 FCFA par produit
3. **Tracking** : Compteur de désactivations et montant total payé
4. **Notifications** : Alertes aux prestataires avant désactivation

## 📊 Tables créées

La migration crée également la table `products_lifecycle` si elle n'existe pas :

```sql
CREATE TABLE products_lifecycle (
    id SERIAL PRIMARY KEY,
    service_id INTEGER REFERENCES services(id),
    product_index INTEGER NOT NULL,
    product_nom TEXT NOT NULL,
    product_type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    auto_deactivate_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    reactivation_cost INTEGER DEFAULT 1000,
    deactivation_count INTEGER DEFAULT 0,
    total_reactivation_paid INTEGER DEFAULT 0,
    ...
);
```

## 🔄 SANS CETTE FONCTION

Le serveur fonctionne normalement **SANS** cette fonction, mais :
- ❌ Pas de désactivation automatique des produits
- ❌ Pas de gestion du cycle de vie des produits
- ❌ Les produits restent actifs indéfiniment

## 📝 NOTES

- La fonction est **SAFE** à exécuter plusieurs fois (`CREATE OR REPLACE`)
- Elle ne modifie pas les données existantes
- Elle ne ralentit pas le serveur
- Elle est appelée une fois par heure par le CRON

## 🎉 APRÈS LA MIGRATION

Une fois exécutée, le message d'erreur disparaîtra au prochain redémarrage du serveur.

Vous pouvez redémarrer manuellement :
```bash
# Via Render Dashboard
Service → Manual Deploy → Deploy latest commit
```

---

**Date** : 2025-10-20  
**Priority** : MOYENNE (fonctionnalité importante mais non-bloquante)  
**Status** : Migration prête, attente exécution en production

