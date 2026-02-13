# ⚡ Optimiser le Temps de Démarrage du Backend

## ⏱️ Pourquoi ça Prend Plusieurs Minutes ?

Le démarrage peut prendre plusieurs minutes à cause de :

1. **Initialisation du Pool de Connexions** :
   - Pool minimum : 20 connexions (configuré dans `start-cloud.sh`)
   - Chaque connexion doit être établie avec RDS
   - Timeout d'acquisition : 30 secondes par connexion

2. **Application des Migrations Automatiques** :
   - Si `ENABLE_AUTO_MIGRATIONS=true`, toutes les migrations sont appliquées
   - Création de tables, index, fonctions, etc.
   - Peut prendre 2-5 minutes selon le nombre de migrations

3. **Vérifications de Base de Données** :
   - Vérification de l'existence des tables
   - Vérification des index critiques
   - Initialisation des fonctions PostgreSQL

4. **Connexion Redis** :
   - Tentatives de connexion avec timeout
   - 3 tentatives × 3 secondes = 9 secondes max

## ✅ Solutions pour Accélérer

### Option 1 : Réduire le Pool Minimum (Recommandé pour Démarrage)

Modifiez `backend/scripts/start-cloud.sh` :

```bash
# Au lieu de 20 connexions minimum, utiliser 5 pour le démarrage
export DB_POOL_MIN_SIZE=${DB_POOL_MIN_SIZE:-5}
```

Cela réduira le temps d'initialisation de ~60 secondes à ~15 secondes.

### Option 2 : Réduire le Timeout d'Acquisition

```bash
# Réduire de 30s à 15s
export DB_ACQUIRE_TIMEOUT_SECS=${DB_ACQUIRE_TIMEOUT_SECS:-15}
```

### Option 3 : Désactiver Temporairement les Migrations Automatiques

Si les migrations prennent trop de temps, vous pouvez les appliquer manuellement :

1. **Désactiver dans AWS Secrets Manager** :
   - Modifier `ENABLE_AUTO_MIGRATIONS=false`

2. **Appliquer les migrations manuellement** :
   - Via script PowerShell ou depuis l'instance EC2

### Option 4 : Optimiser les Migrations

Vérifiez que les migrations sont optimisées :
- Index créés en parallèle si possible
- Pas de migrations redondantes
- Utilisation de `IF NOT EXISTS` pour éviter les erreurs

## 📊 Temps Typiques

- **Pool de connexions (20 connexions)** : ~60-90 secondes
- **Migrations automatiques** : 2-5 minutes (selon nombre)
- **Vérifications** : ~10-30 secondes
- **Total** : 3-7 minutes pour un premier démarrage

## 🔍 Vérification

Pour voir où le temps est passé, vérifiez les logs avec timestamps :

```bash
aws logs tail /ecs/yukpo-backend --follow --region eu-west-1 | grep -E "Connexion|Pool|Migration|Démarrage"
```

## 💡 Recommandation

Pour un démarrage plus rapide :
1. Réduire `DB_POOL_MIN_SIZE` à 5
2. Garder `DB_ACQUIRE_TIMEOUT_SECS` à 30 (sécurisé)
3. Laisser les migrations automatiques (elles ne s'exécutent qu'une fois)

Le pool s'agrandira automatiquement jusqu'à 100 connexions selon la charge.

