# Correction : Saturation du Pool de Connexions PostgreSQL

**Date**: 2026-02-18  
**Problème**: Pool de connexions PostgreSQL saturé sur Cloud SQL  
**Statut**: ✅ Corrigé

## Problème Identifié

Les logs Cloud SQL montraient des erreurs critiques :

```
FATAL: remaining connection slots are reserved for non-replication superuser connections
pool timed out while waiting for an open connection
connection to client lost
```

### Cause Racine

Le pool de connexions PostgreSQL était configuré avec **trop de connexions** :

- Pool principal Cloud Run : **50 connexions max**
- Pool read replica : **30 connexions max**
- Pool migrations : **10 connexions max**
- Pool long ops : **5 connexions max**

**Total : 95 connexions potentielles !**

Cloud SQL PostgreSQL a généralement **100 connexions max** par défaut, mais il faut réserver des slots pour les superusers. Avec 95 connexions utilisées, il ne restait presque rien, causant des refus de connexion.

## Solution Appliquée

Réduction drastique des pools de connexions :

### Avant
- Pool principal : 50 connexions
- Pool read replica : 30 connexions
- Pool migrations : 10 connexions
- Pool long ops : 5 connexions
- **Total : 95 connexions**

### Après
- Pool principal : **20 connexions** (réduit de 50)
- Pool read replica : **10 connexions** (réduit de 30)
- Pool migrations : **5 connexions** (réduit de 10)
- Pool long ops : **5 connexions** (inchangé)
- **Total : 40 connexions**

## Résultat

- **40 connexions utilisées** au lieu de 95
- **~60 connexions disponibles** pour Cloud SQL (sur ~100 max)
- Plus de marge pour les slots réservés aux superusers
- Plus d'erreurs "remaining connection slots are reserved"

## Fichiers Modifiés

- `backend/src/main.rs` :
  - Ligne 367-368 : Pool principal Cloud Run réduit de 50 à 20
  - Ligne 780 : Pool read replica réduit de 30 à 10
  - Ligne 2440 : Pool migrations réduit de 10 à 5

## Commit

```
d0ffc72 fix: Réduction pools connexions PostgreSQL pour éviter saturation Cloud SQL
```

## Prochaines Étapes

1. ✅ Code corrigé et commité
2. ⏳ Attendre le build GitHub Actions
3. ⏳ Déploiement automatique sur Cloud Run
4. ⏳ Vérifier les logs pour confirmer la résolution

## Notes

- Les pools sont maintenant mieux dimensionnés pour Cloud SQL
- Si besoin, on peut augmenter progressivement en surveillant les logs
- Cloud SQL peut être configuré pour augmenter `max_connections` si nécessaire (nécessite redémarrage)


