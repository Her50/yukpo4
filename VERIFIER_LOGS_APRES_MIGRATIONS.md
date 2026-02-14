# 🔍 Vérifier les Logs Après les Migrations

**Date**: 2026-02-13  
**Statut**: ✅ Service ECS redémarré avec succès

---

## ✅ **RÉSUMÉ**

- ✅ **255 tables** créées
- ✅ **1,624 index** créés
- ✅ **1,212 fonctions** créées
- ✅ **Toutes les extensions** installées (uuid-ossp, pgvector, postgis, pg_trgm, unaccent)
- ✅ **Service ECS redémarré** avec succès

---

## 🔍 **VÉRIFIER LES LOGS**

### Option 1: Via AWS Console (Recommandé)

1. **Allez dans AWS Console** → **CloudWatch** → **Log groups**
2. **Sélectionnez**: `/ecs/yukpo-backend`
3. **Cliquez sur le log stream le plus récent** (celui avec la date/heure la plus récente)
4. **Vérifiez les logs** pour voir si l'application démarre correctement

### Option 2: Via AWS CLI (Depuis votre machine locale)

```bash
# 1. Récupérer le nom du log stream le plus récent
aws logs describe-log-streams \
  --log-group-name /ecs/yukpo-backend \
  --order-by LastEventTime \
  --descending \
  --max-items 1 \
  --region eu-west-1 \
  --query 'logStreams[0].logStreamName' \
  --output text

# 2. Récupérer les logs (remplacez STREAM_NAME par le résultat de la commande précédente)
aws logs get-log-events \
  --log-group-name /ecs/yukpo-backend \
  --log-stream-name STREAM_NAME \
  --region eu-west-1 \
  --limit 100 \
  --query 'events[*].message' \
  --output text
```

---

## ✅ **LOGS ATTENDUS**

Vous devriez maintenant voir dans les logs :

### ✅ **Démarrage du Script**
```
🚀 Démarrage de Yukpomnang Backend - AWS Cloud...
🔍 Vérification de la connectivité à la base de données AWS RDS...
✅ Base de données AWS RDS accessible
✅ Vérification Redis terminée, continuation du script...
🔍 Point de contrôle: Avant lancement de l'exécutable
🔍 Point de contrôle: Lancement de ./yukpomnang_backend maintenant...
```

### ✅ **Démarrage de l'Application Rust**
```
[MAIN] 🚀 Application Rust démarre - Point d'entrée atteint
[MAIN] 🔍 Vérification des variables d'environnement...
[MAIN] ✅ Connexion PostgreSQL établie
[MAIN] ✅ Pool PostgreSQL créé avec succès
[MAIN] ✅ Migrations SQLx appliquées avec succès (ou déjà appliquées)
[MAIN] ✅ Application démarrée avec succès
```

### ❌ **PAS d'erreur de migration**
- ❌ **PAS** de `relation "merchant_storage_locations" does not exist`
- ❌ **PAS** de `relation "users" does not exist`
- ❌ **PAS** de `relation "services" does not exist`
- ❌ **PAS** de `relation "deliveries" does not exist`

---

## 🎯 **RÉSULTAT ATTENDU**

Si tout fonctionne correctement :
- ✅ L'application démarre sans erreur
- ✅ Les health checks réussissent
- ✅ Le service ECS reste en état "RUNNING"
- ✅ L'application répond aux requêtes HTTP

---

## 🔧 **SI DES ERREURS PERSISTENT**

Si vous voyez encore des erreurs :
1. **Copiez les logs complets** (les 50-100 dernières lignes)
2. **Analysez les erreurs** spécifiques
3. **Vérifiez que toutes les migrations ont bien été appliquées** :
   ```bash
   psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM _sqlx_migrations;"
   ```

---

**Vérifiez les logs via AWS Console et confirmez que l'application démarre correctement !**

