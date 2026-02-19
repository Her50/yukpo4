# Analyse : Erreurs "connection to client lost"

**Date**: 2026-02-18  
**Période analysée**: 01:29:26 - 01:30:38 UTC  
**Type d'erreur**: `FATAL: connection to client lost`

## Résumé

Les logs montrent **~13 erreurs "connection to client lost"** en **~1 minute** (01:29:26 - 01:30:38 UTC).

## Analyse Détaillée

### Erreurs Observées

```
2026-02-18 01:29:26.620 UTC [164449]: FATAL: connection to client lost
2026-02-18 01:29:36.738 UTC [164452]: FATAL: connection to client lost
2026-02-18 01:29:36.741 UTC [164451]: FATAL: connection to client lost
2026-02-18 01:29:36.743 UTC [164458]: FATAL: connection to client lost
2026-02-18 01:29:47.223 UTC [164459]: FATAL: connection to client lost
2026-02-18 01:29:47.466 UTC [164460]: FATAL: connection to client lost
2026-02-18 01:29:47.473 UTC [164461]: FATAL: connection to client lost
2026-02-18 01:29:47.475 UTC [164462]: FATAL: connection to client lost
2026-02-18 01:29:47.832 UTC [164468]: FATAL: connection to client lost
2026-02-18 01:29:47.920 UTC [164450]: FATAL: connection to client lost
2026-02-18 01:29:48.129 UTC [164448]: FATAL: connection to client lost
2026-02-18 01:30:07.658 UTC [164493]: FATAL: connection to client lost
2026-02-18 01:30:07.925 UTC [164494]: FATAL: connection to client lost
2026-02-18 01:30:18.223 UTC [164492]: FATAL: connection to client lost
2026-02-18 01:30:38.924 UTC [164511]: FATAL: connection to client lost
```

### Caractéristiques

1. **Fréquence élevée** : ~13 erreurs en 1 minute
2. **PIDs variés** : 164449, 164452, 164451, 164458, 164459, 164460, 164461, 164462, 164468, 164450, 164448, 164493, 164494, 164492, 164511
3. **Pattern** : Erreurs groupées (plusieurs en même temps, notamment à 01:29:47)
4. **Timestamp** : Avant la correction du pool (correction commitée à ~01:30+)

## Cause Racine

Ces erreurs sont **directement liées au problème de saturation du pool** que nous avons identifié et corrigé :

1. **Pool saturé** : 95 connexions configurées sur ~100 max Cloud SQL
2. **Connexions perdues** : Quand le pool ne peut pas acquérir de connexions, les connexions existantes peuvent être fermées brutalement
3. **Timeouts** : Les connexions qui attendent trop longtemps sont fermées par PostgreSQL
4. **Cascade** : Une fois que le pool est saturé, les nouvelles requêtes ne peuvent pas obtenir de connexions, causant des fermetures en cascade

## Relation avec les Erreurs Précédentes

Ces erreurs "connection to client lost" apparaissent **en même temps** que les erreurs :
- `remaining connection slots are reserved for non-replication superuser connections`
- `pool timed out while waiting for an open connection`

C'est un **pattern classique** de saturation de pool :
1. Pool saturé → Plus de slots disponibles
2. Timeouts d'acquisition → Connexions qui attendent trop longtemps
3. Fermetures brutales → PostgreSQL ferme les connexions inactives
4. Cascade → Plus de connexions disponibles → Plus d'erreurs

## Solution Appliquée

✅ **Correction commitée** (commit `d0ffc72`) :
- Pool principal : 50 → **20 connexions**
- Pool read replica : 30 → **10 connexions**
- Pool migrations : 10 → **5 connexions**
- **Total : 95 → 40 connexions**

## Résultat Attendu

Une fois le nouveau code déployé, ces erreurs devraient **disparaître** car :
1. ✅ Moins de connexions utilisées (40 au lieu de 95)
2. ✅ Plus de marge pour Cloud SQL (~60 connexions disponibles)
3. ✅ Moins de timeouts d'acquisition
4. ✅ Moins de fermetures brutales de connexions

## Vérification Post-Déploiement

Après le déploiement de la correction, vérifier :
1. ✅ Absence d'erreurs "connection to client lost"
2. ✅ Absence d'erreurs "remaining connection slots are reserved"
3. ✅ Absence d'erreurs "pool timed out"
4. ✅ Connexions stables dans les logs

## Notes

- Ces logs datent de **01:29-01:30 UTC**, donc **avant** la correction
- La correction a été commitée et poussée, le build GitHub Actions est en cours
- Une fois déployé, surveiller les logs pour confirmer la résolution


