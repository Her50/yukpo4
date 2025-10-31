# 🔧 Instructions pour Résoudre l'Erreur d'Index PostgreSQL

## ❌ Erreur Actuelle
```
error returned from database: index row requires 416920 bytes, maximum size is 8191
```

## 📌 Cause
L'index `idx_services_products_gin` essaie d'indexer des images base64 dans le champ `data->'produits'`, ce qui dépasse la limite PostgreSQL de 8 KB.

## ✅ Solution (3 étapes)

### Étape 1 : Connexion à votre base Render

```bash
# Récupérez votre DATABASE_URL depuis Render Dashboard
# Puis connectez-vous via psql

psql postgresql://user:password@host:port/database
```

**Alternative** : Utilisez l'interface Web de Render :
1. Allez sur Render Dashboard
2. Sélectionnez votre base PostgreSQL
3. Cliquez sur "Connect" → "External Connection" → "PSQL Command"
4. Copiez et exécutez la commande dans votre terminal

### Étape 2 : Exécuter les Commandes SQL

Copiez-collez ces commandes dans psql :

```sql
-- Supprimer les index problématiques
DROP INDEX IF EXISTS idx_services_products_gin;
DROP INDEX IF EXISTS idx_services_products_type;

-- Nettoyer l'espace libéré
VACUUM ANALYZE services;

-- Vérifier que les index sont supprimés
\di idx_services_products*

-- Quitter
\q
```

### Étape 3 : Redémarrer votre Application

Sur Render, déclenchez un nouveau déploiement :
- Via l'interface : Dashboard → Manual Deploy
- Via Git : `git push origin main` (si déploiement automatique activé)

## 🎯 Résultat Attendu

Après ces étapes :
- ✅ Création de services fonctionne (même avec beaucoup d'images)
- ✅ Les images sont stockées dans la table `media`
- ✅ Le JSON `data` contient seulement les métadonnées
- ✅ Pas de limite sur le nombre d'images/vidéos

## 🔍 Vérification

Testez la création d'un service avec plusieurs images depuis votre app mobile.

## ❓ Besoin d'Aide ?

Si vous ne pouvez pas accéder à psql, vous pouvez :
1. Utiliser l'interface SQL de Render (Dashboard → votre DB → Query)
2. Demander à Render Support d'exécuter la migration
3. Créer un endpoint admin temporaire qui exécute la migration

## 📊 Architecture Actuelle (Post-Fix)

```
┌─────────────────────┐
│   Table: services   │
│                     │
│ data (JSONB)        │  ← Métadonnées seulement (nom, prix, description)
│  - produits[]       │     Pas d'images base64 ici !
│    - nom            │
│    - prix           │
│    - description    │
│    - images_refs[]  │  ← Références vers table media
└─────────────────────┘
         │
         │ References (service_id)
         ▼
┌─────────────────────┐
│   Table: media      │
│                     │
│ id                  │
│ service_id          │
│ type (image/video)  │
│ path                │  ← Image base64 stockée ici (ILLIMITÉ)
│ image_signature     │
│ image_hash          │
└─────────────────────┘
```

## 🎉 Avantages

- **Stockage illimité** : Autant d'images que vous voulez
- **Performance** : Index optimisés sur les métadonnées
- **Recherche** : Full-text search sur noms/descriptions
- **Recherche d'images** : Signatures pour la recherche visuelle

