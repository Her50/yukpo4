# 🧪 Guide de Test du Nouveau Parsing SQL

**Date** : 2026-02-14  
**Objectif** : Tester les améliorations du parsing SQL dans `auto_migrate.rs`

---

## 📋 Prérequis

1. ✅ Améliorations du parsing SQL effectuées (Tâche 1)
2. ✅ Corrections SQL exécutées (Tâche 2)
3. ✅ Vérifications des migrations manuelles effectuées (Tâche 3)
4. ✅ Accès à AWS ECS et CloudWatch

---

## 🔧 Étapes de Test

### Étape 1 : Activer Temporairement les Auto-Migrations

**Sur AWS ECS** :

1. Se connecter à la console AWS ECS
2. Aller dans le cluster `yukpo-cluster`
3. Sélectionner le service `yukpo-backend-service`
4. Modifier la tâche (Task Definition)
5. Ajouter/modifier la variable d'environnement :
   - **Nom** : `ENABLE_AUTO_MIGRATIONS`
   - **Valeur** : `true`

**OU via AWS CLI** :

```bash
aws ecs update-service \
    --cluster yukpo-cluster \
    --service yukpo-backend-service \
    --task-definition yukpo-backend:XX \
    --force-new-deployment
```

**Note** : Vérifier dans le code backend où cette variable est utilisée pour activer les auto-migrations.

---

### Étape 2 : Redémarrer le Backend

**Sur AWS ECS** :

1. Forcer un nouveau déploiement du service
2. Attendre que les nouvelles tâches soient en cours d'exécution
3. Vérifier que le service est stable

**OU via AWS CLI** :

```bash
aws ecs update-service \
    --cluster yukpo-cluster \
    --service yukpo-backend-service \
    --force-new-deployment
```

---

### Étape 3 : Vérifier les Logs PostgreSQL

**Sur AWS CloudWatch** :

1. Aller dans CloudWatch Logs
2. Sélectionner le groupe de logs PostgreSQL (RDS)
3. Filtrer les logs pour les erreurs :
   - Rechercher : `syntax error at end of input`
   - Période : Dernières 30 minutes

**Commandes AWS CLI** :

```bash
# Lister les groupes de logs
aws logs describe-log-groups --log-group-name-prefix "/aws/rds"

# Voir les logs récents
aws logs tail /aws/rds/instance/yukpo-db/postgresql \
    --since 30m \
    --filter-pattern "syntax error at end of input"
```

**Résultat attendu** :
- ✅ Moins d'erreurs `syntax error at end of input`
- ✅ Les erreurs restantes sont mieux loggées avec plus de contexte

---

### Étape 4 : Vérifier les Logs Backend

**Sur AWS CloudWatch** :

1. Aller dans CloudWatch Logs
2. Sélectionner le groupe de logs du backend ECS
3. Filtrer les logs pour les erreurs :
   - Rechercher : `[MIGRATION] Fragment de commande détecté`
   - Rechercher : `syntax error at end of input`

**Commandes AWS CLI** :

```bash
# Voir les logs récents du backend
aws logs tail /ecs/yukpo-backend-service \
    --since 30m \
    --filter-pattern "[MIGRATION]"
```

**Résultat attendu** :
- ✅ Les erreurs apparaissent en `error!` (niveau ERROR) au lieu de `warn!`
- ✅ Plus de contexte dans les messages d'erreur (longueur, type, parenthèses)
- ✅ Les erreurs sont visibles dans CloudWatch

---

### Étape 5 : Vérifier les Tables Créées

**Sur PostgreSQL** :

```sql
-- Vérifier que les tables critiques sont créées
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'property_views',
    'property_shares',
    'family_profiles',
    'recipes',
    'menu_plans',
    'delivery_chat_messages',
    'videos',
    'user_preferences'
)
ORDER BY table_name;
```

**Résultat attendu** :
- ✅ Toutes les tables critiques sont créées
- ✅ Aucune table dupliquée

---

### Étape 6 : Vérifier les Index Créés

**Sur PostgreSQL** :

```sql
-- Vérifier que les index critiques sont créés
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname IN (
    'idx_offres_date_limite',
    'idx_property_views_user_id',
    'idx_delivery_chat_messages_delivery_id',
    'idx_videos_user_id'
)
ORDER BY indexname;
```

**Résultat attendu** :
- ✅ Tous les index critiques sont créés
- ✅ Aucun index dupliqué

---

### Étape 7 : Vérifier les Fonctions Créées

**Sur PostgreSQL** :

```sql
-- Vérifier que les fonctions critiques sont créées
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'run_audio_cache_cleanup',
    'update_user_documents_updated_at',
    'refresh_services_search_optimized'
)
ORDER BY routine_name;
```

**Résultat attendu** :
- ✅ Toutes les fonctions critiques sont créées

---

### Étape 8 : Désactiver les Auto-Migrations (si nécessaire)

**Sur AWS ECS** :

1. Modifier la variable d'environnement :
   - **Nom** : `ENABLE_AUTO_MIGRATIONS`
   - **Valeur** : `false`

2. Forcer un nouveau déploiement

**OU via AWS CLI** :

```bash
aws ecs update-service \
    --cluster yukpo-cluster \
    --service yukpo-backend-service \
    --task-definition yukpo-backend:XX \
    --force-new-deployment
```

---

## 📊 Critères de Succès

### ✅ Parsing SQL Amélioré

- [ ] Moins de 10 erreurs `syntax error at end of input` dans les logs PostgreSQL (au lieu de ~95)
- [ ] Les erreurs restantes sont mieux loggées avec plus de contexte
- [ ] Les erreurs apparaissent en `error!` dans les logs backend

### ✅ Tables Créées

- [ ] Toutes les tables critiques sont créées
- [ ] Aucune table dupliquée
- [ ] Aucune erreur de création de table

### ✅ Index Créés

- [ ] Tous les index critiques sont créés
- [ ] Aucun index dupliqué
- [ ] Aucune erreur de création d'index

### ✅ Fonctions Créées

- [ ] Toutes les fonctions critiques sont créées
- [ ] Aucune erreur de création de fonction

---

## 🚨 Points d'Attention

### ⚠️ Ne Pas Faire

1. **Ne pas laisser les auto-migrations activées** en production si elles causent des problèmes
2. **Ne pas ignorer les erreurs** même si elles sont "bénignes"
3. **Ne pas déployer** sans avoir testé localement d'abord

### ✅ À Faire

1. **Tester localement** avec des migrations complexes avant de déployer
2. **Vérifier les logs** après chaque correction
3. **Documenter** les changements apportés
4. **Commiter** les changements avec des messages clairs

---

## 📝 Checklist de Test

- [ ] Auto-migrations activées temporairement
- [ ] Backend redémarré
- [ ] Logs PostgreSQL vérifiés (moins d'erreurs)
- [ ] Logs backend vérifiés (erreurs mieux loggées)
- [ ] Tables critiques créées
- [ ] Index critiques créés
- [ ] Fonctions critiques créées
- [ ] Auto-migrations désactivées (si nécessaire)
- [ ] Résultats documentés

---

## 🔗 Fichiers de Référence

- `backend/src/migrations/auto_migrate.rs` - Code amélioré
- `CORRECTIONS_EFFECTUEES_LOG_58.md` - Résumé des corrections
- `PROMPT_CONTINUATION_SESSION_POSTGRES.md` - Contexte initial

---

**Date de création** : 2026-02-14  
**Dernière mise à jour** : 2026-02-14  
**Statut** : Guide prêt pour les tests



